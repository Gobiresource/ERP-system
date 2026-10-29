// Direction "Товч": the overview as a few sentences in large type, no cards. Each sentence opens the list behind it.
// Every sentence is written out whole for each case (none, some), so no words are glued together.
import { useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useApp } from '../../../lib/store'
import { usePageEnter } from '../../../lib/motion'
import { alertsOf, current, hrScoped } from '../../../lib/hr'
import { PageHead } from '../../../ui/PageHead'
import { HrNav } from '../../Hr'
import { AlertList, BirthdayList, DeptBars, MoveList, birthdaysOf, headcount, makeupOf, moveEvents } from '../Overview'

/** Numbers in a sentence stand out */
const figures = (text: string) => text.split(/(\d+)/).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))

export default function Brief() {
  const hr = hrScoped(useApp())
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const staff = hr.employees.filter(current)
  const alerts = alertsOf(hr.employees, hr.docTypes)
  const late = alerts.filter(a => a.days < 0).length
  const { quota, filled } = headcount(hr)
  const events = moveEvents(hr)
  const joined = events.filter(x => x.joined).length
  const left = events.length - joined
  const bdays = birthdaysOf(staff)
  const mk = makeupOf(staff)
  const [open, setOpen] = useState<string | null>(late > 0 ? 'alerts' : null)

  const lines: { id: string; text: string; body?: ReactNode }[] = [
    {
      id: 'people',
      text: quota > filled ? `${staff.length} хүн ажиллаж байна, ${quota - filled} орон тоо сул.` : `${staff.length} хүн ажиллаж байна, орон тоо бүрдсэн.`,
      body: <DeptBars />,
    },
    {
      id: 'alerts',
      text: alerts.length === 0 ? 'Анхаарах зүйл байхгүй.'
        : late > 0 ? `Анхаарах ${alerts.length} зүйл байна, ${late} нь хугацаа хэтэрсэн.` : `Анхаарах ${alerts.length} зүйл байна.`,
      body: alerts.length > 0 && <AlertList alerts={alerts} />,
    },
    {
      id: 'moves',
      text: joined && left ? `Сүүлийн 12 сард ${joined} хүн ажилд орж, ${left} хүн ажлаас гарсан.`
        : joined ? `Сүүлийн 12 сард ${joined} хүн ажилд орсон, ажлаас гарсан хүн байхгүй.`
        : left ? `Сүүлийн 12 сард ${left} хүн ажлаас гарсан, ажилд орсон хүн байхгүй.` : 'Сүүлийн 12 сард ажилд орсон, ажлаас гарсан хүн байхгүй.',
      body: events.length > 0 && <MoveList events={events} />,
    },
    {
      id: 'bdays',
      text: bdays.length ? `Энэ сард ${bdays.length} хүний төрсөн өдөр тохионо.` : 'Энэ сард төрсөн өдөртэй хүн байхгүй.',
      body: bdays.length > 0 && <BirthdayList list={bdays} />,
    },
  ]

  return (
    <div ref={ref}>
      <HrNav at="" />
      <PageHead title="Хүний нөөц" />
      <div className="br">
        {lines.map(x => (
          <section className="br-line" key={x.id} aria-labelledby={`br-${x.id}`} data-enter>
            <h2 id={`br-${x.id}`}>
              {x.body ? (
                <button type="button" aria-expanded={open === x.id} onClick={() => setOpen(open === x.id ? null : x.id)}>
                  <span>{figures(x.text)}</span><ChevronDown className="ico" />
                </button>
              ) : <span>{figures(x.text)}</span>}
            </h2>
            {open === x.id && x.body && <div className="br-body">{x.body}</div>}
          </section>
        ))}
        <p className="br-note" data-enter>Эрэгтэй {mk.men}, эмэгтэй {mk.women}. Дундаж нас {mk.avg}. Регистрийн дугаараас тооцсон.</p>
      </div>
    </div>
  )
}
