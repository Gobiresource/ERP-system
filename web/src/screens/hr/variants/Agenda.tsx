// Direction "Хуваарь": what comes up in the next 30 days, by date, like a desk calendar: contracts, probations,
// documents and birthdays, overdue first. Headcount stays beside it.
import { useRef } from 'react'
import { CalendarCheck } from 'lucide-react'
import type { Employee } from '../../../lib/types'
import { useApp } from '../../../lib/store'
import { usePageEnter } from '../../../lib/motion'
import { ALERT_DAYS, ageOn, alertsOf, current, hrScoped, readRegNo, whenEnds, type AlertKind } from '../../../lib/hr'
import { daysFromToday, parse, short, ymd } from '../../../lib/format'
import { PageHead } from '../../../ui/PageHead'
import { Empty } from '../../../ui/bits'
import { EmpAvatar, HrNav } from '../../Hr'
import { Headcount } from '../Overview'

interface Item { key: string; date: Date; days: number; kind: AlertKind | 'birthday'; e: Employee; what: string; sub: string; when: string }

/** "Өнөөдөр", "Маргааш", "12 хоногийн дараа" */
const inDays = (d: number) => (d === 0 ? 'Өнөөдөр' : d === 1 ? 'Маргааш' : `${d} хоногийн дараа`)

export default function Agenda() {
  const hr = hrScoped(useApp())
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const staff = hr.employees.filter(current)
  const pos = (e: Employee) => hr.position(e.position)?.name ?? ''
  const now = new Date()

  const items: Item[] = [
    ...alertsOf(hr.employees, hr.docTypes).map(a => ({
      key: `${a.kind}-${a.employee.id}-${a.what}`, date: parse(a.date), days: a.days, kind: a.kind, e: a.employee,
      what: a.what, sub: `${short(a.employee)}, ${pos(a.employee)}`, when: whenEnds(a.days),
    })),
    // Birthdays in the same window: this year's date, or next year's once it has passed
    ...staff.flatMap(e => {
      const birth = readRegNo(e.regNo)?.birth
      if (!birth) return []
      let day = new Date(now.getFullYear(), birth.getMonth(), birth.getDate())
      if (daysFromToday(ymd(day)) < 0) day = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate())
      const days = daysFromToday(ymd(day))
      return days > ALERT_DAYS ? [] : [{
        key: `b-${e.id}`, date: day, days, kind: 'birthday' as const, e,
        what: 'Төрсөн өдөр', sub: `${short(e)}, ${ageOn(birth, day)} нас хүрнэ`, when: inDays(days),
      }]
    }),
  ].sort((a, b) => a.days - b.days)

  const groups: [string, Item[]][] = [
    ['Хугацаа хэтэрсэн', items.filter(x => x.days < 0)],
    ['Ойрын 7 хоногт', items.filter(x => x.days >= 0 && x.days < 7)],
    ['Дараагийн 7 хоногт', items.filter(x => x.days >= 7 && x.days < 14)],
    [`14–${ALERT_DAYS} хоногт`, items.filter(x => x.days >= 14)],
  ]

  return (
    <div ref={ref}>
      <HrNav at="" />
      <PageHead title="Хүний нөөц" sub={`Энэ компанид ${staff.length} ажилтан ажиллаж байна.`} />
      <div className="ag">
        <section className="card glass" aria-labelledby="ag-t" data-enter>
          <div className="card__head">
            <div>
              <h2 className="card__title" id="ag-t">Ойрын {ALERT_DAYS} хоног</h2>
              <p className="card__sub">Гэрээ, туршилтын хугацаа, бичиг баримт, төрсөн өдөр</p>
            </div>
          </div>
          {items.length === 0 && <Empty icon={<CalendarCheck className="ico" />} title={`Ойрын ${ALERT_DAYS} хоногт анхаарах зүйл алга`} />}
          {groups.filter(([, xs]) => xs.length > 0).map(([title, xs]) => (
            <div className={`ag-group${xs[0].days < 0 ? ' is-late' : ''}`} key={title}>
              <h3 className="ag-group__h">{title}</h3>
              <ul className="ag-list">
                {xs.map(x => (
                  <li key={x.key}>
                    <a className={`ag-item ag-item--${x.kind}${x.days < 0 ? ' is-late' : ''}`} href={`#hr-${x.e.id}`}>
                      <span className="ag-date"><b className="tnum">{x.date.getDate()}</b><small>{x.date.getMonth() + 1}-р сар</small></span>
                      <EmpAvatar e={x.e} size="sm" />
                      <span className="ag-text"><b>{x.what}</b><small>{x.sub}</small></span>
                      <span className="ag-when">{x.when}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
        <Headcount />
      </div>
    </div>
  )
}
