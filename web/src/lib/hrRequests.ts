// Хүсэлт: ээлжийн амралт, илүү цаг, шинэ ажилтан авах (docs/decisions.md, 2026-11-01). Each kind's steps, who acts at a
// step, the words for where a request stands, a leave's work days, the order a signed leave becomes, and the demo
// requests. Requests to the office for a document stay in lib/docs.ts; the «Хүсэлт» page lists both.
import type { Doc, HireRequest, HrRequest, HrRequestKind, HrStep, Id, LeaveRequest, Move, OvertimeRequest, State } from './types'
import { accessOf } from './access'
import { rolesOf } from './contracts'
import { empOf, managerOf } from './reports'
import { addDays, parse, short, today, ymd } from './format'
import { dots } from './hr'

export const HR_KIND: Record<HrRequestKind, string> = { leave: 'Ээлжийн амралт', overtime: 'Илүү цаг', hire: 'Шинэ ажилтан авах' }
export const STEPS: Record<HrRequestKind, HrStep[]> = { leave: ['manager', 'director', 'hr'], overtime: ['manager', 'finance'], hire: ['hr', 'finance', 'director'] }
/** Who acts at the step, in the list of steps */
export const STEP_WHO: Record<HrStep, string> = { manager: 'Шууд удирдлага', hr: 'Хүний нөөц', finance: 'Санхүү', director: 'Гүйцэтгэх захирал' }
/** What the step's person does: their button, and the request's label in their list */
const DO: Record<HrRequestKind, Partial<Record<HrStep, string>>> = {
  leave: { manager: 'Батлах', director: 'Гарын үсэг зурах', hr: 'Timely-д бүртгэх' },
  overtime: { manager: 'Батлах', finance: 'Шийдвэрлэх' },
  hire: { hr: 'Батлах', finance: 'Батлах', director: 'Батлах' },
}
/** "{who} хянаж буй" (Gemini 38) */
const PILL_WHO: Record<HrStep, string> = { manager: 'Шууд удирдлага', hr: 'Хүний нөөц', finance: 'Санхүү', director: 'Захирал' }

/** What the step's person will do, in the list of steps */
export const WILL: Record<HrRequestKind, Partial<Record<HrStep, string>>> = {
  leave: { manager: 'Батална', director: 'Тушаалд гарын үсэг зурна', hr: 'Timely-д бүртгэнэ' },
  overtime: { manager: 'Батална', finance: 'Ажилласны дараа хөлс эсвэл нөхөн амралт олгохыг шийднэ' },
  hire: { hr: 'Орон тоог шалгана', finance: 'Цалингийн төсвийг шалгана', director: 'Батална' },
}
/** What the step's person did; finance's decision on overtime says itself */
export const DID: Record<HrRequestKind, Partial<Record<HrStep, string>>> = {
  leave: { manager: 'Баталсан', director: 'Гарын үсэг зурсан', hr: 'Timely-д бүртгэсэн' },
  overtime: { manager: 'Баталсан' },
  hire: { hr: 'Баталсан', finance: 'Баталсан', director: 'Баталсан' },
}

export const stepOf = (r: HrRequest) => STEPS[r.kind][r.step]
export const doOf = (r: HrRequest) => DO[r.kind][stepOf(r)]!
export const ORDER_NAME = 'Ээлжийн амралт олгох тухай'

/** Where a request stands, said to everyone but the one whose turn it is. `tone` picks the pill's colour. */
export function pillOf(r: HrRequest): { text: string; tone: 'wait' | 'ok' | 'bad' | 'off' } {
  if (r.status === 'returned') return { text: 'Буцаасан', tone: 'bad' }
  if (r.status === 'canceled') return { text: 'Цуцлагдсан', tone: 'off' }
  if (r.status === 'done') return { text: r.kind === 'overtime' ? (r.pay === 'rest' ? 'Нөхөн амралт' : 'Илүү цагийн хөлс') : 'Батлагдсан', tone: 'ok' }
  const step = stepOf(r)
  if (r.kind === 'overtime' && step === 'finance' && r.date > today()) return { text: 'Шууд удирдлага баталсан', tone: 'wait' }
  if (r.kind === 'leave' && step === 'hr') return { text: 'Хүний нөөц бүртгэж буй', tone: 'wait' }
  return { text: `${PILL_WHO[step]} хянаж буй`, tone: 'wait' }
}

