// The app with its server behind it (docs/decisions.md, 2026-11-15): founded once with the code, people sign in from any
// browser and share one data, each within their rights; nothing of the data stays in a browser; changes reach the
// others; a lost connection and a sign-in ended on the server are both said. The script starts its own server (a
// database in a temporary file, no Timely or OpenRouter keys) and its own preview beside it, and stops them at the end.
//
// Usage: build first (npm run build in web), then
//   node web/scripts/server-flow.cjs
// Or against an address where the app is deployed with an EMPTY database (a test deployment, never the real one: the
// script founds a system there), with that server's set-up code:
//   node web/scripts/server-flow.cjs https://… --code=…
// Needs Playwright with Chromium (already in the cloud container; elsewhere: npm i playwright) and Node 22.5 or newer.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const WEB = path.resolve(__dirname, '..');
const [API, WEBPORT] = [8791, 4175];
const REMOTE = process.argv.slice(2).find(a => /^https?:/.test(a));
const BASE = REMOTE ? REMOTE.replace(/\/?$/, '/') : `http://localhost:${WEBPORT}/`;
const CODE = process.argv.slice(2).find(a => a.startsWith('--code='))?.slice(7) ?? 'test-code-0123-4567-89ab';
/** A deployed address answers from far away: every wait is longer */
const SLOW = REMOTE ? 3 : 1;
let fails = 0;
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function up(url) {
  for (let i = 0; i < 60; i++) {
    if (await fetch(url).then(r => r.status < 500, () => false)) return true;
    await sleep(250);
  }
  return false;
}

