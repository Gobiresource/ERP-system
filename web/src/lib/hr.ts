// Human resources: labels, the registration number (РД), and the numbers the HR screens show.
import type { ContractKind, DocType, EmpStatus, Employee, FileItem, Hue, Id, MoveKind, State } from './types'
import { daysFromToday, parse, today } from './format'

export const EMP_STATUS: Record<EmpStatus, string> = {
  active: 'Ажиллаж буй', probation: 'Туршилтаар', leave: 'Чөлөөтэй', childcare: 'Хүүхэд асрах чөлөөтэй', left: 'Ажлаас гарсан',
}
export const EMP_STATUSES = Object.keys(EMP_STATUS) as EmpStatus[]
export const CONTRACT: Record<ContractKind, string> = { open: 'Хугацаагүй', fixed: 'Хугацаатай', service: 'Хөлсөөр ажиллах' }
export const MOVE: Record<MoveKind, string> = {
  hired: 'Ажилд орсон', moved: 'Шилжсэн', promoted: 'Албан тушаал дэвшсэн', confirmed: 'Туршилт дууссан', pay: 'Цалин өөрчлөгдсөн',
  vacation: 'Ээлжийн амралт', leave: 'Чөлөө', childcare: 'Хүүхэд асрах чөлөө', back: 'Ажилдаа эргэн орсон', award: 'Шагнал',
  penalty: 'Сахилгын шийтгэл', left: 'Ажлаас чөлөөлөгдсөн',
}
export const MOVE_HUE: Record<MoveKind, Hue> = {
  hired: 'green', moved: 'blue', promoted: 'indigo', confirmed: 'teal', pay: 'blue', vacation: 'orange', leave: 'orange',
  childcare: 'purple', back: 'teal', award: 'yellow', penalty: 'pink', left: 'pink',
}

/** Days before an expiry date when it starts to show as a warning */
export const ALERT_DAYS = 30

/** "2026-10-28" → "2026.10.28" */
export const dots = (ymd: string) => ymd.replaceAll('-', '.')
export const fullName = (e: Pick<Employee, 'family' | 'given'>) => `${e.family} ${e.given}`
/** Still works here (on leave counts: the position stays theirs) */
export const current = (e: Employee) => e.status !== 'left'

/**
 * Reads a registration number: two Cyrillic letters and 8 digits, the first 6 being the birth date (YYMMDD).
 * People born in 2000 or later have 20 added to the month. The second-to-last digit is odd for men, even for women.
 * Small letters and spaces are fine. Returns null when the number cannot be a real one.
 */
export function readRegNo(raw: string) {
  const value = raw.replace(/\s+/g, '').toUpperCase()
  const m = /^([А-ЯЁӨҮ]{2})(\d\d)(\d\d)(\d\d)(\d)(\d)$/.exec(value)
  if (!m) return null
  let year = 1900 + Number(m[2])
  let month = Number(m[3])
  if (month > 20) { year += 100; month -= 20 }
  const day = Number(m[4])
  const birth = new Date(year, month - 1, day)
  if (birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > new Date()) return null
  return { value, birth, male: Number(m[5]) % 2 === 1 }
}

export const ageOn = (birth: Date, on = new Date()) =>
  on.getFullYear() - birth.getFullYear() - (on < new Date(on.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)

/** How long since a date: "4 жил 2 сар" */
export function tenure(from: string, to = today()) {
  const a = parse(from)
  const b = parse(to)
  const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0)
  if (months < 1) return '1 сар хүрээгүй'
  const y = Math.floor(months / 12)
  const m = months % 12
  return y ? (m ? `${y} жил ${m} сар` : `${y} жил`) : `${m} сар`
}

export type FileState = 'ok' | 'soon' | 'expired' | 'missing'
/** Where one document of the personal file stands */
export function fileState(item: FileItem | undefined): { state: FileState; days?: number } {
  if (!item) return { state: 'missing' }
  if (!item.expires) return { state: 'ok' }
  const days = daysFromToday(item.expires)
  return { state: days < 0 ? 'expired' : days <= ALERT_DAYS ? 'soon' : 'ok', days }
}

/** Required documents in place (and not expired) out of all required ones: "9 / 12" */
export function fileScore(e: Employee, types: DocType[]) {
  const req = types.filter(t => t.required)
  const done = req.filter(t => {
    const st = fileState(e.files.find(f => f.type === t.id)).state
    return st === 'ok' || st === 'soon'
  }).length
  return { done, total: req.length }
}

export type AlertKind = 'contract' | 'probation' | 'file'
export interface Alert {
  kind: AlertKind
  employee: Employee
  what: string
  date: string
  /** Days left; below zero once the date has passed */
  days: number
}

/** Contracts, probations and documents that end within ALERT_DAYS or have already ended, soonest first */
export function alertsOf(employees: Employee[], types: DocType[]): Alert[] {
  const out: Alert[] = []
  for (const e of employees) {
    if (!current(e)) continue
    const add = (kind: AlertKind, what: string, date: string) => {
      const days = daysFromToday(date)
      if (days <= ALERT_DAYS) out.push({ kind, employee: e, what, date, days })
    }
    if (e.contract.kind !== 'open' && e.contract.end) add('contract', 'Хөдөлмөрийн гэрээ', e.contract.end)
    if (e.status === 'probation' && e.probationEnd) add('probation', 'Туршилтын хугацаа', e.probationEnd)
    for (const f of e.files) if (f.expires) add('file', types.find(t => t.id === f.type)?.name ?? 'Баримт', f.expires)
  }
  return out.sort((a, b) => a.days - b.days)
}

/** "9 хоногийн дараа дуусна", "Өнөөдөр дуусна", "3 хоногийн өмнө дууссан" */
export const whenEnds = (days: number) => (days > 0 ? `${days} хоногийн дараа дуусна` : days === 0 ? 'Өнөөдөр дуусна' : `${-days} хоногийн өмнө дууссан`)

/** The next free employee code in a ХХК: "ГР-026" */
export function nextCode(prefix: string, employees: Employee[]) {
  const n = Math.max(0, ...employees.map(e => Number(e.code.split('-')[1]) || 0)) + 1
  return `${prefix}-${String(n).padStart(3, '0')}`
}

/** HR data of the current ХХК, plus lookups. Cached per state object, like scoped(). */
export interface HrScoped {
  employees: Employee[]
  departments: State['departments']
  positions: State['positions']
  docTypes: DocType[]
  dept: (id: Id) => State['departments'][number] | undefined
  position: (id: Id) => State['positions'][number] | undefined
  employee: (id: Id) => Employee | undefined
  /** People holding each position now */
  filled: Map<Id, number>
}
const cache = new WeakMap<State, HrScoped>()
export function hrScoped(s: State): HrScoped {
  let v = cache.get(s)
  if (!v) {
    const c = s.company
    const departments = s.departments.filter(d => d.company === c)
    const positions = s.positions.filter(p => p.company === c)
    const employees = s.employees.filter(e => e.company === c)
    const filled = new Map<Id, number>()
    for (const e of employees) if (current(e)) filled.set(e.position, (filled.get(e.position) ?? 0) + 1)
    v = {
      employees, departments, positions, filled,
      docTypes: s.docTypes.filter(t => t.company === c),
      dept: id => departments.find(d => d.id === id),
      position: id => positions.find(p => p.id === id),
      employee: id => employees.find(e => e.id === id),
    }
    cache.set(s, v)
  }
  return v
}
