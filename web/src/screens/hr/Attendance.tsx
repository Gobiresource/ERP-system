// Ирц (Хүний нөөц → Ирц): each ХХК's attendance from Timely, as the HR plan's module 8 asks: the month at a glance, by
// department, who is low, everyone's days and hours with their annual leave, and one employee's month day by day.
// Timely's employees are matched to ours by registration number; those in one system only are listed apart. Without
// Timely, a made-up month says "Жишээ" (lib/attendance.ts, docs/decisions.md, 2026-10-31).
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, CircleAlert, CircleCheck, LoaderCircle, RefreshCw, TreePalm, UserRound } from 'lucide-react'
import '../../styles/screens/attendance.css'
import type { State, TimelyDay, TimelyEmployee, TimelyMonth } from '../../lib/types'
import { actions, useApp } from '../../lib/store'
import { usePageEnter } from '../../lib/motion'
import { DAY_STATE, EVERY, LOW, avgIn, datesOf, dayStateOf, linkOf, loadDays, loadMonth, matchUp, pctOf, sampleDays, sampleMonth, spanOf, sumUp, timelyState, type DayState, type Row, type TimelyState } from '../../lib/attendance'
import { dots } from '../../lib/hr'
import { hrView, seer } from '../../lib/access'
import { monthKey, monthName, prevMonth } from '../../lib/reports'
import { collator, hm, parse, short, today, weekdayShort } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Seg } from '../../ui/Seg'
import { Empty, NoAccess } from '../../ui/bits'
import { EmpAvatar, HrNav } from '../Hr'

/** Kept while moving between the overview and an employee, and back */
let shownMonth = monthKey(new Date())
let demoOn = false
const kept = new Map<string, TimelyMonth>()

