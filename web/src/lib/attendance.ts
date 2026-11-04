// Ирц (Хүний нөөц → Ирц): each ХХК's attendance from Timely through our server (server/timely.ts), matched to our
// employees by registration number. Without the server or its keys, a made-up month shows the screens; it says "Жишээ"
// wherever it shows (docs/decisions.md, 2026-10-31).
import type { Employee, Id, State, TimelyCompany, TimelyDay, TimelyEmployee, TimelyLeave, TimelyMonth } from './types'
import { current } from './hr'
import { parse, ymd } from './format'

const API = '/api/attendance'
/** Below this share of the hours to work, an employee is listed as low */
export const LOW = 80
/** How often an open page reads Timely again; the server keeps answers as long */
export const EVERY = 5 * 60_000

/** `locked`: the server wants its code first (server/timely.ts, the test address) */
export interface TimelyState { ready: boolean; companies: TimelyCompany[]; errors: string[]; locked?: boolean }

/** The Timely companies our server's keys open: none without the server (the preview page) or its keys */
export async function timelyState(): Promise<TimelyState> {
  try {
    const r = await fetch(API, { signal: AbortSignal.timeout(10_000) })
    const j = r.ok ? await r.json() : null
    return { ready: !!j?.ready, companies: j?.companies ?? [], errors: j?.errors ?? [], locked: r.status === 401 }
  } catch {
    return { ready: false, companies: [], errors: [] }
  }
}

