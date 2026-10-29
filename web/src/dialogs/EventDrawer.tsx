// Event details: when, where, project, people; delete with Undo.
import { CalendarClock, Folder, MapPin, Trash } from 'lucide-react'
import '../styles/screens/calendar.css'
import '../styles/screens/team.css'
import { actions, scoped, useApp } from '../lib/store'
import { close, open, toast } from '../lib/ui'
import { go } from '../lib/router'
import { eventEnd } from '../lib/derive'
import { dateDots, dueLabel, duration, hm, parse, short } from '../lib/format'
import { Sheet, useCloseSheet } from '../ui/Sheet'
import { Avatar, KIND, KIND_HUE, KIND_ICON, PRESENCE, eventHue } from '../ui/bits'

export function EventDrawer({ id }: { id: string }) {
  return (
    <Sheet kind="drawer" label="Үйл явдлын дэлгэрэнгүй" onClose={close}>
      <Body id={id} />
    </Sheet>
  )
}

function Body({ id }: { id: string }) {
  const s = useApp()
  const sc = scoped(s)
  const closeSheet = useCloseSheet()
  const e = s.events.find(x => x.id === id)
  if (!e) return <p className="tp-none">Энэ үйл явдал устсан байна.</p>
  const start = parse(e.start)
  const p = sc.project(e.project)
  const Icon = KIND_ICON[e.kind]
  const people = e.attendees.map(a => s.people.find(x => x.id === a)).filter(x => x !== undefined)
  const now = new Date()
  const live = start <= now && eventEnd(e) > now

  const remove = () => {
    const undo = actions.removeEvent(e.id)
    closeSheet()
    toast(`Устгалаа: ${e.title}`, { undo })
  }

  return (
    <div className={`ep hue--${eventHue(e, sc)}`}>
      <div className="tp__top">
        <span className={`cal-kind hue--${KIND_HUE[e.kind]}`}><Icon className="ico" />{KIND[e.kind]}</span>
        {live && <span className="cal-live">Яг одоо</span>}
      </div>
      <h2 className="tp__title">{e.title}</h2>
      <dl className="meta">
        <div>
          <dt>Хэзээ</dt>
          <dd><CalendarClock className="ico" /><span className="tnum">{dueLabel(e.start.slice(0, 10))}, {hm(start)}–{hm(eventEnd(e))}</span></dd>
        </div>
        <div>
          <dt>Хугацаа</dt>
          <dd><span className="tnum">{duration(e.minutes)}, {dateDots(start)}</span></dd>
        </div>
        <div>
          <dt>Хаана</dt>
          <dd><MapPin className="ico" /><span>{e.where || 'Заагаагүй'}</span></dd>
        </div>
        <div>
          <dt>Төсөл</dt>
          <dd>
            <Folder className="ico" />
            {p ? <button type="button" className="ov__lead" onClick={() => { close(); go('projects', p.id) }}><span>{p.name}</span></button> : <span>Төсөлгүй</span>}
          </dd>
        </div>
      </dl>
      <section className="block" aria-labelledby="ep-people">
        <header><h3 id="ep-people">Оролцогчид</h3><span className="badge tnum">{people.length}</span></header>
        <div className="prof__list">
          {people.map(x => (
            <button key={x.id} type="button" className="prof__row" onClick={() => open({ kind: 'person', id: x.id })}>
              <Avatar person={x} size="md" presence />
              <span className="prof__rowtext"><b>{short(x)}</b><small>{x.role}, {PRESENCE[x.presence].toLowerCase()}</small></span>
            </button>
          ))}
        </div>
      </section>
      <div className="tp__foot">
        <button type="button" className="btn btn--ghost tp__del" style={{ color: 'var(--danger)' }} onClick={remove}>
          <Trash className="ico" />
          Устгах
        </button>
      </div>
    </div>
  )
}
