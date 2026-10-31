// HR overview: headcount, alerts, recent movement and who works here
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, Cake, CircleCheck, FileClock, FileWarning, Hourglass, UsersRound } from 'lucide-react'
import type { Employee } from '../../lib/types'
import { useApp } from '../../lib/store'
import { enter, usePageEnter } from '../../lib/motion'
import { ALERT_DAYS, EMP_STATUS, MOVE, ageOn, alertsOf, current, dots, fileScore, readRegNo, whenEnds, type AlertKind } from '../../lib/hr'
import { hrView } from '../../lib/access'
import { monthDay, short, ymd } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Empty } from '../../ui/bits'
import { Ring } from '../../ui/charts'
import { EmpAvatar, HrNav } from '../Hr'

const ALERT_ICON: Record<AlertKind, typeof FileClock> = { contract: FileClock, probation: Hourglass, file: FileWarning }

export default function Overview() {
  const s = useApp()
  const hr = hrView(s)
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)

  const staff = hr.employees.filter(current)
  const quota = hr.positions.reduce((n, p) => n + p.quota, 0)
  const filled = hr.positions.reduce((n, p) => n + Math.min(p.quota, hr.filled.get(p.id) ?? 0), 0)
  const scores = staff.map(e => fileScore(e, hr.docTypes))
  const filesPct = Math.round((100 * scores.reduce((n, x) => n + x.done, 0)) / Math.max(1, scores.reduce((n, x) => n + x.total, 0)))
  const alerts = alertsOf(hr.employees, hr.docTypes)
  // A branch director sees their own people; headcount is the whole ХХК's
  const all = hr.access.hr === 'all'

  return (
    <div ref={ref}>
      <HrNav at="" />
      <PageHead
        title="Хүний нөөц"
        sub={all ? `Энэ компанид ${staff.length} ажилтан ажиллаж байна.` : `Таны хариуцсан ${staff.length} ажилтан.`}
        stats={[
          { label: 'Ажилтан', value: staff.length },
          ...(all ? [{ label: 'Орон тоо', value: filled, unit: `/ ${quota}` }] : []),
          { label: 'Хувийн хэрэг', value: filesPct, unit: '%' },
          { label: 'Анхаарах зүйл', value: alerts.length, alert: alerts.length > 0 },
        ]}
      />
      <div className="hr-grid">
        <Alerts alerts={alerts} />
        {all && <Headcount />}
        <Movement />
        <Makeup staff={staff} />
        <Birthdays staff={staff} />
      </div>
    </div>
  )
}

