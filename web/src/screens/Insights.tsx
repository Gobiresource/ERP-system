import { useMemo, useRef, useState } from 'react'
import { Download, List as ListIcon, PartyPopper } from 'lucide-react'
import '../styles/screens/insights.css'
import { scoped, useApp } from '../lib/store'
import { open } from '../lib/ui'
import { usePageEnter } from '../lib/motion'
import { workload } from '../lib/derive'
import { byProject, downloadCsv, insights, slowest, type Range } from '../lib/insights'
import { dec, num, short, today } from '../lib/format'
import { PageHead } from '../ui/PageHead'
import { Seg } from '../ui/Seg'
import { Avatar, ProjectChip } from '../ui/bits'
import { Columns, DataTable, Donut, LineChart } from '../ui/charts'
import { SubNav } from '../ui/SubNav'
import Reports, { useReportTodo } from './insights/Reports'
import ReportPage from './insights/Report'

const pct = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 100) : 0)
const signed = (n: number, unit = '') => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}${unit}`

// Тайлан: the team's numbers (Үзүүлэлт), and each employee's monthly report (Сарын тайлан)
export default function Insights({ id }: { id?: string }) {
  if (id === 'reports') return <Reports />
  if (id?.startsWith('report-')) return <ReportPage key={id} id={id.slice(7)} />
  return <Numbers />
}

const TABS = [['', 'Үзүүлэлт'], ['reports', 'Сарын тайлан']] as const

/** The section's tabs; Сарын тайлан counts the reports waiting for the person */
export function InsightsNav({ at }: { at: (typeof TABS)[number][0] }) {
  const n = useReportTodo()
  const tabs = TABS.map(([key, text]) => [key, key === 'reports' && n ? <>{text}<span className="seg__count">{n}<span className="sr-only"> хийх</span></span></> : text] as const)
  return <SubNav label="Тайлан" base="insights" tabs={tabs} at={at} />
}

function Numbers() {
  const s = useApp()
  const sc = scoped(s)
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const [range, setRange] = useState<Range>(30)
  const [table, setTable] = useState(false)
  const data = useMemo(() => insights(s, range), [s, range])
  const projects = useMemo(() => byProject(s, range), [s, range])
  const { cur, prev } = data
  const doneDelta = pct(cur.done, prev.done)
  const loads = sc.people.map(p => ({ p, l: workload(p, sc.tasks) })).sort((a, b) => b.l.pct - a.l.pct)
  const over = loads.filter(x => x.l.level === 'over').length
  const projTotal = projects.reduce((n, r) => n + r.count, 0)
  const slow = slowest(sc.tasks)
  const days = range === 90 ? 'сүүлийн 90 хоногт' : `сүүлийн ${range} хоногт`

  const exportCsv = () => {
    const rows: (string | number)[][] = [[data.unitLabel, 'Дууссан ажил', 'Өмнөх үе', 'Төвлөрсөн цаг']]
    data.labels.forEach((l, i) => rows.push([l, data.throughput[i], data.throughputPrev[i] ?? 0, data.focus[i]]))
    downloadCsv(`tailan-${range}-honog-${today()}.csv`, rows)
  }

  return (
    <div ref={ref}>
      <InsightsNav at="" />
      <PageHead
        title="Тайлан"
        sub={`Баг ${days} хэрхэн ажилласан бэ?`}
        stats={[
          { label: 'Дууссан ажил', value: cur.done, delta: { text: signed(doneDelta, '%'), good: doneDelta === 0 ? null : doneDelta > 0 } },
          { label: 'Хугацаандаа', value: cur.onTime, unit: '%', delta: { text: signed(cur.onTime - prev.onTime, ' нэгж хувь'), good: cur.onTime === prev.onTime ? null : cur.onTime > prev.onTime } },
          { label: 'Төвлөрсөн цаг', value: cur.focusHours, delta: { text: signed(pct(cur.focusHours, prev.focusHours), '%'), good: cur.focusHours >= prev.focusHours } },
          { label: 'Нэг ажлын дундаж хугацаа', value: dec(cur.cycle), unit: 'хоног', delta: { text: signed(Number(dec(cur.cycle - prev.cycle)), ''), good: cur.cycle <= prev.cycle } },
        ]}
        actions={
          <>
            <Seg label="Хугацаа" className="ins-range" value={String(range)} onChange={v => setRange(Number(v) as Range)}
              options={[{ value: '7', label: '7 хоног' }, { value: '30', label: '30 хоног' }, { value: '90', label: '90 хоног' }]} />
            <button type="button" className="btn btn--glass" onClick={exportCsv}><Download className="ico" />Excel-ээр татах</button>
          </>
        }
      />
      <div className="insights">
        <section className="card glass ins-thru" aria-labelledby="th-t" data-enter>
          <div className="card__head">
            <div><h2 className="card__title" id="th-t">Дууссан ажил</h2><p className="card__sub">{range === 90 ? 'Долоо хоног бүрийн' : 'Өдөр бүрийн'} дууссан ажил</p></div>
            <button type="button" className="btn btn--glass btn--sm thru__toggle" aria-pressed={table} onClick={() => setTable(!table)}><ListIcon className="ico" />Хүснэгтээр харах</button>
          </div>
          <div className="ins-top">
            <p className="ins-sum">
              <b>{num(cur.done)}</b> дууссан.
              <span className={`delta ${doneDelta > 0 ? 'delta--up' : doneDelta < 0 ? 'delta--down' : 'delta--plain'}`}>Өмнөх {range} хоногоос {signed(doneDelta, '%')}</span>
            </p>
            <ul className="ins-key" aria-hidden="true">
              <li><i className="key-line" />Сүүлийн {range} хоног</li>
              <li><i className="key-line key-line--dash" />Өмнөх {range} хоног</li>
            </ul>
          </div>
          <div className="thru__views">
            {table ? (
              <div className="thru__table">
                <table className="itable">
                  <caption className="sr-only">Дууссан ажил, {data.unitLabel.toLowerCase()} бүрээр</caption>
                  <thead><tr><th scope="col">{data.unitLabel}</th><th scope="col">Дууссан</th><th scope="col">Өмнөх үе</th></tr></thead>
                  <tbody>{data.labels.map((l, i) => <tr key={i}><th scope="row">{l}</th><td className="tnum">{data.throughput[i]}</td><td className="tnum">{data.throughputPrev[i] ?? 0}</td></tr>)}</tbody>
                  <tfoot><tr><th scope="row">Нийт</th><td className="tnum">{cur.done}</td><td className="tnum">{prev.done}</td></tr></tfoot>
                </table>
              </div>
            ) : (
              <LineChart key={range} label="Дууссан ажил" unit="" labels={data.labels} height={300}
                series={[{ name: `Сүүлийн ${range} хоног`, values: data.throughput, tone: 'accent', area: true }, { name: `Өмнөх ${range} хоног`, values: data.throughputPrev, tone: 'muted', dashed: true }]} />
            )}
          </div>
        </section>

        <section className="card glass ins-proj" aria-labelledby="pr-t" data-enter>
          <div className="card__head"><div><h2 className="card__title" id="pr-t">Төслөөр</h2><p className="card__sub">Төсөл бүрийн дууссан ажил</p></div></div>
          <div className="proj">
            <Donut key={range} label={`Төслөөр: ${projects.map(r => `${r.project.name} ${r.count}`).join(', ')}`} total={projTotal}
              items={projects.map(r => ({ key: r.project.id, value: r.count, hue: r.project.hue, name: r.project.name }))}>
              <b className="tnum">{projTotal}</b><span>Дууссан</span>
            </Donut>
            <table className="plegend">
              <caption className="sr-only">Төсөл бүрийн дууссан ажил</caption>
              <tbody>
                {projects.map(r => (
                  <tr key={r.project.id} className={`hue--${r.project.hue}`}>
                    <th scope="row"><i aria-hidden="true" /><span>{r.project.name}</span></th>
                    <td className="tnum">{r.count}</td>
                    <td className="tnum">{projTotal ? Math.round((r.count / projTotal) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card glass ins-focus" aria-labelledby="fo-t" data-enter>
          <div className="card__head"><div><h2 className="card__title" id="fo-t">Төвлөрөх цаг</h2><p className="card__sub">Багийн {range === 90 ? 'долоо хоног бүрийн' : 'өдөр бүрийн'} төвлөрсөн цаг</p></div></div>
          <p className="ins-sum" style={{ marginBottom: 12 }}><b>{num(cur.focusHours)}</b> цаг, өдөрт дунджаар {dec(cur.focusHours / range)} цаг.</p>
          <Columns key={range} label="Төвлөрсөн" unit="ц" values={data.focus} labels={data.labels} />
        </section>

        <section className="card glass ins-work" aria-labelledby="wl-t" data-enter>
          <div className="card__head">
            <div><h2 className="card__title" id="wl-t">Ачаалал</h2><p className="card__sub">Дуусаагүй ажлын цаг ба долоо хоногийн боломжит цаг</p></div>
            <span className={`badge${over ? ' badge--danger' : ''}`}>{over ? `${over} хүн хэтэрсэн` : 'Бүгд хэвийн'}</span>
          </div>
          <ul className="ins-key" aria-hidden="true" style={{ margin: '-4px 0 12px' }}>
            <li><i className="key-bar" />Дуусаагүй ажил</li>
            <li><i className="key-cap" />Боломжит цаг</li>
            <li><i className="key-bar key-bar--over" />Хэтэрсэн</li>
          </ul>
          <div className="wl">
            {loads.map(({ p, l }) => {
              const scale = Math.max(l.capacity, l.hours) * 1.1
              return (
                <div key={p.id} className={`wl__row${l.level === 'over' ? ' is-over' : l.level === 'high' ? ' is-near' : ''}`}>
                  <button type="button" className="wl__who" onClick={() => open({ kind: 'person', id: p.id })}>
                    <Avatar person={p} size="md" />
                    <span><b>{short(p)}</b><small>{p.role}</small></span>
                  </button>
                  <span className="wl__bar" aria-hidden="true">
                    <i className="wl__fill" style={{ width: `${(l.hours / scale) * 100}%` }} />
                    <i className="wl__cap" style={{ left: `${(l.capacity / scale) * 100}%` }} />
                  </span>
                  <span className="wl__num tnum"><b>{l.hours}</b><small>/ {l.capacity} цаг</small></span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="card glass ins-time" aria-labelledby="ot-t" data-enter>
          <div className="card__head"><div><h2 className="card__title" id="ot-t">Хугацаандаа</h2><p className="card__sub">{days[0].toUpperCase() + days.slice(1)} дууссан ажил</p></div></div>
          <div className="ot">
            <p className="ot__big"><span className="ot__pct tnum">{cur.onTime}</span><span className="ot__unit">%</span><span className="ot__lbl">нь товлосон хугацаандаа дууссан</span></p>
            <div className="ot__bar" aria-hidden="true">
              <i className="ot__on" style={{ width: `calc(${cur.onTime}% - 4px)` }} />
              {cur.late > 0 && <i className="ot__late" style={{ width: `calc(${100 - cur.onTime}% - 4px)` }} />}
            </div>
            <p className="ot__keys">
              <span><i className="ot__dot ot__dot--on" aria-hidden="true" /><b className="tnum">{cur.done - cur.late}</b> хугацаандаа</span>
              <span><i className="ot__dot ot__dot--late" aria-hidden="true" /><b className="tnum">{cur.late}</b> хоцорсон</span>
            </p>
          </div>
          <h3 className="ot__h">Удааширсан ажил</h3>
          {slow.length === 0 ? <p className="tp-none"><PartyPopper className="ico" /> Дуусаагүй ажил алга.</p> : (
            <ul className="slow">
              {slow.map(({ task, days: d }) => {
                const who = task.assignees.map(x => sc.person(x)).filter(x => x !== undefined)
                return (
                  <li key={task.id}>
                    <button type="button" className="slow__row" onClick={() => open({ kind: 'task', id: task.id })}>
                      {who.length > 0 && <Avatar person={who[0]} size="sm" />}
                      <span className="slow__main">
                        <b>{task.title}</b>
                        <span><ProjectChip project={sc.project(task.project)} />{who.length > 0 && <small>{who.map(short).join(', ')}</small>}</span>
                      </span>
                      <span className="slow__age"><b className="tnum">{d} хоног</b><small>дуусаагүй</small></span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
      <DataTable caption="Хүн бүрийн ачаалал" head={['Хүн', 'Дуусаагүй ажил (цаг)', 'Боломжит цаг']} rows={loads.map(({ p, l }) => [short(p), l.hours, l.capacity])} />
    </div>
  )
}