/** The people who act at a step: one person, or for Хүний нөөц its people (anyone who keeps HR records when it has none) */
export function actorsOf(s: State, r: Pick<HrRequest, 'company' | 'manager'>, step: HrStep): Id[] {
  if (step === 'manager') return r.manager ? [r.manager] : []
  if (step !== 'hr') {
    const id = rolesOf(s, r.company)?.[step]
    return id ? [id] : []
  }
  const keep = s.people.filter(p => p.companies.includes(r.company) && accessOf(s, p.id, r.company).hrEdit)
  const hr = keep.filter(p => p.team === 'Хүний нөөц')
  return (hr.length ? hr : keep).map(p => p.id)
}

/** The person's turn: the step it waits at is theirs; finance decides overtime once its day has come */
export function mayAct(s: State, r: HrRequest, who: Id) {
  if (r.status !== 'open') return false
  if (r.kind === 'overtime' && stepOf(r) === 'finance' && r.date > today()) return false
  return actorsOf(s, r, stepOf(r)).includes(who)
}
/** Sending back is for the steps before a leave's order is signed: after that only HR's Timely step is left */
export const mayReturn = (s: State, r: HrRequest, who: Id) => mayAct(s, r, who) && !(r.kind === 'leave' && r.order)
/** The asker may call it off until a leave's order is signed */
export const mayCancel = (r: HrRequest, who: Id) => r.by === who && (r.status === 'open' || r.status === 'returned') && !(r.kind === 'leave' && r.order)
/** Waits for the person: their turn, or their own request sent back to them */
export const waitsFor = (s: State, r: HrRequest, who: Id) => mayAct(s, r, who) || (r.status === 'returned' && r.by === who)
/** Takes part: the asker, or whoever acts at one of its steps. They may open it. */
export const involves = (s: State, r: HrRequest, who: Id) => r.by === who || STEPS[r.kind].some(st => actorsOf(s, r, st).includes(who))
/** Where it starts: past the manager's step for someone with no one above them */
export const firstStep = (kind: HrRequestKind, manager?: Id) => (STEPS[kind][0] === 'manager' && !manager ? 1 : 0)

/** The latest approval or sending back at a step since the request was last sent */
export function doneAt(r: HrRequest, step: HrStep) {
  const sent = r.history.map(h => h.what).lastIndexOf('sent')
  return r.history.slice(sent + 1).filter(h => h.step === step && (h.what === 'approved' || h.what === 'returned')).at(-1)
}

/**
 * Public holidays on fixed dates, MM-DD. Цагаан сар and Чингис хааны өдөр move with the moon each year: the form says the
 * count leaves out weekends and holidays, and the person corrects it when one of those falls in.
 */
const HOLIDAYS = ['01-01', '03-08', '06-01', '07-11', '07-12', '07-13', '07-14', '07-15', '11-26', '12-29']
export function workDays(from: string, to: string) {
  let n = 0
  for (let d = parse(from); ymd(d) <= to; d = addDays(d, 1)) if (d.getDay() % 6 !== 0 && !HOLIDAYS.includes(ymd(d).slice(5))) n++
  return n
}

/** Who of the ХХК is on leave each day (YYYY-MM-DD), for Календарь: leaves whose order the director has signed */
export function awayByDay(s: Pick<State, 'hrRequests'>, company: Id) {
  const m = new Map<string, Id[]>()
  for (const r of s.hrRequests) {
    if (r.kind !== 'leave' || r.company !== company || !r.order || r.status === 'canceled') continue
    for (let d = parse(r.from); ymd(d) <= r.to; d = addDays(d, 1)) m.set(ymd(d), [...(m.get(ymd(d)) ?? []), r.by])
  }
  return m
}

/** "4 цаг 45 мин", "4 цаг" */
export const hoursText = (m: number) => `${Math.floor(m / 60)} цаг${m % 60 ? ` ${m % 60} мин` : ''}`
/** Minutes from HH:MM to HH:MM, 0 when the end is not later */
export const spanMinutes = (start: string, end: string) => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  return Math.max(0, m(end) - m(start))
}

