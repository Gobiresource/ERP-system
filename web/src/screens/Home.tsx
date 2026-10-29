import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, AtSign, BadgeCheck, CalendarClock, CircleCheck, ListChecks, Pause, Play, Plus, Square, UserPlus } from 'lucide-react'
import '../styles/screens/home.css'
import type { NoteKind, Task } from '../lib/types'
import { scoped, useApp } from '../lib/store'
import { focus, focusLeft, open, useUi } from '../lib/ui'
import { go } from '../lib/router'
import { Flip, checkPop, gsap, reduced, usePageEnter } from '../lib/motion'
import { eventEnd, focusToday, projectProgress } from '../lib/derive'
import { addDays, ago, clock, daysFromToday, dec, dueLabel, hm, monthDay, monthDayDots, parse, short, today, until, weekStart, weekday, weekdayShort, ymd } from '../lib/format'
import { PageHead } from '../ui/PageHead'
import { Seg } from '../ui/Seg'
import { AvatarStack, Avatar, Prio, ProjectChip, ProjectGlyph, PSTATUS, eventHue } from '../ui/bits'
import { Bars } from '../ui/charts'
import { moveTask } from './tasks/TaskCard'

const FOCUS_GOAL = 120 // minutes a day
const RANK = { urgent: 0, high: 1, medium: 2, low: 3 }
const greeting = () => {
  const h = new Date().getHours()
  return h >= 5 && h < 12 ? 'Өглөөний мэнд' : h >= 12 && h < 18 ? 'Өдрийн мэнд' : 'Оройн мэнд'
}

export default function Home() {
  const s = useApp()
  const sc = scoped(s)
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const t = today()
  const now = new Date()
  const me = sc.me

  const mine = sc.tasks.filter(x => x.assignee === s.me)
  const doneToday = mine.filter(x => x.doneAt && ymd(new Date(x.doneAt)) === t)
  const dueToday = mine.filter(x => x.due === t)
  const ringTotal = new Set([...dueToday, ...doneToday].map(x => x.id)).size
  const late = mine.filter(x => x.status !== 'done' && x.due < t)
  const focused = focusToday(s.focusLog)
  const myEvents = sc.events.filter(e => e.attendees.includes(s.me))
  const meetingsToday = myEvents.filter(e => e.start.startsWith(t) && e.kind !== 'focus' && e.kind !== 'deadline')
  const meetingsDone = meetingsToday.filter(e => eventEnd(e) <= now).length
  const tasksLeft = dueToday.filter(x => x.status !== 'done').length + late.length
  const next = myEvents.find(e => eventEnd(e) > now && e.kind !== 'deadline')

  return (
    <div ref={ref}>
      <PageHead
        title={`${greeting()}, ${me.given}`}
        sub={`${weekday(now)}, ${monthDay(now)}. ${tasksLeft || meetingsToday.length - meetingsDone ? `Өнөөдөр ${meetingsToday.length - meetingsDone} уулзалт, ${tasksLeft} ажил үлдсэн.` : 'Өнөөдөр үлдсэн ажил, уулзалт алга.'}`}
        stats={[
          { label: 'Өнөөдөр дууссан', value: doneToday.length, unit: `/ ${ringTotal}` },
          { label: 'Өнөөдөр төвлөрсөн', value: Number(dec(focused.minutes / 60)), unit: 'цаг' },
          { label: 'Хоцорсон', value: late.length, alert: late.length > 0 },
        ]}
        actions={
          <>
            <button type="button" className="btn btn--glass" onClick={() => open({ kind: 'newTask' })}><Plus className="ico" />Шинэ ажил</button>
            {next ? (
              <button type="button" className="btn btn--accent" onClick={() => open({ kind: 'event', id: next.id })}>
                <CalendarClock className="ico" />
                {next.start.startsWith(t) ? `Дараагийнх: ${hm(parse(next.start))}` : `Дараагийнх: ${dueLabel(next.start.slice(0, 10))}`}
              </button>
            ) : (
              <button type="button" className="btn btn--accent" onClick={() => go('calendar')}><CalendarClock className="ico" />Хуанли</button>
            )}
          </>
        }
      />
      <div className="home">
        <Rings tasks={[doneToday.length, ringTotal]} focusMin={focused.minutes} meetings={[meetingsDone, meetingsToday.length]} />
        <UpNext />
        <FocusCard />
        <MyTasks />
        <ThisWeek />
        <HomeProjects />
        <RightNow />
      </div>
    </div>
  )
}

