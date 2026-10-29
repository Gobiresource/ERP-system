import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Calendar, CalendarPlus, Check, ChevronLeft, FolderSearch, Plus, Star } from 'lucide-react'
import '../styles/screens/projects.css'
import type { Project, ProjectStatus } from '../lib/types'
import { actions, scoped, useApp, type Scoped } from '../lib/store'
import { open } from '../lib/ui'
import { go } from '../lib/router'
import { Flip, gsap, reduced, usePageEnter } from '../lib/motion'
import { burnSeries, nextMilestone, projectProgress, timeElapsed } from '../lib/derive'
import { dateDots, daysFromToday, dueLabel, hm, monthDayDots, parse, short, weekdayShort } from '../lib/format'
import { PageHead } from '../ui/PageHead'
import { Seg } from '../ui/Seg'
import { Avatar, AvatarStack, Empty, KIND_HUE, PRESENCE, PSTATUS, Prio, ProjectGlyph, STATUS, STATUSES } from '../ui/bits'
import { LineChart, Ring } from '../ui/charts'

export default function Projects({ id }: { id?: string }) {
  const s = useApp()
  const sc = scoped(s)
  if (id) {
    const p = sc.projects.find(x => x.id === id)
    return p ? <Detail key={p.id} p={p} sc={sc} /> : <Missing />
  }
  return <ProjectList sc={sc} />
}

function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span className={`pstatus pstatus--${status}`}>
      {status === 'done' ? <Check className="ico" /> : <i aria-hidden="true" />}
      {PSTATUS[status]}
    </span>
  )
}

