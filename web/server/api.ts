// The ERP's own server: who is signed in, and the data everyone shares (docs/decisions.md, 2026-11-15). Web-standard
// Request and Response only, so the same code runs on Cloudflare (worker/site.js) and on Node (server/main.ts).
//
// GET  /api/state         a server is here; whether the system has been set up; who is signed in in this browser
// POST /api/setup         the first ХХК and whoever sets the system up: once, and on a public address only with the
//                         code, unless its owner had the door opened for a while (codeNeeded)
// POST /api/login/salt    what the browser stretches a login's password with
// POST /api/login         signs in: a cookie JavaScript cannot read, for 14 days
// POST /api/logout
// POST /api/invite        a new person with their login, and a password or a sign-in link, by an admin of the ХХК
// POST /api/password      one's own new password (with the present one), or someone's by whoever manages their account
// POST /api/link/new      a sign-in link for someone, by whoever manages their account
// POST /api/link/who      whose a sign-in link is, while it holds
// POST /api/link/use      the link's person sets their password with it, and is signed in
// GET  /api/sync          what changed since; POST also takes the browser's changes in (server/data.ts)
// GET, PUT /api/files/ID  the files people add (server/files.ts)
// /api/attendance, /api/scan   as before, now for whoever is signed in, by their rights
import { all, one, prepare, type Db } from './db.ts'
import { changesOf, ctxFor, pull, push, worldOf, type Change } from './data.ts'
import { handleFiles, type FileStore } from './files.ts'
import type { Ctx } from './rules.ts'
import { handleAttendance, plainCode, same, type Gate, type TimelyEnv } from './timely.ts'
import { handleScan } from './scan.ts'
import { accessOf, managesAccount, teamOf } from '../src/lib/access.ts'
import { linkOf } from '../src/lib/attendance.ts'
import type { Employee, Id, Person } from '../src/lib/types.ts'

export interface ApiEnv extends TimelyEnv { DB?: Db; FILES?: FileStore; OPENROUTER_API_KEY?: string }

const COOKIE = 'erp_sid'
const DAYS14 = 14 * 86_400
/** Wrong passwords in a row before the next try must wait: 30 seconds, then twice as long each time, an hour at most */
const FREE = 5
const LOGIN = /^[a-z0-9._-]{3,32}$/
/** What the browser sends for a password: 32 bytes in base64; a salt: 16 */
const HASH = /^[A-Za-z0-9+/]{43}=$/
const SALT = /^[A-Za-z0-9+/]{22}==$/

const json = (body: unknown, status = 200, more: Record<string, string> = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...more } })
const said = (error: string, status: number, more: object = {}) => json({ error, ...more }, status)
const text = (v: unknown): v is string => typeof v === 'string'
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const b64u = (b: Uint8Array) => b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
/** What is kept of a secret: enough to know it again, not to read it back */
const kept = async (secret: string) => b64u(await digest(secret))
const now = () => Math.floor(Date.now() / 1000)