/** Timely's connection for the ХХК, the chosen month and its data; reads again every 5 minutes while open */
function useAttendance() {
  const s = useApp()
  const [timely, setTimely] = useState<TimelyState | null>(null)
  const [month, setMonth] = useState(shownMonth)
  const [demo, setDemo] = useState(demoOn)
  const [data, setData] = useState<TimelyMonth | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const link = timely ? linkOf(s, s.company, timely.companies) : undefined
  const key = link ? `${link.id}:${month}` : demo ? `demo:${s.company}:${month}` : `none:${s.company}`

  const check = useCallback(() => {
    setTimely(null)
    timelyState().then(setTimely)
  }, [])
  useEffect(check, [check])

  const id = link?.id
  const load = useCallback((fresh: boolean) => {
    if (id === undefined) return
    setBusy(true)
    loadMonth(id, month, fresh)
      .then(m => {
        kept.set(`${id}:${month}`, m)
        setData(m)
        setError(null)
      }, (e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }, [id, month])

  useEffect(() => {
    setError(null)
    if (id === undefined) {
      setData(demo ? sampleMonth(s, month) : null)
      return
    }
    setData(kept.get(`${id}:${month}`) ?? null)
    load(false)
    const t = setInterval(() => load(false), EVERY)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, load])

  return {
    s, timely, link, month, data, error, busy, demo, check, load,
    pickMonth: (m: string) => {
      shownMonth = m
      setMonth(m)
    },
    showDemo: () => {
      demoOn = true
      setDemo(true)
    },
  }
}
type Att = ReturnType<typeof useAttendance>

/**
 * The month within the person's attendance right: everyone, or only their own people by Шууд удирдлага. Those in one
 * system only are for whoever sees everyone.
 */
function visible(s: State, data: TimelyMonth) {
  const hr = hrView(s)
  const m = matchUp(hr.all, data.employees)
  const scope = hr.access.attendance
  if (scope === 'all') return m
  const sees = seer(s, s.me, s.company, scope)
  return { rows: m.rows.filter(r => r.e && sees(r.e)), onlyTimely: [], onlyErp: [] }
}

/** A Timely employee's name the way ours are shown: "Д.Бат-Эрдэнэ" */
const tname = (t: TimelyEmployee) => (t.family ? short(t) : t.given || `№ ${t.workerId}`)
/** The employee's address in Ирц: ours by id, one only Timely knows by its worker number */
const keyOf = (r: Row) => (r.e ? r.e.id : `t${r.t.workerId}`)
const pctText = (p: number | null) => (p === null ? '—' : `${p}%`)

export default function Attendance() {
  const a = useAttendance()
  const hr = hrView(a.s)
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const m = a.data ? visible(a.s, a.data) : null
  const sum = m ? sumUp(m.rows) : null
  return (
    <div ref={ref}>
      <HrNav at="attendance" />
      <PageHead
        title="Ирц"
        sub={hr.access.attendance === 'all' ? 'Timely-ийн ирц. Ажилтныг регистрийн дугаараар тулгана.' : 'Таны хариуцсан ажилтны ирц, Timely-ээс.'}
        stats={sum ? [
          { label: 'Дундаж ирц', value: sum.avg ?? '—', unit: sum.avg === null ? undefined : '%' },
          { label: 'Ажиллавал зохих өдөр', value: sum.workDays },
          { label: 'Бүх өдөр ажилласан', value: sum.full },
          { label: `Ирц ${LOW}%-иас доош`, value: sum.low.length, alert: sum.low.length > 0 },
        ] : undefined}
        actions={<MonthTools a={a} />}
      />
      <TimelyBar a={a} />
      {m && sum ? (
        <div className="hr-grid">
          <Low rows={sum.low} />
          <ByDept rows={m.rows} />
          <Everyone rows={m.rows} />
          {(m.onlyTimely.length > 0 || m.onlyErp.length > 0) && <Unmatched a={a} onlyTimely={m.onlyTimely} onlyErp={m.onlyErp} />}
        </div>
      ) : (
        <Waiting a={a} />
      )}
    </div>
  )
}

/** The last three months, and reading Timely again now */
function MonthTools({ a }: { a: Att }) {
  const cur = monthKey(new Date())
  const months = [cur, prevMonth(cur), prevMonth(cur, 2)]
  return (
    <div className="att-tools">
      <Seg label="Сар" small value={a.month} onChange={a.pickMonth} options={months.map(m => ({ value: m, label: monthName(m) }))} />
      {(a.link || a.demo) && (
        <button type="button" className="btn btn--glass" disabled={a.busy} onClick={() => (a.link ? a.load(true) : a.check())}>
          <RefreshCw className={`ico${a.busy ? ' spin' : ''}`} />Шинэчлэх
        </button>
      )}
    </div>
  )
}

/** Whether Timely is connected for this ХХК; which Timely company, when the names differ; the example otherwise */
function TimelyBar({ a }: { a: Att }) {
  const { s, timely, link } = a
  if (!timely) return <p className="sbar" role="status"><LoaderCircle className="ico spin" />Timely-тэй холболтыг шалгаж байна…</p>
  const picked = s.timely[s.company]
  // Found by name: nothing to pick unless Timely has several companies; only an admin picks
  const pick = hrView(s).access.admin && timely.companies.length > 0 && (picked !== undefined || !link || timely.companies.length > 1) && (
    <label className="att-pick">
      <span>Timely-ийн байгууллага</span>
      <select value={picked ?? ''} onChange={e => actions.linkTimely(s.company, e.target.value ? Number(e.target.value) : null)}>
        <option value="">{link && picked === undefined ? `${link.name} (нэрээр таарсан)` : 'Сонгоно уу'}</option>
        {timely.companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.register ? `, ${c.register}` : ''}</option>)}
      </select>
    </label>
  )
  const errors = timely.errors.length > 0 && <span className="att-errs">{timely.errors.join(' ')}</span>
  if (link) {
    return (
      <div className="sbar is-on" role="status">
        <CircleCheck className="ico" />
        <span>
          <b>Timely холбогдсон:</b> {link.name}{link.register ? ` (${link.register})` : ''}.
          {a.data && ` Сүүлд ${hm(new Date(a.data.updated))}-д шинэчилсэн.`}
          {a.error && a.data && <span className="att-errs"> {a.error}</span>}
          {errors}
        </span>
        {pick}
      </div>
    )
  }
  return (
    <div className="sbar" role="status">
      <CircleAlert className="ico" />
      <span>
        {!timely.ready
          ? <><b>Timely холбогдоогүй байна.</b> Серверт Timely-ийн түлхүүр тохируулсны дараа ирц энд харагдана.</>
          : timely.companies.length
            ? <><b>Timely-ээс энэ ХХК олдсонгүй.</b> Timely-ийн байгууллагыг сонгоно уу.</>
            : <b>Timely-д холбогдож чадсангүй.</b>}
        {errors}
        {a.demo && <span className="att-demo"><b>Жишээ горим:</b> ирц болон ажилтны мэдээлэл зохиомол.</span>}
      </span>
      {pick}
      {!a.demo && <button type="button" className="btn btn--glass btn--sm" onClick={a.showDemo}>Жишээ ирц харах</button>}
    </div>
  )
}