/** Gives the server the code that opens attendance; it keeps the browser open for 30 days. Throws what went wrong. */
export async function unlock(code: string) {
  const r = await fetch(`${API}/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), signal: AbortSignal.timeout(10_000) })
    .catch(() => {
      throw new Error('Сервертэй холбогдож чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.')
    })
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? 'Код буруу байна. Дахин шалгаад бичнэ үү.')
}

/** Names without "ХХК", quotes and case, to find an ХХК's Timely company */
const plain = (name: string) => name.toLowerCase().replace(/ххк|«|»|"|'|\./g, '').replace(/\s+/g, ' ').trim()

/** The ХХК's Timely company: the one picked by hand, or the one of the same name */
export function linkOf(s: Pick<State, 'timely' | 'companies'>, company: Id, companies: TimelyCompany[]) {
  const picked = s.timely[company]
  if (picked !== undefined) return companies.find(c => c.id === picked)
  const name = plain(s.companies.find(c => c.id === company)?.name ?? '')
  return companies.find(c => plain(c.name) === name)
}

async function ask<T>(path: string): Promise<T> {
  // No answer at all: our server out of reach, or Timely too slow for it
  const r = await fetch(API + path, { signal: AbortSignal.timeout(90_000) }).catch((e: Error) => {
    throw new Error(e.name === 'TimeoutError' ? 'Timely хариу өгсөнгүй. Түр хүлээгээд дахин оролдоно уу.' : 'Сервертэй холбогдож чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.')
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? 'Timely хариу өгсөнгүй.')
  return j
}
export const loadMonth = (company: number, month: string, fresh = false) => ask<TimelyMonth>(`/month?company=${company}&month=${month}${fresh ? '&fresh' : ''}`)
export const loadDays = (company: number, worker: number, month: string, fresh = false) =>
  ask<{ days: TimelyDay[]; updated: string }>(`/days?company=${company}&worker=${worker}&month=${month}${fresh ? '&fresh' : ''}`)

/** A Timely employee and ours with the same registration number, if any */
export interface Row { t: TimelyEmployee; e?: Employee }

const regKey = (r: string) => r.replace(/\s/g, '').toUpperCase()

/** Timely's employees matched to ours by registration number; those in one system only are listed apart */
export function matchUp(ours: Employee[], theirs: TimelyEmployee[]) {
  const byReg = new Map(ours.map(e => [regKey(e.regNo), e]))
  const rows: Row[] = theirs.map(t => ({ t, e: t.register ? byReg.get(regKey(t.register)) : undefined }))
  const seen = new Set(rows.flatMap(r => (r.e ? [r.e.id] : [])))
  return { rows, onlyTimely: rows.filter(r => !r.e).map(r => r.t), onlyErp: ours.filter(e => current(e) && !seen.has(e.id)) }
}

/** Worked hours of the hours to work, in percent; by days when Timely gives no hours; null with nothing to work yet */
export function pctOf(t: TimelyEmployee) {
  const share = t.supposedHours > 0 ? t.workedHours / t.supposedHours : t.supposedDays > 0 ? t.workedDays / t.supposedDays : null
  return share === null ? null : Math.min(100, Math.round(100 * share))
}

/** The month at a glance: the average, the work days so far, who worked every day and who is below LOW */
export function sumUp(rows: Row[]) {
  const counted = rows.filter(r => pctOf(r.t) !== null)
  return {
    avg: counted.length ? Math.round(counted.reduce((n, r) => n + pctOf(r.t)!, 0) / counted.length) : null,
    workDays: Math.max(0, ...rows.map(r => r.t.supposedDays)),
    full: counted.filter(r => r.t.workedDays >= r.t.supposedDays).length,
    low: counted.filter(r => pctOf(r.t)! < LOW).sort((a, b) => pctOf(a.t)! - pctOf(b.t)!),
  }
}

export type DayState = 'in' | 'part' | 'none' | 'rest' | 'leave' | 'later'
export const DAY_STATE: Record<Exclude<DayState, 'later'>, string> = { in: 'Ирсэн', part: 'Бүртгэл дутуу', none: 'Бүртгэлгүй', leave: 'Чөлөө, ээлжийн амралт', rest: 'Амралтын өдөр' }
/** Said where Timely sets no cap on annual leave (TimelyLeave earned and left are null) */
export const NO_CAP = 'Timely-д ээлжийн амралтын хоногийг хязгаарлаагүй тул эрх, үлдэгдэл тооцогдохгүй.'

/**
 * What a day was. Clocks first: today's clock-in without a clock-out yet is a day at work. Then Timely's words, which
 * know the schedule, holidays and requests, though no one is absent before today is over. Without them, Saturdays and
 * Sundays are days off and the annual leave listed is leave.
 */
export function dayStateOf(date: string, d: TimelyDay | undefined, leave: TimelyLeave | null, today: string): DayState {
  if (date > today) return 'later'
  if (d?.in && (d.out || date === today)) return 'in'
  if (d?.in || d?.out) return 'part'
  if (d?.kind && !(d.kind === 'none' && date === today)) return d.kind
  if (parse(date).getDay() % 6 === 0) return 'rest'
  if (leave?.taken.some(x => x.from <= date && date <= x.to)) return 'leave'
  return date === today ? 'later' : 'none'
}

/** The day in words: Timely's own ("Хоцорсон, Эрт тарсан") where it has them, ours otherwise */
export const dayWord = (st: Exclude<DayState, 'later'>, d?: TimelyDay) => (d?.status?.length ? d.status.join(', ') : DAY_STATE[st])

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const clock = (m: number) => {
  const t = Math.round(m) // rounded first, so 08:59.6 is 09:00 and never 08:60
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Clock-in to clock-out, "8 ц 13 мин" */
export function spanOf(d: TimelyDay) {
  if (!d.in || !d.out) return null
  const m = minutes(d.out) - minutes(d.in)
  return m > 0 ? `${Math.floor(m / 60)} ц ${m % 60} мин` : null
}

/** The average clock-in, HH:MM */
export function avgIn(days: TimelyDay[]) {
  const ins = days.flatMap(d => (d.in ? [minutes(d.in)] : []))
  return ins.length ? clock(ins.reduce((a, b) => a + b, 0) / ins.length) : null
}

/** Every date of the month, YYYY-MM-DD */
export function datesOf(month: string) {
  const [y, m] = month.split('-').map(Number)
  return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}

// The example month: made up, the same each time for the same person and month

/** A little random number generator, seeded */
function rng(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296
}

/**
 * An employee's example days, and the leave taken, up to today. One in seven misses many days, to show the low list;
 * never the one looking at it.
 */
function sampleOf(seed: string, month: string, today: string, me: boolean) {
  const often = !me && rng(`${seed}:often`)() < 1 / 7 ? 0.3 : 0.04
  const r = rng(`${seed}:${month}`)
  const dates = datesOf(month).filter(d => d <= today)
  const workdays = dates.filter(d => parse(d).getDay() % 6 !== 0)
  // Some take a few days of leave in the month; the end is always past the start, so never an empty range
  const taken = r() < 0.25 && workdays.length > 8 ? [workdays.slice(3 + Math.floor(r() * 4), 7 + Math.floor(r() * 4))] : []
  const days: TimelyDay[] = []
  for (const date of dates) {
    const off = parse(date).getDay() % 6 === 0
    if (taken.some(t => t.includes(date)) || (off && r() > 0.04) || (!off && r() < often)) continue
    const late = r() < 0.15 ? 20 + r() * 40 : r() * 25
    const inAt = clock(8 * 60 + 25 + late)
    const outAt = r() < 0.05 ? null : clock(18 * 60 + r() * 75)
    days.push({ date, in: inAt, out: date === today ? null : outAt })
  }
  return { days, taken: taken.map(t => ({ from: t[0], to: t[t.length - 1], days: t.length })) }
}

/** Sums an example month the way Timely does: 8 hours a work day, leave days not to be worked */
function sampleEmployee(t: Omit<TimelyEmployee, 'supposedDays' | 'supposedHours' | 'workedDays' | 'workedHours' | 'leave'>, seed: string, month: string, today: string, me = false): TimelyEmployee {
  const { days, taken } = sampleOf(seed, month, today, me)
  const leaveDays = taken.reduce((n, x) => n + x.days, 0)
  // Days to work are the ones over: a day counts as worked only with its clock-out, which today does not have yet
  const workdays = datesOf(month).filter(d => d < today && parse(d).getDay() % 6 !== 0 && !taken.some(x => x.from <= d && d <= x.to)).length
  const worked = days.filter(d => d.in && d.out)
  const r = rng(seed)
  const earned = 15 + Math.floor(r() * 10)
  // Used is the leave listed, so the card never says none was taken beside days used
  const used = Math.min(earned, leaveDays)
  return {
    ...t,
    leave: { year: Number(month.slice(0, 4)), earned, used, left: earned - used, taken },
    supposedDays: workdays,
    supposedHours: workdays * 8,
    workedDays: worked.length,
    workedHours: Math.round(worked.reduce((n, d) => n + Math.min(8, (minutes(d.out!) - minutes(d.in!)) / 60 - 1), 0) * 10) / 10,
  }
}

const workerOf = (id: Id) => [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 90_000, 7) + 10_000

/**
 * A made-up month for the ХХК's employees, to show the screens before Timely is connected. One employee is left out and
 * two people only Timely knows come in, to show the lists of those in one system only.
 */
export function sampleMonth(s: State, month: string): TimelyMonth {
  const today = ymd(new Date())
  const staff = s.employees.filter(e => e.company === s.company && current(e)).sort((a, b) => b.hired.localeCompare(a.hired))
  const employees = staff.slice(1).map(e => sampleFor(s, e, month))
  const strangers = [
    { workerId: 90_001, family: 'Должин', given: 'Сэр-Од', register: 'УБ85032417', position: 'Харуул', division: 'Аж ахуй' },
    { workerId: 90_002, family: 'Ганзориг', given: 'Номин', register: 'УБ01250833', position: 'Цэвэрлэгч', division: 'Аж ахуй' },
  ].map(t => sampleEmployee(t, String(t.workerId), month, today))
  const [from, to] = [`${month}-01`, datesOf(month).filter(d => d <= today).pop() ?? `${month}-01`]
  return { month, from, to, updated: new Date().toISOString(), employees: [...employees, ...strangers] }
}

/** One employee's example month, as sampleMonth makes it: for a window that needs only them (Хүсэлт) */
export function sampleFor(s: State, e: Employee, month: string): TimelyEmployee {
  const dept = s.departments.find(d => d.id === e.dept)?.name ?? ''
  const pos = s.positions.find(p => p.id === e.position)?.name ?? ''
  return sampleEmployee({ workerId: workerOf(e.id), family: e.family, given: e.given, register: e.regNo.toUpperCase(), position: pos, division: dept }, e.id, month, ymd(new Date()), e.user === s.me)
}

/** The employee's row in a Timely month, by registration number */
export const rowOf = (m: TimelyMonth, e: Employee) => m.employees.find(t => t.register && regKey(t.register) === regKey(e.regNo)) ?? null

/** The example days of the employee above, the same ones its month was summed from */
export function sampleDays(s: State, t: TimelyEmployee, month: string): TimelyDay[] {
  const e = s.employees.find(x => workerOf(x.id) === t.workerId)
  return sampleOf(e ? e.id : String(t.workerId), month, ymd(new Date()), !!e && e.user === s.me).days
}
