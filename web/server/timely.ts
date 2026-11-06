// Ирц from Timely (developer.timely.mn), for Хүний нөөц → Ирц. Each ХХК's Timely account has a key, kept here and never
// sent to the browser:
//   TIMELY_API_KEYS=timely_sk_…,timely_sk_… node server/main.ts
// A key belongs to one Timely company; the browser finds its ХХК among them by name. A key is traded for a token that
// lasts an hour, and answers are kept 5 minutes, as the HR plan asks. Read only, and only what the screens show: the
// salary and bank details Timely also has (/employees/info) are never asked for (docs/decisions.md, 2026-10-31).
// Web-standard Request and Response only, like scan.ts.
import type { DayKind, TimelyCompany, TimelyDay, TimelyEmployee, TimelyMonth } from '../src/lib/types.ts'

const API = 'https://api.timely.mn/openapi'
/** How long an answer is kept before Timely is asked again */
export const KEEP = 5 * 60_000
/** "Шинэчлэх" asks again only when the answer is older than this */
const FRESH = 30_000

export interface TimelyEnv { TIMELY_API_KEYS?: string; ATTENDANCE_CODE?: string }

interface Account { key: string; token?: string; until?: number; scopes?: string[]; company?: TimelyCompany; groups?: Map<string, string> }
const accounts = new Map<string, Account>()
const kept = new Map<string, { at: number; value: object }>()

/** Forgets tokens and answers; for the tests */
export const forget = () => (accounts.clear(), kept.clear())

const SAID: Record<number, string> = {
  401: 'Timely-ийн түлхүүр буруу эсвэл идэвхгүй байна. Timely-ийн тохиргооноос шалгана уу.',
  403: 'Timely-ийн түлхүүрт энэ мэдээллийг унших эрх алга. Түлхүүрт ирц, ажилтны мэдээлэл унших эрх өгнө үү.',
  429: 'Timely ачаалалтай байна. Түр хүлээгээд дахин оролдоно уу.',
}
const SILENT = 'Timely хариу өгсөнгүй. Түр хүлээгээд дахин оролдоно уу.'

/** Node runs this file by stripping the types, so no parameter properties */
class TimelyError extends Error {
  code: number
  constructor(message: string, code = 0) {
    super(message)
    this.code = code
  }
}

/** Never kept by a browser or on the way: the answers carry names and attendance */
const json = (body: unknown, status = 200, more: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...more } })

/** One call; Timely answers { success, message, result } */
async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(API + path, { ...init, signal: AbortSignal.timeout(20_000) }).catch(() => {
    throw new TimelyError(SILENT)
  })
  const j = await res.json().catch(() => null)
  if (!res.ok || !j?.success) throw new TimelyError(SAID[res.status] ?? (typeof j?.message === 'string' ? j.message : SILENT), res.status)
  return j.result
}