function PinButton({ p, big }: { p: Project; big?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  const toggle = () => {
    actions.togglePin(p.id)
    if (!p.pinned && !reduced() && ref.current) gsap.fromTo(ref.current.querySelector('svg'), { scale: 0.4, rotation: -72 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.6)' })
  }
  if (big) {
    return (
      <button ref={ref} type="button" className="btn btn--glass pstar" aria-pressed={p.pinned} onClick={toggle}>
        <Star className="ico" />
        {p.pinned ? 'Онцолсон' : 'Онцлох'}
      </button>
    )
  }
  return (
    <button ref={ref} type="button" className="ibtn ibtn--sm pstar" aria-pressed={p.pinned} onClick={toggle} aria-label={`${p.name}: онцлох`}>
      <Star className="ico" />
    </button>
  )
}

/** "11.01, 4 хоногийн дараа" */
function when(date: string) {
  const n = daysFromToday(date)
  const d = monthDayDots(parse(date))
  if (n === 0) return `${d}, өнөөдөр`
  if (n > 0) return `${d}, ${n} хоногийн дараа`
  return `${d}, ${-n} хоног хэтэрсэн`
}

function ProjectList({ sc }: { sc: Scoped }) {
  const ref = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const flipState = useRef<Flip.FlipState | null>(null)
  const [filter, setFilter] = useState<'all' | ProjectStatus>('all')
  usePageEnter(ref)

  const active = sc.projects.filter(p => p.status === 'active')
  const done = sc.projects.filter(p => p.status === 'done')
  const onTrack = active.filter(p => projectProgress(p.id, sc.tasks).pct / 100 >= timeElapsed(p) - 0.1).length
  const now = new Date()
  const dueThisMonth = sc.projects.filter(p => p.status !== 'done' && parse(p.due).getMonth() === now.getMonth() && parse(p.due).getFullYear() === now.getFullYear()).length

  const change = (f: typeof filter) => {
    if (grid.current && !reduced()) flipState.current = Flip.getState(grid.current.querySelectorAll('.pcard'))
    setFilter(f)
  }
  // Cards slide to their new places when the filter changes
  useLayoutEffect(() => {
    if (!flipState.current) return
    Flip.from(flipState.current, {
      duration: 0.65, ease: 'power3.inOut',
      onEnter: els => gsap.fromTo(els, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' }),
    })
    flipState.current = null
  }, [filter])

  const order = useMemo(() => [...sc.projects].sort((a, b) => Number(b.pinned) - Number(a.pinned) || ['active', 'planning', 'done'].indexOf(a.status) - ['active', 'planning', 'done'].indexOf(b.status)), [sc.projects])

  return (
    <div ref={ref}>
      <PageHead
        title="Төсөл"
        sub={`${active.length + sc.projects.filter(p => p.status === 'planning').length} төсөл явагдаж байна, ${done.length} нь дууссан.`}
        stats={[
          { label: 'Идэвхтэй', value: active.length },
          { label: 'Дууссан', value: done.length },
          { label: 'Хугацаандаа явж буй', value: active.length ? Math.round((onTrack / active.length) * 100) : 0, unit: '%' },
          { label: 'Энэ сард дуусах', value: dueThisMonth },
        ]}
        actions={
          <>
            <Seg label="Төлвөөр шүүх" className="pfilter" value={filter} onChange={change}
              options={[{ value: 'all', label: 'Бүгд' }, { value: 'active', label: 'Идэвхтэй' }, { value: 'planning', label: 'Төлөвлөж буй' }, { value: 'done', label: 'Дууссан' }]} />
            <button type="button" className="btn btn--accent" onClick={() => open({ kind: 'newProject' })}>
              <Plus className="ico" />
              Шинэ төсөл
            </button>
          </>
        }
      />
      <div className="pgrid" ref={grid}>
        {order.map(p => <ProjectCard key={p.id} p={p} sc={sc} hidden={filter !== 'all' && p.status !== filter} />)}
      </div>
      {order.every(p => filter !== 'all' && p.status !== filter) && (
        <div className="card glass"><Empty icon={<FolderSearch className="ico" />} title="Энэ төлөвт төсөл алга" /></div>
      )}
    </div>
  )
}

function ProjectCard({ p, sc, hidden }: { p: Project; sc: Scoped; hidden: boolean }) {
  const prog = projectProgress(p.id, sc.tasks)
  const next = nextMilestone(p)
  const people = p.members.map(id => sc.person(id)).filter(x => x !== undefined)
  return (
    <article className={`pcard glass hue--${p.hue}`} hidden={hidden} data-enter data-flip-id={p.id}>
      <div className="pcard__top">
        <ProjectGlyph project={p} size="lg" />
        <div className="pcard__id">
          <h2 className="pcard__name"><a className="pcard__link" href={`#project-${p.id}`}>{p.name}</a></h2>
          <StatusPill status={p.status} />
        </div>
        <PinButton p={p} />
      </div>
      <p className="pcard__sum">{p.goal}</p>
      <div className="pcard__mid">
        <Ring value={prog.pct / 100} hue={p.hue}>{prog.pct}%</Ring>
        <div className="pcard__next">
          {next ? (
            <>
              <small>Дараагийн үе шат</small>
              <b>{next.name}</b>
              <span>{when(next.date)}</span>
            </>
          ) : (
            <>
              <small>{p.status === 'done' ? 'Дууссан' : 'Үе шат'}</small>
              <b>{p.milestones.length ? 'Бүх үе шат биелсэн' : 'Үе шат төлөвлөөгүй'}</b>
              <span>{dateDots(parse(p.due))}</span>
            </>
          )}
        </div>
      </div>
      <div className="pcard__foot">
        <AvatarStack people={people} max={4} size="sm" />
        <span className="pcard__count tnum">{prog.done}/{prog.total} ажил</span>
        <span className="pcard__due"><Calendar className="ico" /><span className="sr-only">Дуусах: </span>{monthDayDots(parse(p.due))}</span>
      </div>
    </article>
  )
}

function Missing() {
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  return (
    <div ref={ref}>
      <PageHead title="Төсөл олдсонгүй" />
      <div className="card glass" style={{ maxWidth: 560 }}>
        <Empty icon={<FolderSearch className="ico" />} title="Энэ төсөл энэ компанид алга" text="Өөр компани сонгосон эсвэл төсөл устсан байж магадгүй.">
          <button type="button" className="btn btn--glass" onClick={() => go('projects')}>Бүх төсөл</button>
        </Empty>
      </div>
    </div>
  )
}

function Detail({ p, sc }: { p: Project; sc: Scoped }) {
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const prog = projectProgress(p.id, sc.tasks)
  const left = daysFromToday(p.due)
  const lead = sc.person(p.lead)
  const people = [...new Set([p.lead, ...p.members])].map(id => sc.person(id)).filter(x => x !== undefined)
  const elapsed = timeElapsed(p)
  const span = Math.max(1, parse(p.due).getTime() - parse(p.start).getTime())
  const pos = (date: string) => Math.max(0, Math.min(1, (parse(date).getTime() - parse(p.start).getTime()) / span))
  const burn = useMemo(() => burnSeries(p, sc.tasks), [p, sc.tasks])
  const ms = [...p.milestones].sort((a, b) => a.date.localeCompare(b.date))
  const next = nextMilestone(p)
  const tasks = sc.tasks.filter(t => t.project === p.id)
  const events = sc.events.filter(e => e.project === p.id && daysFromToday(e.start) >= 0).slice(0, 4)
  const [showDone, setShowDone] = useState(false)

  return (
    <div ref={ref}>
      <div className="pd-head">
        <PageHead
          title={p.name}
          sub={p.goal}
          lead={
            <>
              <button type="button" className="ibtn ibtn--glass head__back" onClick={() => go('projects')} aria-label="Бүх төсөл рүү буцах">
                <ChevronLeft className="ico" />
              </button>
              <span className="head__icon"><ProjectGlyph project={p} size="lg" /></span>
            </>
          }
          stats={[
            { label: 'Явц', value: prog.pct, unit: '%' },
            { label: 'Нээлттэй ажил', value: prog.open },
            { label: 'Дууссан', value: prog.done },
            left >= 0 ? { label: 'Үлдсэн хоног', value: left } : { label: 'Хэтэрсэн хоног', value: -left, alert: p.status !== 'done' },
          ]}
          actions={
            <>
              <PinButton p={p} big />
              <button type="button" className="btn btn--glass" onClick={() => open({ kind: 'newEvent', defaults: { project: p.id } })}>
                <CalendarPlus className="ico" />
                Шинэ тов
              </button>
            </>
          }
        />
      </div>

      <div className={`pd hue--${p.hue}`}>
        <div className="pd__col">
          <section className="card glass pd-over" aria-labelledby="ov-t" data-enter>
            <div className="card__head"><h2 className="card__title" id="ov-t">Тойм</h2></div>
            <dl className="meta">
              <div>
                <dt>Удирдагч</dt>
                <dd>{lead && <button type="button" className="ov__lead" onClick={() => open({ kind: 'person', id: lead.id })}><Avatar person={lead} size="xs" /><span>{short(lead)}</span></button>}</dd>
              </div>
              <div>
                <dt>Төлөв</dt>
                <dd>
                  <StatusPill status={p.status} />
                  <button type="button" className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }}
                    onClick={() => actions.updateProject(p.id, { status: p.status === 'done' ? 'active' : 'done' })}>
                    {p.status === 'done' ? 'Дахин нээх' : 'Дуусгах'}
                  </button>
                </dd>
              </div>
            </dl>
            <div className="tline" aria-hidden="true">
              <div className="tline__track">
                <span className="tline__fill" style={{ transform: `scaleX(${elapsed})` }} />
                {ms.map(m => <span key={m.id} className={`tline__ms${m.done ? ' is-done' : ''}`} style={{ left: `${pos(m.date) * 100}%` }} title={m.name} />)}
                {p.status !== 'done' && elapsed > 0 && elapsed < 1 && (
                  <span className={`tline__now${elapsed < 0.12 ? ' is-start' : elapsed > 0.88 ? ' is-end' : ''}`} style={{ left: `${elapsed * 100}%` }}><em>Өнөөдөр</em></span>
                )}
              </div>
            </div>
            <div className="tline__ends">
              <span><small>Эхэлсэн</small>{dateDots(parse(p.start))}</span>
              <span><small>Дуусах</small>{dateDots(parse(p.due))}</span>
            </div>
            <h3 className="ov__h">Хүмүүс <span className="badge tnum">{people.length}</span></h3>
            <div className="ov__people">
              {people.map(x => (
                <button key={x.id} type="button" className="ov__person" onClick={() => open({ kind: 'person', id: x.id })}>
                  <Avatar person={x} size="md" presence />
                  <span>
                    <b>{short(x)}</b>
                    <small>{x.id === p.lead ? `Удирдагч, ${PRESENCE[x.presence].toLowerCase()}` : PRESENCE[x.presence]}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="card glass pd-ms" aria-labelledby="ms-t" data-enter>
            <div className="card__head">
              <div>
                <h2 className="card__title" id="ms-t">Үе шат</h2>
                <p className="card__sub">{ms.filter(m => m.done).length}/{ms.length} биелсэн</p>
              </div>
            </div>
            {ms.length === 0 ? <p className="tp-none">Үе шат төлөвлөөгүй байна.</p> : (
              <ol className="ms">
                {ms.map(m => (
                  <li key={m.id} className={`ms__item${m.done ? ' is-done' : ''}${m === next ? ' is-next' : ''}`}>
                    <button type="button" className="ms__check" aria-pressed={m.done} aria-label={`${m.name}: биелсэн`} onClick={() => actions.toggleMilestone(p.id, m.id)}>
                      <Check className="ico" />
                    </button>
                    <span className="ms__body">
                      <b>{m.name}</b>
                      <small>{m.done ? `${dateDots(parse(m.date))}, биелсэн` : when(m.date)}</small>
                    </span>
                    {m === next && <span className="ms__tag">Дараагийнх</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="pd__col">
          <section className="card glass pd-burn" aria-labelledby="burn-t" data-enter>
            <div className="card__head">
              <div>
                <h2 className="card__title" id="burn-t">Явцын график</h2>
                <p className="card__sub">Дууссан ажил ба нийт ажил, төсөл эхэлснээс хойш</p>
              </div>
            </div>
            <div className="burn__legend" aria-hidden="true">
              <span><i />Дууссан</span>
              <span><i className="is-dashed" />Нийт</span>
            </div>
            <LineChart label="Явцын график" unit="ажил" labels={burn.labels} height={240}
              series={[{ name: 'Дууссан', values: burn.dones, tone: 'accent', area: true }, { name: 'Нийт', values: burn.totals, tone: 'muted', dashed: true }]} />
          </section>

          <section className="card glass pd-tasks" aria-labelledby="pt-t" data-enter>
            <div className="card__head">
              <div>
                <h2 className="card__title" id="pt-t">Ажлууд</h2>
                <p className="card__sub">{prog.open} нээлттэй, {prog.done} дууссан</p>
              </div>
              <button type="button" className="btn btn--accent btn--sm" onClick={() => open({ kind: 'newTask', defaults: { project: p.id } })}>
                <Plus className="ico" />
                Ажил нэмэх
              </button>
            </div>
            <div className="ptasks">
              {STATUSES.map(st => {
                const list = tasks.filter(t => t.status === st)
                const collapsed = st === 'done' && !showDone
                return (
                  <div key={st}>
                    <div className="pgroup__head">
                      <span className={`sdot sdot--${st}`} aria-hidden="true" />
                      <h3>{STATUS[st]}</h3>
                      <span className="badge tnum">{list.length}</span>
                      {st === 'done' && list.length > 0 && (
                        <button type="button" className="btn btn--ghost btn--sm pgroup__more" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>{showDone ? 'Нуух' : 'Харуулах'}</button>
                      )}
                    </div>
                    {list.length === 0 ? <p className="pgroup__none">Ажил алга.</p> : !collapsed && (
                      <ul className="pgroup__list">
                        {list.map(t => {
                          const who = sc.person(t.assignee)
                          const late = t.status !== 'done' && daysFromToday(t.due) < 0
                          return (
                            <li key={t.id}>
                              <button type="button" className={`prow${t.status === 'done' ? ' is-done' : ''}`} onClick={() => open({ kind: 'task', id: t.id })}>
                                <span className="prow__title">{t.title}</span>
                                <Prio prio={t.prio} />
                                <span className={`prow__due${late ? ' is-late' : ''}`}>{late && <span className="sr-only">Хоцорсон: </span>}{dueLabel(t.due)}</span>
                                {who ? <Avatar person={who} size="xs" /> : <span />}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="card glass pd-up" aria-labelledby="up-t" data-enter>
            <div className="card__head"><h2 className="card__title" id="up-t">Удахгүй болох</h2></div>
            {events.length === 0 ? (
              <p className="tp-none">Төлөвлөсөн тов алга.</p>
            ) : (
              <div className="pup__events">
                {events.map(e => {
                  const d = parse(e.start)
                  return (
                    <button key={e.id} type="button" className={`pev hue--${KIND_HUE[e.kind]}`} onClick={() => open({ kind: 'event', id: e.id })}>
                      <span className="pev__date" aria-hidden="true"><small>{weekdayShort(d)}</small><b>{d.getDate()}</b></span>
                      <span className="pev__body">
                        <b>{e.title}</b>
                        <small>{dueLabel(e.start.slice(0, 10))}, {hm(d)}{e.where ? `, ${e.where}` : ''}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