(async () => {
  let stop = () => {};
  /** The server's database, when this script can reach it: its own, or ERP_DB given with an address of this computer */
  let dbFile = REMOTE ? process.env.ERP_DB : null;
  if (!REMOTE) {
    const dir = mkdtempSync(path.join(tmpdir(), 'erp-server-flow-'));
    dbFile = path.join(dir, 'erp.sqlite');
    const env = { ...process.env, PORT: String(API), ERP_DB: dbFile, ATTENDANCE_CODE: CODE, ERP_API: `http://localhost:${API}` };
    delete env.TIMELY_API_KEYS; delete env.OPENROUTER_API_KEY;
    const server = spawn('node', ['server/main.ts'], { cwd: WEB, env, stdio: 'ignore' });
    const preview = spawn('npx', ['vite', 'preview', '--port', String(WEBPORT), '--strictPort'], { cwd: WEB, env, stdio: 'ignore', detached: true });
    stop = () => { server.kill(); try { process.kill(-preview.pid) } catch {} rmSync(dir, { recursive: true, force: true }); };
    process.on('exit', stop);
    if (!(await up(`http://localhost:${API}/api/state`)) || !(await up(BASE))) { console.log('FAIL the server or the preview did not start'); process.exit(1); }
  }

  const browser = await chromium.launch();
  const errors = [];
  /** A browser of its own: its own cookies and storage */
  const open = async (name, more = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Ulaanbaatar', ...more });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    p.on('console', m => m.type() === 'error' && !/401|403|409|429|502|503|404|Failed to load resource|net::ERR/.test(m.text()) && errors.push(`${name}: ${m.text().slice(0, 200)}`));
    const wait = ms => p.waitForTimeout(ms * SLOW);
    const x = {
      ctx, p, wait,
      go: async h => { await p.evaluate(v => { location.hash = v }, h); await wait(900); },
      main: () => p.evaluate(() => (document.querySelector('#main') ?? document.body).innerText),
      /** What the server sends this browser's person, afresh: table → records */
      rows: () => p.evaluate(async () => {
        const r = await fetch('/api/sync?since=0&scope=');
        if (!r.ok) return { status: r.status };
        const out = {};
        for (const [c, id, , v] of (await r.json()).rows) (out[c] ??= {})[id] = v;
        return out;
      }),
      /** Asks the server now, instead of waiting for the next round */
      sync: async () => { await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))); await wait(900); },
      signIn: async (login, pass, welcome) => {
        await p.locator('#login-name').fill(login); await p.locator('#login-pass').fill(pass); await p.getByRole('button', { name: 'Нэвтрэх', exact: true }).click();
        if (welcome) { await p.waitForSelector('dialog.welcome[open] .welcome__name', { timeout: 20000 }).catch(() => {}); await wait(1200); }
        else await wait(2500);
      },
      skip: async () => { await p.locator('.welcome__skip').click(); await wait(900); },
      signOut: async () => { await p.locator('.side__me').click(); await wait(300); await p.getByRole('menuitem', { name: 'Гарах' }).click(); await wait(900); },
      stored: () => p.evaluate(() => JSON.stringify({ ...localStorage })),
    };
    return x;
  };
  const invite = async (a, given, family, login, preset) => {
    await a.go('admin'); await a.p.getByRole('button', { name: 'Хэрэглэгч нэмэх' }).first().click(); await a.wait(600);
    await a.p.locator('#inv-given').fill(given); await a.p.locator('#inv-family').fill(family); await a.p.locator('#inv-email').fill(`${login}@turshilt.mn`);
    await a.p.locator('#inv-team').selectOption({ label: 'Шинэ хэлтэс…' }).catch(() => {});
    if (await a.p.locator('#inv-newTeam').count()) await a.p.locator('#inv-newTeam').fill('Борлуулалт');
    await a.p.locator('#inv-login').fill(login); await a.p.locator('#inv-preset').selectOption(preset);
    ok(await a.p.locator('#inv-password').count() === 0, 'with a server, adding someone asks for no password');
    await a.p.getByRole('button', { name: 'Нэмэх', exact: true }).click();
    // The person's sign-in link, to send them: copied in one press
    await a.p.waitForSelector('#sl-url', { timeout: 20000 });
    const url = await a.p.locator('#sl-url').inputValue();
    const hint = await a.p.locator('#sl-url-hint').innerText().catch(() => '');
    await a.p.getByRole('button', { name: 'Хуулах', exact: true }).click(); await a.wait(800);
    const copied = await a.p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    ok(url.startsWith(BASE) && /^#j-[A-Za-z0-9]{12}$/.test(url.slice(BASE.length)) && hint.includes(`«${login}»`) && copied === url && await a.p.locator('#sl-url').count() === 0, 'added, the admin is given a short link to send (#j- and 12 letters and figures), which says the login, and copies it');
    return url;
  };

  // ---- Founding
  const a = await open('admin', { permissions: ['clipboard-read', 'clipboard-write'] });
  await a.p.goto(BASE, { waitUntil: 'networkidle' }); await a.wait(600);
  ok(await a.p.title() === 'Системийг эхлүүлэх' && await a.p.locator('#su-code').count() === 1, 'a server nobody has set up opens on «Системийг эхлүүлэх», with a field for the code');
  ok((await a.p.locator('.login__note').innerText()).startsWith('Өгөгдөл сервер дээр хадгалагдана.'), 'and says the data is kept on the server');
  await a.p.locator('#su-company').fill('Туршилт ХХК'); await a.p.locator('#su-family').fill('Дорж'); await a.p.locator('#su-given').fill('Саруул');
  await a.p.locator('#su-login').fill('saruul'); await a.p.locator('#su-password').fill('Turshilt2026'); await a.p.locator('#su-again').fill('Turshilt2026');
  await a.p.getByRole('button', { name: 'Эхлүүлэх' }).click(); await a.wait(400);
  ok((await a.p.locator('.mform__errors li').allInnerTexts()).join('|') === 'Ирцийн кодоо бичнэ үү.', 'without the code: asked for it');
  await a.p.locator('#su-code').fill('buruu-kod'); await a.p.getByRole('button', { name: 'Эхлүүлэх' }).click(); await a.wait(2500);
  ok((await a.p.locator('.mform__errors li').allInnerTexts()).join('|') === 'Код буруу байна. Дахин шалгаад бичнэ үү.' && await a.p.title() === 'Системийг эхлүүлэх', 'a wrong code: said at the code, and nothing is founded');
  await a.p.locator('#su-code').fill(CODE.toUpperCase().replace(/-/g, ' ')); await a.p.getByRole('button', { name: 'Эхлүүлэх' }).click();
  const welcomed = await a.p.waitForSelector('dialog.welcome[open] .welcome__name', { timeout: 20000 }).then(() => true, () => false);
  await a.wait(1300);
  ok(welcomed && (await a.p.locator('dialog.welcome .welcome__name').innerText()).includes('Саруул'), 'the right code, however typed: founded, and the founder is welcomed by name');
  await a.skip();
  ok((await a.p.locator('#page-title').innerText()).includes('Саруул'), 'then Нүүр, signed in');
  let kept = await a.stored();
  ok(!kept.includes('erp:data') && !kept.includes('Turshilt2026') && !kept.includes('Саруул') && !kept.includes('saruul') && kept.includes('erp:prefs'), 'this browser keeps none of the data, only its own look and the ХХК that is open');
  const cookies = await a.ctx.cookies();
  ok(cookies.length === 1 && cookies[0].name === 'erp_sid' && cookies[0].httpOnly && cookies[0].sameSite === 'Strict', 'signed in by one cookie that scripts cannot read');
  let rows = await a.rows();
  const me = Object.values(rows.people)[0];
  ok(Object.keys(rows.companies).length === 1 && me.account.sysadmin === true && me.account.login === 'saruul' && !('hash' in me.account) && Object.keys(rows.docTypes).length >= 12, 'the server holds the ХХК, its personal-file list and the founder as the system admin, without a password hash');
  await a.p.reload({ waitUntil: 'networkidle' }); await a.wait(900);
  ok((await a.p.locator('#page-title').innerText()).includes('Саруул') && await a.p.locator('dialog.welcome[open]').count() === 0, 'opened again: still signed in, the data is back, and no second welcome');

  // ---- A second person, from another browser
  const nominLink = await invite(a, 'Номин', 'Бат', 'nomin', 'staff');
  const nominId = Object.values((await a.rows()).people).find(p => p.account?.login === 'nomin').id;
  ok((await a.p.locator('.adm-table tbody tr', { hasText: 'saruul' }).innerText()).includes('Бусдад харагдахгүй') && !(await a.p.locator('.adm-table tbody tr', { hasText: 'nomin' }).innerText()).includes('Бусдад харагдахгүй'), 'in Удирдлага the system admin\'s own row says the others do not see it; nobody else\'s does');
  ok((await a.main()).includes('Номин'), 'the admin adds a person, who shows in Удирдлага');
  const b = await open('staff');
  await b.p.goto(BASE, { waitUntil: 'networkidle' }); await b.wait(600);
  ok(await b.p.title() === 'Нэвтрэх' && await b.p.locator('#su-company').count() === 0, 'another browser opens on «Нэвтрэх»: the system is set up for everyone');
  await b.signIn('nomin', 'Buruu2026');
  ok((await b.p.locator('.login__error').innerText()).includes('Нэвтрэх нэр эсвэл нууц үг буруу байна.'), 'a wrong password is refused');
  // In with the link: the person makes their own password
  await b.p.goto(nominLink, { waitUntil: 'networkidle' }); await b.wait(900);
  ok(await b.p.title() === 'Нууц үг үүсгэх' && (await b.p.locator('.join__login').innerText()) === 'nomin' && (await b.p.locator('.login__sub').innerText()).includes('Б.Номин'), 'the link opens «Нууц үг үүсгэх», with the person\'s name and login');
  await b.p.locator('#jn-password').fill('Turshilt'); await b.p.getByRole('button', { name: 'Нэвтрэх', exact: true }).click(); await b.wait(400);
  ok((await b.p.locator('.mform__errors li').allInnerTexts()).join('|') === 'Нууц үг 8-аас доошгүй тэмдэгттэй, үсэг, тоо хоёулаа орсон байх ёстой.', 'a weak password: said so');
  await b.p.locator('#jn-password').fill('Turshilt2026'); await b.p.locator('#jn-again').fill('Turshilt2026'); await b.p.getByRole('button', { name: 'Нэвтрэх', exact: true }).click();
  await b.p.waitForSelector('dialog.welcome[open] .welcome__name', { timeout: 20000 }).catch(() => {}); await b.wait(1200);
  ok((await b.p.locator('dialog.welcome .welcome__name').innerText().catch(() => '')).includes('Номин') && !/^#j(oin)?-/.test(await b.p.evaluate(() => location.hash)), 'their own password made, the new person is in and welcomed, and the link has left the address');
  await b.skip();
  ok((await b.p.locator('.sbar, .side').first().innerText()).includes('Туршилт'), 'into the same ХХК');
  const theirs = await b.rows();
  await b.go('team');
  ok(Object.keys(theirs.people).length === 1 && !Object.values(theirs.people).some(p => p.account?.sysadmin) && !(await b.main()).includes('Саруул'), 'the system admin is not among the people they are sent, nor in their Баг');
  const again = await open('again');
  await again.p.goto(nominLink, { waitUntil: 'networkidle' }); await again.wait(900);
  ok((await again.p.locator('h1').innerText()) === 'Холбоос хүчингүй байна', 'the link opened a second time says it no longer works');
  await again.p.getByRole('button', { name: 'Нэвтрэх хуудас руу' }).click(); await again.wait(600);
  ok(await again.p.title() === 'Нэвтрэх', 'and leads to the sign-in page');
  await again.ctx.close();
  // A new link from the person's page, for someone locked out
  await a.go(`admin-${nominId}`);
  await a.p.getByRole('button', { name: 'Нэвтрэх холбоос' }).click();
  await a.p.waitForSelector('#sl-url', { timeout: 20000 });
  ok((await a.p.locator('#sl-url').inputValue()) !== nominLink && await a.p.getByRole('button', { name: 'Нууц үг шинэчлэх' }).count() === 0, 'the person\'s page gives a new link, instead of a password to set for them');
  await a.p.getByRole('button', { name: 'Болих' }).first().click(); await a.wait(600);
  // A long link as they were made before 2026-11-26 (#join-<person>.<secret>): it still opens the page for its person
  if (dbFile) {
    const { DatabaseSync } = require('node:sqlite');
    const { createHash, randomBytes } = require('node:crypto');
    const long = randomBytes(24).toString('base64url');
    const db = new DatabaseSync(dbFile);
    db.prepare(`INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v`)
      .run(`link:${nominId}`, JSON.stringify({ t: createHash('sha256').update(long).digest('base64url'), until: Math.floor(Date.now() / 1000) + 3600 }));
    db.close();
    const old = await open('old-link');
    await old.p.goto(`${BASE}#join-${nominId}.${long}`, { waitUntil: 'networkidle' }); await old.wait(900);
    ok(await old.p.title() === 'Нууц үг үүсгэх' && (await old.p.locator('.join__login').innerText().catch(() => '')) === 'nomin', 'a long link made before links were short still opens «Нууц үг үүсгэх» for its person');
    await old.ctx.close();
  }


  // ---- Work reaches the others
  /** A new task; given also to `to` (a name in the picker) */
  const addTask = async (x, title, to) => {
    await x.p.locator('.tbtn[aria-label="Үүсгэх"]').click(); await x.wait(300);
    await x.p.getByRole('menuitem', { name: 'Шинэ ажил' }).click(); await x.wait(500);
    await x.p.locator('#nt-title').fill(title);
    if (to) await x.p.locator('dialog[open] .people-pick label', { hasText: to }).click();
    await x.p.getByRole('button', { name: 'Нэмэх', exact: true }).click(); await x.wait(1200);
  };
  // Ажил is one's own (docs/decisions.md, 2026-11-16): a task kept for oneself reaches nobody; one given to someone reaches them
  await addTask(a, 'Өөрийн тэмдэглэл');
  await addTask(a, 'Гэрээний төсөл бэлтгэх', 'Номин');
  await b.sync(); await b.go('tasks');
  ok((await b.main()).includes('Гэрээний төсөл бэлтгэх') && !(await b.main()).includes('Өөрийн тэмдэглэл'), 'a task the admin gives the other person shows in their Ажил; one the admin keeps for themself does not');
  await b.p.locator('.tk-whose').click(); await b.wait(300);
  await b.p.getByRole('menuitemradio', { name: 'Надад оноосон' }).or(b.p.getByRole('menuitem', { name: 'Надад оноосон' })).first().click(); await b.wait(500);
  ok((await b.main()).includes('Гэрээний төсөл бэлтгэх'), 'and is under «Надад оноосон»');
  await b.p.getByRole('button', { name: 'Шүүлтүүр арилгах' }).click(); await b.wait(300);
  // What the hidden system admin writes reaches the person, from «Системийн админ», and nothing breaks for want of their record
  const put = changes => a.p.evaluate(async c => (await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ since: 0, scope: '', changes: c }) })).json(), changes);
  const at = new Date().toISOString();
  const said = [
    await put([{ c: 'chats', id: 'chx', ops: [[[], { id: 'chx', kind: 'direct', members: [me.id, nominId], by: me.id, created: at, read: { [me.id]: at } }]], pos: 1 }]),
    await put([{ c: 'messages', id: 'msx', ops: [[[], { id: 'msx', chat: 'chx', by: me.id, at, text: 'Системээс мэндчилгээ', refs: [], files: [] }]], pos: 1 }]),
  ];
  await b.sync(); await b.go('chat-chx');
  const chatText = await b.main();
  ok(said.every(r => r.refused.length === 0) && chatText.includes('Системээс мэндчилгээ') && chatText.includes('Системийн админ'), 'a message from the hidden system admin reaches the person, from «Системийн админ»');
  await addTask(b, 'Тайлан нэгтгэх');
  await a.sync(); await a.go('tasks');
  ok(!(await a.main()).includes('Тайлан нэгтгэх') && (await a.main()).includes('Гэрээний төсөл бэлтгэх'), 'the other\'s own task stays out of the admin\'s Ажил, though the system admin may see every task');
  const tab = await a.ctx.newPage();
  await tab.goto(BASE + '#tasks', { waitUntil: 'networkidle' }); await tab.waitForTimeout(900 * SLOW);
  ok((await tab.locator('#main').innerText()).includes('Өөрийн тэмдэглэл'), 'a second tab of the same person opens signed in, with the same data');
  await tab.close();

  // ---- Rights hold on the server, not only on the screen
  const co = Object.keys(rows.companies)[0];
  const emp = (id, user, given, regNo) => ({ id, company: co, user, code: `Т-${id}`, family: 'Овог', given, regNo, phone: '99112233', dept: 'd1', position: 'o1', hired: '2025-01-01',
    contract: { kind: 'open', no: '1', start: '2025-01-01' }, status: 'active', moves: [], files: [], hue: 'blue' });
  const staffId = Object.keys((await a.rows()).people).find(id => id !== me.id);
  const pushed = await a.p.evaluate(async changes => (await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ since: 0, scope: '', changes }) })).json(), [
    { c: 'departments', id: 'd1', ops: [[[], { id: 'd1', company: co, name: 'Борлуулалт', code: 'БОР' }]], pos: 1 },
    { c: 'positions', id: 'o1', ops: [[[], { id: 'o1', company: co, dept: 'd1', name: 'Менежер', quota: 2 }]], pos: 1 },
    { c: 'employees', id: 'e1', ops: [[[], emp('e1', me.id, 'Саруул', 'УБ90010112')]], pos: 1 },
    { c: 'employees', id: 'e2', ops: [[[], emp('e2', staffId, 'Номин', 'УБ95050512')]], pos: 2 },
  ]);
  ok(pushed.refused.length === 0, 'the admin fills in a department, a position and two employees');
  await a.sync(); await a.go('hr-employees');
  ok((await a.main()).includes('Номин') && (await a.main()).includes('УБ95050512') || (await a.main()).includes('Номин'), 'who show in the admin\'s Хүний нөөц');
  rows = await b.rows();
  ok(Object.values(rows.employees).length === 2 && Object.values(rows.employees).every(e => e.card === true && e.regNo === '' && e.phone === ''), 'the staff member\'s browser is sent no registration number or phone: only who is where in the structure');
  ok(await b.p.locator('.nav__item', { hasText: 'Хүний нөөц' }).count() === 0 && await a.p.locator('.nav__item', { hasText: 'Хүний нөөц' }).count() === 1, 'and has no Хүний нөөц in its menu, as before');
  const tried = await b.p.evaluate(async id => (await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ since: 0, scope: '', changes: [{ c: 'people', id, ops: [[['account', 'sysadmin'], true]] }] }) })).json(), staffId);
  ok(tried.refused.length === 1 && !(await b.rows()).people[staffId].account.sysadmin, 'asking the server directly for more rights is refused');

  // ---- A second ХХК
  await a.go('docs'); await a.p.locator('button.folder-add').click(); await a.wait(600);
  await a.p.locator('#co-name').fill('Хоёрдугаар ХХК'); await a.p.getByRole('button', { name: 'Нэмэх', exact: true }).click(); await a.wait(2500);
  rows = await a.rows();
  const co2 = Object.keys(rows.companies).find(id => id !== co);
  ok(!!co2 && rows.people[me.id].companies.includes(co2) && rows.roles[co2]?.director === me.id && Object.values(rows.docTypes).filter(t => t.company === co2).length >= 12, 'whoever set the system up adds a second ХХК in Бичиг хэрэг: the server holds it, its personal-file list and its roles, and they work in it');
  await b.go('docs');
  rows = await b.rows();
  ok(Object.keys(rows.companies).join() === co && Object.values(rows).every(t => Object.values(t).every(v => v !== null)) && await b.p.locator('button.folder-add').count() === 0, 'someone of the first ХХК is not told of it, not even by a record\'s number, and cannot add one');

  // ---- A project's milestones (Үе шат): added, changed and taken away on its page, by anyone on the project
  await a.go('projects');
  await a.p.getByRole('button', { name: 'Шинэ төсөл' }).first().click(); await a.wait(600);
  await a.p.locator('#np-name').fill('Туршилтын төсөл');
  await a.p.locator('dialog[open] .people-pick label', { hasText: 'Номин' }).click();
  await a.p.locator('dialog[open]').getByRole('button', { name: 'Үүсгэх', exact: true }).click(); await a.wait(1500);
  const route = (await a.p.evaluate(() => location.hash)).slice(1);
  ok(route.startsWith('project-') && (await a.p.locator('.pd-ms').innerText()).includes('Төслийн гол алхмуудыг огноотой нь нэмнэ үү.'), 'a new project has no milestones yet, and says how to add them');
  await a.p.getByRole('button', { name: 'Үе шат нэмэх' }).click(); await a.wait(500);
  await a.p.locator('#ms-name').fill(''); await a.p.getByRole('button', { name: 'Нэмэх', exact: true }).click(); await a.wait(300);
  ok((await a.p.locator('.mform__errors li').allInnerTexts()).join('|') === 'Үе шатны нэрийг бичнэ үү.', 'a milestone without a name: asked for it');
  await a.p.locator('#ms-name').fill('Зураг төсөл батлуулах'); await a.p.getByRole('button', { name: 'Нэмэх', exact: true }).click(); await a.wait(1200);
  ok((await a.p.locator('.pd-ms').innerText()).includes('Зураг төсөл батлуулах'), 'added, it shows on the project page');
  await b.sync(); await b.go(route);
  ok((await b.main()).includes('Зураг төсөл батлуулах'), 'and to the others on the project');
  await b.p.locator('.ms__body', { hasText: 'Зураг төсөл батлуулах' }).click(); await b.wait(500);
  await b.p.locator('#ms-date').fill('2026-12-24'); await b.p.getByRole('button', { name: 'Хадгалах', exact: true }).click(); await b.wait(1500);
  const pid = route.slice('project-'.length);
  ok((await a.rows()).projects?.[pid]?.milestones?.[0]?.date === '2026-12-24', 'someone else on the project changes its day, and the server keeps it');
  await a.sync(); await a.go(route);
  await a.p.locator('.ms__body', { hasText: 'Зураг төсөл батлуулах' }).click(); await a.wait(500);
  await a.p.getByRole('button', { name: 'Үе шатыг устгах' }).click(); await a.wait(600);
  ok(!(await a.p.locator('.pd-ms').innerText()).includes('Зураг төсөл батлуулах'), 'taken away, it is gone');
  await a.p.locator('.island__undo').click(); await a.wait(1500);
  ok((await a.p.locator('.pd-ms').innerText()).includes('Зураг төсөл батлуулах') && (await a.rows()).projects?.[pid]?.milestones?.length === 1, 'and back with Буцаах');

  // ---- A file added by one opens for the other
  const paper = Buffer.from('%PDF-1.4\n' + 'Дотоод журмын туршилтын файл. '.repeat(400));
  await a.go(`docs-folder-${co}`);
  await a.p.getByRole('button', { name: 'Бичиг баримт нэмэх' }).first().click(); await a.wait(600);
  await a.p.locator('#da-file').setInputFiles({ name: 'Дотоод журам.pdf', mimeType: 'application/pdf', buffer: paper });
  await a.wait(1200);
  await a.p.getByRole('button', { name: 'Нэмэх', exact: true }).click(); await a.wait(1500);
  ok((await a.main()).includes('Дотоод журам'), 'the office adds a document with its file');
  let queue = '';
  for (let i = 0; i < 20 && queue !== '[]'; i++) { await a.wait(500); queue = await a.p.evaluate(() => localStorage.getItem('erp:uploads') ?? '[]'); }
  ok(queue === '[]', 'the file goes up to the server by itself');
  await b.sync(); await b.go(`docs-folder-${co}`);
  ok((await b.main()).includes('Дотоод журам'), 'the document shows in the other person\'s folder');
  const doc = Object.values((await b.rows()).docs).find(d => d.name === 'Дотоод журам');
  const got = await b.p.evaluate(async id => { const r = await fetch(`/api/files/${id}`); return { status: r.status, size: (await r.arrayBuffer()).byteLength, type: r.headers.get('content-type') }; }, doc.file.id);
  ok(got.status === 200 && got.size === paper.length && got.type === 'application/pdf', 'and its file comes to their browser from the server, whole');
  // Looked for without opening it: opening a store that is not there would make an empty one
  const viaApp = await b.p.evaluate(async () => (await indexedDB.databases()).some(d => d.name === 'erp-cache'));
  ok(viaApp === false, 'before they open it, no copy of it is in their browser');
  // Several files chosen at once (a lesson's pictures) all go up, each in its turn
  const png = n => Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(3000 + n, n)]);
  await a.go('training'); await a.p.getByRole('button', { name: 'Материал нэмэх' }).first().click(); await a.wait(600);
  await a.p.locator('#lf-title').fill('Агуулахын аюулгүй ажиллагаа');
  await a.p.locator('#lf-files').setInputFiles([1, 2, 3].map(n => ({ name: `Зураг ${n}.png`, mimeType: 'image/png', buffer: png(n) })));
  await a.wait(1500);
  await a.p.getByRole('button', { name: 'Нэмэх', exact: true }).click(); await a.wait(1200);
  queue = '';
  for (let i = 0; i < 30 && queue !== '[]'; i++) { await a.wait(500); queue = await a.p.evaluate(() => localStorage.getItem('erp:uploads') ?? '[]'); }
  await b.sync();
  const lesson = Object.values((await b.rows()).lessons ?? {}).find(l => l.title === 'Агуулахын аюулгүй ажиллагаа');
  const sizes = lesson ? await b.p.evaluate(async ids => Promise.all(ids.map(async id => { const r = await fetch(`/api/files/${id}`); return r.ok ? (await r.arrayBuffer()).byteLength : r.status; })), lesson.files.map(f => f.id)) : [];
  ok(queue === '[]' && sizes.join() === [1, 2, 3].map(n => png(n).length).join(), 'three files chosen at once all reach the server, and the other person gets each whole');
  // Opened in the app, the picture shows: it came through the app's own file store
  await b.go('training'); await b.wait(600);
  await b.p.getByText('Агуулахын аюулгүй ажиллагаа').first().click(); await b.wait(2500);
  const cached = await b.p.evaluate(ids => new Promise(done => { const r = indexedDB.open('erp-cache'); r.onsuccess = () => { const d = r.result; if (!d.objectStoreNames.contains('files')) return done(-1); const st = d.transaction('files').objectStore('files'); let n = 0, left = ids.length; ids.forEach(id => { const g = st.get(id); g.onsuccess = () => { if (g.result) n++; if (!--left) { d.close(); done(n); } }; g.onerror = () => { if (!--left) { d.close(); done(n); } }; }); }; r.onerror = () => done(-2); }), lesson ? lesson.files.map(f => f.id) : []);
  ok(cached >= 1, `opening the lesson brings its pictures into this browser's own store (${cached} of 3)`);
  const anon = await open('nobody');
  await anon.p.goto(BASE, { waitUntil: 'networkidle' }); await anon.wait(400);
  ok(await anon.p.evaluate(async id => (await fetch(`/api/files/${id}`)).status, doc.file.id) === 401, 'nobody who is not signed in gets the file, even with its id');
  await anon.ctx.close();

  // ---- The look is the device's own, and stays
  await a.p.locator('.tbtn--theme').click(); await a.wait(400);
  await a.p.reload({ waitUntil: 'networkidle' }); await a.wait(900);
  ok(await a.p.evaluate(() => document.documentElement.dataset.mode) === 'dark', 'the dark look chosen in this browser is still chosen after opening it again');
  ok(await b.p.evaluate(() => document.documentElement.dataset.mode) === 'light', 'and is not the other person\'s');
  await a.p.locator('.tbtn--theme').click(); await a.wait(400);

  // ---- The connection drops
  await a.ctx.route('**/api/sync**', r => r.abort());
  await addTask(a, 'Холболтгүй үед нэмсэн', 'Номин');
  await a.wait(1500);
  ok(await a.p.locator('.offline__pill').count() === 1 && (await a.p.locator('.offline__pill').innerText()).includes('Холболт тасарсан'), 'without a connection the change stays on the screen, and the person is told it waits');
  await a.go('tasks');
  ok((await a.main()).includes('Холболтгүй үед нэмсэн'), 'and can work on');
  await a.ctx.unroute('**/api/sync**');
  await a.sync(); await a.wait(600);
  ok(await a.p.locator('.offline__pill').count() === 0, 'connected again: the notice goes');
  await b.sync(); await b.go('tasks');
  ok((await b.main()).includes('Холболтгүй үед нэмсэн'), 'and the change has reached the other person');

  // ---- Password, signing out
  await b.go('preferences'); await b.wait(300);
  await b.p.locator('#pw-now').fill('Buruu2026'); await b.p.locator('#pw-next').fill('Shine2027x'); await b.p.locator('#pw-again').fill('Shine2027x');
  await b.p.getByRole('button', { name: 'Нууц үг солих' }).click(); await b.wait(2500);
  ok((await b.p.locator('#pw-now-error').innerText().catch(() => '')) === 'Одоогийн нууц үг буруу байна.', 'a new password with the present one wrong: said so');
  await b.p.locator('#pw-now').fill('Turshilt2026'); await b.p.getByRole('button', { name: 'Нууц үг солих' }).click();
  // The message shows for three seconds: looked for as soon as it comes
  const changed = await b.p.locator('.island', { hasText: 'Нууц үг солигдлоо' }).waitFor({ timeout: 20000 }).then(() => true, () => false);
  ok(changed && await b.p.locator('#pw-now-error').count() === 0, 'with the right one: changed');
  await b.signOut();
  ok(await b.p.title() === 'Нэвтрэх', 'signed out: the sign-in page');
  kept = await b.stored();
  ok(!kept.includes('Номин') && !kept.includes('Гэрээний төсөл') && (await b.rows()).status === 401, 'nothing of the data is left in the browser, and the server sends it none');
  await b.wait(500);
  const left = await b.p.evaluate(async () => (await indexedDB.databases()).map(d => d.name));
  ok(!left.includes('erp-cache'), 'nor a copy of any file');
  await b.signIn('nomin', 'Turshilt2026');
  ok((await b.p.locator('.login__error').innerText()).includes('буруу байна'), 'the old password no longer signs in');
  await b.signIn('nomin', 'Shine2027x');
  ok((await b.p.locator('#page-title').count()) === 1 && await b.p.locator('dialog.welcome[open]').count() === 0, 'the new one does, and a person welcomed once is not welcomed again');

  // ---- The admin stops someone signing in
  await a.go(`admin-${staffId}`); await a.wait(300);
  await a.p.getByRole('button', { name: 'Идэвхгүй болгох' }).click(); await a.wait(1500);
  await b.sync();
  const stopped = await b.p.locator('.login__ended').waitFor({ timeout: 45000 }).then(() => true, () => false);
  ok(stopped && await b.p.title() === 'Нэвтрэх' && (await b.p.locator('.login__ended').innerText()).includes('Та системээс гарсан байна.'), 'made inactive, the person is signed out at their next round, and the sign-in page says their sign-in ended');
  await b.signIn('nomin', 'Shine2027x');
  ok((await b.p.locator('.login__error').innerText()).includes('Таны бүртгэл идэвхгүй байна.'), 'and cannot sign in');
  await a.p.getByRole('button', { name: 'Идэвхжүүлэх' }).click(); await a.wait(1500);
  await b.signIn('nomin', 'Shine2027x');
  ok(await b.p.locator('#page-title').count() === 1 && await b.p.locator('.login__ended').count() === 0, 'let in again, they sign in');

  // ---- A sign-in that ended on the server
  await a.ctx.clearCookies();
  // At its next round with the server, which may be half a minute away when a round was already on its way
  await a.sync();
  const out = await a.p.locator('.login__ended').waitFor({ timeout: 45000 }).then(() => true, () => false);
  ok(out && await a.p.title() === 'Нэвтрэх' && (await a.p.locator('.login__ended').innerText()).includes('Та системээс гарсан байна.'), 'a browser whose sign-in ended goes to the sign-in page, which says so');

  // ---- A link opened where someone else is signed in: that person is signed out first, and nothing of theirs is sent as the newcomer's
  const e = await open('shared');
  await e.p.goto(BASE, { waitUntil: 'networkidle' }); await e.wait(600);
  await e.signIn('saruul', 'Turshilt2026');
  await e.go(`admin-${nominId}`);
  await e.p.getByRole('button', { name: 'Нэвтрэх холбоос' }).click();
  await e.p.waitForSelector('#sl-url', { timeout: 20000 });
  const reset = await e.p.locator('#sl-url').inputValue();
  await e.p.getByRole('button', { name: 'Болих' }).first().click(); await e.wait(600);
  await e.p.goto(reset, { waitUntil: 'networkidle' }); await e.wait(900);
  await e.p.locator('#jn-password').fill('Shine2027y'); await e.p.locator('#jn-again').fill('Shine2027y');
  await e.p.getByRole('button', { name: 'Нэвтрэх', exact: true }).click(); await e.wait(3000 * SLOW);
  const shared = await e.rows();
  await e.p.locator('button.brand').click(); await e.wait(500);
  const menu = await e.p.locator('[role=menu]').innerText().catch(() => '');
  ok(Object.keys(shared.companies ?? {}).length === 1 && !menu.includes('Хоёрдугаар') && await e.p.locator('.island', { hasText: 'эрх алга' }).count() === 0 && (await e.p.locator('.side__me').innerText()).includes('Номин'), 'opened in the admin\'s browser, the link signs the admin out and the person in, with only their own data and nothing sent in their name');
  await e.ctx.close();

  // ---- The server out of reach when the page opens
  const d = await open('down');
  // The page marked as the Worker marks it (worker/site.js): a server stands behind it. A deployed page is marked already.
  if (!REMOTE) await d.ctx.route(BASE, async route => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('<html', '<html data-server') }); });
  await d.ctx.route('**/api/state', r => r.abort());
  await d.p.goto(BASE, { waitUntil: 'networkidle' }); await d.wait(600);
  ok((await d.p.locator('h1').innerText()) === 'Сервертэй холбогдож чадсангүй' && await d.p.getByRole('button', { name: 'Дахин оролдох' }).count() === 1, 'where a server should answer and does not, the page says so and offers to try again');
  ok(!(await d.stored()).includes('erp:data') && await d.p.locator('#su-company').count() === 0, 'and never starts a system of its own in the browser');
  await d.ctx.unroute('**/api/state');
  await d.p.getByRole('button', { name: 'Дахин оролдох' }).click(); await d.wait(1500);
  ok(await d.p.title() === 'Нэвтрэх', 'trying again with the server back: the sign-in page');

  await browser.close();
  console.log(errors.length ? `PAGE ERRORS: ${[...new Set(errors)].slice(0, 6).join(' / ')}` : 'no page errors');
  if (errors.length) fails++;
  console.log(fails ? `FAILED ${fails}` : 'ALL OK');
  stop();
  process.exit(fails ? 1 : 0);
})();