function Rings({ tasks, focusMin, meetings }: { tasks: [number, number]; focusMin: number; meetings: [number, number] }) {
  const svg = useRef<SVGSVGElement>(null)
  const rings = [
    { cls: 'tasks', r: 52, v: tasks[1] ? tasks[0] / tasks[1] : 0 },
    { cls: 'focus', r: 37, v: Math.min(1, focusMin / FOCUS_GOAL) },
    { cls: 'meet', r: 22, v: meetings[1] ? meetings[0] / meetings[1] : 0 },
  ]
  useLayoutEffect(() => {
    if (reduced() || !svg.current) return
    gsap.from(svg.current.querySelectorAll('.rings__arc'), { strokeDashoffset: (_i: number, el: SVGCircleElement) => Number(el.getAttribute('stroke-dasharray')), duration: 1.4, ease: 'power3.inOut', stagger: 0.12 })
  }, [])
  return (
    <section className="card glass w-rings" aria-labelledby="rings-t" data-enter>
      <div className="card__head"><div><h2 className="card__title" id="rings-t">Өнөөдөр</h2><p className="card__sub">Өдрийн зорилтоо биелүүлээрэй</p></div></div>
      <div className="rings">
        <svg className="rings__svg" viewBox="0 0 120 120" ref={svg} aria-hidden="true">
          {rings.map(r => {
            const c = 2 * Math.PI * r.r
            return (
              <g key={r.cls} className={`rings--${r.cls}`}>
                <circle className="rings__track" cx="60" cy="60" r={r.r} />
                <circle className="rings__arc" cx="60" cy="60" r={r.r} strokeDasharray={c} strokeDashoffset={c * (1 - r.v)} />
              </g>
            )
          })}
        </svg>
        <dl className="rings__legend">
          <div className="rings__row rings--tasks"><dt>Ажил</dt><dd className="tnum">{tasks[0]}<small>/ {tasks[1]}</small></dd></div>
          <div className="rings__row rings--focus"><dt>Төвлөрөл</dt><dd className="tnum">{dec(focusMin / 60)}<small>/ {FOCUS_GOAL / 60} цаг</small></dd></div>
          <div className="rings__row rings--meet"><dt>Уулзалт</dt><dd className="tnum">{meetings[0]}<small>/ {meetings[1]}</small></dd></div>
        </dl>
      </div>
    </section>
  )
}