/** Before the month is in: reading it, why it could not be read, or nothing to show yet */
function Waiting({ a }: { a: Att }) {
  if (!a.timely) return null
  if (a.link && a.error) {
    return (
      <section className="card glass" data-enter>
        <Empty icon={<CircleAlert className="ico" />} title="Ирцийг татаж чадсангүй" text={a.error}>
          <button type="button" className="btn btn--glass" onClick={() => a.load(true)}><RefreshCw className="ico" />Дахин оролдох</button>
        </Empty>
      </section>
    )
  }
  if (a.link) {
    return (
      <section className="card glass" data-enter>
        <Empty icon={<LoaderCircle className="ico spin" />} title="Timely-ээс ирц татаж байна…" text="Ажилтан бүрийн сарын ирцийг уншиж байна. Түр хүлээнэ үү." />
      </section>
    )
  }
  return (
    <section className="card glass" data-enter>
      <Empty icon={<UserRound className="ico" />} title="Ирцийн мэдээлэл байхгүй" text="Timely холбогдсоны дараа ажилтан бүрийн ажилласан өдөр, цаг, ээлжийн амралтын үлдэгдэл энд харагдана." />
    </section>
  )
}

/** The employee: ours with their avatar, or one only Timely knows */
function Who({ r, sub }: { r: Row; sub?: string }) {
  const hr = hrView(useApp())
  return (
    <span className="etable__who">
      {r.e ? <EmpAvatar e={r.e} size="sm" /> : <span className="att-stranger" aria-hidden="true"><UserRound className="ico" /></span>}
      <span>
        <a href={`#hr-attendance-${keyOf(r)}`}>{r.e ? short(r.e) : tname(r.t)}</a>
        <small>{sub ?? (r.e ? hr.position(r.e.position)?.name : r.t.position)}</small>
      </span>
    </span>
  )
}

