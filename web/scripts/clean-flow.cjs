// The system as it really starts, with no example data (docs/decisions.md, 2026-11-15). The first page makes the ХХК
// and its one admin, who holds every right; nothing made up is left on any page and the test tools of the example data
// are gone; the system can be built up from nothing (a department, a position, an employee, a user in a new
// department, a chat); Ирц shows by itself (our only ХХК takes Timely's only organisation) within each person's right,
// behind the server's code; a browser that still holds the example data keeps it untouched.
// Timely is answered by the script itself with made-up people: no key, no server, no real attendance.
//
// Usage: build, serve web/dist on 4173 (npx vite preview --port 4173 --strictPort), then
//   node web/scripts/clean-flow.cjs [address]
// Needs Playwright with Chromium (already in the cloud container; elsewhere: npm i playwright).
const { chromium } = require('playwright');
const BASE = process.argv.slice(2).find(a => /^https?:/.test(a)) ?? 'http://localhost:4173/';
// The real clock: a fixed one freezes Date.now(), and a menu closed once then never opens again (its guard against a
// double toggle compares times). The month is the one the page asks for, today's in Ulaanbaatar.
const ub = new Date(Date.now() + 8 * 3600_000).toISOString();
const month = ub.slice(0, 7), today = ub.slice(0, 10);
let fails = 0;
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
const MADE_UP = /Болд|Ариунаа|Нандин|Батзориг|Ганзориг|Сарантуяа|Тэмүүлэн|Говь Ресурс|Говь Логистик|Говь Трейд|Шинэ агуулахын|Жишээ горим|Жишээ өгөгд|Жишээ ирц|Жишээ скан|Жишээ эрх|Жишээ файл|зохиомол|example\.mn/;
// Timely's side, made up for the test: five employees, the first with the register of the employee added below
const people = [['Бат', 'Тест-Нэг', 'УБ90010112', 'Нягтлан бодогч', 'Санхүү', 20, 160], ['Дорж', 'Тест-Хоёр', 'ТТ91020212', 'Жолооч', 'Тээвэр', 12, 96], ['Сүх', 'Тест-Гурав', 'ТТ92030313', 'Нярав', 'Агуулах', 19, 150],
  ['Цэрэн', 'Тест-Дөрөв', 'ТТ93040414', 'Менежер', 'Борлуулалт', 20, 158], ['Ганаа', 'Тест-Тав', '', 'Харуул', 'Аж ахуй', 9, 70]];
const monthBody = { month, from: `${month}-01`, to: today, updated: new Date().toISOString(),
  employees: people.map(([family, given, register, position, division, wd, wh], i) => ({ workerId: 100 + i, family, given, register, position, division,
    leave: { year: 2026, earned: 15, used: 3, left: 12, taken: [] }, supposedDays: 20, supposedHours: 160, workedDays: wd, workedHours: wh })) };
