// Direction "Орон тоо": the headcount as seats. Every place in a department is a seat: people sit in theirs, empty
// places are dashed. A ring marks someone with a date to act on. Tapping a face says who it is without leaving the page.
import { useRef, useState } from 'react'
import { ChevronDown, Moon } from 'lucide-react'
import type { Employee } from '../../../lib/types'
import { useApp } from '../../../lib/store'
import { usePageEnter } from '../../../lib/motion'
import { EMP_STATUS, alertsOf, current, hrScoped, whenEnds } from '../../../lib/hr'
import { short } from '../../../lib/format'
import { PageHead } from '../../../ui/PageHead'
import { EmpAvatar, HrNav } from '../../Hr'
import { Alerts, Birthdays, MoveList, headcount, makeupOf, moveEvents } from '../Overview'

type Alert = ReturnType<typeof alertsOf>[number]

export default function Seats() {
  const hr = hrScoped(useApp())
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const staff = hr.employees.filter(current)
  const alerts = alertsOf(hr.employees, hr.docTypes)
  return (
    <div ref={ref}>
      <HrNav at="" />
      <PageHead title="Хүний нөөц" sub={`Энэ компанид ${staff.length} ажилтан ажиллаж байна.`} />
      <div className="sv">
        <SeatBoard alerts={alerts} />
        <div className="sv__alerts"><Alerts alerts={alerts} /></div>
        <div className="sv__bdays"><Birthdays staff={staff} wide={false} /></div>
      </div>
    </div>
  )
}

const away = (e: Employee) => e.status === 'leave' || e.status === 'childcare'
const alertText = (a: Alert) => `${a.what} ${whenEnds(a.days).toLowerCase()}`

function SeatBoard({ alerts }: { alerts: Alert[] }) {
  const hr = hrScoped(useApp())
  const [sel, setSel] = useState<string | null>(null)
  const [moves, setMoves] = useState(false)
  const staff = hr.employees.filter(current)
  const { quota, filled } = headcount(hr)
  // The most pressing date per person: alerts come soonest first, overdue ones before the rest
  const need = new Map<string, Alert>()
  for (const a of alerts) if (!need.has(a.employee.id)) need.set(a.employee.id, a)
  const rows = hr.departments.map(d => {
    const ps = hr.positions.filter(p => p.dept === d.id)
    const seats = ps.flatMap(p => {
      const people = staff.filter(e => e.position === p.id)
      const empty = Array.from({ length: Math.max(0, p.quota - people.length) }, (_, i) => ({ key: `${p.id}-${i}`, pos: p.name, e: undefined }))
      return [...people.map(e => ({ key: e.id, pos: p.name, e: e as Employee | undefined })), ...empty]
    })
    return { d, seats, q: ps.reduce((n, p) => n + p.quota, 0), f: ps.reduce((n, p) => n + Math.min(p.quota, hr.filled.get(p.id) ?? 0), 0) }
  })
  const events = moveEvents(hr)
  const joined = events.filter(x => x.joined).length
  const mk = makeupOf(staff)

  return (
    <section className="card glass sv-board" aria-labelledby="sv-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="sv-t">Орон тоо</h2>
          <p className="card__sub">{quota} орон тооноос {filled} нь бүрдсэн, {quota - filled} сул</p>
        </div>
        <a className="btn btn--ghost btn--sm" href="#hr-structure">Бүтэц харах</a>
      </div>
      <div className="sv-rows">
        {rows.map(({ d, seats, q, f }) => {
          const picked = seats.find(x => x.e?.id === sel)?.e
          return (
            <div className="sv-row" key={d.id} role="group" aria-labelledby={`svr-${d.id}`}>
              <p className="sv-row__head" id={`svr-${d.id}`}><b>{d.name}</b><span className="tnum">{f}<small> / {q}</small></span></p>
              <ul className="sv-seats">
                {seats.map(({ key, pos, e }) => {
                  if (!e) return <li key={key}><span className="sv-seat sv-seat--empty" role="img" aria-label={`Сул орон тоо: ${pos}`} /></li>
                  const a = need.get(e.id)
                  const state = a ? (a.days < 0 ? ' is-late' : ' is-soon') : ''
                  const label = [`${short(e)}, ${pos}`, a && alertText(a), away(e) && EMP_STATUS[e.status]].filter(Boolean).join('. ')
                  return (
                    <li key={key}>
                      <button type="button" className={`sv-seat${state}${away(e) ? ' is-away' : ''}`} aria-label={label} aria-pressed={sel === e.id}
                        onClick={() => setSel(sel === e.id ? null : e.id)}>
                        <EmpAvatar e={e} size="md" />
                        {a && a.days < 0 && <span className="sv-seat__badge is-late" aria-hidden="true">!</span>}
                        {!a && away(e) && <span className="sv-seat__badge" aria-hidden="true"><Moon className="ico" /></span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {picked && <SeatInfo e={picked} alert={need.get(picked.id)} />}
            </div>
          )
        })}
      </div>
      <ul className="sv-key" aria-label="Тайлбар">
        <li><i className="sv-key__empty" />Сул орон тоо</li>
        <li><i className="sv-key__soon" />Ойрын 30 хоногт хугацаа дуусах</li>
        <li><i className="sv-key__late">!</i>Хугацаа хэтэрсэн</li>
        <li><i className="sv-key__away"><Moon className="ico" /></i>Чөлөөтэй</li>
      </ul>
      <div className="sv-foot">
        <button type="button" className="sv-more" aria-expanded={moves} onClick={() => setMoves(!moves)}>
          Сүүлийн 12 сард: {joined} ажилд орсон, {events.length - joined} ажлаас гарсан<ChevronDown className="ico" />
        </button>
        <span>Эрэгтэй {mk.men}, эмэгтэй {mk.women}. Дундаж нас {mk.avg}.</span>
      </div>
      {moves && events.length > 0 && <MoveList events={events} />}
    </section>
  )
}

/** Who sits in the tapped seat, and the date to act on if there is one */
function SeatInfo({ e, alert }: { e: Employee; alert?: Alert }) {
  const hr = hrScoped(useApp())
  const pos = hr.position(e.position)?.name
  return (
    <div className="sv-info">
      <EmpAvatar e={e} size="lg" />
      <div>
        <b>{short(e)}</b>
        <small>{e.status === 'active' ? pos : `${pos}, ${EMP_STATUS[e.status].toLowerCase()}`}</small>
        {alert && <small className={alert.days < 0 ? 'is-late' : 'is-soon'}>{alertText(alert)}</small>}
      </div>
      <a className="btn btn--glass btn--sm" href={`#hr-${e.id}`}>Дэлгэрэнгүй харах</a>
    </div>
  )
}