function Low({ rows }: { rows: Row[] }) {
  return (
    <section className="card glass span-7" aria-labelledby="atl-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="atl-t">Ирц хангалтгүй</h2>
          <p className="card__sub">Ажиллавал зохих цагийн {LOW}%-иас бага ажилласан</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty icon={<CircleCheck className="ico" />} title="Ирц хангалтгүй ажилтан алга" text={`Бүх ажилтан ажиллавал зохих цагийн ${LOW}% болон түүнээс дээш ажилласан.`} />
      ) : (
        <ul className="att-low">
          {rows.map(r => (
            <li key={keyOf(r)}>
              <Who r={r} />
              <span className="att-low__n"><b className="tnum">{pctText(pctOf(r.t))}</b><small className="tnum">{r.t.workedDays}/{r.t.supposedDays} өдөр</small></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Each department's average, our departments where the employee is ours */
function ByDept({ rows }: { rows: Row[] }) {
  const hr = hrView(useApp())
  const groups = new Map<string, number[]>()
  for (const r of rows) {
    const p = pctOf(r.t)
    if (p === null) continue
    const name = (r.e ? hr.dept(r.e.dept)?.name : r.t.division) || 'Хэлтэсгүй'
    groups.set(name, [...(groups.get(name) ?? []), p])
  }
  const depts = [...groups].map(([name, ps]) => ({ name, avg: Math.round(ps.reduce((a, b) => a + b, 0) / ps.length), n: ps.length })).sort((a, b) => a.avg - b.avg)
  return (
    <section className="card glass span-5" aria-labelledby="atd-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="atd-t">Хэлтсийн ирц</h2>
          <p className="card__sub">Дундаж ирц, доогуураас нь эхэлж</p>
        </div>
      </div>
      <ul className="hr-depts att-depts">
        {depts.map(d => (
          <li key={d.name} className={d.avg < LOW ? 'is-low' : undefined}>
            <span className="hr-depts__name">{d.name}</span>
            <span className="hr-bar" aria-hidden="true"><i style={{ transform: `scaleX(${d.avg / 100})` }} /></span>
            <span className="tnum hr-depts__n">{d.avg}%<span className="sr-only">, {d.n} ажилтан</span></span>
          </li>
        ))}
      </ul>
    </section>
  )
}

type Sort = { key: 'name' | 'pct'; dir: 1 | -1 }

/** Everyone's month: days and hours worked of those to work, the share, and the annual leave left */
function Everyone({ rows }: { rows: Row[] }) {
  const hr = hrView(useApp())
  const [dept, setDept] = useState('')
  const [sort, setSort] = useState<Sort>({ key: 'name', dir: 1 })
  const deptOf = (r: Row) => (r.e ? hr.dept(r.e.dept)?.name : r.t.division) || 'Хэлтэсгүй'
  const depts = [...new Set(rows.map(deptOf))].sort(collator.compare)
  const name = (r: Row) => (r.e ? `${r.e.given} ${r.e.family}` : `${r.t.given} ${r.t.family}`)
  const shown = rows.filter(r => !dept || deptOf(r) === dept).sort((a, b) =>
    sort.key === 'pct' ? ((pctOf(a.t) ?? -1) - (pctOf(b.t) ?? -1)) * sort.dir || collator.compare(name(a), name(b)) : collator.compare(name(a), name(b)) * sort.dir)
  const head = (key: Sort['key'], label: string, className = '') => (
    <th scope="col" className={className} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="etable__sort" onClick={() => setSort(sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: 1 })}>
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="ico" /> : <ArrowDown className="ico" />)}
      </button>
    </th>
  )
  return (
    <section className="card glass span-12 etable-card" aria-labelledby="ate-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="ate-t">Ажилтнуудын ирц</h2>
          <p className="card__sub">{shown.length} ажилтан</p>
        </div>
        <label className="att-pick">
          <span>Хэлтэс</span>
          <select value={dept} onChange={e => setDept(e.target.value)}>
            <option value="">Бүх хэлтэс</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>
      <div className="etable-wrap">
        <table className="etable att-table">
          <caption className="sr-only">Ажилтан бүрийн энэ сарын ирц. Баганын нэр дээр дарж эрэмбэлнэ.</caption>
          <thead>
            <tr>
              {head('name', 'Ажилтан')}
              <th scope="col" className="hide-md">Хэлтэс</th>
              <th scope="col" className="num">Ажилласан өдөр</th>
              <th scope="col" className="num hide-sm">Ажилласан цаг</th>
              {head('pct', 'Ирц', 'num')}
              <th scope="col" className="num hide-sm">Амралтын үлдэгдэл</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(r => {
              const p = pctOf(r.t)
              return (
                <tr key={keyOf(r)} onClick={ev => { if (!(ev.target as HTMLElement).closest('a')) location.hash = `hr-attendance-${keyOf(r)}` }}>
                  <th scope="row"><Who r={r} /></th>
                  <td className="hide-md">{deptOf(r)}</td>
                  <td className="num tnum">{r.t.workedDays}<small className="att-of"> / {r.t.supposedDays}</small></td>
                  <td className="num tnum hide-sm">{Math.round(r.t.workedHours)}<small className="att-of"> / {Math.round(r.t.supposedHours)}</small></td>
                  <td className="num">
                    <span className={`efiles att-pct${p !== null && p < LOW ? ' is-short' : ''}`}>
                      <span className="tnum">{pctText(p)}</span>
                      <span className="efiles__bar" aria-hidden="true"><i style={{ transform: `scaleX(${(p ?? 0) / 100})` }} /></span>
                    </span>
                  </td>
                  <td className="num tnum hide-sm">{r.t.leave ? `${r.t.leave.left} хоног` : <span className="muted">—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Those in one system only: often a registration number typed differently, or someone not yet added */
function Unmatched({ a, onlyTimely, onlyErp }: { a: Att; onlyTimely: TimelyEmployee[]; onlyErp: ReturnType<typeof matchUp>['onlyErp'] }) {
  const hr = hrView(a.s)
  return (
    <section className="card glass span-12" aria-labelledby="atu-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="atu-t">Таараагүй ажилтнууд</h2>
          <p className="card__sub">Регистрийн дугаар нь нөгөө системд бүртгэгдээгүй байна. Дугаарыг шалгах эсвэл ажилтныг нэмж бүртгэнэ үү.</p>
        </div>
      </div>
      <div className="att-un">
        <div>
          <h3 className="att-un__t">Зөвхөн Timely-д <span className="tnum">({onlyTimely.length})</span></h3>
          {onlyTimely.length ? (
            <ul className="att-un__list">
              {onlyTimely.map(t => (
                <li key={t.workerId}>
                  <a href={`#hr-attendance-t${t.workerId}`}>{tname(t)}</a>
                  <small>{[t.position, t.register || 'РД бүртгээгүй'].filter(Boolean).join(', ')}</small>
                </li>
              ))}
            </ul>
          ) : <p className="muted att-un__none">Алга</p>}
        </div>
        <div>
          <h3 className="att-un__t">Зөвхөн ERP-д <span className="tnum">({onlyErp.length})</span></h3>
          {onlyErp.length ? (
            <ul className="att-un__list">
              {onlyErp.map(e => (
                <li key={e.id}>
                  <a href={`#hr-${e.id}`}>{short(e)}</a>
                  <small>{[hr.position(e.position)?.name, e.regNo].filter(Boolean).join(', ')}</small>
                </li>
              ))}
            </ul>
          ) : <p className="muted att-un__none">Алга</p>}
        </div>
      </div>
    </section>
  )
}

const ICON: Partial<Record<DayState, typeof CircleCheck>> = { part: CircleAlert, leave: TreePalm }

/** One employee's month, day by day */
export function AttendanceOne({ id }: { id: string }) {
  const a = useAttendance()
  const hr = hrView(a.s)
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const m = a.data ? visible(a.s, a.data) : null
  const row = m?.rows.find(r => keyOf(r) === id)
  const ours = hr.all.find(e => e.id === id)
  // Someone outside the person's right is not shown, not even as missing from Timely
  const outside = hr.access.attendance !== 'all' && !(ours && seer(a.s, a.s.me, a.s.company, hr.access.attendance)(ours))
  const [days, setDays] = useState<TimelyDay[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Шинэчлэх here reads the days again too */
  const [again, setAgain] = useState(0)
  const worker = row?.t.workerId
  const linkId = a.link?.id

  useEffect(() => {
    setDays(null)
    setError(null)
    if (worker === undefined) return
    if (linkId === undefined) {
      if (a.demo && row) setDays(sampleDays(a.s, row.t, a.month))
      return
    }
    let live = true
    loadDays(linkId, worker, a.month, again > 0).then(r => live && setDays(r.days), (e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker, linkId, a.month, a.demo, again])

  const name = outside ? 'Ажилтны ирц' : row ? (row.e ? short(row.e) : tname(row.t)) : ours ? short(ours) : 'Ажилтны ирц'
  const back = <a className="ibtn ibtn--glass head__back" href="#hr-attendance" aria-label="Ирц руу буцах"><ChevronLeft className="ico" /></a>
  const p = row ? pctOf(row.t) : null
  const avg = days ? avgIn(days) : null

  return (
    <div ref={ref}>
      <HrNav at="attendance" />
      <PageHead
        title={name}
        sub={row ? [row.e ? hr.position(row.e.position)?.name : row.t.position, row.e ? hr.dept(row.e.dept)?.name : row.t.division].filter(Boolean).join(', ') : undefined}
        lead={<>{back}{!outside && (row?.e || ours) ? <span className="head__icon"><EmpAvatar e={(row?.e ?? ours)!} size="xl" /></span> : null}</>}
        stats={row ? [
          { label: 'Ирц', value: p ?? '—', unit: p === null ? undefined : '%', alert: p !== null && p < LOW },
          { label: 'Ажилласан өдөр', value: row.t.workedDays, unit: `/ ${row.t.supposedDays}` },
          { label: 'Дундаж ирсэн цаг', value: avg ?? '—' },
          { label: 'Амралтын үлдэгдэл', value: row.t.leave?.left ?? '—', unit: row.t.leave ? 'хоног' : undefined },
        ] : undefined}
        actions={<MonthTools a={{ ...a, load: (fresh: boolean) => (a.load(fresh), setAgain(n => n + 1)) }} />}
      />
      <TimelyBar a={a} />
      {outside ? (
        <NoAccess inline text="Та зөвхөн хариуцсан ажилтныхаа ирцийг харах эрхтэй." />
      ) : !m ? (
        <Waiting a={a} />
      ) : !row ? (
        <section className="card glass" data-enter>
          <Empty icon={<UserRound className="ico" />} title="Энэ ажилтан Timely-д олдсонгүй"
            text={ours ? `Timely-д ${ours.regNo} регистрийн дугаартай ажилтан алга. Дугаарыг хоёр системд шалгана уу.` : 'Ажилтан бүртгэлээс хасагдсан эсвэл өөр ХХК-д байж магадгүй.'}>
            <a className="btn btn--glass" href="#hr-attendance">Бүх ажилтны ирц харах</a>
          </Empty>
        </section>
      ) : (
        <div className="hr-grid">
          <Month days={days} error={error} t={row.t} month={a.month} />
          <Leave t={row.t} />
          {days && <Days days={days} t={row.t} month={a.month} />}
        </div>
      )}
    </div>
  )
}

/** The month as a calendar, each day by what it was */
function Month({ days, error, t, month }: { days: TimelyDay[] | null; error: string | null; t: TimelyEmployee; month: string }) {
  const now = today()
  const byDate = new Map((days ?? []).map(d => [d.date, d]))
  const dates = datesOf(month)
  const lead = (parse(dates[0]).getDay() + 6) % 7
  const label = (date: string, st: DayState, d?: TimelyDay) =>
    `${Number(date.slice(8))}, ${weekdayShort(parse(date))}: ${st === 'later' ? 'дараа' : DAY_STATE[st]}${d?.in ? `, ирсэн ${d.in}` : ''}${d?.out ? `, явсан ${d.out}` : ''}`
  return (
    <section className="card glass span-7" aria-labelledby="atm-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="atm-t">{monthName(month)}</h2>
          <p className="card__sub">Өдөр бүрийн ирц</p>
        </div>
      </div>
      {error ? (
        <Empty icon={<CircleAlert className="ico" />} title="Өдрийн ирцийг татаж чадсангүй" text={error} />
      ) : !days ? (
        <Empty icon={<LoaderCircle className="ico spin" />} title="Өдрийн ирцийг татаж байна…" />
      ) : (
        <>
          <ol className="acal" aria-label={`${monthName(month)}, өдөр бүр`}>
            {['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'].map(w => <li key={w} className="acal__wd" aria-hidden="true">{w}</li>)}
            {Array.from({ length: lead }, (_, i) => <li key={`b${i}`} className="acal__blank" aria-hidden="true" />)}
            {dates.map(date => {
              const d = byDate.get(date)
              const st = dayStateOf(date, d, t.leave, now)
              const Icon = ICON[st]
              return (
                <li key={date} className={`acal__day is-${st}${date === now ? ' is-today' : ''}`} aria-label={label(date, st, d)}>
                  <span className="acal__n" aria-hidden="true">{Number(date.slice(8))}</span>
                  <span className="acal__t" aria-hidden="true">
                    {Icon && <Icon className="ico" />}
                    {st === 'in' || st === 'part' ? d?.in ?? '—' : st === 'none' ? '—' : ''}
                  </span>
                </li>
              )
            })}
          </ol>
          <ul className="acal-key" aria-label="Тайлбар">
            {(['in', 'part', 'none', 'leave', 'rest'] as const).map(k => <li key={k}><i className={`is-${k}`} aria-hidden="true" />{DAY_STATE[k]}</li>)}
          </ul>
        </>
      )}
    </section>
  )
}

/** The current leave year's annual leave and what was taken */
function Leave({ t }: { t: TimelyEmployee }) {
  const l = t.leave
  return (
    <section className="card glass span-5" aria-labelledby="atv-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="atv-t">Ээлжийн амралт</h2>
          <p className="card__sub">{l ? `${l.year} оны эрх` : 'Timely-д бүртгэлгүй'}</p>
        </div>
      </div>
      {l ? (
        <>
          <dl className="att-leave">
            <div><dt>Эрх</dt><dd className="tnum">{l.earned}<small> хоног</small></dd></div>
            <div><dt>Ашигласан</dt><dd className="tnum">{l.used}<small> хоног</small></dd></div>
            <div><dt>Үлдсэн</dt><dd className="tnum">{l.left}<small> хоног</small></dd></div>
          </dl>
          {l.taken.length > 0 ? (
            <ul className="att-taken">
              {l.taken.map(x => (
                <li key={x.from}><TreePalm className="ico" /><span className="tnum">{dots(x.from)}{x.to !== x.from && `–${dots(x.to).slice(5)}`}</span><small className="tnum">{x.days} хоног</small></li>
              ))}
            </ul>
          ) : <p className="muted att-un__none">Энэ жил ээлжийн амралт аваагүй.</p>}
        </>
      ) : (
        <Empty icon={<TreePalm className="ico" />} title="Ээлжийн амралтын мэдээлэл алга" />
      )}
    </section>
  )
}

/** Each day to today: in, out, how long between, and what the day was */
function Days({ days, t, month }: { days: TimelyDay[]; t: TimelyEmployee; month: string }) {
  const now = today()
  const byDate = new Map(days.map(d => [d.date, d]))
  const rows = datesOf(month).filter(d => d <= now).reverse()
  return (
    <section className="card glass span-12 etable-card" aria-labelledby="atday-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="atday-t">Өдрийн ирц</h2>
          <p className="card__sub">Сүүлийн өдрөөс эхэлж</p>
        </div>
      </div>
      <div className="etable-wrap">
        <table className="etable att-days">
          <caption className="sr-only">Өдөр бүрийн ирсэн, явсан цаг</caption>
          <thead>
            <tr>
              <th scope="col">Огноо</th>
              <th scope="col" className="num">Ирсэн</th>
              <th scope="col" className="num">Явсан</th>
              <th scope="col" className="num hide-sm">Хугацаа</th>
              <th scope="col">Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(date => {
              const d = byDate.get(date)
              const st = dayStateOf(date, d, t.leave, now)
              return (
                <tr key={date} className={st === 'rest' ? 'is-rest' : undefined}>
                  <th scope="row" className="tnum">{dots(date).slice(5)}<small className="muted">, {weekdayShort(parse(date))}</small></th>
                  <td className="num tnum">{d?.in ?? '—'}</td>
                  <td className="num tnum">{d?.out ?? '—'}</td>
                  <td className="num tnum hide-sm">{d ? spanOf(d) ?? '—' : '—'}</td>
                  <td>{st !== 'later' && <span className={`apill is-${st}`}>{DAY_STATE[st]}</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
