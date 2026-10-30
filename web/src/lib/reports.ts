// Сарын тайлан: by the last day of each month an employee writes what they did, their problems and ideas, and next month's
// plan; their direct manager scores it on the ХХК's KPI criteria, and the score's grade sets the bonus share
// (docs/decisions.md, 2026-10-30). The user gave no criteria yet, so these are common ones that each ХХК can change.
import type { Band, Criterion, Employee, Id, KpiRules, MonthReport, ReportLine, ReportStatus, State } from './types'
import { daysFromToday, parse, ymd, ymdhm } from './format'
import { current } from './hr'
import { rolesOf, STAGE } from './contracts'
import { cid } from './draft'
import { rng } from './seedHr'

export const DEFAULT_KPI: KpiRules = {
  criteria: [
    { id: 'k1', name: 'Ажлын гүйцэтгэл', hint: 'Төлөвлөсөн ажлаа хэр бүрэн хийсэн', weight: 30 },
    { id: 'k2', name: 'Ажлын чанар', hint: 'Алдаагүй, дахин засвар шаардаагүй', weight: 25 },
    { id: 'k3', name: 'Хугацаа', hint: 'Ажлаа товлосон хугацаанд нь хийсэн', weight: 20 },
    { id: 'k4', name: 'Санаачилга, хамтын ажиллагаа', hint: 'Шинэ санал гаргаж, бусадтай хамтарч ажилласан', weight: 15 },
    { id: 'k5', name: 'Сахилга, хариуцлага', hint: 'Дотоод журам, ажлын цагийг баримталсан', weight: 10 },
  ],
  bands: [
    { min: 90, name: 'Маш сайн', bonus: 100 },
    { min: 75, name: 'Сайн', bonus: 80 },
    { min: 60, name: 'Дунд', bonus: 50 },
    { min: 0, name: 'Хангалтгүй', bonus: 0 },
  ],
}
/** The words of the points, 1 to 5 */
export const POINTS = ['Хангалтгүй', 'Сайжруулах шаардлагатай', 'Хангалттай', 'Сайн', 'Маш сайн']
/** Days before the due day when the report shows in "Миний хийх" */
export const OPEN_DAYS = 3

export const kpiOf = (s: Pick<State, 'kpi'>, company: Id) => s.kpi[company] ?? DEFAULT_KPI
/** Points out of 100: each criterion counts by its weight, 5 points being full */
export function total(scores: { weight: number; points: number }[]) {
  const w = scores.reduce((n, x) => n + x.weight, 0)
  return w ? Math.round((scores.reduce((n, x) => n + x.weight * x.points, 0) / (5 * w)) * 100) : 0
}
export const bandOf = (bands: Band[], score: number) => [...bands].sort((a, b) => b.min - a.min).find(b => score >= b.min) ?? bands[bands.length - 1]

// Months are "2026-10"
export const monthKey = (d: Date) => ymd(d).slice(0, 7)
const shift = (m: string, n: number) => {
  const d = parse(`${m}-01`)
  return monthKey(new Date(d.getFullYear(), d.getMonth() + n, 1))
}
export const prevMonth = (m: string, n = 1) => shift(m, -n)
export const nextMonth = (m: string) => shift(m, 1)
/** The last day of the month, "2026-10-31": the report is due by its end */
export const dueOf = (m: string) => {
  const d = parse(`${m}-01`)
  return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}
/** "10-р сар" */
export const monthName = (m: string) => `${Number(m.slice(5))}-р сар`
/** "10-р сарын", as in "10-р сарын тайлан" */
export const ofMonth = (m: string) => `${Number(m.slice(5))}-р сарын`
/** "10-р сарын 31" */
export const dueName = (m: string) => `${Number(m.slice(5))}-р сарын ${Number(dueOf(m).slice(8))}`

export const findReport = (s: Pick<State, 'reports'>, company: Id, person: Id, month: string) =>
  s.reports.find(r => r.company === company && r.person === person && r.month === month)
/** Sent after the last day of its month */
export const isLate = (r: MonthReport) => !!r.sent && ymd(new Date(r.sent)) > dueOf(r.month)

type Org = Pick<State, 'employees' | 'departments' | 'roles'>
/** A person's HR record in a ХХК while they work there */
export const empOf = (s: Pick<State, 'employees'>, company: Id, person: Id) => s.employees.find(e => e.company === company && e.user === person && current(e))