const ONE = [{ id: 77, name: 'Өөр нэртэй байгууллага ХХК', register: '1234567', scopes: [] }];
const TWO = [...ONE, { id: 78, name: 'Хоёр дахь байгууллага ХХК', register: null, scopes: [] }];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Ulaanbaatar' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => m.type() === 'error' && !/401|502|503|404|Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 200)));
  const wait = ms => p.waitForTimeout(ms);
  const st = async () => { await wait(300); return p.evaluate(() => JSON.parse(localStorage.getItem('erp:data'))); };
  const go = async h => { await p.evaluate(x => { location.hash = x }, h); await wait(1000); };
  const main = () => p.evaluate(() => (document.querySelector('#main') ?? document.body).innerText);
  const bar = () => p.locator('.sbar').first().innerText();
  // Timely through our server, mocked: `mode` is what the server would answer
  let mode = 'off', companies = ONE, t0 = ''; const asked = [];
  await ctx.route('**/api/attendance**', async route => {
    const u = new URL(route.request().url());
    asked.push(u.pathname + u.search);
    if (mode === 'off') return route.fulfill({ status: 404, body: 'Сервер хараахан байхгүй.' });
    if (u.pathname === '/api/attendance/unlock') {
      const code = JSON.parse(route.request().postData() || '{}').code;
      if (code !== 'zuv-kod-1234-5678') return route.fulfill({ status: 401, json: { error: 'Код буруу байна. Дахин шалгаад бичнэ үү.' } });
      mode = 'open';
      return route.fulfill({ json: { ok: true } });
    }
    if (mode === 'locked') return route.fulfill({ status: 401, json: { locked: true, error: 'Ирцийг харахын тулд кодоо бичнэ үү.' } });
    if (u.pathname === '/api/attendance') return route.fulfill({ json: { ready: true, companies, errors: [] } });
    if (u.pathname === '/api/attendance/month') return route.fulfill({ json: monthBody });
    if (u.pathname === '/api/attendance/days') return route.fulfill({ json: { days: [{ date: `${month}-01`, in: '08:40', out: '18:10' }], updated: new Date().toISOString() } });
    return route.fulfill({ status: 404, json: {} });
  });
  const signOut = async () => { await p.locator('.side__me').click(); await wait(300); await p.getByRole('menuitem', { name: 'Гарах' }).click(); await wait(700); };
  const signIn = async (name, pass, welcome) => {
    await p.locator('#login-name').fill(name); await p.locator('#login-pass').fill(pass); await p.getByRole('button', { name: 'Нэвтрэх', exact: true }).click();
    if (welcome) { await p.waitForSelector('dialog.welcome[open] .welcome__name', { timeout: 15000 }).catch(() => {}); await wait(1200); }
    else await wait(1500);
  };
  const invite = async (given, family, login, preset, team, newTeam) => {
    await go('admin'); await p.getByRole('button', { name: 'Хэрэглэгч нэмэх' }).first().click(); await wait(600);
    await p.locator('#inv-given').fill(given); await p.locator('#inv-family').fill(family); await p.locator('#inv-email').fill(`${login}@turshilt.mn`);
    if (team) await p.locator('#inv-team').selectOption(team);
    if (newTeam !== undefined) { await p.locator('#inv-team').selectOption({ label: 'Шинэ хэлтэс…' }); await p.locator('#inv-newTeam').fill(newTeam); }
    await p.locator('#inv-login').fill(login); await p.locator('#inv-password').fill('Turshilt2026'); await p.locator('#inv-preset').selectOption(preset);
    await p.getByRole('button', { name: 'Нэмэх', exact: true }).click(); await wait(900);
  };

  // ---- The first page
  await p.goto(BASE, { waitUntil: 'networkidle' }); await wait(700);
  ok(await p.title() === 'Системийг эхлүүлэх' && (await p.locator('h1').innerText()) === 'Системийг эхлүүлэх', 'an empty system opens on «Системийг эхлүүлэх»');
  ok(await p.locator('.login__demo').count() === 0 && !MADE_UP.test(await p.locator('body').innerText()), 'no example accounts, nothing made up on it');
  ok(await p.evaluate(() => localStorage.getItem('erp:demo')) === null, 'the example switch is off');
  await p.getByRole('button', { name: 'Эхлүүлэх' }).click(); await wait(300);
  let errs = await p.locator('.mform__errors li').allInnerTexts();
  ok(errs.join('|') === 'ХХК-ийн нэрийг бичнэ үү.|Эцэг/эхийн нэрийг бичнэ үү.|Нэрийг бичнэ үү.|Нэвтрэх нэрийг бичнэ үү.|Нууц үгээ бичнэ үү.', `empty: the five things it needs (${errs.length})`);
  ok(await p.evaluate(() => document.activeElement?.classList.contains('mform__errors')), 'focus goes to the list of errors');
  await p.locator('.mform__errors a').first().click(); await wait(100);
  ok(await p.evaluate(() => document.activeElement?.id) === 'su-company', 'an error in the list leads to its field');
  await p.locator('#su-company').fill('Туршилт ХХК'); await p.locator('#su-family').fill('Дорж'); await p.locator('#su-given').fill('Саруул');
  await p.locator('#su-login').fill('Саруул'); await p.locator('#su-password').fill('богино'); await p.locator('#su-again').fill('өөр');
  await p.getByRole('button', { name: 'Эхлүүлэх' }).click(); await wait(300);
  errs = await p.locator('.mform__errors li').allInnerTexts();
  ok(errs.includes('Нэвтрэх нэр латин үсэг, тоотой, 3-аас 32 тэмдэгт байх ёстой.') && errs.includes('Нууц үг 8-аас доошгүй тэмдэгттэй, үсэг, тоо хоёулаа орсон байх ёстой.'), 'a Cyrillic login and a weak password are told what to be');
  await p.locator('#su-login').fill('saruul'); await p.locator('#su-password').fill('Turshilt2026'); await p.locator('#su-again').fill('Turshilt2027');
  await p.getByRole('button', { name: 'Эхлүүлэх' }).click(); await wait(300);
  errs = await p.locator('.mform__errors li').allInnerTexts();
  ok(errs.join('|') === 'Нууц үг таарахгүй байна.' && !(await st())?.people?.length, 'passwords that differ: said, and nothing is made yet');
  await p.locator('#su-again').fill('Turshilt2026');
  await p.getByRole('button', { name: 'Эхлүүлэх' }).click();
  const welcomed = await p.waitForSelector('dialog.welcome[open] .welcome__name', { timeout: 15000 }).then(() => true, () => false);
  await wait(1300);
  ok(welcomed && (await p.locator('dialog.welcome .welcome__name').innerText()).includes('Саруул') && await p.locator('.welcome__team').count() === 0, 'set up: the welcome page greets the admin by name, with no colleagues yet');
  const letter = () => p.evaluate(() => [...document.querySelectorAll('dialog.welcome .welcome__letter p .sr-only')].map(e => e.textContent).join(' | '));
  ok((await p.locator('dialog.welcome .welcome__hello').innerText()) === 'Эрхэм хүндэт' && (await p.locator('dialog.welcome .welcome__cheer').innerText()) === 'танд баяр хүргэе!' && (await letter()).startsWith('Туршилт ХХК-ийн хамт олны нэг болсонд тань баяр хүргэж,') && (await letter()).endsWith('Манай багт тавтай морилно уу!'), 'with the letter to a new colleague, in the ХХК\'s own name');
  await p.locator('.welcome__skip').click(); await wait(900);
  ok((await p.locator('#page-title').innerText()).includes('Саруул') && p.url().includes('#home') || (await p.locator('#page-title').innerText()).includes('Саруул'), 'then Нүүр, signed in');
  let s = await st();
  const me = s.people[0];
  ok(s.companies.length === 1 && s.companies[0].name === 'Туршилт ХХК' && s.people.length === 1, 'one ХХК and one person');
  const acc = me.account.access[s.company];
  ok(me.account.sysadmin === true && me.account.active && me.account.login === 'saruul' && acc.admin && acc.hr === 'all' && acc.hrEdit && acc.attendance === 'all' && acc.docs === 'all' && acc.docsEdit, 'the one account is the system admin with every right');
  ok(Object.keys(s.roles[s.company]).length === 5 && Object.values(s.roles[s.company]).every(x => x === me.id), 'and holds the five process roles until others are named');
  const raw = await p.evaluate(() => JSON.stringify({ ...localStorage }));
  ok(!raw.includes('Turshilt2026') && me.account.hash?.length > 20 && me.account.salt?.length > 8, 'the password is kept only as its hash');
  ok(await p.evaluate(() => localStorage.getItem('erp:v1')) === null, 'nothing is written under the example data key');
  const filled = Object.entries(s).filter(([k, v]) => Array.isArray(v) && v.length && !['companies', 'people', 'docTypes'].includes(k)).map(([k, v]) => `${k}:${v.length}`);
  ok(filled.length === 0, `every list starts empty${filled.length ? ' (not: ' + filled.join(', ') + ')' : ''}`);

  // ---- Every page: nothing made up, nothing odd
  const pages = ['home', 'tasks', 'requests', 'chat', 'calendar', 'projects', 'draft', 'insights', 'insights-reports', 'team', 'hr', 'hr-employees', 'hr-structure', 'hr-attendance', 'docs', 'docs-contracts', 'docs-scans', 'docs-pdf', 'training', 'training-erp', 'admin', 'preferences'];
  const bad = [];
  for (const h of pages) {
    await go(h);
    const t = await main();
    const odd = t.match(/undefined|NaN|Invalid Date|\bnull\b|\[object Object\]/);
    const made = t.match(MADE_UP);
    if (odd || made || await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) bad.push(`${h}: ${odd?.[0] ?? made?.[0] ?? 'sideways'}`);
  }
  ok(bad.length === 0, `22 pages: nothing made up, nothing odd${bad.length ? ' (' + bad.join('; ') + ')' : ''}`);

  // ---- The example data's tools are gone
  await go('home'); await p.locator('.side__me').click(); await wait(300);
  const menu = await p.locator('[role="menu"]').last().innerText();
  ok(menu.includes('Гарах') && !menu.includes('Жишээ'), 'the account menu: no «Жишээ өгөгдлийг сэргээх»');
  await p.keyboard.press('Escape'); await wait(200);
  await go('preferences');
  ok(!(await main()).includes('Жишээ өгөгд') && (await main()).includes('Excel-ээр татах'), 'Тохиргоо → Өгөгдөл: the export stays, the reset is gone');
  let acts = 0;
  for (const h of ['docs-contracts', 'requests', 'insights-reports']) { await go(h); acts += await p.locator('.actas').count(); }
  ok(acts === 0, 'no «Туршилт: хэн болж ажиллах» on Гэрээ, Хүсэлт, Сарын тайлан');
  await go('docs-scans');
  ok(!(await main()).includes('Жишээ скан'), 'no example scan button');
  await go('hr-attendance');
  ok((await bar()).includes('Timely холбогдоогүй байна.') && await p.getByRole('button', { name: 'Жишээ ирц харах' }).count() === 0, 'without the server Ирц says so and offers no example month');

  // ---- Built up from nothing
  await go('hr-structure');
  ok((await main()).includes('Хэлтэс алга') && await p.locator('#main .empty, #main [class*="empty"]').count() > 0, 'Бүтэц says there are no departments yet');
  await go('hr-new');
  ok((await main()).includes('Эхлээд бүтцээ бүртгэнэ үү') && await p.locator('.eform').count() === 0, 'Ажилтан нэмэх sends the admin to the structure first');
  await p.getByRole('link', { name: 'Бүтэц, орон тоо руу очих' }).click(); await wait(900);
  ok(p.url().endsWith('#hr-structure'), 'its link leads there');
  await p.getByRole('button', { name: 'Хэлтэс нэмэх' }).first().click(); await wait(500);
  await p.locator('#df-name').fill('Санхүү'); await p.locator('#df-code').fill('САН'); await p.getByRole('button', { name: 'Нэмэх', exact: true }).click(); await wait(800);
  await p.getByRole('button', { name: 'Албан тушаал нэмэх' }).first().click(); await wait(500);
  await p.locator('#pf-name').fill('Нягтлан бодогч'); await p.locator('#pf-quota').fill('2'); await p.getByRole('button', { name: 'Нэмэх', exact: true }).click(); await wait(800);
  s = await st();
  ok(s.departments.length === 1 && s.positions.length === 1 && await p.locator('.dcard').count() === 1, 'a department and a position are added');
  await go('hr-new');
  ok(await p.locator('.eform').count() === 1 && await p.locator('#ef-dept option').count() === 1 && await p.locator('#ef-position option').count() === 1, 'now the employee form opens, with them to choose');
  await p.locator('#ef-family').fill('Бат'); await p.locator('#ef-given').fill('Тест-Нэг'); await p.locator('#ef-regNo').fill('УБ90010112'); await p.locator('#ef-phone').fill('99112233'); await p.locator('#ef-cNo').fill('ХГ-001');
  await p.getByRole('button', { name: 'Хадгалах', exact: true }).click(); await wait(1200);
  s = await st();
  ok(s.employees.length === 1 && s.employees[0].regNo === 'УБ90010112', `an employee is saved${s.employees.length ? '' : ': ' + (await p.locator('.mform__errors li').allInnerTexts()).join(' | ')}`);

  await go('chat'); await p.getByRole('button', { name: 'Шинэ зурвас' }).click(); await wait(500);
  ok((await p.locator('dialog[open]').last().innerText()).includes('Өөр хэрэглэгч бүртгэгдээгүй байна.'), 'Шинэ зурвас with nobody else says so');
  await p.keyboard.press('Escape'); await wait(400);

  await go('admin'); await p.getByRole('button', { name: 'Хэрэглэгч нэмэх' }).first().click(); await wait(600);
  const teamOpts = await p.locator('#inv-team option').allInnerTexts();
  ok(teamOpts.join('|') === 'Санхүү|Удирдлага|Шинэ хэлтэс…', `Хэрэглэгч нэмэх offers the departments so far and a new one (${teamOpts.join(', ')})`);
  await p.locator('#inv-given').fill('Номин'); await p.locator('#inv-family').fill('Гантулга'); await p.locator('#inv-email').fill('nomin@turshilt.mn');
  await p.locator('#inv-team').selectOption({ label: 'Шинэ хэлтэс…' }); await wait(200);
  await p.locator('#inv-password').fill('Turshilt2026'); await p.locator('#inv-preset').selectOption('hr');
  await p.getByRole('button', { name: 'Нэмэх', exact: true }).click(); await wait(400);
  ok((await p.locator('dialog[open] .mform__errors').innerText().catch(() => '')).includes('Хэлтсийн нэрийг бичнэ үү.'), 'a new department needs its name');
  await p.locator('#inv-newTeam').fill('Хүний нөөц'); await p.getByRole('button', { name: 'Нэмэх', exact: true }).click(); await wait(900);
  s = await st();
  const nomin = s.people.find(x => x.account?.login === 'nomin');
  ok(!!nomin && nomin.team === 'Хүний нөөц' && nomin.account.access[s.company].attendance === 'all' && !nomin.account.sysadmin, 'a user is added in a new department, with the Хүний нөөц rights');
  await invite('Тэмүжин', 'Очир', 'temuujin', 'head', 'Хүний нөөц');
  await invite('Анар', 'Сүрэн', 'anar', 'staff', undefined, 'Борлуулалт');
  s = await st();
  ok(s.people.length === 4 && s.people.filter(x => x.account?.sysadmin).length === 1 && s.people.find(x => x.account?.login === 'anar')?.team === 'Борлуулалт', 'four people, still one system admin');
  await go('team');
  t0 = await main();
  ok(t0.includes('4 хүн') && ['Удирдлага', 'Хүний нөөц', 'Борлуулалт'].every(x => t0.includes(x)), 'Баг shows them by department');
  await p.locator('.mcard', { hasText: 'Саруул' }).getByRole('button', { name: 'Мэдээлэл харах' }).click(); await wait(600);
  const drawer = await p.locator('dialog[open]').last().innerText();
  ok(drawer.includes('Саруул') && !drawer.includes('Имэйл'), 'the admin, set up without an e-mail, has no empty Имэйл line');
  await p.keyboard.press('Escape'); await wait(400);

  // ---- Signing out and in
  await signOut();
  ok(await p.title() === 'Нэвтрэх' && await p.locator('#su-company').count() === 0 && await p.locator('.login__demo').count() === 0, 'signed out: the sign-in page, not the set-up page, and no example accounts');
  await signIn('saruul', 'buruu-nuuts-ug1', false);
  ok(await p.locator('#login-name').count() === 1 && (await p.locator('body').innerText()).includes('буруу'), 'a wrong password is refused');
  await signIn('saruul', 'Turshilt2026', false);
  ok(await p.locator('dialog.welcome[open]').count() === 0 && (await p.locator('#page-title').innerText()).includes('Саруул'), 'the admin signs in again; the welcome page does not come twice');
  await p.reload({ waitUntil: 'networkidle' }); await wait(800);
  ok((await p.locator('#page-title').innerText().catch(() => '')).length > 0 && await p.locator('#login-name').count() === 0, 'a reload keeps them signed in');

  // ---- Ирц, behind the server's code, shows by itself
  mode = 'locked';
  await go('hr-attendance');
  ok((await bar()).includes('Ирц кодоор хамгаалагдсан.') && await p.locator('#att-code').count() === 1 && await p.locator('.att-table').count() === 0, 'the public address: locked until the code is given');
  await p.locator('#att-code').fill('buruu-kod'); await p.getByRole('button', { name: 'Нээх' }).click(); await wait(600);
  ok((await p.locator('#att-code-err').innerText().catch(() => '')).includes('Код буруу байна.') && await p.locator('.att-table').count() === 0, 'a wrong code opens nothing');
  await p.locator('#att-code').fill('zuv-kod-1234-5678'); await p.getByRole('button', { name: 'Нээх' }).click(); await wait(1500);
  ok((await bar()).includes('Timely холбогдсон: Өөр нэртэй байгууллага ХХК (1234567).'), `the right code: our only ХХК takes Timely's only organisation, though the names differ («${(await bar()).replace(/\s+/g, ' ').slice(0, 70)}»)`);
  ok(await p.locator('.sbar .att-pick').count() === 0 && (await st()).timely[s.company] === undefined, 'nothing to pick, nothing saved as picked');
  ok(asked.some(a => a.startsWith(`/api/attendance/month?company=77&month=${month}`)), 'the month is asked for that organisation');
  ok(await p.locator('.att-table tbody tr').count() === 5, 'all five of Timely show to the admin');
  const un = await p.locator('.att-un').innerText();
  ok(un.includes('Зөвхөн Timely-д (4)') && un.includes('Зөвхөн ERP-д (0)') && !un.includes('Тест-Нэг'), 'the one in Хүний нөөц is matched by register; the other four are listed as only in Timely');
  await p.locator('.att-table tbody tr', { hasText: 'Тест-Нэг' }).locator('a').click(); await wait(1200);
  ok(p.url().includes(`#hr-attendance-${(await st()).employees[0].id}`) && await p.locator('.acal__day').count() >= 28, 'the matched employee opens by our own record, with the calendar');

  // The rights: Хүний нөөц sees all, a manager only their own people, an employee nothing
  await signOut(); await signIn('nomin', 'Turshilt2026', true);
  ok((await p.locator('dialog.welcome .welcome__name').innerText().catch(() => '')).includes('Номин') && await p.locator('.welcome__team').count() === 1, 'a new user is welcomed by name, among colleagues');
  await p.locator('.welcome__skip').click(); await wait(800);
  await go('hr-attendance');
  ok(await p.locator('.att-table tbody tr').count() === 5 && (await bar()).includes('Timely холбогдсон'), 'Хүний нөөц (ирц: бүх ажилтан) sees everyone, linked the same way');
  ok(await p.locator('.side__nav a, .nav a').filter({ hasText: 'Удирдлага' }).count() === 0, 'without the admin right there is no Удирдлага');
  await signOut(); await signIn('temuujin', 'Turshilt2026', true); await p.locator('.welcome__skip').click(); await wait(800);
  await go('hr-attendance');
  let t = await main();
  ok(t.includes('Таны хариуцсан ажилтны ирц алга') && await p.locator('.att-table').count() === 0 && !/Тест-(Нэг|Хоёр|Гурав|Дөрөв|Тав)/.test(t), 'a manager with nobody under them sees no one, and is told why');
  await go('hr-attendance-t101');
  ok(!/Тест-Хоёр/.test(await main()), 'nor by an address');
  await signOut(); await signIn('anar', 'Turshilt2026', true); await p.locator('.welcome__skip').click(); await wait(800);
  const before = asked.length;
  await go('hr-attendance');
  t = await main();
  ok(await p.locator('.att-table').count() === 0 && !/Тест-(Нэг|Хоёр|Гурав|Дөрөв|Тав)/.test(t) && await p.locator('.side__nav a, .nav a').filter({ hasText: 'Хүний нөөц' }).count() === 0, 'an employee without the right sees no attendance and no Хүний нөөц');
  await go('hr-attendance-t101'); await go('home'); await wait(300);
  ok(asked.length === before, 'and nothing is asked of the server for them');

  // Several organisations, or several ХХК: the admin chooses
  await signOut(); await signIn('saruul', 'Turshilt2026', false);
  companies = TWO;
  await go('home'); await go('hr-attendance');
  ok((await bar()).includes('Timely-ээс энэ ХХК олдсонгүй.') && (await bar()).includes('Timely-ийн байгууллагыг сонгоно уу.') && await p.locator('.att-table').count() === 0, 'with two organisations nothing is guessed');
  await p.locator('.sbar .att-pick select').selectOption('78'); await wait(1300);
  ok((await bar()).includes('Timely холбогдсон: Хоёр дахь байгууллага ХХК') && (await st()).timely[s.company] === 78, 'the admin picks one, and it is kept');
  await p.locator('.sbar .att-pick select').selectOption(''); await wait(600);
  companies = ONE;
  await go('docs'); await p.locator('button', { hasText: 'Компани нэмэх' }).first().click(); await wait(600);
  await p.locator('#co-name').fill('Туршилт Хоёр ХХК'); await p.getByRole('button', { name: 'Нэмэх', exact: true }).click(); await wait(900);
  s = await st();
  ok(s.companies.length === 2, 'a second ХХК is added');
  await go('hr-attendance');
  ok(s.company === (await st()).company && (await bar()).includes('Timely-ээс энэ ХХК олдсонгүй.'), 'with two ХХК the one organisation is not given to either by itself');

  // ---- A browser that still holds the example data
  const old = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const kept = JSON.stringify({ version: 1, me: 'u1', people: [{ id: 'u1', given: 'Хуучин' }], mark: 'хөндөж болохгүй' });
  await old.addInitScript(k => { if (!localStorage.getItem('erp:v1')) { localStorage.setItem('erp:v1', k); localStorage.setItem('erp:session', JSON.stringify({ user: 'u1', until: Date.now() + 864e5 })); } }, kept);
  const q = await old.newPage(); const qerr = []; q.on('pageerror', e => qerr.push(e.message));
  await q.goto(BASE, { waitUntil: 'networkidle' }); await q.waitForTimeout(800);
  ok(await q.title() === 'Системийг эхлүүлэх' && qerr.length === 0, 'a browser with the example data and its old sign-in opens the set-up page, without an error');
  await q.locator('#su-company').fill('Жинхэнэ нэр'); await q.locator('#su-family').fill('Бат'); await q.locator('#su-given').fill('Эрдэнэ'); await q.locator('#su-login').fill('erdene'); await q.locator('#su-password').fill('Turshilt2026'); await q.locator('#su-again').fill('Turshilt2026');
  await q.getByRole('button', { name: 'Эхлүүлэх' }).click(); await q.waitForSelector('dialog.welcome[open]', { timeout: 15000 }).catch(() => {}); await q.waitForTimeout(800);
  ok(await q.evaluate(() => localStorage.getItem('erp:v1')) === kept && JSON.parse(await q.evaluate(() => localStorage.getItem('erp:data'))).people.length === 1, 'the example data stays as it was, beside the new system');
  ok((await q.evaluate(() => document.querySelector('dialog.welcome .welcome__letter p .sr-only')?.textContent ?? '')).startsWith('Жинхэнэ нэр компанийн хамт олны нэг болсонд тань'), 'a company name that does not end in ХХК gets no ending joined to it in the letter');
  await old.close();

  ok(errors.length === 0, `no page errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 5).join(' / ') : ''}`);
  console.log(fails ? `FAILED ${fails}` : 'ALL OK');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
