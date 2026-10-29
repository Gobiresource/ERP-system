// A colleague's profile: status, workload, open tasks, this week's events, projects.
import { ChevronRight, Clock, Mail, PartyPopper } from 'lucide-react'
import '../styles/screens/team.css'
import type { Presence } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { close, open } from '../lib/ui'
import { go } from '../lib/router'
import { demoFocusHours, focusByDay, localTime, teamHue, thisWeek, workload } from '../lib/derive'
import { dec, dueLabel, hm, parse, short, weekdayShort, daysFromToday } from '../lib/format'
import { Sheet } from '../ui/Sheet'
import { Seg } from '../ui/Seg'
import { Avatar, KIND_HUE, PRESENCE, PresenceLabel, Prio, ProjectGlyph } from '../ui/bits'

export function PersonDrawer({ id }: { id: string }) {
  const s = useApp()
  const sc = scoped(s)
  const p = s.people.find(x => x.id === id)
  if (!p) return null
  const me = p.id === s.me
  const load = workload(p, sc.tasks)
  const where = localTime(p)
  const focusHours = me ? focusByDay(s.focusLog, 7).reduce((n, d) => n + d.minutes, 0) / 60 : demoFocusHours(p)
  const tasks = sc.tasks.filter(t => t.assignee === p.id && t.status !== 'done').sort((a, b) => a.due.localeCompare(b.due))
  const events = sc.events.filter(e => e.attendees.includes(p.id) && thisWeek(e.start) && daysFromToday(e.start) >= 0)
  const projects = sc.projects.filter(x => x.members.includes(p.id) || x.lead === p.id)
  const r = 40
  const c = 2 * Math.PI * r

  return (
    <Sheet kind="drawer" label={`${short(p)}, профайл`} onClose={close}>
      <div className={`prof hue--${teamHue(p.team)}`}>
        <div className="prof__hero">
          <Avatar person={p} size="xl" presence />
          <div className="prof__who">
            <h2 className="prof__name">{short(p)}</h2>
            <p className="prof__role">{p.role}</p>
            <div className="prof__chips">
              <span className={`pchip hue--${teamHue(p.team)}`}><i aria-hidden="true" /><span>{p.team}</span></span>
              <PresenceLabel presence={p.presence} />
            </div>
          </div>
        </div>

        {me && (
          <div className="prof__status">
            <span className="field__label" aria-hidden="true">Таны төлөв</span>
            <Seg<Presence> label="Таны төлөв" className="prof__seg" small value={p.presence} onChange={v => actions.setPresence(p.id, v)}
              options={(['online', 'focus', 'meeting', 'away'] as Presence[]).map(v => ({ value: v, label: PRESENCE[v] }))} />
          </div>
        )}

        <dl className="meta">
          <div>
            <dt>Имэйл</dt>
            <dd><Mail className="ico" /><span>{p.email}</span></dd>
          </div>
          <div>
            <dt>{where ? 'Орон нутгийн цаг' : 'Овог'}</dt>
            <dd>{where ? <><Clock className="ico" /><span className="tnum">{where.time}, {where.city}</span></> : <span>{p.family}</span>}</dd>
          </div>
        </dl>

        <div className="prof__stats">
          <div className={`prof__ring mload--${load.level}`} aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <circle className="prof__track" cx="50" cy="50" r={r} />
              <circle className="prof__arc" cx="50" cy="50" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, load.pct / 100))} />
            </svg>
            <div className="prof__ringval"><b className="tnum">{load.pct}%</b><small>ачаалал</small></div>
          </div>
          <div className="prof__nums">
            <div><small>Ачаалал</small><b className="tnum">{load.hours} <span>/ {load.capacity} цаг</span></b></div>
            <div><small>Энэ долоо хоногт төвлөрсөн</small><b className="tnum">{dec(focusHours)} <span>цаг</span></b></div>
            <div><small>Нээлттэй ажил</small><b className="tnum">{load.open}</b></div>
          </div>
        </div>

        <section className="block" aria-labelledby="prof-tasks">
          <header><h3 id="prof-tasks">Нээлттэй ажил</h3><span className="badge tnum">{tasks.length}</span></header>
          {tasks.length === 0 ? (
            <p className="prof__none"><PartyPopper className="ico" />Нээлттэй ажил алга.</p>
          ) : (
            <div className="prof__list">
              {tasks.slice(0, 6).map(t => {
                const proj = sc.project(t.project)
                const late = daysFromToday(t.due) < 0
                return (
                  <button key={t.id} type="button" className="prof__row" onClick={() => open({ kind: 'task', id: t.id })}>
                    {proj ? <ProjectGlyph project={proj} /> : <span className="picon picon--sm hue--blue" aria-hidden="true" />}
                    <span className="prof__rowtext">
                      <b>{t.title}</b>
                      <small className={late ? 'is-late' : undefined}>{late ? 'Хоцорсон, ' : ''}{dueLabel(t.due)}{proj ? `, ${proj.name}` : ''}</small>
                    </span>
                    <Prio prio={t.prio} />
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="block" aria-labelledby="prof-week">
          <header><h3 id="prof-week">Энэ долоо хоногт</h3><span className="badge tnum">{events.length}</span></header>
          {events.length === 0 ? (
            <p className="prof__none">Үлдсэн хурал, уулзалт алга.</p>
          ) : (
            <div className="prof__list">
              {events.slice(0, 6).map(e => {
                const d = parse(e.start)
                return (
                  <button key={e.id} type="button" className={`prof__row hue--${KIND_HUE[e.kind]}`} onClick={() => open({ kind: 'event', id: e.id })}>
                    <span className="prof__day" aria-hidden="true"><small>{weekdayShort(d)}</small><b>{d.getDate()}</b></span>
                    <span className="prof__rowtext">
                      <b>{e.title}</b>
                      <small>{dueLabel(e.start.slice(0, 10))}, {hm(d)}</small>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="block" aria-labelledby="prof-projects">
          <header><h3 id="prof-projects">Төслүүд</h3><span className="badge tnum">{projects.length}</span></header>
          {projects.length === 0 ? (
            <p className="prof__none">Төсөлд ороогүй.</p>
          ) : (
            <div className="prof__list">
              {projects.map(x => (
                <button key={x.id} type="button" className="prof__row" onClick={() => { close(); go('projects', x.id) }}>
                  <ProjectGlyph project={x} size="md" />
                  <span className="prof__rowtext">
                    <b>{x.name}</b>
                    <small>{x.lead === p.id ? 'Удирдагч' : 'Гишүүн'}</small>
                  </span>
                  <ChevronRight className="ico" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </Sheet>
  )
}