/** Шууд удирдлага of an HR record: the one set on it, else the head of its department, else the director. 'none' for the top. */
export function bossOf(s: Org, e: Employee): Employee | 'none' | undefined {
  if (e.manager === 'none') return 'none'
  const find = (id?: Id) => s.employees.find(x => x.id === id && current(x))
  const head = s.departments.find(d => d.id === e.dept)?.head
  const director = s.employees.find(x => x.company === e.company && x.user === rolesOf(s, e.company).director && current(x))
  const m = find(e.manager) ?? (head !== e.id ? find(head) : undefined) ?? director
  return m && m.id !== e.id ? m : undefined
}

/** Who scores a person's report, their direct manager, as an ERP user (the director when the manager has no account). Undefined at the top. */
export function managerOf(s: Org, company: Id, person: Id): Id | undefined {
  const e = empOf(s, company, person)
  const b = e && bossOf(s, e)
  if (!e || b === 'none') return undefined
  const m = b?.user ?? rolesOf(s, company).director
  return m !== person ? m : undefined
}

/** The people of a ХХК who write a monthly report: ERP users at work (not on leave) with someone to score it, hired by the month's end */
export function writers(s: Org, company: Id, month: string): Id[] {
  return s.employees
    .filter(e => e.company === company && e.user && (e.status === 'active' || e.status === 'probation') && e.hired <= dueOf(month) && managerOf(s, company, e.user))
    .map(e => e.user!)
}

/** The director, the top and HR read every report of the ХХК. HR is known by its team here; the real system gives it a right. */
export const seesAll = (s: Org & Pick<State, 'people'>, company: Id, who: Id) =>
  (!!empOf(s, company, who) && !managerOf(s, company, who)) || s.people.find(p => p.id === who)?.team === 'Хүний нөөц'

/** Whose reports a person may read: their own and the ones they score, or everyone's */
export function readable(s: Org & Pick<State, 'people'>, company: Id, who: Id, month: string): Id[] {
  const all = writers(s, company, month)
  return seesAll(s, company, who) ? all : all.filter(p => p === who || managerOf(s, company, p) === who)
}

export type RowState = ReportStatus | 'none' | 'overdue'
/** Where a person's report for a month stands; not sent after the month ended is "overdue" */
export function stateOf(r: MonthReport | undefined, month: string): RowState {
  if (r && r.status !== 'draft') return r.status
  if (daysFromToday(dueOf(month)) < 0) return 'overdue'
  return r ? 'draft' : 'none'
}
export const STATE_PILL: Record<RowState, string> = {
  none: 'Бөглөөгүй', draft: 'Бөглөж буй', sent: 'Илгээсэн', returned: 'Буцаасан', scored: 'Үнэлсэн', overdue: 'Хугацаа хэтэрсэн',
}

/** What a person has to do with monthly reports in a ХХК now: their own to write or fix, and the ones sent to them to score */
export function reportTodo(s: Org & Pick<State, 'reports'>, company: Id, who: Id, cur: string) {
  const out: { person: Id; month: string; what: string }[] = []
  for (const m of [prevMonth(cur), cur]) {
    if (!writers(s, company, m).includes(who)) continue
    const r = findReport(s, company, who, m)
    if (r?.status === 'returned') out.push({ person: who, month: m, what: 'Засаад илгээх' })
    else if ((!r || r.status === 'draft') && daysFromToday(dueOf(m)) < OPEN_DAYS) out.push({ person: who, month: m, what: m < cur ? 'Хугацаа хэтэрсэн' : 'Бөглөх' })
  }
  for (const r of s.reports) if (r.company === company && r.manager === who && r.status === 'sent') out.push({ person: r.person, month: r.month, what: 'Үнэлэх' })
  return out
}

const inMonth = (iso: string | undefined, month: string) => !!iso && monthKey(new Date(iso)) === month
const doneTasks = (s: Pick<State, 'tasks'>, company: Id, person: Id, month: string) =>
  s.tasks.filter(t => t.company === company && t.assignees.includes(person) && inMonth(t.doneAt, month))