function UpNext() {
  const s = useApp()
  const sc = scoped(s)
  const now = new Date()
  const mine = sc.events.filter(e => e.attendees.includes(s.me) && eventEnd(e) > now && e.kind !== 'deadline')
  const next = mine[0]
  const rest = next ? mine.filter(e => e !== next && e.start.startsWith(next.start.slice(0, 10))).slice(0, 3) : []
  return (
    <section className="card glass w-next" aria-labelledby="next-t" data-enter>
      <div className="card__head">
        <h2 className="card__title" id="next-t">Дараагийн уулзалт</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => go('calendar')}>Хуанли</button>
      </div>
      {!next ? <p className="tp-none">Ойрын үед уулзалт алга.</p> : (
        <div className="next-wrap">
          <button type="button" className={`next hue--${eventHue(next, sc)}`} onClick={() => open({ kind: 'event', id: next.id })}>
            <span className="next__when">
              {parse(next.start) <= now ? <><span className="next__live" aria-hidden="true" /><b>Яг одоо</b></> : next.start.startsWith(today()) ? <b>{until(parse(next.start))}</b> : <b>{dueLabel(next.start.slice(0, 10))}</b>}
            </span>
            <span className="next__title">{next.title}</span>
            <span className="next__meta tnum">{hm(parse(next.start))}–{hm(eventEnd(next))}{next.where ? `, ${next.where}` : ''}</span>
            <span className="next__foot">
              <AvatarStack people={next.attendees.map(id => sc.person(id)).filter(x => x !== undefined)} max={4} size="sm" />
              <span className="btn btn--accent btn--sm" aria-hidden="true">Дэлгэрэнгүй</span>
            </span>
          </button>
          {rest.length > 0 && (
            <ul className="next__rest">
              {rest.map(e => (
                <li key={e.id}>
                  <button type="button" className={`hue--${eventHue(e, sc)}`} onClick={() => open({ kind: 'event', id: e.id })}>
                    <i aria-hidden="true" /><span>{e.title}</span><time>{hm(parse(e.start))}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function FocusCard() {
  const s = useApp()
  const ui = useUi()
  const f = ui.focus
  const [len, setLen] = useState(String([15, 25, 50].includes(s.settings.focus.work) ? s.settings.focus.work : 25))
  const [task, setTask] = useState('')
  const [, tick] = useState(0)
  useEffect(() => {
    if (f.status !== 'running') return
    const id = window.setInterval(() => tick(x => x + 1), 1000)
    return () => clearInterval(id)
  }, [f.status])

  const running = f.status !== 'idle'
  const total = running ? f.total : Number(len) * 60
  const left = running ? focusLeft(f) : total
  const r = 52
  const c = 2 * Math.PI * r
  const today_ = focusToday(s.focusLog)
  const open_ = s.tasks.filter(t => t.company === s.company && t.assignee === s.me && t.status !== 'done')
  const current = f.task ? s.tasks.find(t => t.id === f.task) : undefined

  return (
    <section className="card glass w-focus" aria-labelledby="focus-t" data-enter>
      <div className="card__head">
        <div><h2 className="card__title" id="focus-t">Төвлөрөл</h2><p className="card__sub">Цаг нь дээд талд харагдана</p></div>
        {!running && <Seg small label="Төвлөрөх хугацаа" value={len} onChange={setLen} options={['15', '25', '50'].map(v => ({ value: v, label: `${v} мин` }))} />}
      </div>
      <div className={`focus${f.status === 'running' ? ' is-running' : f.status === 'paused' ? ' is-paused' : ''}`}>
        <div className="focus__main">
          <div className="focus__dial">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="focus__track" cx="60" cy="60" r={r} />
              <circle className="focus__arc" cx="60" cy="60" r={r} strokeDasharray={c} strokeDashoffset={c * (left / Math.max(1, total))} />
            </svg>
            <div className="focus__read" role="timer" aria-live="off">
              <span className="focus__time">{clock(left)}</span>
              <span className="focus__state">{f.status === 'running' ? 'Төвлөрч байна' : f.status === 'paused' ? 'Түр зогссон' : 'Бэлэн'}</span>
            </div>
          </div>
          <div className="focus__side">
            {!running ? (
              <>
                <label className="focus__pick">
                  <span className="focus__label">Юун дээр төвлөрөх вэ</span>
                  <select value={task} onChange={e => setTask(e.target.value)}>
                    <option value="">Ажил сонгохгүй</option>
                    {open_.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </label>
                <button type="button" className="btn btn--accent focus__go" onClick={() => focus.start(Number(len), task || undefined)}>
                  <Play className="ico" />
                  Төвлөрч эхлэх
                </button>
              </>
            ) : (
              <>
                <span className="focus__label">Төвлөрч буй ажил</span>
                <span className="focus__task">{current ? current.title : `${Math.round(f.total / 60)} минутын төвлөрөл`}</span>
                <div className="focus__btns">
                  <button type="button" className="btn btn--glass btn--sm" onClick={f.status === 'paused' ? focus.resume : focus.pause}>
                    {f.status === 'paused' ? <><Play className="ico" />Үргэлжлүүлэх</> : <><Pause className="ico" />Түр зогсоох</>}
                  </button>
                  <button type="button" className="btn btn--glass btn--sm" onClick={() => focus.end()}><Square className="ico" />Дуусгах</button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="focus__today">
          <div className="focus__today-row"><span>Өнөөдөр төвлөрсөн</span><b className="tnum">{dec(today_.minutes / 60)} цаг, {today_.sessions} удаа</b></div>
          <div className="focus__meter" aria-hidden="true"><i style={{ transform: `scaleX(${Math.min(1, today_.minutes / FOCUS_GOAL)})` }} /></div>
        </div>
      </div>
    </section>
  )
}

function MyTasks() {
  const s = useApp()
  const sc = scoped(s)
  const list = useRef<HTMLDivElement>(null)
  const flipState = useRef<Flip.FlipState | null>(null)
  const t = today()
  const tasks = useMemo(() => sc.tasks
    .filter(x => x.assignee === s.me && ((x.status !== 'done' && x.due <= t) || (x.doneAt && ymd(new Date(x.doneAt)) === t)))
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.due.localeCompare(b.due) || RANK[a.prio] - RANK[b.prio]),
  [sc.tasks, s.me, t])

  useLayoutEffect(() => {
    if (!flipState.current) return
    Flip.from(flipState.current, { duration: 0.65, ease: 'power3.inOut' })
    flipState.current = null
  }, [tasks])

  const toggle = (task: Task, input: HTMLInputElement) => {
    if (list.current && !reduced()) flipState.current = Flip.getState(list.current.querySelectorAll('.mytask'))
    if (task.status !== 'done') checkPop(input)
    moveTask(task, task.status === 'done' ? 'todo' : 'done')
  }

  return (
    <section className="card glass w-tasks" aria-labelledby="mt-t" data-enter>
      <div className="card__head">
        <div><h2 className="card__title" id="mt-t">Миний ажлууд</h2><p className="card__sub">Өнөөдрийн болон хоцорсон</p></div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => go('tasks')}>Бүх ажил</button>
      </div>
      {tasks.length === 0 ? <p className="tp-none">Өнөөдөр хийх ажил алга.</p> : (
        <div className="mytasks" ref={list}>
          {tasks.map(x => {
            const p = sc.project(x.project)
            const lateDays = x.status !== 'done' ? -daysFromToday(x.due) : 0
            return (
              <div key={x.id} className={`mytask${x.status === 'done' ? ' is-done' : ''}`} data-flip-id={x.id}>
                <input type="checkbox" className="check" checked={x.status === 'done'} aria-label={`${x.title}: дууссан`} onChange={e => toggle(x, e.target)} />
                <button type="button" className="mytask__body" onClick={() => open({ kind: 'task', id: x.id })}>
                  <span className="mytask__title">{x.title}</span>
                  <span className="mytask__meta">
                    <ProjectChip project={p} />
                    <span className={lateDays > 0 ? 'is-late' : undefined}>{lateDays > 0 ? `${lateDays} хоног хоцорсон` : dueLabel(x.due)}</span>
                  </span>
                </button>
                <Prio prio={x.prio} />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ThisWeek() {
  const s = useApp()
  const sc = scoped(s)
  const start = weekStart(new Date())
  const lastStart = addDays(start, -7)
  const todayIndex = (new Date().getDay() + 6) % 7
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const doneOn = (d: Date) => sc.tasks.filter(x => x.doneAt && ymd(new Date(x.doneAt)) === ymd(d)).length
  const values = days.map((d, i) => (i > todayIndex ? null : doneOn(d)))
  const sum = values.reduce<number>((n, v) => n + (v ?? 0), 0)
  const last = Array.from({ length: todayIndex + 1 }, (_, i) => doneOn(addDays(lastStart, i))).reduce((a, b) => a + b, 0)
  const delta = last ? Math.round(((sum - last) / last) * 100) : sum ? 100 : 0
  return (
    <section className="card glass w-week" aria-labelledby="wk-t" data-enter>
      <div className="card__head">
        <div><h2 className="card__title" id="wk-t">Энэ долоо хоног</h2><p className="card__sub">Багийн дуусгасан ажил</p></div>
        <button type="button" className="ibtn ibtn--sm" onClick={() => go('insights')} aria-label="Тайлан руу очих"><ArrowUpRight className="ico" /></button>
      </div>
      <p className="week__sum">
        <b className="tnum" data-count={sum}>{sum}</b> ажил дууссан.
        <span className={`delta ${delta > 0 ? 'delta--up' : delta < 0 ? 'delta--down' : 'delta--plain'}`}>
          Өмнөх долоо хоногийн мөн үеэс {delta > 0 ? '+' : ''}{delta}%
        </span>
      </p>
      <Bars label="Дууссан" unit="ажил" values={values} hi={todayIndex} labels={days.map(weekdayShort)} names={days.map(d => `${weekday(d)}, ${monthDayDots(d)}`)} />
    </section>
  )
}

function HomeProjects() {
  const s = useApp()
  const sc = scoped(s)
  const list = sc.projects.filter(p => p.status !== 'done').sort((a, b) => Number(b.pinned) - Number(a.pinned)).slice(0, 5)
  return (
    <section className="card glass w-projects" aria-labelledby="hp-t" data-enter>
      <div className="card__head">
        <h2 className="card__title" id="hp-t">Төслүүд</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => go('projects')}>Бүгдийг харах</button>
      </div>
      <ul className="hprojects">
        {list.map(p => {
          const prog = projectProgress(p.id, sc.tasks)
          return (
            <li key={p.id}>
              <button type="button" className={`hproject hue--${p.hue}`} onClick={() => go('projects', p.id)}>
                <ProjectGlyph project={p} size="md" />
                <span className="hproject__name"><b>{p.name}</b><small>{PSTATUS[p.status]}, дуусах {monthDayDots(parse(p.due))}</small></span>
                <span className="hproject__bar" aria-hidden="true"><i style={{ transform: `scaleX(${prog.pct / 100})` }} /></span>
                <span className="hproject__pct tnum">{prog.pct}%</span>
                <AvatarStack people={p.members.map(id => sc.person(id)).filter(x => x !== undefined)} max={3} size="xs" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const FEED_ICON: Record<NoteKind, typeof AtSign> = { mention: AtSign, review: ListChecks, approval: BadgeCheck, moved: CalendarClock, done: CircleCheck, invite: UserPlus }

function RightNow() {
  const s = useApp()
  const sc = scoped(s)
  const [tab, setTab] = useState<'team' | 'activity'>('team')
  const now = new Date()
  const order = { focus: 0, meeting: 1, online: 2, away: 3 }
  const people = sc.people.filter(p => p.id !== s.me && p.presence !== 'away').sort((a, b) => order[a.presence] - order[b.presence]).slice(0, 6)
  const feed = [...sc.notices].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6)
  const status = (id: string, presence: string, role: string) => {
    if (presence === 'focus') return 'Төвлөрч байна'
    if (presence === 'meeting') {
      const e = sc.events.find(x => x.attendees.includes(id) && parse(x.start) <= now && eventEnd(x) > now)
      return e ? `Уулзалтад: ${e.title}` : 'Уулзалтад'
    }
    return `Онлайн, ${role}`
  }
  return (
    <section className="card glass w-people" aria-labelledby="rn-t" data-enter>
      <div className="card__head">
        <h2 className="card__title" id="rn-t">Яг одоо</h2>
        <Seg small label="Харах" value={tab} onChange={setTab} options={[{ value: 'team', label: 'Баг' }, { value: 'activity', label: 'Үйл ажиллагаа' }]} />
      </div>
      {tab === 'team' ? (
        <div className="people">
          {people.map(p => (
            <button key={p.id} type="button" className="person" onClick={() => open({ kind: 'person', id: p.id })}>
              <Avatar person={p} size="md" presence />
              <span><b>{short(p)}</b><small>{status(p.id, p.presence, p.role)}</small></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="people">
          {feed.map(n => {
            const Icon = FEED_ICON[n.kind]
            return (
              <button key={n.id} type="button" className="person" onClick={() => n.task ? open({ kind: 'task', id: n.task }) : n.project && go('projects', n.project)}>
                <span className="lead"><Icon className="ico" /></span>
                <span><b style={{ fontWeight: 560, whiteSpace: 'normal' }}>{n.text}</b><small>{ago(n.at)}</small></span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
