// Mongolian formats: 2026.10.28, 14:30, 1,234,567 ₮. Fixed strings so every browser shows the same text.

const WEEKDAYS = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба']
const WEEKDAYS_SHORT = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя']

const pad = (n: number) => String(n).padStart(2, '0')

/** Local date as YYYY-MM-DD */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** Local date-time as YYYY-MM-DDTHH:mm */
export const ymdhm = (d: Date) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
/** Parses YYYY-MM-DD or YYYY-MM-DDTHH:mm as local time */
export const parse = (s: string) => {
  const [date, time = '00:00'] = s.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

export const today = () => ymd(new Date())
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes())
export const addDaysYmd = (s: string, n: number) => ymd(addDays(parse(s), n))
/** Whole days from today to the date (negative = past) */
export const daysFromToday = (s: string) => Math.round((parse(s.slice(0, 10)).getTime() - parse(today()).getTime()) / 864e5)
/** Monday of the week that holds d */
export const weekStart = (d: Date) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7))
/** Monday and Sunday of this week, as YYYY-MM-DD */
export const thisWeekRange = () => {
  const m = weekStart(new Date())
  return [ymd(m), ymd(addDays(m, 6))] as const
}

export const weekday = (d: Date) => WEEKDAYS[d.getDay()]
export const weekdayShort = (d: Date) => WEEKDAYS_SHORT[d.getDay()]
/** 2026.10.28 */
export const dateDots = (d: Date) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
/** 10.28 */
export const monthDayDots = (d: Date) => `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
/** 10-р сарын 28 */
export const monthDay = (d: Date) => `${d.getMonth() + 1}-р сарын ${d.getDate()}`
/** 2026 оны 10-р сар */
export const monthTitle = (d: Date) => `${d.getFullYear()} оны ${d.getMonth() + 1}-р сар`
/** 14:30 */
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Short due label for cards: Өнөөдөр, Маргааш, Өчигдөр, a weekday this week, or 11.19 */
export function dueLabel(s: string) {
  const n = daysFromToday(s)
  if (n === 0) return 'Өнөөдөр'
  if (n === 1) return 'Маргааш'
  if (n === -1) return 'Өчигдөр'
  if (n > 1 && n < 7) return weekday(parse(s))
  const d = parse(s)
  return d.getFullYear() === new Date().getFullYear() ? monthDayDots(d) : dateDots(d)
}

/** 5 минутын өмнө, 2 цагийн өмнө, Өчигдөр, 3 өдрийн өмнө */
export function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 6e4)
  if (min < 1) return 'Дөнгөж сая'
  if (min < 60) return `${min} минутын өмнө`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} цагийн өмнө`
  const d = Math.round(h / 24)
  return d === 1 ? 'Өчигдөр' : `${d} өдрийн өмнө`
}

/** 20 минутын дараа, 2 цагийн дараа */
export function until(d: Date) {
  const min = Math.round((d.getTime() - Date.now()) / 6e4)
  if (min <= 0) return 'Эхэлсэн'
  if (min < 60) return `${min} минутын дараа`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} цаг ${m} минутын дараа` : `${h} цагийн дараа`
}

/** 1,234,567 */
export const num = (n: number) => Math.round(n).toLocaleString('en-US')
/** 1.1 (one decimal, no trailing .0) */
export const dec = (n: number) => (Math.round(n * 10) / 10).toString()
/** 20 мин, 1 цаг, 1.5 цаг */
export const duration = (m: number) => (m < 60 ? `${m} мин` : `${Math.round((m / 60) * 10) / 10} цаг`)
/** 25:00 */
export const clock = (sec: number) => `${pad(Math.floor(Math.max(0, sec) / 60))}:${pad(Math.floor(Math.max(0, sec) % 60))}`

/** Б.Болд */
export const short = (p: { given: string; family: string }) => `${p.family.charAt(0)}.${p.given}`
/** Initials for avatars: БӨ */
export const initials = (p: { given: string; family: string }) => (p.family.charAt(0) + p.given.charAt(0)).toUpperCase()
/** ГР for "Говь Ресурс ХХК": the company's mark, and the start of its employee codes */
export const companyMark = (name: string) => name.replace(/\s*ХХК$/i, '').split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase()

/** Sorts Mongolian text correctly (Ө after О, Ү after У) */
export const collator = new Intl.Collator('mn')