/** Work done in the month as the system knows it: the person's finished tasks, and the contracts they wrote that moved on */
export function fromSystem(s: Pick<State, 'tasks' | 'contracts'>, company: Id, person: Id, month: string): ReportLine[] {
  const contracts = s.contracts.filter(c => c.company === company && c.owner === person
    && c.events.some(e => inMonth(e.at, month) && (e.kind === 'send' || e.kind === 'register' || e.kind === 'deliver')))
  return [
    ...doneTasks(s, company, person, month).map(t => ({ id: cid(), text: t.title, task: t.id })),
    ...contracts.map(c => ({ id: cid(), text: `${c.title}: ${STAGE[c.stage].pill.toLowerCase()}`, contract: c.id })),
  ]
}

/** The numbers beside a report: tasks finished and how many on time, meetings held */
export function factsOf(s: Pick<State, 'tasks' | 'events'>, company: Id, person: Id, month: string) {
  const done = doneTasks(s, company, person, month)
  return {
    done: done.length,
    onTime: done.filter(t => ymd(new Date(t.doneAt!)) <= t.due).length,
    meetings: s.events.filter(e => e.company === company && e.kind === 'meeting' && e.attendees.includes(person) && e.start.startsWith(month) && e.start <= ymdhm(new Date())).length,
  }
}

/** The empty report a person starts from: what the system knows they did, then their own words */
export const blankReport = (s: Pick<State, 'tasks' | 'contracts'>, company: Id, person: Id, month: string): Pick<MonthReport, 'done' | 'issues' | 'plan'> =>
  ({ done: fromSystem(s, company, person, month), issues: '', plan: [] })

