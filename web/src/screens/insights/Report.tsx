// One monthly report. The writer types into it as into a sheet of paper and it saves itself; it starts from the work the
// system knows they finished. Beside it: where it stands, the manager's KPI score, and the month's numbers.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronLeft, FilePen, FileText, ListPlus, Pencil, Plus, Send, SquareCheck, Trash2, Undo2 } from 'lucide-react'
import '../../styles/screens/contracts.css'
import '../../styles/screens/reports.css'
import type { Band, Criterion, Id, MonthReport, ReportLine } from '../../lib/types'
import { actions, useApp } from '../../lib/store'
import { open, toast } from '../../lib/ui'
import { usePageEnter } from '../../lib/motion'
import { cid } from '../../lib/draft'
import { POINTS, bandOf, blankReport, dueName, empOf, factsOf, findReport, fromSystem, isLate, kpiOf, managerOf, nextMonth, ofMonth, prevMonth, seesAll, stateOf, total, writers } from '../../lib/reports'
import { ago, monthTitle, parse, short } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { ActAs, useActor } from '../docs/Contracts'
import { Grow } from '../docs/Contract'
import { InsightsNav } from '../Insights'
import { ReportPill, reportActors } from './Reports'

type Text = Pick<MonthReport, 'done' | 'issues' | 'plan'>
type Errs = { done?: string; plan?: string }

export default function ReportPage({ id }: { id: string }) {
  const s = useApp()
  const who = useActor()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const cut = id.indexOf('-')
  const person = id.slice(0, cut)
  const month = id.slice(cut + 1)
  const p = s.people.find(x => x.id === person)
  const r = findReport(s, s.company, person, month)
  const manager = r?.manager ?? managerOf(s, s.company, person)
  const allowed = who === person || who === manager || seesAll(s, s.company, who)
  if (!p || !/^\d{4}-\d\d$/.test(month) || !allowed) {
    return (
      <div ref={ref}>
        <InsightsNav at="reports" />
        <PageHead title={p ? 'Энэ тайланг харах эрхгүй байна' : 'Тайлан олдсонгүй'} sub={p ? 'Зөвхөн өөрийн болон өөрийн үнэлэх тайланг харах боломжтой.' : undefined}
          actions={<a className="btn btn--glass" href="#insights-reports">Бүх тайлан</a>} />
        <ActAs ids={reportActors(s)} />
      </div>
    )
  }
  const e = empOf(s, s.company, person)
  const position = s.positions.find(x => x.id === e?.position)?.name
  const writing = who === person && (!r || r.status === 'draft' || r.status === 'returned') && writers(s, s.company, month).includes(person)
  return (
    <div ref={ref} className="ctpage">
      <InsightsNav at="reports" />
      <a className="dback" href="#insights-reports" data-enter><ChevronLeft className="ico" />Сарын тайлан</a>
      <PageHead title={`${ofMonth(month)} тайлан`} sub={`${short(p)}${position ? `, ${position}` : ''}`}
        actions={r && <button type="button" className="btn btn--glass" onClick={() => open({ kind: 'reportPdf', id: r.id })}><FileText className="ico" />PDF-ээр харах</button>} />
      <ActAs ids={reportActors(s)} />
      <Body key={`${who}-${writing}`} person={person} month={month} r={r} who={who} writing={writing} position={position} />
    </div>
  )
}

