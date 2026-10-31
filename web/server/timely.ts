// Ирц from Timely (developer.timely.mn), for Хүний нөөц → Ирц. Each ХХК's Timely account has a key, kept here and never
// sent to the browser:
//   TIMELY_API_KEYS=timely_sk_…,timely_sk_… node server/main.ts
// A key belongs to one Timely company; the browser finds its ХХК among them by name. A key is traded for a token that
// lasts an hour, and answers are kept 5 minutes, as the HR plan asks. Read only, and only what the screens show: the
// salary and bank details Timely also has (/employees/info) are never asked for (docs/decisions.md, 2026-10-31).
// Web-standard Request and Response only, like scan.ts.
import type { TimelyCompany, TimelyDay, TimelyEmployee, TimelyMonth } from '../src/lib/types.ts'

const API = 'https://api.timely.mn/openapi'
/** How long an answer is kept before Timely is asked again */
export const KEEP = 5 * 60_000
/** "Шинэчлэх" asks again only when the answer is older than this */
const FRESH = 30_000

export interface TimelyEnv { TIMELY_API_KEYS?: string }

interface Account { key: string; token?: string; until?: number; scopes?: string[]; company?: TimelyCompany }
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

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

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
interface RawLeave { year?: number; earnedDays?: number; usedDays?: number; remainingDays?: number; used?: { begDate?: string; endDate?: string; days?: number }[] }
interface RawEmployee { workerId?: number; firstname?: string | null; lastname?: string | null; register?: string | null; position?: string | null; division?: { name?: string | null } | null; annualLeave?: RawLeave | null }
interface RawSummary { supposedWorkDays?: number; supposedWorkHours?: number; workedDays?: number; workedHours?: number }
interface RawDay { date?: string; clockIn?: string | null; clockOut?: string | null }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** HH:MM in Ulaanbaatar time, from "08:52", "2026-07-01 08:52:13" or a time with its zone */
export function hm(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  if (/T.*(Z|[+-]\d\d:?\d\d)$/.test(v)) {
    const d = new Date(v)
    return Number.isNaN(+d) ? null : new Date(+d + 8 * 3_600_000).toISOString().slice(11, 16)
  }
  const m = /(\d{1,2}):(\d{2})/.exec(v)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
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
    leave: l
      ? {
          year: num(l.year), earned: num(l.earnedDays), used: num(l.usedDays), left: num(l.remainingDays),
          taken: (Array.isArray(l.used) ? l.used : []).map(u => ({ from: str(u.begDate).slice(0, 10), to: str(u.endDate).slice(0, 10), days: num(u.days) })),
        }
      : null,
    supposedDays: num(s?.supposedWorkDays),
    supposedHours: num(s?.supposedWorkHours),
    workedDays: num(s?.workedDays),
    workedHours: num(s?.workedHours),
  }
}

/** Everyone active, with their leave, and each one's month: four at a time, since only the one-employee summary is documented */
async function monthOf(a: Account, month: string, range: { from: string; to: string }): Promise<Omit<TimelyMonth, 'updated'>> {
  const list = await get(a, '/employees')
  const people: RawEmployee[] = Array.isArray(list) ? list : []
  const employees: TimelyEmployee[] = []
  for (let i = 0; i < people.length; i += 4) {
    employees.push(
      ...(await Promise.all(
        people.slice(i, i + 4).map(async e => {
          const s: RawSummary | null = await get(a, `/employees/attendance-summary?workerId=${num(e.workerId)}&dateFrom=${range.from}&dateTo=${range.to}`).catch(err => {
            if (err instanceof TimelyError && err.code === 404) return null
            throw err
          })
          return employeeOf(e, s)
        }),
      )),
    )
  }
  return { month, ...range, employees }
}

async function daysOf(a: Account, worker: number, range: { from: string; to: string }): Promise<{ days: TimelyDay[] }> {
  const r = await get(a, `/employees/attendance?workerId=${worker}&dateFrom=${range.from}&dateTo=${range.to}`)
  const days: RawDay[] = Array.isArray(r?.attendance) ? r.attendance : []
  return { days: days.map(d => ({ date: str(d.date).slice(0, 10), in: hm(d.clockIn), out: hm(d.clockOut) })) }
}

/**
 * GET /api/attendance: the Timely companies the keys open.
 * GET /api/attendance/month?company=&month=YYYY-MM[&fresh]: everyone's month and leave.
 * GET /api/attendance/days?company=&worker=&month=YYYY-MM[&fresh]: one employee's days.
 */
export async function handleAttendance(req: Request, env: TimelyEnv): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Хүсэлт буруу байна.' }, 405)
  const url = new URL(req.url)
  const what = url.pathname.replace(/^\/api\/attendance\/?/, '')
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