// Demo reports: two months scored for everyone, and this month at every step. Lines by team; all made up.
const POOL: Record<string, { done: string[]; issues: string[]; plan: string[] }> = {
  'Удирдлага': {
    done: [
      'Худалдан авалтын журмын төслийг боловсруулж, хэлэлцүүлэгт оруулсан',
      'Шинэ агуулахын барилгын гүйцэтгэгчтэй долоо хоног бүр уулзаж, явцыг хянасан',
      'Хэлтсүүдийн сарын төлөвлөгөөний биелэлтийг нэгтгэсэн',
      'Түрээсийн гэрээний нөхцөлийг шинэчлэн тохиролцсон',
      'Тээврийн зардлыг бууруулах саналыг удирдлагын хуралд танилцуулсан',
    ],
    issues: [
      'Хэлтсүүд хоорондоо мэдээлэл солилцох тогтсон журамгүй байна. Долоо хоног бүр 30 минутын товч уулзалт хийхийг санал болгож байна.',
      'Худалдан авалт батлах шат олон тул жижиг худалдан авалт 5–7 хоног хүлээгдэж байна.',
    ],
    plan: ['Худалдан авалтын журмыг батлуулах', 'Агуулахын барилгын суурийн ажлыг хүлээж авах', 'Дараа оны үйл ажиллагааны төлөвлөгөөний төслийг боловсруулах', 'Хэлтсүүдийн KPI-г шинэчлэх саналыг бэлтгэх'],
  },
  'Санхүү': {
    done: [
      'Сарын санхүүгийн тайланг гаргаж, удирдлагад танилцуулсан',
      'Харилцагчдын тооцоог тулгаж, хугацаа хэтэрсэн 4 харилцагчид төлбөр төлөх мэдэгдэл хүргүүлсэн',
      'НӨАТ-ын сарын тайланг хугацаанд нь илгээсэн',
      'Банкны хуулгыг гүйлгээтэй тулгасан',
      'Цалингийн тооцоог хийж, хугацаанд нь олгосон',
      'Төсвийн гүйцэтгэлийг хэлтэс бүрээр гаргасан',
    ],
    issues: [
      'Хэлтсүүд зардлын баримтаа сарын сүүлд бөөнөөр нь өгдөг тул тулгалт удааширч байна. Долоо хоног бүр өгдөг болгохыг санал болгож байна.',
      'Банкны хуулгыг гараар шивж оруулж байна. Банкны системтэй холбовол сард ажлын 2 өдөр хэмнэнэ.',
    ],
    plan: ['Жилийн аудитын материалыг бэлтгэх', 'Авлагын насжилтын тайлан гаргах', 'Дараа оны төсвийн төслийг боловсруулах', 'Үндсэн хөрөнгийн тооллого хийх'],
  },
  'Борлуулалт': {
    done: [
      'Шинэ 3 харилцагчтай гэрээ байгуулсан',
      'Намрын аяны сурталчилгааг цахим сувгуудаар явуулсан',
      'Гол 10 харилцагчтай уулзаж, захиалгын төлөвлөгөөг тохиролцсон',
      'Үнийн саналыг 6 байгууллагад илгээсэн',
      'Борлуулалтын долоо хоногийн тайланг тогтмол гаргасан',
    ],
    issues: [
      'Агуулахын үлдэгдлийн мэдээлэл хоцорч ирдэг тул харилцагчдад нийлүүлэх хугацаа баталгаажуулахад хүндрэл үүсэж байна.',
      'Харилцагчийн бүртгэл олон Excel файлд тархсан тул нэгдсэн санд төвлөрүүлэх шаардлагатай байна.',
    ],
    plan: ['Үзэсгэлэнд оролцож, 20 шинэ харилцагчийн мэдээлэл цуглуулах', 'Улирлын борлуулалтын дүнг гаргах', 'Гол харилцагчдад 2027 оны үнийн санал хүргүүлэх', 'Цахим сурталчилгааны төсвийг шинэчлэх'],
  },
  'Үйл ажиллагаа': {
    done: [
      'Агуулахын барилгын материалыг хуваарийн дагуу хүлээж авсан',
      'Тээврийн 3 чиглэлийн хуваарийг шинэчилсэн',
      'Оффисын 12 компьютерийн програм хангамжийг шинэчилсэн',
      'Сүлжээний тасалдлыг засаж, нөөц холболт суурилуулсан',
      'Тээврийн хэрэгслүүдийн техникийн үзлэгийг хугацаанд нь хийлгэсэн',
    ],
    issues: [
      'Сэлбэг худалдан авалтын зөвшөөрөл удааширснаас тээврийн хэрэгслийн засвар 3–4 хоногоор саатаж байна.',
      'Серверийн өрөөний агааржуулалт хангалтгүй. Зун халалт үүсэх эрсдэлтэй.',
    ],
    plan: ['Агуулахын барилгын суурийн ажлыг хянах', 'Тээврийн хэрэгслүүдийг өвлийн үйлчилгээнд хамруулах', 'Нөөц серверийг туршиж ажиллуулах', 'ERP-ийн туршилтад оролцох ажилтнуудыг сургах'],
  },
  'Хүний нөөц': {
    done: [
      'Борлуулалтын ажилтны сонгон шалгаруулалт явуулж, 1 ажилтныг ажилд авсан',
      'Аюулгүй ажиллагааны сургалтыг 24 ажилтанд зохион байгуулсан',
      'Ажилтнуудын хувийн хэргийн дутуу баримтыг нөхүүлсэн',
      'Ээлжийн амралтын хуваарийг гаргаж, батлуулсан',
      'Ирцийн мэдээллийг цалингийн хүснэгтэд нэгтгэсэн',
    ],
    issues: [
      'Ирцийг цаасаар бүртгэдэг тул цалин бодоход 2 өдөр зарцуулж байна. Цахим бүртгэлд шилжихийг санал болгож байна.',
      'Туршилтын хугацаатай ажилтнуудын үнэлгээг нэгжийн удирдлагууд хугацаанд нь ирүүлэхгүй байна.',
    ],
    plan: ['Туршилтын хугацаа нь дуусах 2 ажилтны үнэлгээг зохион байгуулах', 'Ажилтнуудын сэтгэл ханамжийн жилийн судалгаа явуулах', 'Хөдөлмөрийн дотоод журмын шинэчилсэн төслийг бэлтгэх', 'Шинэ ажилтныг чиглүүлэх, дадлагажуулах хөтөлбөр боловсруулах'],
  },
}
const COMMENTS = [
  'Төлөвлөгөөгөө бүрэн биелүүлсэн. Сайн ажилласан.',
  'Ажлын чанар сайн байна. Цаашид хугацааг чанд баримталж ажиллана уу.',
  'Санаачилгатай ажилласан. Гаргасан саналыг дараагийн удирдлагын хурлаар хэлэлцүүлнэ.',
  'Хийсэн ажлаа тоо, үр дүнтэй нь бичвэл үнэлэхэд хялбар болно.',
  'Сайн ажилласан. Бусад хэлтэстэй ажлын уялдаа холбоогоо сайжруулахад анхаарна уу.',
]
/** This month in Говь Ресурс: [status, hours since it was sent]. The others follow a pattern. */
const NOW_C1: Record<Id, [ReportStatus | 'none', number?]> = {
  u3: ['sent', 20], u12: ['sent', 3], u4: ['scored', 30], u10: ['draft'], u7: ['none'], u5: ['sent', 26], u6: ['none'], u9: ['scored', 40], u14: ['returned', 22],
}
const NOW_OTHERS: (ReportStatus | 'none')[] = ['sent', 'none', 'draft', 'sent', 'none']