/** The paper and the side; while the writer writes, their text lives here and is saved a moment after each change */
function Body({ person, month, r, who, writing, position }: { person: Id; month: string; r?: MonthReport; who: Id; writing: boolean; position?: string }) {
  const s = useApp()
  const company = s.company
  const [text, setText] = useState<Text>(() => (r ? { done: r.done, issues: r.issues, plan: r.plan } : blankReport(s, company, person, month)))
  const [saved, setSaved] = useState<'' | 'saving' | 'saved'>('')
  const [errors, setErrors] = useState<Errs>({})
  const timer = useRef(0)
  const latest = useRef(text)
  const save = () => {
    window.clearTimeout(timer.current)
    timer.current = 0
    actions.saveReport(company, person, month, latest.current)
    setSaved('saved')
  }
  // Leaving saves what is waiting
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) save() }, [])
  const change = (next: Text) => {
    latest.current = next
    setText(next)
    setSaved('saving')
    if (errors.done && next.done.some(l => l.text.trim())) setErrors(x => ({ ...x, done: undefined }))
    if (errors.plan && next.plan.some(l => l.text.trim())) setErrors(x => ({ ...x, plan: undefined }))
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(save, 600)
  }
  const send = () => {
    const clean = { done: text.done.filter(l => l.text.trim()), issues: text.issues.trim(), plan: text.plan.filter(l => l.text.trim()) }
    const errs: Errs = { done: clean.done.length ? undefined : 'Хийсэн ажлаа бичнэ үү.', plan: clean.plan.length ? undefined : 'Дараа сарын төлөвлөгөөгөө бичнэ үү.' }
    if (errs.done || errs.plan) {
      setErrors(errs)
      document.querySelector<HTMLElement>(errs.done ? '#rp-done' : '#rp-plan')?.focus()
      return
    }
    latest.current = clean
    save()
    if (actions.sendReport(company, person, month, who)) toast('Тайлан илгээгдлээ.')
  }
  const shown = writing ? text : r
  return (
    <div className="ctgrid" data-enter>
      <div className="rmain">
        <article className="paper rpaper" aria-label="Тайлангийн текст">
          <header className="paper__head">
            <span className="paper__co">{s.companies.find(c => c.id === company)?.name}</span>
            <span className="paper__no">{monthTitle(parse(`${month}-01`))}</span>
            <h2 className="paper__name">Сарын тайлан</h2>
            <p className="paper__kind">{fullName(s.people, person)}{position ? `, ${position}` : ''}</p>
          </header>
          {!shown ? <p className="paper__lock">Тайлан бөглөөгүй байна.</p> : (
            <ol className="paper__clauses rparts">
              <li>
                <h3 id="rp-done" tabIndex={-1}>1. Хийсэн ажил</h3>
                {writing
                  ? <Lines name="Хийсэн ажил" lines={text.done} error={errors.done} onChange={done => change({ ...text, done })}
                    extra={fromSystem(s, company, person, month).filter(x => !text.done.some(l => (x.task && l.task === x.task) || (x.contract && l.contract === x.contract)))} />
                  : <Read lines={shown.done} />}
              </li>
              <li>
                <h3>2. Асуудал, санал</h3>
                {writing
                  ? <Grow value={text.issues} label="Асуудал, санал" placeholder="Ажилд тулгарсан асуудал, сайжруулах санал" onChange={issues => change({ ...text, issues })} />
                  : <p>{shown.issues || 'Бичээгүй байна.'}</p>}
              </li>
              <li>
                <h3 id="rp-plan" tabIndex={-1}>3. Дараа сарын төлөвлөгөө</h3>
                {writing ? <Lines name="Дараа сарын төлөвлөгөө" lines={text.plan} error={errors.plan} onChange={plan => change({ ...text, plan })} /> : <Read lines={shown.plan} plan />}
              </li>
            </ol>
          )}
          {writing && (
            <div className="paper__foot">
              <span className="paper__saved" role="status">{saved === 'saving' ? 'Хадгалж байна…' : saved === 'saved' ? 'Хадгалагдсан' : 'Өөрчлөлт автоматаар хадгалагдана.'}</span>
            </div>
          )}
        </article>
        {r && (r.status === 'sent' || r.status === 'scored') && <Score key={r.id} r={r} who={who} />}
      </div>
      <aside className="ctside">
        <Status person={person} month={month} r={r} who={who} writing={writing} send={send} />
        <Facts person={person} month={month} />
        <LastPlan person={person} month={month} />
        {writing && <Criteria list={kpiOf(s, company).criteria} />}
      </aside>
    </div>
  )
}

const fullName = (people: { id: Id; given: string; family: string }[], id: Id) => {
  const p = people.find(x => x.id === id)
  return p ? `${p.family} ${p.given}` : ''
}
const shortName = (people: { id: Id; given: string; family: string }[], id?: Id) => {
  const p = people.find(x => x.id === id)
  return p ? short(p) : ''
}

/** Where a line came from (a finished task, a contract), or the task a plan line became */
function Source({ l, plan }: { l: ReportLine; plan?: boolean }) {
  const s = useApp()
  if (l.task && s.tasks.some(t => t.id === l.task)) {
    return <button type="button" className="rsrc" onClick={() => open({ kind: 'task', id: l.task! })}><SquareCheck className="ico" />{plan ? 'Ажил болгосон' : 'Ажил'}</button>
  }
  if (l.contract && s.contracts.some(c => c.id === l.contract)) return <a className="rsrc" href={`#docs-contract-${l.contract}`}><FilePen className="ico" />Гэрээ</a>
  return null
}

