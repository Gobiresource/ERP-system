// Сарын тайлан: whoever writes one sees theirs on top, a manager the ones to score; the table shows a month of the team,
// or of the whole ХХК for the director and HR, who take it to Excel for the bonus (docs/decisions.md, 2026-10-30).
import { useRef, useState } from 'react'
import { ClipboardList, Download, PenLine, SlidersHorizontal } from 'lucide-react'
import '../../styles/screens/contracts.css'
import '../../styles/screens/hr.css'
import '../../styles/screens/reports.css'
import type { Id, KpiRules, MonthReport, State } from '../../lib/types'
import { useApp } from '../../lib/store'
import { open } from '../../lib/ui'
import { go } from '../../lib/router'
import { usePageEnter } from '../../lib/motion'
import { downloadCsv } from '../../lib/insights'
import { STATE_PILL, dueName, empOf, findReport, isLate, kpiOf, managerOf, monthKey, monthName, ofMonth, prevMonth, readable, reportTodo, seesAll, stateOf, total, writers, type RowState } from '../../lib/reports'
import { collator, dateDots, short, today } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Seg } from '../../ui/Seg'
import { Avatar, Empty } from '../../ui/bits'
import { ActAs, useActor } from '../docs/Contracts'
import { InsightsNav } from '../Insights'

/** The month whose reports are written now */
export const thisMonth = () => monthKey(new Date())

/** How many reports wait for the person in the current ХХК: theirs to write or fix, and the ones to score (the menu shows it) */
export function useReportTodo() {
  const s = useApp()
  return reportTodo(s, s.company, useActor(), thisMonth()).length
}

/** Demo: the people of the ХХК's report chain to work as, managers first */
export function reportActors(s: State) {
  const w = writers(s, s.company, thisMonth())
  return [...new Set<Id>([s.me, ...w.map(p => managerOf(s, s.company, p)!), ...w])]
}

export const href = (person: Id, month: string) => `#insights-report-${person}-${month}`

