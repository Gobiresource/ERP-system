// Numbers computed from the data: workload, local time, counts. Used by several screens.
import type { CalEvent, FocusLog, Hue, Person, Project, Task } from './types'
import { addDays, hm, parse, today, weekStart, ymd } from './format'

const TEAM_HUE: Record<string, Hue> = { 'Удирдлага': 'indigo', 'Санхүү': 'pink', 'Борлуулалт': 'green', 'Үйл ажиллагаа': 'orange', 'Хүний нөөц': 'purple' }
export const teamHue = (team: string): Hue => TEAM_HUE[team] ?? 'blue'

export interface Load {
  hours: number
  capacity: number
  pct: number
  level: 'ok' | 'high' | 'over'
  open: number
}

/** Open work (hours of unfinished tasks) against the hours a person has in a week */
export function workload(p: Person, tasks: Task[]): Load {
  const mine = tasks.filter(t => t.assignees.includes(p.id) && t.status !== 'done')
  // A task with several people in charge: its hours are shared between them
  const hours = Math.round(mine.reduce((n, t) => n + t.estimate / t.assignees.length, 0) * 10) / 10
  const pct = Math.round((hours / p.capacity) * 100)
  return { hours, capacity: p.capacity, pct, level: pct > 100 ? 'over' : pct >= 70 ? 'high' : 'ok', open: mine.length }
}

/** Local time for people outside Ulaanbaatar time (UTC+8) */
export function localTime(p: Person) {
  if (!p.tz) return null
  const now = new Date()
  const there = new Date(now.getTime() + (p.tz.offset - 8) * 36e5)
  const diff = p.tz.offset - 8
  return {
    time: hm(there),
    city: p.tz.city,
    day: there.getHours() >= 7 && there.getHours() < 19,
    gap: diff === 0 ? 'Таны цагтай ижил' : diff < 0 ? `${-diff} цагаар хоцорсон` : `${diff} цагаар түрүүлсэн`,
  }
}

/** Minutes focused per day for the last `days` days (oldest first) */
export function focusByDay(log: FocusLog[], days: number) {
  const start = addDays(new Date(), -(days - 1))
  const keys = Array.from({ length: days }, (_, i) => ymd(addDays(start, i)))
  const map = new Map(keys.map(k => [k, 0]))
  for (const f of log) {
    const k = ymd(new Date(f.at))
    if (map.has(k)) map.set(k, map.get(k)! + f.minutes)
  }
  return keys.map(k => ({ day: k, minutes: map.get(k)! }))
}

export const focusToday = (log: FocusLog[]) => {
  const t = today()
  const list = log.filter(f => ymd(new Date(f.at)) === t)
  return { minutes: list.reduce((n, f) => n + f.minutes, 0), sessions: list.length }
}

/** Demo-only focus hours for colleagues (only your own sessions are recorded for now) */
export function demoFocusHours(p: Person) {
  let h = 0
  for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) % 997
  return Math.round(((h % 50) / 10 + (p.presence === 'focus' ? 2 : 0.5)) * 10) / 10
}

export const isToday = (s: string) => s.slice(0, 10) === today()
export const thisWeek = (s: string) => {
  const start = weekStart(new Date())
  const d = parse(s.slice(0, 10))
  return d >= start && d < addDays(start, 7)
}
export const eventEnd = (e: CalEvent) => new Date(parse(e.start).getTime() + e.minutes * 6e4)

/** Done and total tasks of a project */
export function projectProgress(projectId: string, tasks: Task[]) {
  const mine = tasks.filter(t => t.project === projectId)
  const done = mine.filter(t => t.status === 'done').length
  return { total: mine.length, done, open: mine.length - done, pct: mine.length ? Math.round((done / mine.length) * 100) : 0 }
}

/** How far through its time a project is (0..1) */
export function timeElapsed(p: Project) {
  const s = parse(p.start).getTime()
  const e = parse(p.due).getTime()
  return Math.max(0, Math.min(1, (Date.now() - s) / Math.max(1, e - s)))
}

/** Upcoming (first unfinished) milestone */
export const nextMilestone = (p: Project) => [...p.milestones].sort((a, b) => a.date.localeCompare(b.date)).find(m => !m.done)

/**
 * Burn-up: tasks done and total tasks, from the start of the project to today (or the end).
 * The demo has no history, so the curve before today is drawn from where the numbers are now.
 */
export function burnSeries(p: Project, tasks: Task[], points = 12) {
  const { total, done } = projectProgress(p.id, tasks)
  const start = parse(p.start)
  const end = new Date(Math.min(Date.now(), parse(p.due).getTime()))
  const span = Math.max(1, end.getTime() - start.getTime())
  let seed = 0
  for (const c of p.id) seed = (seed * 31 + c.charCodeAt(0)) % 9973
  const jitter = (i: number) => ((Math.sin(seed + i * 1.7) + 1) / 2) * 0.12
  const labels: string[] = []
  const totals: number[] = []
  const dones: number[] = []
  for (let i = 0; i < points; i++) {
    const f = i / (points - 1)
    const d = new Date(start.getTime() + span * f)
    labels.push(`${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`)
    totals.push(Math.round(total * Math.min(1, 0.35 + 0.65 * Math.min(1, f * 1.15 + jitter(i)))))
    dones.push(Math.round(done * Math.min(1, Math.pow(f, 1.6) + jitter(i + 5) * f)))
  }
  totals[points - 1] = total
  dones[points - 1] = done
  for (let i = 1; i < points; i++) {
    totals[i] = Math.max(totals[i], totals[i - 1])
    dones[i] = Math.max(dones[i], dones[i - 1])
  }
  return { labels, totals, dones }
}