/** A signed leave's order (Тушаал): the lines its page is drawn from (lib/paper.ts). No name or number takes an ending. */
export function orderLines(s: Pick<State, 'people' | 'employees' | 'positions'>, r: LeaveRequest): string[] {
  const p = s.people.find(x => x.id === r.by)
  const e = empOf(s, r.company, r.by)
  const position = (e && s.positions.find(x => x.id === e.position)?.name) ?? p?.role ?? ''
  return [
    'Хөдөлмөрийн тухай хууль, компанийн Хөдөлмөрийн дотоод журмыг үндэслэн ТУШААХ НЬ:',
    '1. Дор дурдсан ажилтанд ээлжийн амралт олгосугай.',
    `Ажилтан: ${position} ${p ? short(p) : ''}`,
    `Хугацаа: ${dots(r.from)}–${dots(r.to)}, ажлын ${r.days} өдөр`,
    '2. Ээлжийн амралтын олговрыг холбогдох журмын дагуу олгохыг санхүүгийн албанд үүрэг болгосугай.',
    '3. Тушаалын хэрэгжилтэд хяналт тавьж ажиллахыг хүний нөөцийн албанд даалгасугай.',
  ]
}
/** The leave's line in the employee's history, with its order */
export const leaveMove = (r: LeaveRequest, id: Id, doc: Id): Move => ({ id, date: r.from, kind: 'vacation', doc, note: `${dots(r.from)}–${dots(r.to)}, ажлын ${r.days} өдөр` })
/** Newest first, as the history is kept */
export const withMove = (moves: Move[], m: Move) => [...moves, m].sort((a, b) => b.date.localeCompare(a.date))

/**
 * The demo's requests in Говь Ресурс: a leave and an overtime waiting for the manager, a leave for the director to sign,
 * a hiring request at the director after HR and finance, an overtime for finance to decide, one decided, a leave sent
 * back, and a leave done with its order in Бичиг хэрэг and in the employee's history.
 */