function Alerts({ alerts }: { alerts: ReturnType<typeof alertsOf> }) {
  const hr = hrView(useApp())
  const [all, setAll] = useState(false)
  const shown = all ? alerts : alerts.slice(0, 6)
  return (
    <section className="card glass span-7" aria-labelledby="hra-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="hra-t">Анхаарах зүйл</h2>
          <p className="card__sub">Ойрын {ALERT_DAYS} хоногт дуусах, хугацаа хэтэрсэн</p>
        </div>
      </div>
      {alerts.length === 0 ? (
        <Empty icon={<CircleCheck className="ico" />} title="Анхаарах зүйл алга" text={`Ойрын ${ALERT_DAYS} хоногт хугацаа нь дуусах гэрээ, баримт байхгүй.`} />
      ) : (
        <ul className="hr-alerts">
          {shown.map(a => {
            const Icon = ALERT_ICON[a.kind]
            return (
              <li key={`${a.kind}-${a.employee.id}-${a.what}`}>
                <a className={`hr-alert${a.days < 0 ? ' is-late' : ''}`} href={`#hr-${a.employee.id}`}>
                  <span className="lead"><Icon className="ico" /></span>
                  <span className="hr-alert__what"><b>{a.what}</b><small>{short(a.employee)}, {hr.position(a.employee.position)?.name}</small></span>
                  <span className="hr-when"><b className="tnum">{dots(a.date)}</b><small>{whenEnds(a.days)}</small></span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
      {alerts.length > 6 && (
        <button type="button" className="btn btn--ghost btn--sm hr-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Хураах' : `Бүгдийг харах (${alerts.length})`}
        </button>
      )}
    </section>
  )
}

function Headcount() {
  const hr = hrView(useApp())
  const box = useRef<HTMLUListElement>(null)
  const quota = hr.positions.reduce((n, p) => n + p.quota, 0)
  const filled = hr.positions.reduce((n, p) => n + Math.min(p.quota, hr.filled.get(p.id) ?? 0), 0)
  const depts = hr.departments.map(d => {
    const ps = hr.positions.filter(p => p.dept === d.id)
    return { d, q: ps.reduce((n, p) => n + p.quota, 0), f: ps.reduce((n, p) => n + Math.min(p.quota, hr.filled.get(p.id) ?? 0), 0) }
  })
  useLayoutEffect(() => {
    if (!box.current) return
    const anims = enter(box.current.querySelectorAll('.hr-bar i'), { transform: 'scaleX(0)' }, { duration: 1.1, ease: 'power3.out', stagger: 0.05, delay: 0.2 })
    return () => anims.forEach(a => a.cancel())
  }, [])
  return (
    <section className="card glass span-5" aria-labelledby="hrh-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="hrh-t">Орон тоо</h2>
          <p className="card__sub">{quota} орон тооноос {filled} нь бүрдсэн</p>
        </div>
        <a className="btn btn--ghost btn--sm" href="#hr-structure">Бүтэц харах<ArrowRight className="ico" /></a>
      </div>
      <div className="hr-fill">
        <Ring value={quota ? filled / quota : 0} size={92} width={10}>
          <b className="tnum">{quota ? Math.round((100 * filled) / quota) : 0}%</b>
        </Ring>
        <dl>
          <div><dt>Бүрдсэн</dt><dd className="tnum">{filled}</dd></div>
          <div><dt>Сул</dt><dd className="tnum">{quota - filled}</dd></div>
        </dl>
      </div>
      <ul className="hr-depts" ref={box}>
        {depts.map(({ d, q, f }) => (
          <li key={d.id}>
            <span className="hr-depts__name">{d.name}</span>
            <span className="hr-bar" aria-hidden="true"><i style={{ transform: `scaleX(${q ? f / q : 0})` }} /></span>
            <span className="tnum hr-depts__n">{f}<small> / {q}</small></span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Who joined and who left in the last 12 months, newest first. With one or two people a month, names say more than a chart. */
function Movement() {
  const hr = hrView(useApp())
  const [all, setAll] = useState(false)
  const now = new Date()
  const from = ymd(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()))
  const within = (d: string) => d > from && d <= ymd(now)
  const events = [
    ...hr.employees.filter(e => within(e.hired)).map(e => ({ e, date: e.hired, joined: true, note: undefined as string | undefined })),
    ...hr.employees.flatMap(e => e.moves.filter(m => m.kind === 'left' && within(m.date)).map(m => ({ e, date: m.date, joined: false, note: m.note }))),
  ].sort((a, b) => b.date.localeCompare(a.date))
  const joined = events.filter(x => x.joined).length
  const shown = all ? events : events.slice(0, 6)
  return (
    <section className="card glass span-7" aria-labelledby="hrm-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="hrm-t">Ажилд орсон, ажлаас гарсан</h2>
          <p className="card__sub">Сүүлийн 12 сар: {joined} орсон, {events.length - joined} гарсан</p>
        </div>
      </div>
      {events.length === 0 ? (
        <Empty icon={<UsersRound className="ico" />} title="Сүүлийн 12 сард орсон, гарсан хүн алга" />
      ) : (
        <ul className="hr-people">
          {shown.map(({ e, date, joined, note }) => {
            const pos = hr.position(e.position)?.name ?? ''
            return (
              <li key={`${e.id}-${joined}`}>
                <a href={`#hr-${e.id}`} className="hr-person">
                  <EmpAvatar e={e} size="md" />
                  <span><b>{short(e)}</b><small>{joined ? (e.status === 'probation' ? `${pos}, ${EMP_STATUS.probation.toLowerCase()}` : pos) : note ?? pos}</small></span>
                  <span className="hr-when"><b className="tnum">{dots(date)}</b><small className={joined ? 'is-in' : 'is-out'}>{joined ? MOVE.hired : EMP_STATUS.left}</small></span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
      {events.length > 6 && (
        <button type="button" className="btn btn--ghost btn--sm hr-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Хураах' : `Бүгдийг харах (${events.length})`}
        </button>
      )}
    </section>
  )
}

const AGES: [string, number, number][] = [['24 ба түүнээс доош', 0, 24], ['25–34', 25, 34], ['35–44', 35, 44], ['45–54', 45, 54], ['55 ба түүнээс дээш', 55, 200]]

/** Men and women, and age groups, read from the registration numbers */
function Makeup({ staff }: { staff: Employee[] }) {
  const people = staff.map(e => readRegNo(e.regNo)).filter(x => x !== null)
  const men = people.filter(p => p.male).length
  const women = people.length - men
  const ages = people.map(p => ageOn(p.birth))
  const groups = AGES.map(([label, lo, hi]) => ({ label, n: ages.filter(a => a >= lo && a <= hi).length }))
  const max = Math.max(1, ...groups.map(g => g.n))
  const avg = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0
  const pct = (n: number) => Math.round((100 * n) / Math.max(1, people.length))
  return (
    <section className="card glass span-5" aria-labelledby="hrk-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="hrk-t">Нас, хүйс</h2>
          <p className="card__sub">Регистрийн дугаараас тооцсон. Дундаж нас {avg}.</p>
        </div>
      </div>
      <div className="hr-sex">
        <div className="hr-sex__bar" aria-hidden="true">
          <i className="is-men" style={{ flexGrow: men }} />
          <i className="is-women" style={{ flexGrow: women }} />
        </div>
        <p><span><i className="is-men" />Эрэгтэй <b className="tnum">{men}</b> <small className="tnum">{pct(men)}%</small></span>
          <span><i className="is-women" />Эмэгтэй <b className="tnum">{women}</b> <small className="tnum">{pct(women)}%</small></span></p>
      </div>
      <ul className="hr-ages">
        {groups.map(g => (
          <li key={g.label}>
            <span>{g.label}</span>
            <span className="hr-bar" aria-hidden="true"><i style={{ transform: `scaleX(${g.n / max})` }} /></span>
            <b className="tnum">{g.n}</b>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Birthdays({ staff }: { staff: Employee[] }) {
  const now = new Date()
  const list = staff
    .map(e => ({ e, birth: readRegNo(e.regNo)?.birth }))
    .filter((x): x is { e: Employee; birth: Date } => !!x.birth && x.birth.getMonth() === now.getMonth())
    .sort((a, b) => a.birth.getDate() - b.birth.getDate())
  return (
    <section className="card glass span-12 hr-bdays" aria-labelledby="hrb-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="hrb-t">Энэ сарын төрсөн өдөр</h2>
          <p className="card__sub">{now.getMonth() + 1}-р сар</p>
        </div>
      </div>
      {list.length === 0 ? (
        <Empty icon={<Cake className="ico" />} title="Энэ сард төрсөн өдөртэй ажилтан алга" />
      ) : (
        <ul className="hr-people">
          {list.map(({ e, birth }) => {
            const day = new Date(now.getFullYear(), birth.getMonth(), birth.getDate())
            const today = day.getDate() === now.getDate()
            return (
              <li key={e.id}>
                <a href={`#hr-${e.id}`} className={`hr-person${today ? ' is-today' : ''}`}>
                  <EmpAvatar e={e} size="md" />
                  <span><b>{short(e)}</b><small>{monthDay(day)}{today ? ', өнөөдөр' : ''}</small></span>
                  <span className="hr-person__aside">{ageOn(birth, day)} нас</span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
