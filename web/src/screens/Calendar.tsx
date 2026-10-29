import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { CalendarPlus, ChevronLeft, ChevronRight, Flag, MapPin, Plus } from 'lucide-react'
import '../styles/screens/calendar.css'
import type { CalEvent, Hue } from '../lib/types'
import { scoped, useApp, type Scoped } from '../lib/store'
import { open } from '../lib/ui'
import { gsap, reduced, usePageEnter } from '../lib/motion'
import { addDays, duration, hm, monthDay, parse, today, weekStart, weekday, weekdayShort, ymd, ymdhm } from '../lib/format'
import { eventEnd, thisWeek } from '../lib/derive'
import { PageHead } from '../ui/PageHead'
import { Seg } from '../ui/Seg'
import { AvatarStack, KIND, KIND_HUE, KIND_ICON, eventHue } from '../ui/bits'
import { moveTask } from './tasks/TaskCard'

type View = 'month' | 'week'
const VIEW_KEY = 'erp:calendar-view'
const readView = (): View => { try { return localStorage.getItem(VIEW_KEY) === 'week' ? 'week' : 'month' } catch { return 'month' } }
const HOURS = { from: 8, to: 19 }

const monthLabel = (from: Date, to: Date) =>
  from.getMonth() === to.getMonth() ? `${from.getFullYear()} оны ${from.getMonth() + 1}-р сар`
    : `${to.getFullYear()} оны ${from.getMonth() + 1}–${to.getMonth() + 1}-р сар`