export function seedReports(now: Date, s: Org & Pick<State, 'people' | 'tasks' | 'contracts'>): Pick<State, 'reports' | 'kpi'> {
  const r = rng(20261030)
  const cur = monthKey(now)
  const reports: MonthReport[] = []
  const lines = (list: string[], k: number, from = 0) => Array.from({ length: k }, (_, i) => ({ id: cid(), text: list[(from + i) % list.length] }))
  const iso = (ymdText: string, days: number, hour: number) => {
    const d = parse(ymdText)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, hour, Math.floor(r() * 60)).toISOString()
  }
  const score = (rep: MonthReport, mean: number, at: string, i: number) => {
    const scores = DEFAULT_KPI.criteria.map((c: Criterion) => ({ ...c, points: Math.max(1, Math.min(5, Math.round(mean + (r() - 0.5) * 1.6))) }))
    return { ...rep, status: 'scored' as const, scores, band: bandOf(DEFAULT_KPI.bands, total(scores)), comment: COMMENTS[i % COMMENTS.length], scored: at, updated: at }
  }
  for (const company of Object.keys(s.roles)) {
    writers(s, company, cur).forEach((person, i) => {
      const pool = POOL[s.people.find(p => p.id === person)?.team ?? ''] ?? POOL['Удирдлага']
      const manager = managerOf(s, company, person)!
      const mean = 3.4 + r() * 1.4
      const base = (month: string, text: Pick<MonthReport, 'done' | 'issues' | 'plan'>, at: string): MonthReport =>
        ({ id: `mr-${company}-${person}-${month}`, company, person, month, ...text, status: 'draft', updated: at })
      // Two months back and one: sent around the last day (now and then a day late), scored a day or three later
      for (const back of [2, 1]) {
        const m = prevMonth(cur, back)
        const late = (i * 3 + back) % 8 === 5
        const sent = iso(dueOf(m), late ? 1 : -Math.floor(r() * 3), 15 + Math.floor(r() * 3))
        const rep = { ...base(m, { done: lines(pool.done, 3 + (i % 2), i + back), issues: pool.issues[(i + back) % pool.issues.length], plan: lines(pool.plan, 3, i + back + 1) }, sent), status: 'sent' as const, manager, sent }
        reports.push(score(rep, mean, new Date(new Date(sent).getTime() + (1 + Math.floor(r() * 3)) * 864e5).toISOString(), i + back))
      }
      // This month
      const [st, hours = 0] = company === 'c1' ? NOW_C1[person] ?? ['none'] : [NOW_OTHERS[i % NOW_OTHERS.length], 4 + i * 5]
      if (st === 'none') return
      const at = new Date(now.getTime() - hours * 36e5).toISOString()
      const text = { done: [...fromSystem(s, company, person, cur), ...lines(pool.done, st === 'draft' ? 1 : 2, i)], issues: st === 'draft' ? '' : pool.issues[i % pool.issues.length], plan: lines(pool.plan, st === 'draft' ? 1 : 3, i + 2) }
      const rep = base(cur, text, at)
      if (st === 'draft') reports.push(rep)
      else if (st === 'returned') reports.push({ ...rep, status: 'returned', manager, sent: at, reason: 'Хийсэн ажлаа бодит тоо баримт, үр дүнтэй нь тодорхой тусгана уу. Жишээ нь, хэдэн компьютер шинэчилж, хэдэн хүсэлт шийдвэрлэсэн талаар дэлгэрүүлнэ үү.', updated: new Date(now.getTime() - 4 * 36e5).toISOString() })
      else if (st === 'sent') reports.push({ ...rep, status: 'sent', manager, sent: at })
      else reports.push(score({ ...rep, status: 'sent', manager, sent: at }, mean, new Date(now.getTime() - (hours - 6) * 36e5).toISOString(), i))
    })
  }
  return { reports, kpi: {} }
}