/** The key's token, traded again a couple of minutes before its hour is up */
async function token(a: Account, again = false) {
  if (!again && a.token && a.until! > Date.now()) return a.token
  const r = await call('/auth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: a.key }) })
  a.token = String(r.accessToken)
  a.until = Date.now() + (Number(r.expiresIn) - 120) * 1000
  a.scopes = Array.isArray(r.scopes) ? r.scopes : []
  return a.token
}

/** A read with the token; a token Timely no longer takes is traded again once */
async function get(a: Account, path: string) {
  try {
    return await call(path, { headers: { Authorization: `Bearer ${await token(a)}` } })
  } catch (e) {
    if (!(e instanceof TimelyError) || e.code !== 401 || !a.token) throw e
    return call(path, { headers: { Authorization: `Bearer ${await token(a, true)}` } })
  }
}

const accountsOf = (env: TimelyEnv) =>
  (env.TIMELY_API_KEYS ?? '').split(',').map(k => k.trim()).filter(Boolean).map(key => accounts.get(key) ?? accounts.set(key, { key }).get(key)!)

async function companyOf(a: Account): Promise<TimelyCompany> {
  if (!a.company) {
    const c = await get(a, '/company')
    a.company = { id: Number(c.id), name: String(c.name ?? ''), register: c.register ?? null, scopes: a.scopes ?? [] }
  }
  return a.company
}

/** An answer kept for 5 minutes; "Шинэчлэх" asks again unless it is fresh */
async function keep<T extends object>(key: string, again: boolean, make: () => Promise<T>) {
  const k = kept.get(key)
  const age = k ? Date.now() - k.at : Infinity
  if (k && (age < FRESH || (!again && age < KEEP))) return k.value as T & { updated: string }
  const value = { ...(await make()), updated: new Date().toISOString() }
  kept.set(key, { at: Date.now(), value })
  return value
}

/** Today in Ulaanbaatar (UTC+8 all year) */
const ubToday = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
/** The day before YYYY-MM-DD */
const dayBefore = (d: string) => new Date(Date.parse(d) - 86_400_000).toISOString().slice(0, 10)

/** The month's first day to its last, or to today; null for a month still to come */
export function rangeOf(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const today = ubToday()
  const from = `${month}-01`
  return from > today ? null : { from, to: last < today ? last : today }
}

/** Timely's own shapes, as far as they are read here; anything may be missing */
interface RawLeave { year?: number; earnedDays?: number; usedDays?: number; remainingDays?: number; uncapped?: boolean; used?: { begDate?: string; endDate?: string; days?: number }[] }
interface RawEmployee { workerId?: number; firstname?: string | null; lastname?: string | null; register?: string | null; position?: string | null; division?: { name?: string | null } | null; annualLeave?: RawLeave | null }
interface RawSummary { supposedWorkDays?: number; supposedWorkHours?: number; workedDays?: number; workedHours?: number }
interface RawDay { date?: string; clockIn?: string | null; clockOut?: string | null; statusDetail?: { code?: string; name?: string }[] | null }
interface RawRequestType { code?: string; group?: { code?: string } | null; subTypes?: { code?: string }[] | null }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * HH:MM as Timely writes it: "08:52", "2026-07-01 08:52:13" or "2026-11-04T08:52:13.000Z". Its times are Ulaanbaatar
 * time, as its docs say, though they end in the "Z" of UTC: real clock-ins came as T07–T09…Z (2026-11-04). Nothing is added.
 */
export function hm(v: unknown): string | null {
  const m = typeof v === 'string' ? /(\d{1,2}):(\d{2})/.exec(v) : null
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

/** Each request code's group ("worked", "unworked"…), from the request types, which Timely's docs say decode its days */
async function groupsOf(a: Account) {
  if (!a.groups) {
    const r = await get(a, '/request-types')
    const types: RawRequestType[] = Array.isArray(r) ? r : []
    a.groups = new Map(types.flatMap(t => [t, ...(t.subTypes ?? [])].map(x => [str(x.code), str(t.group?.code)] as [string, string])))
  }
  return a.groups
}

/**
 * What Timely's day words settle for a day without clocks: absent (Тасалсан; Timely ranks it first), away on leave,
 * sickness or time off (group "unworked", "overtime_rest"), at work elsewhere (group "worked": Томилолт, Зайнаас ажиллах),
 * or a day off by the schedule or a holiday (Амралт, Чөлөөт). Null leaves it to the browser's guess.
 */
function kindOf(codes: string[], groups: Map<string, string>): DayKind | null {
  const g = codes.map(c => groups.get(c))
  if (codes.includes('absent')) return 'none'
  if (g.includes('unworked') || g.includes('overtime_rest')) return 'leave'
  if (g.includes('worked')) return 'in'
  return codes.includes('rest') || codes.includes('free') ? 'rest' : null
}

function employeeOf(e: RawEmployee, s: RawSummary | null): TimelyEmployee {
  const l = e.annualLeave
  return {
    workerId: num(e.workerId),
    family: str(e.lastname),
    given: str(e.firstname),
    register: str(e.register).toUpperCase(),
    position: str(e.position),
    division: str(e.division?.name),
    // Without a cap Timely counts nothing earned or left (both 0, for all 20 on 2026-11-04): null, not none left
    leave: l
      ? {
          year: num(l.year), earned: l.uncapped ? null : num(l.earnedDays), used: num(l.usedDays), left: l.uncapped ? null : num(l.remainingDays),
          taken: (Array.isArray(l.used) ? l.used : []).map(u => ({ from: str(u.begDate).slice(0, 10), to: str(u.endDate).slice(0, 10), days: num(u.days) })),
        }
      : null,
    supposedDays: num(s?.supposedWorkDays),
    supposedHours: num(s?.supposedWorkHours),
    workedDays: num(s?.workedDays),
    workedHours: num(s?.workedHours),
  }
}

/**
 * Everyone active, with their leave, and each one's month: four at a time, since only the one-employee summary is
 * documented. Today is still being worked, yet Timely counts all its hours to work, so the month is summed to yesterday;
 * on the 1st nothing is over yet.
 */
async function monthOf(a: Account, month: string, range: { from: string; to: string }): Promise<Omit<TimelyMonth, 'updated'>> {
  const to = range.to === ubToday() ? dayBefore(range.to) : range.to
  const list = await get(a, '/employees')
  const people: RawEmployee[] = Array.isArray(list) ? list : []
  const employees: TimelyEmployee[] = []
  for (let i = 0; i < people.length; i += 4) {
    employees.push(
      ...(await Promise.all(
        people.slice(i, i + 4).map(async e => {
          const s: RawSummary | null = to < range.from ? null : await get(a, `/employees/attendance-summary?workerId=${num(e.workerId)}&dateFrom=${range.from}&dateTo=${to}`).catch(err => {
            if (err instanceof TimelyError && err.code === 404) return null
            throw err
          })
          return employeeOf(e, s)
        }),
      )),
    )
  }
  return { month, from: range.from, to, employees }
}

/** One employee's days with Timely's own words for each; without the request types, the words still come */
async function daysOf(a: Account, worker: number, range: { from: string; to: string }): Promise<{ days: TimelyDay[] }> {
  const groups = await groupsOf(a).catch(() => new Map<string, string>())
  const r = await get(a, `/employees/attendance?workerId=${worker}&dateFrom=${range.from}&dateTo=${range.to}`)
  const days: RawDay[] = Array.isArray(r?.attendance) ? r.attendance : []
  return {
    days: days.map(d => {
      const st = Array.isArray(d.statusDetail) ? d.statusDetail : []
      const status = [...new Set(st.map(x => str(x.name)).filter(Boolean))]
      return { date: str(d.date).slice(0, 10), in: hm(d.clockIn), out: hm(d.clockOut), status, kind: kindOf(st.map(x => str(x.code)), groups) }
    }),
  }
}

// The door until the ERP signs people in on the server (docs/decisions.md, 2026-11-04). With ATTENDANCE_CODE set (the
// test address always sets one, worker/site.js), attendance opens only to a browser that gave the code: it is traded for
// a 30-day cookie JavaScript cannot read, signed with the code itself, so a new code shuts every door at once. The code
// is long and random, so guessing it is hopeless. Without it set (the local server) the door stands open.
const COOKIE = 'erp_att'
const DAYS30 = 30 * 86_400
/** Lower case letters and digits only, so dashes, spaces and capitals typed do not matter */
const plainCode = (v: unknown) => (typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9]/g, '') : '')
/** Equal, taking as long whichever character differs */
const same = (a: string, b: string) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0

