// HR overview: headcount, alerts, recent movement and who works here
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, Cake, CircleCheck, FileClock, FileWarning, Hourglass } from 'lucide-react'
import type { Employee } from '../../lib/types'
import { useApp } from '../../lib/store'
import { enter, usePageEnter } from '../../lib/motion'
import { ALERT_DAYS, EMP_STATUS, MOVE, ageOn, alertsOf, current, dots, fileScore, hrScoped, readRegNo, whenEnds, type AlertKind } from '../../lib/hr'
import { monthDay, short } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Empty } from '../../ui/bits'
import { DataTable, Ring } from '../../ui/charts'
import { EmpAvatar, HrNav } from '../Hr'

const ALERT_ICON: Record<AlertKind, typeof FileClock> = { contract: FileClock, probation: Hourglass, file: FileWarning }

export default function Overview() {
  const s = useApp()
  const hr = hrScoped(s)
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)

  const staff = hr.employees.filter(current)
  const quota = hr.positions.reduce((n, p) => n + p.quota, 0)
  const filled = hr.positions.reduce((n, p) => n + Math.min(p.quota, hr.filled.get(p.id) ?? 0), 0)
  const scores = staff.map(e => fileScore(e, hr.docTypes))
  const filesPct = Math.round((100 * scores.reduce((n, x) => n + x.done, 0)) / Math.max(1, scores.reduce((n, x) => n + x.total, 0)))
  const alerts = alertsOf(hr.employees, hr.docTypes)

  return (
    <div ref={ref}>
      <HrNav at="" />
      <PageHead
        title="Хүний нөөц"
        sub={`Энэ компанид ${staff.length} ажилтан ажиллаж байна.`}
        stats={[
          { label: 'Ажилтан', value: staff.length },
          { label: 'Орон тоо', value: filled, unit: `/ ${quota}` },
          { label: 'Хувийн хэрэг', value: filesPct, unit: '%' },
          { label: 'Анхаарах зүйл', value: alerts.length, alert: alerts.length > 0 },
        ]}
      />
      <div className="hr-grid">
        <Alerts alerts={alerts} />
        <Headcount />
        <Movement />
        <Recent staff={staff} />
        <Makeup staff={staff} />
        <Birthdays staff={staff} />
      </div>
    </div>
  )
}

function Alerts({ alerts }: { alerts: ReturnType<typeof alertsOf> }) {
  const hr = hrScoped(useApp())
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
                  <span className="hr-alert__when"><b className="tnum">{dots(a.date)}</b><small>{whenEnds(a.days)}</small></span>
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
  const hr = hrScoped(useApp())
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

/** Hires above the line, leavers below, for the last 12 months */
function Movement() {
  const hr = hrScoped(useApp())
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 11 + i, 1))
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const count = (dates: string[]) => months.map(m => dates.filter(x => x.startsWith(key(m))).length)
  const ins = count(hr.employees.map(e => e.hired))
  const outs = count(hr.employees.flatMap(e => e.moves.filter(m => m.kind === 'left').map(m => m.date)))
  const max = Math.max(1, ...ins, ...outs)
  const name = (m: Date) => `${m.getFullYear()} оны ${m.getMonth() + 1}-р сар`
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!box.current) return
    const up = enter(box.current.querySelectorAll('.hr-mov__in i'), { transform: 'scaleY(0)' }, { duration: 1, ease: 'power3.out', stagger: 0.04, delay: 0.25 })
    const down = enter(box.current.querySelectorAll('.hr-mov__out i'), { transform: 'scaleY(0)' }, { duration: 1, ease: 'power3.out', stagger: 0.04, delay: 0.35 })
    return () => [...up, ...down].forEach(a => a.cancel())
  }, [])
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  return (
    <section className="card glass span-7 hr-movcard" aria-labelledby="hrm-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="hrm-t">Ажилд орсон, гарсан</h2>
          <p className="card__sub">Сүүлийн 12 сар</p>
        </div>
        <ul className="hr-key" aria-label="Тайлбар">
          <li><i className="hr-key__in" />{MOVE.hired} <b className="tnum">{sum(ins)}</b></li>
          <li><i className="hr-key__out" />Гарсан <b className="tnum">{sum(outs)}</b></li>
        </ul>
      </div>
      <div className="hr-mov" ref={box} aria-hidden="true">
        {months.map((m, i) => (
          <div className="hr-mov__col" key={i} title={`${name(m)}: ${ins[i]} орсон, ${outs[i]} гарсан`}>
            <span className="hr-mov__in">{ins[i] > 0 && <i style={{ height: `${(ins[i] / max) * 78}%` }}><b className="tnum">{ins[i]}</b></i>}</span>
            <span className="hr-mov__out">{outs[i] > 0 && <i style={{ height: `${(outs[i] / max) * 78}%` }}><b className="tnum">{outs[i]}</b></i>}</span>
            <span className="hr-mov__lab">{m.getMonth() + 1}</span>
          </div>
        ))}
      </div>
      <DataTable caption="Сар бүр ажилд орсон, гарсан ажилтны тоо" head={['Сар', 'Орсон', 'Гарсан']} rows={months.map((m, i) => [name(m), ins[i], outs[i]])} />
    </section>
  )
}

function Recent({ staff }: { staff: Employee[] }) {
  const hr = hrScoped(useApp())
  const list = [...staff].sort((a, b) => b.hired.localeCompare(a.hired)).slice(0, 5)
  return (
    <section className="card glass span-5" aria-labelledby="hrr-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="hrr-t">Сүүлд ажилд орсон</h2>
          <p className="card__sub">Шинэ ажилтан</p>
        </div>
        <a className="btn btn--ghost btn--sm" href="#hr-employees">Бүгдийг харах</a>
      </div>
      <ul className="hr-people">
        {list.map(e => (
          <li key={e.id}>
            <a href={`#hr-${e.id}`} className="hr-person">
              <EmpAvatar e={e} size="md" />
              <span><b>{short(e)}</b><small>{hr.position(e.position)?.name}{e.status === 'probation' ? `, ${EMP_STATUS.probation.toLowerCase()}` : ''}</small></span>
              <span className="hr-person__aside tnum">{dots(e.hired)}</span>
            </a>
          </li>
        ))}
      </ul>
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
    <section className="card glass span-7" aria-labelledby="hrk-t" data-enter>
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
    <section className="card glass span-5" aria-labelledby="hrb-t" data-enter>
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