export default function Reports() {
  const s = useApp()
  const who = useActor()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const cur = thisMonth()
  const months = [cur, prevMonth(cur), prevMonth(cur, 2)]
  const [month, setMonth] = useState(cur)
  const all = seesAll(s, s.company, who)
  const team = readable(s, s.company, who, month).filter(p => p !== who)
  const todo = reportTodo(s, s.company, who, cur)
  const rules = kpiOf(s, s.company)
  // A manager or the director looks at people in one month; anyone else at their own months
  const byPeople = all || team.length > 0
  const rows = byPeople ? sortPeople(s, team).map(p => ({ person: p, month })) : writers(s, s.company, cur).includes(who) ? months.map(m => ({ person: who, month: m })) : []
  const reps = rows.map(x => ({ ...x, r: findReport(s, s.company, x.person, x.month) }))
  const sent = reps.filter(x => x.r && x.r.status !== 'draft').length
  const scored = reps.filter(x => x.r?.status === 'scored')
  const late = reps.filter(x => stateOf(x.r, x.month) === 'overdue' || (x.r && isLate(x.r))).length
  const avg = scored.length ? Math.round(scored.reduce((n, x) => n + total(x.r!.scores!), 0) / scored.length) : 0

  const exportCsv = () => {
    const head = ['Код', 'Ажилтан', 'Хэлтэс', 'Албан тушаал', 'Шууд удирдлага', 'Төлөв', 'Илгээсэн огноо', 'Хоцорч илгээсэн', ...rules.criteria.map(c => `${c.name} (${c.weight}%)`), 'Оноо', 'Үнэлгээ', 'Урамшуулал, %', 'Санал, зөвлөмж']
    downloadCsv(`sariin-tailan-${month}-${today()}.csv`, [head, ...reps.map(({ person, r }) => {
      const e = empOf(s, s.company, person)
      const m = s.people.find(p => p.id === (r?.manager ?? managerOf(s, s.company, person)))
      return [
        e?.code ?? '', name(s, person), s.departments.find(d => d.id === e?.dept)?.name ?? '', s.positions.find(x => x.id === e?.position)?.name ?? '', m ? short(m) : '',
        STATE_PILL[stateOf(r, month)], r?.sent ? dateDots(new Date(r.sent)) : '', r && isLate(r) ? 'Тийм' : '',
        ...rules.criteria.map(c => r?.scores?.find(x => x.id === c.id)?.points ?? ''),
        r?.scores ? total(r.scores) : '', r?.band?.name ?? '', r?.band?.bonus ?? '', r?.comment ?? '',
      ]
    })])
  }

  return (
    <div ref={ref}>
      <InsightsNav at="reports" />
      <PageHead
        title="Сарын тайлан"
        sub={`Ажилтан бүр сарын сүүлийн өдөр тайлангаа илгээж, шууд удирдлага нь KPI шалгуураар үнэлнэ. Энэ сарын эцсийн хугацаа: ${dueName(cur)}.`}
        stats={byPeople && rows.length > 0 ? [
          { label: 'Илгээсэн', value: sent, unit: `/ ${rows.length}` },
          { label: 'Үнэлсэн', value: scored.length },
          { label: 'Хугацаа хэтэрсэн', value: late, alert: late > 0 },
          { label: 'Дундаж оноо', value: avg || '—' },
        ] : undefined}
        actions={byPeople && rows.length > 0 && <button type="button" className="btn btn--glass" onClick={exportCsv}><Download className="ico" />Excel-ээр татах</button>}
      />
      <ActAs ids={reportActors(s)} />
      {todo.length > 0 && (
        <section className="card glass ctlist rtodo" aria-labelledby="rtodo-h" data-enter>
          <h2 className="rtodo__h" id="rtodo-h">Миний хийх</h2>
          <ul>
            {todo.map(t => {
              const p = s.people.find(x => x.id === t.person)
              const mine = t.person === who
              const r = findReport(s, s.company, t.person, t.month)
              return (
                <li key={t.person + t.month}>
                  <a className="ctrow ctrow--report" href={href(t.person, t.month)} onClick={e => { e.preventDefault(); go('insights', `report-${t.person}-${t.month}`) }}>
                    {mine || !p ? <span className="ctrow__ico" aria-hidden="true"><PenLine className="ico" /></span> : <Avatar person={p} size="md" />}
                    <span className="ctrow__text">
                      <b>{mine ? `Таны ${ofMonth(t.month)} тайлан` : `${p ? short(p) : ''}, ${ofMonth(t.month)} тайлан`}</b>
                      <small>{mine ? (r?.status === 'returned' ? `Буцаасан шалтгаан: ${r.reason}` : `Хугацаа: ${dueName(t.month)}`) : `${p?.role ?? ''}, ${r?.sent ? `илгээсэн ${dateDots(new Date(r.sent))}` : ''}`}</small>
                    </span>
                    <span className={`ctrow__todo${t.what === 'Хугацаа хэтэрсэн' ? ' is-late' : ''}`}>{t.what}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <section className="card glass etable-card rtable" aria-labelledby="rt-h" data-enter>
        <div className="card__head">
          <div>
            <h2 className="card__title" id="rt-h">{all ? 'Ажилтнуудын тайлан' : byPeople ? 'Багийн тайлан' : 'Миний тайлан'}</h2>
            <p className="card__sub">{byPeople ? `${monthName(month)}, ${rows.length} ажилтан` : 'Сүүлийн 3 сар'}</p>
          </div>
          {byPeople && <Seg label="Сар" small value={month} onChange={setMonth} options={months.map(m => ({ value: m, label: monthName(m) }))} />}
        </div>
        {rows.length === 0 ? (
          <Empty icon={<ClipboardList className="ico" />} title="Тайлан алга" text="Танд илгээх болон үнэлэх тайлан алга." />
        ) : (
          <div className="etable-wrap">
            <table className="etable">
              <caption className="sr-only">{byPeople ? `${ofMonth(month)} тайлан, ажилтан бүрээр` : 'Миний тайлан, сар бүрээр'}. Мөр дээр дарж тайланг нээнэ.</caption>
              <thead>
                <tr>
                  <th scope="col">{byPeople ? 'Ажилтан' : 'Сар'}</th>
                  {byPeople && <th scope="col" className="hide-md">Хэлтэс</th>}
                  {all && <th scope="col" className="hide-md">Шууд удирдлага</th>}
                  <th scope="col">Төлөв</th>
                  <th scope="col" className="num hide-sm">Илгээсэн огноо</th>
                  <th scope="col" className="num">Оноо</th>
                  <th scope="col" className="hide-sm">Үнэлгээ</th>
                  {all && <th scope="col" className="num hide-sm">Урамшуулал</th>}
                </tr>
              </thead>
              <tbody>
                {reps.map(({ person, month: m, r }) => <Row key={person + m} person={person} month={m} r={r} byPeople={byPeople} all={all} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Rules rules={rules} edit={all} />
    </div>
  )
}

const name = (s: State, id: Id) => {
  const p = s.people.find(x => x.id === id)
  return p ? `${p.family} ${p.given}` : ''
}

/** By department, then by name */
function sortPeople(s: State, list: Id[]) {
  const dept = (p: Id) => s.departments.find(d => d.id === empOf(s, s.company, p)?.dept)?.name ?? ''
  const given = (p: Id) => s.people.find(x => x.id === p)?.given ?? ''
  return [...list].sort((a, b) => collator.compare(dept(a), dept(b)) || collator.compare(given(a), given(b)))
}

/** A report's state in a word */
export function ReportPill({ st }: { st: RowState }) {
  return <span className={`ctpill rpill--${st}`}>{STATE_PILL[st]}</span>
}

function Row({ person, month, r, byPeople, all }: { person: Id; month: string; r?: MonthReport; byPeople: boolean; all: boolean }) {
  const s = useApp()
  const p = s.people.find(x => x.id === person)
  const e = empOf(s, s.company, person)
  const m = s.people.find(x => x.id === (r?.manager ?? managerOf(s, s.company, person)))
  const st = stateOf(r, month)
  return (
    <tr onClick={ev => { if (!(ev.target as HTMLElement).closest('a')) go('insights', `report-${person}-${month}`) }}>
      <th scope="row">
        {byPeople ? (
          <span className="etable__who">
            {p && <Avatar person={p} size="sm" />}
            <span>
              <a href={href(person, month)}>{p ? short(p) : ''}</a>
              <small>{s.positions.find(x => x.id === e?.position)?.name}</small>
            </span>
          </span>
        ) : <a href={href(person, month)}>{monthName(month)}</a>}
      </th>
      {byPeople && <td className="hide-md">{s.departments.find(d => d.id === e?.dept)?.name}</td>}
      {all && <td className="hide-md">{m ? short(m) : ''}</td>}
      <td><span className="rstate"><ReportPill st={st} />{r && isLate(r) && <span className="rlate">Хоцорч илгээсэн</span>}</span></td>
      <td className="num tnum hide-sm">{r?.sent && r.status !== 'draft' ? dateDots(new Date(r.sent)) : <span className="muted">—</span>}</td>
      <td className="num">{r?.scores ? <b className="rscore-n tnum">{total(r.scores)}</b> : <span className="muted">—</span>}</td>
      <td className="hide-sm">{r?.band?.name ?? <span className="muted">—</span>}</td>
      {all && <td className="num tnum hide-sm">{r?.band ? `${r.band.bonus}%` : <span className="muted">—</span>}</td>}
    </tr>
  )
}

/** The ХХК's criteria and grades, for everyone to see; the director and HR change them */
function Rules({ rules, edit }: { rules: KpiRules; edit: boolean }) {
  const bands = [...rules.bands].sort((a, b) => b.min - a.min)
  return (
    <section className="card glass rrules" aria-labelledby="rrules-h" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="rrules-h">Үнэлгээний журам</h2>
          <p className="card__sub">Шууд удирдлага шалгуур бүрийг 1–5 оноогоор үнэлж, жингийн харьцаагаар 100 оноонд шилжүүлнэ.</p>
        </div>
        {edit && <button type="button" className="btn btn--glass btn--sm" onClick={() => open({ kind: 'kpiRules' })}><SlidersHorizontal className="ico" />Журам өөрчлөх</button>}
      </div>
      <div className="rrules__cols">
        <div>
          <h3 className="rrules__h">Шалгуур</h3>
          <ul className="rcrits">
            {rules.criteria.map(c => (
              <li key={c.id}>
                <span className="rcrits__text"><b>{c.name}</b><small>{c.hint}</small></span>
                <span className="rcrits__w tnum">{c.weight}%</span>
                <span className="rcrits__bar" aria-hidden="true"><i style={{ width: `${c.weight}%` }} /></span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="rrules__h">Урамшуулал</h3>
          <table className="rbands">
            <caption className="sr-only">Оноогоор олгох урамшууллын хувь</caption>
            <thead><tr><th scope="col">Оноо</th><th scope="col">Үнэлгээ</th><th scope="col" className="num">Урамшуулал</th></tr></thead>
            <tbody>
              {bands.map((b, i) => (
                <tr key={b.min}>
                  <td className="tnum">{i === 0 ? `${b.min}–100` : `${b.min}–${bands[i - 1].min - 1}`}</td>
                  <th scope="row">{b.name}</th>
                  <td className="num tnum">{b.bonus}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rrules__note">Урамшууллын хувь нь жишээ. Танай дотоод журмаар тохируулна.</p>
        </div>
      </div>
    </section>
  )
}