export default function Calendar() {
  const s = useApp()
  const sc = scoped(s)
  const ref = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const [view, setView] = useState<View>(readView)
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(today())
  const dir = useRef(0)

  const weekFrom = weekStart(cursor)
  const monthFrom = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const gridFrom = weekStart(monthFrom)
  const title = view === 'month' ? monthLabel(monthFrom, monthFrom) : monthLabel(weekFrom, addDays(weekFrom, 6))
  const weekCount = sc.events.filter(e => thisWeek(e.start)).length

  const step = (n: number) => {
    dir.current = n
    setCursor(c => (view === 'month' ? new Date(c.getFullYear(), c.getMonth() + n, 1) : addDays(c, 7 * n)))
  }
  const goToday = () => {
    dir.current = 0
    setCursor(new Date())
    setSelected(today())
  }
  const changeView = (v: View) => {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* not saved */ }
  }

  // Slide between months or weeks; events pop in
  useLayoutEffect(() => {
    const el = stage.current
    if (!el || reduced()) return
    if (dir.current) gsap.fromTo(el, { x: 56 * dir.current, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'expo.out', clearProps: 'transform,opacity' })
    gsap.from(el.querySelectorAll('.cal-ev, .cal-blk'), { scale: 0.8, opacity: 0, duration: 0.5, ease: 'back.out(2.2)', stagger: 0.008, clearProps: 'transform,opacity' })
    dir.current = 0
  }, [view, cursor])

  return (
    <div ref={ref}>
      <PageHead
        title={title}
        sub={`Энэ долоо хоногт ${weekCount} үйл явдал байна.`}
        actions={
          <>
            <div className="cal-nav" role="group" aria-label={view === 'month' ? 'Сар солих' : 'Долоо хоног солих'}>
              <button type="button" className="cal-nav__btn" onClick={() => step(-1)} aria-label={view === 'month' ? 'Өмнөх сар' : 'Өмнөх долоо хоног'}><ChevronLeft className="ico" /></button>
              <button type="button" className="cal-nav__btn cal-nav__today" onClick={goToday}>Өнөөдөр</button>
              <button type="button" className="cal-nav__btn" onClick={() => step(1)} aria-label={view === 'month' ? 'Дараах сар' : 'Дараах долоо хоног'}><ChevronRight className="ico" /></button>
            </div>
            <Seg label="Харагдац" className="cal-viewseg" value={view} onChange={changeView} options={[{ value: 'month', label: 'Сар' }, { value: 'week', label: 'Долоо хоног' }]} />
            <button type="button" className="btn btn--accent" onClick={() => open({ kind: 'newEvent', defaults: { start: `${selected}T10:00` } })}>
              <CalendarPlus className="ico" />
              Шинэ үйл явдал
            </button>
          </>
        }
      />
      <div className={`cal${view === 'week' ? ' is-week' : ''}`}>
        {view === 'month' ? (
          <>
            <section className="card glass cal-monthcard" aria-label={title} data-enter>
              <div className="cal-wd" aria-hidden="true">
                {['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'].map(d => <span key={d}>{d}</span>)}
              </div>
              <div className="cal-stage" ref={stage}>
                <MonthGrid from={gridFrom} month={monthFrom.getMonth()} sc={sc} selected={selected} onSelect={setSelected}
                  onPage={n => { step(n) }} />
              </div>
            </section>
            <Agenda day={selected} sc={sc} />
          </>
        ) : (
          <section className="card glass" aria-label={title} data-enter>
            <div className="card__head">
              <div>
                <h2 className="card__title">{`${monthDay(weekFrom)} – ${monthDay(addDays(weekFrom, 6))}`}</h2>
                <p className="card__sub">{sc.events.filter(e => e.start >= ymd(weekFrom) && e.start < ymd(addDays(weekFrom, 7))).length} үйл явдал</p>
              </div>
              <p className="cal-hint">Хоосон цаг дээр дарж үйл явдал нэмнэ.</p>
            </div>
            <div className="cal-wk__scroll">
              <div className="cal-stage" ref={stage}>
                <WeekGrid from={weekFrom} sc={sc} />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function MonthGrid({ from, month, sc, selected, onSelect, onPage }: { from: Date; month: number; sc: Scoped; selected: string; onSelect: (d: string) => void; onPage: (n: number) => void }) {
  const grid = useRef<HTMLDivElement>(null)
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(from, i)), [from])
  const t = today()
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of sc.events) {
      const k = e.start.slice(0, 10)
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return m
  }, [sc.events])
  const flags = useMemo(() => {
    const m = new Map<string, { hue: Hue; name: string }[]>()
    for (const p of sc.projects) for (const ms of p.milestones) m.set(ms.date, [...(m.get(ms.date) ?? []), { hue: p.hue, name: `${ms.name} (${p.name})` }])
    return m
  }, [sc.projects])

  // Arrow keys move between days, Page Up/Down change the month
  const onKey = (e: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); onPage(e.key === 'PageUp' ? -1 : 1); return }
    if (!(e.key in moves)) return
    e.preventDefault()
    const next = ymd(addDays(parse(selected), moves[e.key]))
    onSelect(next)
    requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-day="${next}"]`)?.focus())
  }

  return (
    <div className="cal-grid" ref={grid} onKeyDown={onKey}>
      {days.map(d => {
        const k = ymd(d)
        const evs = byDay.get(k) ?? []
        const fl = flags.get(k) ?? []
        const out = d.getMonth() !== month
        const weekend = d.getDay() === 0 || d.getDay() === 6
        const shown = evs.slice(0, 3)
        return (
          <button
            key={k}
            type="button"
            data-day={k}
            className={`cal-day${out ? ' is-out' : ''}${weekend ? ' is-weekend' : ''}${k === t ? ' is-today' : ''}`}
            aria-pressed={k === selected}
            aria-current={k === t ? 'date' : undefined}
            aria-label={`${monthDay(d)}, ${weekday(d)}. ${evs.length ? `${evs.length} үйл явдал` : 'Үйл явдалгүй'}${fl.length ? `, ${fl.length} үе шат` : ''}`}
            tabIndex={k === selected ? 0 : -1}
            onClick={() => onSelect(k)}
            onDoubleClick={() => open({ kind: 'newEvent', defaults: { start: `${k}T10:00` } })}
          >
            <span className="cal-day__top">
              <span className="cal-day__n">{d.getDate()}</span>
              {evs.length > 3 && <span className="cal-more">+{evs.length - 3}</span>}
              {fl.slice(0, 2).map((f, i) => <span key={i} className={`cal-flag hue--${f.hue}`} title={f.name}><Flag className="ico" /></span>)}
            </span>
            <span className="cal-day__evs" aria-hidden="true">
              {shown.map(e => (
                <span key={e.id} className={`cal-ev hue--${eventHue(e, sc)}${eventEnd(e) < new Date() ? ' is-past' : ''}`}><span>{e.title}</span></span>
              ))}
            </span>
            <span className="cal-day__dots" aria-hidden="true">
              {shown.map(e => <i key={e.id} className={`hue--${eventHue(e, sc)}`} />)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Agenda({ day, sc }: { day: string; sc: Scoped }) {
  const d = parse(day)
  const isToday = day === today()
  const events = sc.events.filter(e => e.start.startsWith(day))
  const due = sc.tasks.filter(t => t.due === day)
  const milestones = sc.projects.flatMap(p => p.milestones.filter(m => m.date === day).map(m => ({ m, p })))
  const now = new Date()
  const nowIndex = isToday ? events.filter(e => parse(e.start) <= now).length : -1

  return (
    <section className="card glass cal-agenda" aria-labelledby="ag-title" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="ag-title">{isToday ? 'Өнөөдөр' : weekday(d)}</h2>
          <p className="card__sub">{monthDay(d)}, {events.length} үйл явдал</p>
        </div>
        <button type="button" className="btn btn--glass btn--sm" onClick={() => open({ kind: 'newEvent', defaults: { start: `${day}T10:00` } })}>
          <Plus className="ico" />
          Нэмэх
        </button>
      </div>
      <div className="cal-ag">
        {milestones.map(({ m, p }) => (
          <div key={m.id} className={`cal-ms hue--${p.hue}`}>
            <Flag className="ico" />
            <span><b>{m.name}</b><small>{p.name}, үе шат</small></span>
          </div>
        ))}
        <div className="cal-tl">
          {events.length === 0 && <p className="cal-none">Энэ өдөр үйл явдал алга.</p>}
          {events.map((e, i) => {
            const start = parse(e.start)
            const end = eventEnd(e)
            const live = start <= now && end > now
            const Icon = KIND_ICON[e.kind]
            const people = e.attendees.map(id => sc.person(id)).filter(x => x !== undefined)
            return (
              <div key={e.id} className={`cal-tl__item${end < now ? ' is-past' : ''}`}>
                {i === nowIndex && !live && <NowLine />}
                <button type="button" className={`cal-tl__btn hue--${eventHue(e, sc)}`} onClick={() => open({ kind: 'event', id: e.id })}>
                  <span className="cal-tl__time"><b className="tnum">{hm(start)}</b><small>{duration(e.minutes)}</small></span>
                  <span className="cal-tl__rail" aria-hidden="true" />
                  <span className="cal-tl__body">
                    <span className="cal-tl__title">{e.title}</span>
                    {e.where && <span className="cal-tl__meta"><MapPin className="ico" />{e.where}</span>}
                    <span className="cal-tl__foot">
                      {live && <span className="cal-live">Яг одоо</span>}
                      {people.length > 0 && <AvatarStack people={people} max={3} size="xs" />}
                      <span className={`cal-kind hue--${KIND_HUE[e.kind]}`}><Icon className="ico" />{KIND[e.kind]}</span>
                    </span>
                  </span>
                </button>
              </div>
            )
          })}
          {nowIndex === events.length && events.length > 0 && <NowLine />}
        </div>
        {due.length > 0 && (
          <div className="cal-due">
            <h3 className="cal-due__h">{isToday ? 'Өнөөдөр дуусах ажил' : 'Энэ өдөр дуусах ажил'} <span className="badge tnum">{due.length}</span></h3>
            {due.map(t => {
              const p = sc.project(t.project)
              return (
                <div key={t.id} className={`cal-task${t.status === 'done' ? ' is-done' : ''}`}>
                  <input type="checkbox" className="check" checked={t.status === 'done'} aria-label={`${t.title}: дууссан`} onChange={e => moveTask(t, e.target.checked ? 'done' : 'todo')} />
                  <button type="button" className="cal-task__t" onClick={() => open({ kind: 'task', id: t.id })}>
                    <span>{t.title}</span>
                    {p && <small className={`hue--${p.hue}`}><i aria-hidden="true" />{p.name}</small>}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function NowLine() {
  return (
    <div className="cal-tl__now" aria-hidden="true">
      <span>{hm(new Date())}</span>
      <i />
    </div>
  )
}

function WeekGrid({ from, sc }: { from: Date; sc: Scoped }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const t = today()
  const now = new Date()
  const span = (HOURS.to - HOURS.from) * 60
  const top = (min: number) => `${((min - HOURS.from * 60) / span) * 100}%`

  const addAt = (e: MouseEvent<HTMLDivElement>, day: Date) => {
    if (e.target !== e.currentTarget) return
    const r = e.currentTarget.getBoundingClientRect()
    const min = HOURS.from * 60 + Math.floor((((e.clientY - r.top) / r.height) * span) / 30) * 30
    const d = new Date(day)
    d.setHours(Math.floor(min / 60), min % 60, 0, 0)
    open({ kind: 'newEvent', defaults: { start: ymdhm(d) } })
  }

  return (
    <div className="cal-wk">
      <div className="cal-wk__head">
        <span />
        {days.map(d => (
          <div key={ymd(d)} className={`cal-wk__day${ymd(d) === t ? ' is-today' : ''}`}>
            <small>{weekdayShort(d)}</small><b className="tnum">{d.getDate()}</b>
          </div>
        ))}
      </div>
      <div className="cal-wk__body">
        <div className="cal-wk__hours" aria-hidden="true">
          {Array.from({ length: HOURS.to - HOURS.from }, (_, i) => (
            <span key={i} style={{ top: `${(i / (HOURS.to - HOURS.from)) * 100}%` }}>{String(HOURS.from + i).padStart(2, '0')}:00</span>
          ))}
        </div>
        {days.map(d => {
          const k = ymd(d)
          const evs = sc.events.filter(e => e.start.startsWith(k))
          // Side-by-side lanes for events that overlap
          const lanes: number[] = []
          const placed = evs.map(e => {
            const s0 = parse(e.start).getHours() * 60 + parse(e.start).getMinutes()
            let lane = lanes.findIndex(end => end <= s0)
            if (lane < 0) lane = lanes.length
            lanes[lane] = s0 + Math.max(e.minutes, 20)
            return { e, s0, lane }
          })
          const width = 100 / Math.max(1, lanes.length)
          const nowMin = now.getHours() * 60 + now.getMinutes()
          return (
            <div key={k} className={`cal-wk__col${k === t ? ' is-today' : ''}${d.getDay() === 0 || d.getDay() === 6 ? ' is-weekend' : ''}`}
              onClick={e => addAt(e, d)} aria-label={`${monthDay(d)}, ${weekday(d)}`} role="group">
              {placed.map(({ e, s0, lane }) => {
                const short = e.minutes < 40
                const mins = Math.max(e.minutes, 20)
                return (
                  <button key={e.id} type="button" className={`cal-blk hue--${eventHue(e, sc)}${short ? ' is-short' : ''}${eventEnd(e) < now ? ' is-past' : ''}`}
                    style={{ top: top(Math.max(s0, HOURS.from * 60)), height: `${(mins / span) * 100}%`, left: `calc(${lane * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
                    onClick={() => open({ kind: 'event', id: e.id })}>
                    <b>{e.title}</b>
                    {!short && <small>{hm(parse(e.start))}{e.where ? `, ${e.where}` : ''}</small>}
                  </button>
                )
              })}
              {k === t && nowMin >= HOURS.from * 60 && nowMin <= HOURS.to * 60 && <span className="cal-now" style={{ top: top(nowMin) }} aria-hidden="true" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