/** Who the browser's cookie says it is, while the sign-in lasts */
async function sessionOf(req: Request, db: Db) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([\\w-]{40,})`).exec(req.headers.get('cookie') ?? '')
  if (!m) return null
  const sid = await kept(m[1])
  const s = await one<{ person: Id; until: number }>(db, `SELECT person, until FROM sessions WHERE id = ?`, sid)
  return s && s.until > now() ? { me: s.person, sid } : null
}
const cookie = (req: Request, value: string, age: number) =>
  `${COOKIE}=${value}; Path=/api; Max-Age=${age}; HttpOnly; SameSite=Strict${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`
/** A new sign-in: the statement that keeps it, and the cookie that carries it */
async function signIn(req: Request, db: Db, person: Id) {
  const token = b64u(crypto.getRandomValues(new Uint8Array(32)))
  return { stmt: db.prepare(`INSERT INTO sessions (id, person, until) VALUES (?, ?, ?)`).bind(await kept(token), person, now() + DAYS14), cookie: cookie(req, token, DAYS14) }
}

type Body = Record<string, unknown>

/** A sign-in link holds a week, and once */
const WEEK = 7 * 86_400
const BAD_LINK = 'Энэ холбоос хүчингүй болсон байна. Удирдлагадаа хандаж шинэ холбоос авна уу.'
/** A password nobody knows: a person invited by link signs in only once they have set their own */
const unknowable = () => b64u(crypto.getRandomValues(new Uint8Array(32)))

/** A link's secret: 12 letters and figures, about 71 bits of chance. Letters and figures only, so that a link stays
 *  whole wherever it is pasted; each as likely as the next (248 is the largest multiple of 62 under 256). */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const SHORT = /^[A-Za-z0-9]{12}$/
function linkSecret() {
  let out = ''
  while (out.length < 12) for (const b of crypto.getRandomValues(new Uint8Array(16))) if (b < 248 && out.length < 12) out += LETTERS[b % 62]
  return out
}

/**
 * A new sign-in link for the person (docs/decisions.md, 2026-11-16; short since 2026-11-26): whoever opens it sets the
 * person's password and is signed in as them. The link carries its secret alone; the server keeps what is kept of it in
 * meta under `link:<person>`, so a newer link puts out the one before, and the person is found by it.
 */
async function newLink(db: Db, who: Id) {
  const secret = linkSecret()
  await all(db, `INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v`, `link:${who}`, JSON.stringify({ t: await kept(secret), until: now() + WEEK }))
  return secret
}

/** The person a sign-in link is for, while it holds; else null. A link made before 2026-11-26 is `<person>.<secret>`. */
async function linkHolder(db: Db, token: unknown): Promise<Id | null> {
  if (!text(token)) return null
  const dot = token.lastIndexOf('.')
  if (dot < 1 && !SHORT.test(token)) return null
  const t = await kept(dot < 1 ? token : token.slice(dot + 1))
  const rows = dot < 1
    ? await all<{ k: string; v: string }>(db, `SELECT k, v FROM meta WHERE k LIKE 'link:%'`)
    : await all<{ k: string; v: string }>(db, `SELECT k, v FROM meta WHERE k = ?`, `link:${token.slice(0, dot)}`)
  for (const row of rows) {
    const v = JSON.parse(row.v) as { t: string; until: number }
    if (v.until > now() && same(t, v.t)) return row.k.slice('link:'.length)
  }
  return null
}

/** The link's person sets their password and is in; whoever was signed in as them before is out */
async function useLink(req: Request, db: Db, b: Body) {
  if (!text(b.salt) || !SALT.test(b.salt) || !text(b.hash) || !HASH.test(b.hash)) return said('Хүсэлт буруу байна.', 400)
  const who = await linkHolder(db, b.token)
  if (!who) return said(BAD_LINK, 404)
  if (!ctxFor(await worldOf(db), who)) return said('Таны бүртгэл идэвхгүй байна. Удирдлагадаа хандана уу.', 403)
  const session = await signIn(req, db, who)
  await db.batch([
    db.prepare(`UPDATE accounts SET salt = ?, hash = ?, tries = 0, until = 0 WHERE person = ?`).bind(b.salt, await kept(b.hash), who),
    db.prepare(`DELETE FROM meta WHERE k = ?`).bind(`link:${who}`),
    db.prepare(`DELETE FROM sessions WHERE person = ?`).bind(who),
    session.stmt,
  ])
  return json({ me: who }, 200, { 'Set-Cookie': session.cookie })
}

/**
 * Whether setting the system up asks for the code. Whoever sets it up holds every right in it, so on a public address
 * it does. The owner asked for their director to make the account without a code (docs/decisions.md, 2026-11-15): the
 * database's meta row `open` holds the time until which none is asked, written there by hand for a few days; after
 * that, or once the system is set up, the door is as it was.
 */
async function codeNeeded(env: ApiEnv, db: Db) {
  if (env.ATTENDANCE_CODE === undefined) return false
  return !(Number((await one<{ v: number }>(db, `SELECT v FROM meta WHERE k = 'open'`))?.v) > now())
}

async function setup(req: Request, env: ApiEnv, db: Db, b: Body) {
  // With the code its owner put in the server's settings (the one that opened Ирц before people could sign in).
  // Without one set there, the door is shut.
  if (await codeNeeded(env, db)) {
    const code = plainCode(env.ATTENDANCE_CODE)
    if (code.length < 16) return said('Ирцийн код тохируулаагүй байна.', 503)
    if (!same(plainCode(b.code), code)) return said('Код буруу байна. Дахин шалгаад бичнэ үү.', 401, { field: 'code' })
  }
  const changes = changesOf(b.changes)
  const person = changes?.filter(ch => ch.c === 'people') ?? []
  const record = person[0]?.ops?.[0]?.[1] as Person | undefined
  if (!changes || !text(b.login) || !LOGIN.test(b.login) || !text(b.salt) || !SALT.test(b.salt) || !text(b.hash) || !HASH.test(b.hash) || person.length !== 1 || !record?.account) return said('Хүсэлт буруу байна.', 400)
  if (await one(db, `SELECT 1 FROM accounts LIMIT 1`)) return said('Системийг аль хэдийн эхлүүлсэн байна. Нэвтэрнэ үү.', 409)
  // The one person of the founding is the one who signs in, with every right
  const me = person[0].id
  record.account = { ...record.account, login: b.login, active: true, sysadmin: true }
  const session = await signIn(req, db, me)
  const refused = await push(db, null, changes, [
    // Only one founding: a second at the same moment fails here, and none of its records are kept
    db.prepare(`INSERT INTO meta (k, v) VALUES ('founder', ?)`).bind(me),
    db.prepare(`INSERT INTO accounts (person, login, salt, hash) VALUES (?, ?, ?, ?)`).bind(me, b.login, b.salt, await kept(b.hash)),
    session.stmt,
  ])
  if (refused.some(r => r[2])) return said('Системийг эхлүүлж чадсангүй. Дахин оролдоно уу.', 409)
  return json({ me }, 200, { 'Set-Cookie': session.cookie })
}

async function salt(db: Db, b: Body) {
  if (!text(b.login)) return said('Хүсэлт буруу байна.', 400)
  const a = await one<{ salt: string }>(db, `SELECT salt FROM accounts WHERE login = ?`, b.login)
  if (a) return json({ salt: a.salt })
  // A login nobody has gets a salt too, the same each time, so asking does not tell which logins there are
  const pepper = (await one<{ v: string }>(db, `SELECT v FROM meta WHERE k = 'pepper'`))?.v ?? ''
  return json({ salt: b64((await digest(`${pepper}:${b.login}`)).slice(0, 16)) })
}

async function login(req: Request, db: Db, b: Body) {
  if (!text(b.login) || !text(b.hash)) return said('Хүсэлт буруу байна.', 400)
  const a = await one<{ person: Id; hash: string; tries: number; until: number }>(db, `SELECT person, hash, tries, until FROM accounts WHERE login = ?`, b.login)
  if (a && a.until > now()) return json({ wait: a.until - now() }, 429)
  if (!a || !same(await kept(b.hash), a.hash)) {
    // Counted for the login, wherever the tries come from. A wrong login and a wrong password answer alike.
    const tries = (a?.tries ?? 0) + 1
    const wait = tries >= FREE ? Math.min(3600, 30 * 2 ** (tries - FREE)) : 0
    if (a) await all(db, `UPDATE accounts SET tries = ?, until = ? WHERE person = ?`, tries, wait ? now() + wait : 0, a.person)
    return json({ wrong: true, wait }, 401)
  }
  if (!ctxFor(await worldOf(db), a.person)) return json({ inactive: true }, 403)
  const session = await signIn(req, db, a.person)
  await db.batch([session.stmt, db.prepare(`UPDATE accounts SET tries = 0, until = 0 WHERE person = ?`).bind(a.person), db.prepare(`DELETE FROM sessions WHERE until < ?`).bind(now())])
  return json({ me: a.person }, 200, { 'Set-Cookie': session.cookie })
}

/**
 * A new person in the ХХК, as dialogs/Invite.tsx makes them: the record, and the password they sign in with, or none:
 * then the answer carries the sign-in link they set their own with
 */
async function invite(db: Db, x: Ctx, b: Body) {
  const p = b.person as Person | undefined
  const a = p?.account
  const byLink = b.salt === undefined && b.hash === undefined
  if (!p || !text(p.id) || !Array.isArray(p.companies) || p.companies.length !== 1 || !a || (!byLink && (!text(b.salt) || !SALT.test(b.salt) || !text(b.hash) || !HASH.test(b.hash)))) return said('Хүсэлт буруу байна.', 400)
  const company = p.companies[0]
  if (!accessOf(x.s, x.me, company).admin) return said('Танд хэрэглэгч нэмэх эрх алга.', 403)
  if (!text(a.login) || !LOGIN.test(a.login)) return said('Нэвтрэх нэр латин үсэг, тоотой, 3-аас 32 тэмдэгт байх ёстой.', 400)
  if (x.rec('people', p.id) || (await one(db, `SELECT 1 FROM accounts WHERE login = ?`, a.login))) return said('Энэ нэвтрэх нэр өөр хүнд бүртгэлтэй байна.', 409)
  // Rights in this ХХК only, and never the system's own
  const record: Person = { ...p, account: { login: a.login, active: true, access: { [company]: a.access?.[company] } } as Person['account'] }
  const change: Change = { c: 'people', id: p.id, ops: [[[], record]], pos: typeof b.pos === 'number' ? b.pos : undefined }
  const [salt, hash] = byLink ? [b64(crypto.getRandomValues(new Uint8Array(16))), unknowable()] : [b.salt as string, await kept(b.hash as string)]
  const refused = await push(db, null, [change], [db.prepare(`INSERT INTO accounts (person, login, salt, hash) VALUES (?, ?, ?, ?)`).bind(p.id, a.login, salt, hash)])
  if (refused.some(r => r[2])) return said('Хэрэглэгчийг нэмж чадсангүй. Дахин оролдоно уу.', 409)
  return json(byLink ? { link: await newLink(db, p.id) } : { ok: true })
}

async function password(db: Db, x: Ctx, sid: string, b: Body) {
  if (!text(b.who) || !text(b.salt) || !SALT.test(b.salt) || !text(b.hash) || !HASH.test(b.hash)) return said('Хүсэлт буруу байна.', 400)
  const a = await one<{ hash: string }>(db, `SELECT hash FROM accounts WHERE person = ?`, b.who)
  if (!a) return said('Хэрэглэгч олдсонгүй.', 404)
  if (b.who === x.me) {
    if (!text(b.old) || !same(await kept(b.old), a.hash)) return said('Одоогийн нууц үг буруу байна.', 401, { field: 'old' })
  } else if (!managesAccount(x.s, x.me, b.who)) return said('Танд нууц үг солих эрх алга.', 403)
  await db.batch([
    db.prepare(`UPDATE accounts SET salt = ?, hash = ?, tries = 0, until = 0 WHERE person = ?`).bind(b.salt, await kept(b.hash), b.who),
    // Signed out everywhere else: whoever had the old password is out
    db.prepare(`DELETE FROM sessions WHERE person = ? AND id != ?`).bind(b.who, sid),
  ])
  return json({ ok: true })
}

/**
 * Ирц as the signed-in person may see it. A Timely company is the attendance of the ХХК it is linked to
 * (lib/attendance.ts linkOf): there the person sees everyone, the people under them, or only themself, by their Ирц
 * right. Rows carry our employee's id, matched here by registration number; the number itself goes on only to those
 * Хүний нөөц's rights reach.
 */
const gateOf = (x: Ctx): Gate => (company, companies) => {
  const key = (r: string) => r.replace(/\s/g, '').toUpperCase()
  const mine = x.s.companies.filter(c => (x.sys || x.mine.has(c.id)) && linkOf(x.s, c.id, companies)?.id === company.id)
  if (!mine.length) return null
  const everyone = mine.some(c => accessOf(x.s, x.me, c.id).attendance === 'all')
  const open = new Map<string, { e: Employee; whole: boolean }>()
  for (const c of mine) {
    const a = accessOf(x.s, x.me, c.id)
    const team = teamOf(x.s, x.me, c.id)
    for (const e of x.s.employees) {
      if (e.company !== c.id || !e.regNo) continue
      const seen = a.attendance === 'all' || (a.attendance === 'team' ? team.has(e.id) : e.user === x.me)
      if (seen) open.set(key(e.regNo), { e, whole: a.hr === 'all' || (a.hr === 'team' && team.has(e.id)) })
    }
  }
  return t => {
    const m = t.register ? open.get(key(t.register)) : undefined
    // Someone only Timely knows shows to whoever sees everyone's attendance, to be matched
    return m ? { ...t, emp: m.e.id, register: m.whole ? t.register : '' } : everyone ? t : null
  }
}

/** Answers /api/…, or null when the path is not the server's */
export async function handleApi(req: Request, env: ApiEnv): Promise<Response | null> {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api\/?/, '')
  if (!url.pathname.startsWith('/api/')) return null
  const db = env.DB
  // Without a database (an older deployment): Ирц behind its code and the scan reader, as before
  if (!db) return path.startsWith('attendance') ? handleAttendance(req, env) : path === 'scan' ? handleScan(req, env) : said('Сервер хараахан байхгүй.', 404)
  // Only our own pages change anything. Another site's page cannot send JSON, or put a file, here without asking first
  // (and is told no), its requests carry no cookie (SameSite), and the browser itself says where a request comes from.
  const from = req.headers.get('sec-fetch-site')
  const plain = path.startsWith('files/') || /^application\/json/.test(req.headers.get('content-type') ?? '')
  if (req.method !== 'GET' && ((from && from !== 'same-origin' && from !== 'none') || !plain)) return said('Хүсэлт буруу байна.', 403)
  try {
    return await route(req, env, db, url, path)
  } catch (e) {
    // A database nothing has been made in yet: its tables are made, and the request answered again
    if (!/no such table/i.test(String((e as Error)?.message ?? e))) throw e
    await prepare(db)
    return route(req, env, db, url, path)
  }
}

async function route(req: Request, env: ApiEnv, db: Db, url: URL, path: string): Promise<Response> {
  const post = req.method === 'POST'
  const session = await sessionOf(req, db)
  if (path === 'state' && !post) {
    const started = !!(await one(db, `SELECT 1 FROM accounts LIMIT 1`))
    const x = session && ctxFor(await worldOf(db), session.me)
    return json({ server: true, started, me: x ? x.me : null, code: !started && (await codeNeeded(env, db)) })
  }
  // The scan reader reads its own body (pages as pictures); everything else is small
  const b: Body = post && path !== 'scan' ? ((await req.json().catch(() => null)) ?? {}) : {}
  if (post && path === 'setup') return setup(req, env, db, b)
  if (post && path === 'login/salt') return salt(db, b)
  if (post && path === 'login') return login(req, db, b)
  if (post && path === 'link/who') {
    const who = await linkHolder(db, b.token)
    const p = who ? (await worldOf(db)).recs.get('people')?.get(who) as Person | undefined : undefined
    return p?.account ? json({ given: p.given, family: p.family, login: p.account.login }) : said(BAD_LINK, 404)
  }
  if (post && path === 'link/use') return useLink(req, db, b)
  if (post && path === 'logout') {
    if (session) await all(db, `DELETE FROM sessions WHERE id = ?`, session.sid)
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(req, '', 0) })
  }
  // From here on: only for someone signed in who may still sign in
  const x = session && ctxFor(await worldOf(db), session.me)
  if (!session || !x) return said('Нэвтэрнэ үү.', 401, { signedOut: true })
  if (post && path === 'invite') return invite(db, x, b)
  if (post && path === 'password') return password(db, x, session.sid, b)
  if (post && path === 'link/new') {
    if (!text(b.who) || !x.rec<Person>('people', b.who)?.account) return said('Хэрэглэгч олдсонгүй.', 404)
    if (!managesAccount(x.s, x.me, b.who)) return said('Танд энэ хэрэглэгчид нэвтрэх холбоос үүсгэх эрх алга.', 403)
    return json({ link: await newLink(db, b.who) })
  }
  if (path === 'sync') {
    const since = Number(post ? b.since : url.searchParams.get('since')) || 0
    const scope = String((post ? b.scope : url.searchParams.get('scope')) ?? '')
    if (!post) return json(await pull(db, await worldOf(db), x, since, scope))
    const changes = changesOf(b.changes)
    if (!changes) return said('Хүсэлт буруу байна.', 400)
    const refused = await push(db, x.me, changes)
    // By the organisation as the changes left it
    const w = await worldOf(db)
    const after = ctxFor(w, x.me)
    return after ? json(await pull(db, w, after, since, scope, refused)) : said('Нэвтэрнэ үү.', 401, { signedOut: true })
  }
  if (path.startsWith('files/')) return env.FILES ? handleFiles(req, env.FILES, x.me, path.slice(6)) : said('Файл хадгалах газар тохируулаагүй байна.', 404)
  if (path.startsWith('attendance')) return handleAttendance(req, env, gateOf(x))
  if (path === 'scan') return handleScan(req, env)
  return said('Хүсэлт буруу байна.', 404)
}
