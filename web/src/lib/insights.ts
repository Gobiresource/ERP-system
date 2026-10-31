// Numbers for the Insights screen. Recent days come from the real tasks; older days are demo history,
// generated the same way every time, so the charts have something to show before real data exists.
import type { State, Task } from './types'
import { addDays, dayOf, monthDayDots, parse, ymd } from './format'
import { scoped } from './store'
import { saveBlob } from './files'

export type Range = 7 | 30 | 90

interface Day {
  day: string
  done: number
  late: number
  focusMin: number
  cycle: number // average days from created to done
}

/** Days for which the real tasks are the source (the demo data covers about two weeks) */
const REAL_DAYS = 14

function rand(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/** One record per day, oldest first, for `days` days ending today */
export function history(s: State, days: number): Day[] {
  const sc = scoped(s)
  const r = rand(`${s.company}-history`)
  const out: Day[] = []
  const end = new Date()
  const teamSize = sc.people.length
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(end, -i)
    const key = ymd(d)
    const weekend = d.getDay() === 0 || d.getDay() === 6
    const noise = r()
    if (i < REAL_DAYS) {
      const done = sc.tasks.filter(t => t.doneAt && ymd(new Date(t.doneAt)) === key)
      const mine = sc.focusLog.filter(f => ymd(new Date(f.at)) === key).reduce((n, f) => n + f.minutes, 0)
      out.push({
        day: key,
        done: done.length,
        late: done.filter(t => ymd(new Date(t.doneAt!)) > t.due).length,
        focusMin: mine + (weekend ? 0 : Math.round(teamSize * 30 * (0.6 + noise))),
        cycle: done.length ? done.reduce((n, t) => n + daysBetween(t.createdAt, t.doneAt!), 0) / done.length : 0,
      })
    } else {
      // About as many as the demo tasks of the last two weeks, so the charts have no step where real data starts
      const done = weekend ? (noise > 0.8 ? 1 : 0) : Math.round(teamSize * (0.06 + noise * 0.2))
      out.push({
        day: key,
        done,
        late: done && r() > 0.82 ? 1 : 0,
        focusMin: weekend ? 0 : Math.round(teamSize * 30 * (0.6 + r())),
        cycle: 2.5 + r() * 3,
      })
    }
  }
  return out
}

const daysBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 864e5)

export interface Summary {
  done: number
  onTime: number // 0..100
  late: number
  focusHours: number
  cycle: number
}

const summarize = (days: Day[]): Summary => {
  const done = days.reduce((n, d) => n + d.done, 0)
  const late = days.reduce((n, d) => n + d.late, 0)
  const withCycle = days.filter(d => d.done && d.cycle)
  return {
    done,
    late,
    onTime: done ? Math.round(((done - late) / done) * 100) : 100,
    focusHours: Math.round(days.reduce((n, d) => n + d.focusMin, 0) / 60),
    cycle: withCycle.length ? withCycle.reduce((n, d) => n + d.cycle * d.done, 0) / withCycle.reduce((n, d) => n + d.done, 0) : 0,
  }
}

/** The range and the same length before it */
export function insights(s: State, range: Range) {
  const all = history(s, range * 2)
  const prev = all.slice(0, range)
  const cur = all.slice(range)
  const weekly = range === 90
  const bucket = (days: Day[], pick: (d: Day) => number) => {
    if (!weekly) return days.map(pick)
    const out: number[] = []
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7).reduce((n, d) => n + pick(d), 0))
    return out
  }
  const labels = weekly
    ? Array.from({ length: Math.ceil(range / 7) }, (_, i) => monthDayDots(parse(cur[i * 7].day)))
    : cur.map(d => monthDayDots(parse(d.day)))
  return {
    cur: summarize(cur),
    prev: summarize(prev),
    labels,
    unitLabel: weekly ? 'Долоо хоног' : 'Өдөр',
    throughput: bucket(cur, d => d.done),
    throughputPrev: bucket(prev, d => d.done),
    // Minutes add up first: sums of rounded hours carry float noise (28.600000000000005)
    focus: bucket(cur, d => d.focusMin).map(m => Math.round(m / 6) / 10),
    days: cur,
  }
}

/** Finished tasks per project in the range: real tasks plus demo history spread over the projects */
export function byProject(s: State, range: Range) {
  const sc = scoped(s)
  const from = ymd(addDays(new Date(), -(range - 1)))
  const realFrom = ymd(addDays(new Date(), -(REAL_DAYS - 1)))
  // The same demo days as insights() draws: history() of another length gives other numbers
  const demo = history(s, range * 2).slice(range).filter(d => d.day < realFrom).reduce((n, d) => n + d.done, 0)
  const projects = sc.projects
  const weights = projects.map(p => 0.5 + rand(p.id)())
  const wsum = weights.reduce((a, b) => a + b, 0)
  const rows = projects.map((p, i) => ({
    project: p,
    count: sc.tasks.filter(t => t.project === p.id && t.doneAt && dayOf(t.doneAt) >= (from > realFrom ? from : realFrom)).length + Math.round((demo * weights[i]) / wsum),
  }))
  return rows.filter(r => r.count > 0).sort((a, b) => b.count - a.count)
}

/** Open tasks that have been open the longest */
export function slowest(tasks: Task[], n = 3) {
  return tasks
    .filter(t => t.status !== 'done')
    .map(t => ({ task: t, days: Math.round(daysBetween(t.createdAt, new Date().toISOString())) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, n)
}

/** CSV for Excel (UTF-8 with BOM so Cyrillic opens correctly) */
export function toCsv(rows: (string | number)[][]) {
  // Text stays text in Excel: it runs a cell that starts with = + - @ as a formula (OWASP: lead it with '), and turns
  // 12/12 or 10.10 into a date or a number (="…" shows it as written)
  const text = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : /^\d[\d .,/:%-]*$/.test(v) ? `="${v}"` : v)
  const esc = (v: string | number) => {
    if (typeof v === 'number') return String(v)
    const t = text(v)
    return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  return '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n')
}

/** Saves rows as a CSV file */
export const downloadCsv = (name: string, rows: (string | number)[][]) => saveBlob(name, new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