export function seedHrRequests(now: Date, s: State): Pick<State, 'hrRequests' | 'docs' | 'employees'> {
  const c = 'c1'
  const ago = (h: number) => new Date(now.getTime() - h * 36e5).toISOString()
  /** A day's 10:00, `n` days from a date */
  const on = (date: string, n: number) => new Date(addDays(parse(date), n).getTime() + 10 * 36e5).toISOString()
  const plus = (date: string, n: number) => ymd(addDays(parse(date), n))
  /** The first Monday or Saturday from `weeks` weeks on */
  const next = (weeks: number, day: number) => {
    const d = addDays(now, 7 * weeks)
    return ymd(addDays(d, (day - d.getDay() + 7) % 7))
  }
  const mgr = (who: Id) => managerOf(s, c, who)
  const emp = (user: Id) => empOf(s, c, user)?.id
  const named = (given: string) => s.employees.find(e => e.company === c && e.given === given)?.id
  const sales = s.positions.find(p => p.company === c && p.name === 'Борлуулалтын ажилтан')?.id

  const leave = (r: Omit<LeaveRequest, 'kind' | 'company' | 'days'>): LeaveRequest => ({ ...r, kind: 'leave', company: c, days: workDays(r.from, r.to) })
  const overtime = (r: Omit<OvertimeRequest, 'kind' | 'company'>): OvertimeRequest => ({ ...r, kind: 'overtime', company: c })

  const l1 = next(2, 1)
  const l3 = next(6, 1)
  const l7 = next(-7, 1)
  const l8 = next(1, 1)
  const o2 = next(1, 6)
  const o5 = next(-1, 6)
  const o6 = next(-2, 6)
  const done = leave({
    id: 'hq7', by: 'u12', status: 'done', step: 2, manager: mgr('u12'), from: l7, to: plus(l7, 4), order: 'dc-order1',
    history: [
      { what: 'sent', by: 'u12', at: on(l7, -20) },
      { what: 'approved', by: mgr('u12') ?? 'u1', at: on(l7, -19), step: 'manager' },
      { what: 'approved', by: 'u1', at: on(l7, -18), step: 'director' },
      { what: 'approved', by: 'u12', at: on(l7, -17), step: 'hr' },
    ],
  })
  const hrRequests: HrRequest[] = [
    leave({ id: 'hq1', by: 'u9', status: 'open', step: 0, manager: mgr('u9'), from: l1, to: plus(l1, 4), stand: named('Тэмүүжин'), note: 'Гэр бүлээрээ аялна.', history: [{ what: 'sent', by: 'u9', at: ago(22) }] }),
    overtime({ id: 'hq2', by: 'u14', status: 'open', step: 0, manager: mgr('u14'), date: o2, start: '10:00', end: '14:00', work: 'Серверийн программыг шинэчилж, нөөц хуулбар авна.', history: [{ what: 'sent', by: 'u14', at: ago(3) }] }),
    leave({
      id: 'hq3', by: 'u5', status: 'open', step: 1, manager: mgr('u5'), from: l3, to: plus(l3, 4), stand: emp('u6'),
      history: [{ what: 'sent', by: 'u5', at: ago(70) }, { what: 'approved', by: mgr('u5') ?? 'u3', at: ago(46), step: 'manager' }],
    }),
    {
      id: 'hq4', kind: 'hire', company: c, by: 'u7', status: 'open', step: 2, position: sales ?? '', count: 1,
      start: ymd(new Date(now.getFullYear(), now.getMonth() + 2, 1)), reason: 'vacant',
      duties: 'Харилцагчтай ажиллаж, захиалга авна. Сарын борлуулалтын төлөвлөгөөгөө биелүүлнэ.',
      needs: 'Борлуулалтад нэгээс дээш жил ажилласан туршлагатай.',
      history: [
        { what: 'sent', by: 'u7', at: ago(6 * 24) },
        { what: 'approved', by: 'u12', at: ago(5 * 24), step: 'hr', note: 'Сул орон тоо 1 байна.' },
        { what: 'approved', by: 'u3', at: ago(3 * 24), step: 'finance', note: 'Цалингийн төсөвт багтана.' },
      ],
    } satisfies HireRequest,
    overtime({
      id: 'hq5', by: 'u6', status: 'open', step: 1, manager: mgr('u6'), date: o5, start: '10:00', end: '15:00', work: 'Сарын тайлангийн баримтуудыг нэгтгэнэ.',
      history: [{ what: 'sent', by: 'u6', at: on(o5, -2) }, { what: 'approved', by: mgr('u6') ?? 'u3', at: on(o5, -1), step: 'manager' }],
    }),
    overtime({
      id: 'hq6', by: 'u10', status: 'done', step: 1, manager: mgr('u10'), date: o6, start: '09:00', end: '13:00', work: 'Агуулахын тооллого хийнэ.', pay: 'rest', minutes: 230,
      history: [
        { what: 'sent', by: 'u10', at: on(o6, -3) },
        { what: 'approved', by: mgr('u10') ?? 'u1', at: on(o6, -2), step: 'manager' },
        { what: 'approved', by: 'u3', at: on(o6, 2), step: 'finance' },
      ],
    }),
    leave({
      id: 'hq8', by: 'u14', status: 'returned', step: 0, manager: mgr('u14'), from: l8, to: plus(l8, 2),
      history: [
        { what: 'sent', by: 'u14', at: ago(30) },
        { what: 'returned', by: mgr('u14') ?? 'u10', at: ago(20), step: 'manager', note: 'Энэ долоо хоногт серверийг шилжүүлнэ. Дараагийн долоо хоногт амарч болно.' },
      ],
    }),
    done,
  ]
  const order: Doc = { id: 'dc-order1', company: c, name: ORDER_NAME, kind: 'order', text: orderLines(s, done), to: ['u12'], by: 'u1', added: done.history[2].at }
  const e = empOf(s, c, 'u12')
  return {
    hrRequests,
    docs: [order, ...s.docs],
    employees: s.employees.map(x => (x.id === e?.id ? { ...x, moves: withMove(x.moves, leaveMove(done, 'mv-order1', order.id)) } : x)),
  }
}