async function signed(code: string, until: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`attendance ${until}`)))
  return btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The browser's cookie, still in date and signed with this code */
async function opened(req: Request, code: string) {
  const c = new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([\\w-]+)`).exec(req.headers.get('cookie') ?? '')
  return !!c && Number(c[1]) > Date.now() / 1000 && same(c[2], await signed(code, Number(c[1])))
}

/**
 * GET /api/attendance: the Timely companies the keys open.
 * GET /api/attendance/month?company=&month=YYYY-MM[&fresh]: everyone's month and leave.
 * GET /api/attendance/days?company=&worker=&month=YYYY-MM[&fresh]: one employee's days.
 * POST /api/attendance/unlock { code }: the cookie that opens them, where a code is set.
 */
export async function handleAttendance(req: Request, env: TimelyEnv): Promise<Response> {
  const url = new URL(req.url)
  const what = url.pathname.replace(/^\/api\/attendance\/?/, '')
  // Set but too short to be safe opens nothing
  const code = env.ATTENDANCE_CODE === undefined ? null : plainCode(env.ATTENDANCE_CODE)
  const usable = !!code && code.length >= 16
  if (what === 'unlock') {
    if (req.method !== 'POST') return json({ error: 'Хүсэлт буруу байна.' }, 405)
    if (!usable) return json({ error: 'Ирцийн код тохируулаагүй байна.' }, 503)
    const given = plainCode((await req.json().catch(() => null))?.code)
    if (!same(given, code)) return json({ error: 'Код буруу байна. Дахин шалгаад бичнэ үү.' }, 401)
    const until = Math.floor(Date.now() / 1000) + DAYS30
    return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=${until}.${await signed(code, until)}; Path=/api/attendance; Max-Age=${DAYS30}; HttpOnly; Secure; SameSite=Strict` })
  }
  if (req.method !== 'GET') return json({ error: 'Хүсэлт буруу байна.' }, 405)
  if (code !== null && !(usable && (await opened(req, code)))) return json({ locked: true, error: 'Ирцийг харахын тулд кодоо бичнэ үү.' }, 401)
  const list = accountsOf(env)
  if (!what) {
    const companies: TimelyCompany[] = []
    const errors: string[] = []
    for (const a of list) await companyOf(a).then(c => companies.push(c), (e: Error) => errors.push(e.message))
    return json({ ready: list.length > 0, companies, errors })
  }
  if (what !== 'month' && what !== 'days') return json({ error: 'Хүсэлт буруу байна.' }, 404)
  if (!list.length) return json({ error: 'Timely-ийн түлхүүр тохируулаагүй байна.' }, 503)
  const month = url.searchParams.get('month') ?? ''
  const range = rangeOf(month)
  const id = Number(url.searchParams.get('company'))
  const worker = Number(url.searchParams.get('worker'))
  if (!range || (what === 'days' && !(Number.isInteger(worker) && worker > 0))) return json({ error: 'Хүсэлт буруу байна.' }, 400)
  const again = url.searchParams.has('fresh')
  try {
    let a: Account | undefined
    let failed: Error | undefined
    for (const x of list) {
      const c = await companyOf(x).catch((e: Error) => void (failed = e))
      if (c?.id === id) a = x
    }
    // Not found because Timely did not answer is not the same as not connected
    if (!a) return failed ? json({ error: failed.message }, 502) : json({ error: 'Энэ ХХК Timely-тэй холбогдоогүй байна.' }, 404)
    const account = a
    return json(what === 'month'
      ? await keep(`m:${id}:${month}`, again, () => monthOf(account, month, range))
      : await keep(`d:${id}:${worker}:${month}`, again, () => daysOf(account, worker, range)))
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : SILENT }, 502)
  }
}