function Read({ lines, plan }: { lines: ReportLine[]; plan?: boolean }) {
  if (!lines.length) return <p>Бичээгүй байна.</p>
  return <ul className="rlines">{lines.map(l => <li key={l.id}><span className="rlines__text">{l.text}</span><Source l={l} plan={plan} /></li>)}</ul>
}

/** Lines to type into: Enter starts the next line, Backspace on an empty one takes it away */
function Lines({ name, lines, error, onChange, extra = [] }: { name: string; lines: ReportLine[]; error?: string; onChange: (l: ReportLine[]) => void; extra?: ReportLine[] }) {
  const focus = useRef<Id | null>(null)
  useEffect(() => {
    if (!focus.current) return
    document.querySelector<HTMLTextAreaElement>(`[data-line="${focus.current}"]`)?.focus()
    focus.current = null
  })
  const add = (at = lines.length) => {
    const l = { id: cid(), text: '' }
    focus.current = l.id
    onChange([...lines.slice(0, at), l, ...lines.slice(at)])
  }
  const drop = (id: Id, i: number) => {
    focus.current = lines[i - 1]?.id ?? lines[i + 1]?.id ?? null
    onChange(lines.filter(x => x.id !== id))
  }
  const keys = (l: ReportLine, i: number) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      add(i + 1)
    } else if (e.key === 'Backspace' && !l.text && lines.length > 1) {
      e.preventDefault()
      drop(l.id, i)
    }
  }
  return (
    <>
      {lines.length > 0 && (
        <ul className="rlines is-edit">
          {lines.map((l, i) => (
            <li key={l.id}>
              <Grow data-line={l.id} className="paper__body rlines__text" value={l.text} label={`${name}, ${i + 1}-р мөр`} onKeyDown={keys(l, i)}
                onChange={v => onChange(lines.map(x => (x.id === l.id ? { ...x, text: v } : x)))} />
              <Source l={l} />
              <button type="button" className="ibtn ibtn--sm paper__drop" aria-label={`${name}: ${i + 1}-р мөрийг хасах`} title="Мөр хасах" onClick={() => drop(l.id, i)}>
                <Trash2 className="ico" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="field__error rlines__error" role="alert">{error}</p>}
      <div className="rlines__add">
        <button type="button" className="btn btn--glass btn--sm" onClick={() => add()}><Plus className="ico" />Мөр нэмэх</button>
        {extra.length > 0 && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange([...lines.filter(l => l.text.trim()), ...extra])}>
            <ListPlus className="ico" />Системээс {extra.length} ажил нэмэх
          </button>
        )}
      </div>
    </>
  )
}

/** Where the report is: written, scored by the manager, scored; then what the person can do, or who it waits for */
function Status({ person, month, r, who, writing, send }: { person: Id; month: string; r?: MonthReport; who: Id; writing: boolean; send: () => void }) {
  const s = useApp()
  const st = stateOf(r, month)
  const manager = r?.manager ?? managerOf(s, s.company, person)
  const steps = [
    { label: 'Бөглөх', sub: `${shortName(s.people, person)}, хугацаа ${dueName(month)}`, past: st === 'sent' || st === 'scored', now: !r || r.status === 'draft' || r.status === 'returned' },
    { label: 'Үнэлэх', sub: `${shortName(s.people, manager)}, шууд удирдлага`, past: st === 'scored', now: st === 'sent' },
    { label: 'Дууссан', sub: r?.scores && r.band ? `${total(r.scores)} оноо, ${r.band.name.toLowerCase()}` : '', past: st === 'scored', now: false },
  ]
  const wait = st === 'sent' ? `${shortName(s.people, manager)} үнэлэхийг хүлээж байна.`
    : st === 'returned' ? `${shortName(s.people, person)} засаж байна.`
      : st === 'scored' ? '' : `${shortName(s.people, person)} тайлангаа илгээгээгүй байна.`
  return (
    <section className="card glass ctstate" aria-labelledby="rstate-h">
      <div className="ctstate__top">
        <h2 id="rstate-h">Явц</h2>
        <span className="rstate">{r && isLate(r) && <span className="rlate">Хоцорч илгээсэн</span>}<ReportPill st={st} /></span>
      </div>
      {r?.status === 'returned' && (
        <div className="ctback" role="note">
          <Undo2 className="ico" />
          <p><b>{shortName(s.people, r.manager)} буцаасан:</b> {r.reason}</p>
        </div>
      )}
      <ol className="ctsteps">
        {steps.map(x => (
          <li key={x.label} className={x.past ? 'is-past' : x.now ? 'is-now' : ''}>
            <span className="ctsteps__dot" aria-hidden="true">{x.past && <Check className="ico" />}</span>
            <span className="ctsteps__text"><b>{x.label}</b>{x.sub && <small>{x.sub}</small>}</span>
          </li>
        ))}
      </ol>
      {writing ? (
        <div className="ctact">
          <button type="button" className="btn btn--accent" onClick={send}><Send className="ico" />{r?.status === 'returned' ? 'Засаад илгээх' : 'Удирдлагад илгээх'}</button>
          <p className="ctact__hint">{shortName(s.people, manager)} үнэлнэ. Илгээсэн тайланг зөвхөн буцаагдсан үед засна.</p>
        </div>
      ) : wait && !(st === 'sent' && r?.manager === who) && <div className="ctact"><p className="ctact__wait">{wait}</p></div>}
    </section>
  )
}

/** The score as a number out of 100 and where it falls among the grades */
function Total({ score, bands, got }: { score: number | null; bands: Band[]; got?: Band }) {
  const band = got ?? (score === null ? null : bandOf(bands, score))
  const up = [...bands].sort((a, b) => a.min - b.min)
  return (
    <div className="rtotal">
      <p className="rtotal__top">
        <span className="rtotal__n tnum">{score ?? '—'}</span><span className="rtotal__of">/ 100</span>
        {band && <span className="rtotal__band"><b>{band.name}</b>, урамшуулал {band.bonus}%</span>}
      </p>
      <div className="rbar" aria-hidden="true">
        {up.map((b, i) => (
          <span key={b.min} className={b.min === band?.min ? 'is-on' : undefined} style={{ flexGrow: (up[i + 1]?.min ?? 101) - b.min }} />
        ))}
        {score !== null && <i className="rbar__mark" style={{ left: `${score}%` }} />}
      </div>
      <div className="rbar__ticks tnum" aria-hidden="true">{up.slice(1).map(b => <span key={b.min} style={{ left: `${b.min}%` }}>{b.min}</span>)}</div>
    </div>
  )
}

/** The manager scores here (1 to 5 on each criterion); everyone else sees the score */
function Score({ r, who }: { r: MonthReport; who: Id }) {
  const s = useApp()
  const rules = kpiOf(s, r.company)
  const mine = r.manager === who
  const [edit, setEdit] = useState(mine && r.status === 'sent')
  const criteria: Criterion[] = r.scores ?? rules.criteria
  const [points, setPoints] = useState<Record<Id, number>>(() => Object.fromEntries((r.scores ?? []).map(c => [c.id, c.points])))
  const [comment, setComment] = useState(r.comment ?? '')
  const [tasks, setTasks] = useState(true)
  const [error, setError] = useState('')
  const open1 = r.plan.filter(l => !l.task).length
  const sum = criteria.every(c => points[c.id]) ? total(criteria.map(c => ({ weight: c.weight, points: points[c.id] }))) : null
  if (!edit) {
    if (r.status !== 'scored' || !r.scores) return null
    return (
      <section className="card glass rscore" aria-labelledby="rscore-h">
        <div className="ctstate__top">
          <h2 className="card__title" id="rscore-h">Үнэлгээ</h2>
          {mine && <button type="button" className="btn btn--glass btn--sm" onClick={() => setEdit(true)}><Pencil className="ico" />Засах</button>}
        </div>
        <div className="rscore__got">
          <Total score={total(r.scores)} bands={rules.bands} got={r.band} />
          <ul className="rgot">
            {r.scores.map(c => (
              <li key={c.id}>
                <span className="rgot__name">{c.name} <small className="tnum">{c.weight}%</small></span>
                <span className="rgot__pts" aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= c.points ? 'is-on' : undefined} />)}</span>
                <span className="rgot__n tnum">{c.points}<span className="sr-only"> оноо, {POINTS[c.points - 1]}</span></span>
              </li>
            ))}
          </ul>
        </div>
        {r.comment && <q className="rscore__note">{r.comment}</q>}
        <p className="rscore__by">{shortName(s.people, r.manager)} үнэлсэн, {r.scored ? ago(r.scored).toLowerCase() : ''}</p>
      </section>
    )
  }
  const submit = () => {
    const miss = criteria.find(c => !points[c.id])
    if (miss) {
      setError('Бүх шалгуурыг үнэлнэ үү.')
      document.querySelector<HTMLInputElement>(`input[name="rc-${miss.id}"]`)?.focus()
      return
    }
    if (actions.scoreReport(r.id, who, points, comment.trim(), tasks)) {
      toast(r.status === 'scored' ? 'Үнэлгээ хадгалагдлаа.' : 'Тайлан үнэлэгдлээ.')
      setEdit(false)
    }
  }
  return (
    <section className="card glass rscore" aria-labelledby="rscore-h">
      <div className="ctstate__top">
        <h2 className="card__title" id="rscore-h">Үнэлгээ</h2>
        <small className="rscore__scale">1 нь хангалтгүй, 5 нь маш сайн</small>
      </div>
      {criteria.map(c => (
        <fieldset key={c.id} className="rcrit">
          <legend><b>{c.name}</b> <span className="tnum">{c.weight}%</span></legend>
          <p className="rcrit__hint">{c.hint}</p>
          <div className="rscale">
            {[1, 2, 3, 4, 5].map(n => (
              <label key={n} className="rscale__opt" title={POINTS[n - 1]}>
                <input type="radio" name={`rc-${c.id}`} checked={points[c.id] === n} onChange={() => { setPoints({ ...points, [c.id]: n }); setError('') }} />
                <span className="tnum">{n}</span><span className="sr-only">, {POINTS[n - 1]}</span>
              </label>
            ))}
            <span className="rscale__word" aria-hidden="true">{points[c.id] ? POINTS[points[c.id] - 1] : ''}</span>
          </div>
        </fieldset>
      ))}
      <div className="rscore__got">
        <Total score={sum} bands={rules.bands} />
        <div className="rscore__more">
          <div className="field">
            <label className="field__label" htmlFor="rs-note">Санал, зөвлөмж (заавал биш)</label>
            <textarea id="rs-note" rows={2} value={comment} onChange={e => setComment(e.target.value)} />
          </div>
          {open1 > 0 && (
            <label className="rscore__tasks">
              <input type="checkbox" className="check" checked={tasks} onChange={e => setTasks(e.target.checked)} />
              <span><b>Төлөвлөгөөг ажил болгон бүртгэх</b><small>{open1} мөр ажил болж, {shortName(s.people, r.person)} хариуцна. Хугацаа: {dueName(nextMonth(r.month))}.</small></span>
            </label>
          )}
        </div>
      </div>
      {error && <p className="field__error" role="alert">{error}</p>}
      <div className="ctact__row rscore__btns">
        <button type="button" className="btn btn--accent" onClick={submit}><Check className="ico" />{r.status === 'scored' ? 'Хадгалах' : 'Үнэлэх'}</button>
        {r.status === 'sent'
          ? <button type="button" className="btn btn--glass" onClick={() => open({ kind: 'reportReturn', id: r.id })}><Undo2 className="ico" />Буцаах</button>
          : <button type="button" className="btn btn--glass" onClick={() => setEdit(false)}>Болих</button>}
      </div>
    </section>
  )
}

/** The month's numbers from the system, for the manager to weigh the words against */
function Facts({ person, month }: { person: Id; month: string }) {
  const s = useApp()
  const f = factsOf(s, s.company, person, month)
  if (!f.done && !f.meetings) return null
  return (
    <section className="card glass rfacts" aria-labelledby="rfacts-h">
      <h2 id="rfacts-h">Системд бүртгэгдсэн</h2>
      <dl>
        <div><dt>Дууссан ажил</dt><dd className="tnum">{f.done}</dd></div>
        {f.done > 0 && <div><dt>Үүнээс хугацаандаа</dt><dd className="tnum">{f.onTime}</dd></div>}
        <div><dt>Уулзалт</dt><dd className="tnum">{f.meetings}</dd></div>
      </dl>
    </section>
  )
}

/** Last month's plan, to set beside this month's work */
function LastPlan({ person, month }: { person: Id; month: string }) {
  const s = useApp()
  const prev = findReport(s, s.company, person, prevMonth(month))
  if (!prev?.plan.length) return null
  return (
    <section className="card glass rprev" aria-labelledby="rprev-h">
      <h2 id="rprev-h">{ofMonth(prev.month)} төлөвлөгөө</h2>
      <ul>{prev.plan.map(l => <li key={l.id}>{l.text}<Source l={l} plan /></li>)}</ul>
    </section>
  )
}

/** What the report is scored on, for the writer to know before sending */
function Criteria({ list }: { list: Criterion[] }) {
  return (
    <section className="card glass rprev" aria-labelledby="rcrit-h">
      <h2 id="rcrit-h">Үнэлэх шалгуур</h2>
      <ul className="rcrits rcrits--small">
        {list.map(c => (
          <li key={c.id}>
            <span className="rcrits__text"><b>{c.name}</b><small>{c.hint}</small></span>
            <span className="rcrits__w tnum">{c.weight}%</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

