// One contract. In the middle, its text: one document everyone in the process works in, instead of files passed around
// (the user's wish, 2026-10-29). Each person's edits are kept as their version, and any version shows what it changed.
// Beside it: where the contract is, what the person can do now, its versions and its history.
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { Check, ChevronLeft, FileText, MessageSquareQuote, Plus, Send, Stamp, Trash2, Truck, Undo2, X } from 'lucide-react'
import '../../styles/screens/contracts.css'
import type { Clause, Contract, ContractEvent, Id, ProcessRole } from '../../lib/types'
import { actions, useApp } from '../../lib/store'
import { open, toast } from '../../lib/ui'
import { usePageEnter } from '../../lib/motion'
import { CONTRACT_KIND, FLOW, REVIEW, REVIEW_PART, STAGE, canEdit, deciders, diffClauses, rolesOf, type Piece } from '../../lib/contracts'
import { cid } from '../../lib/draft'
import { ago, dateDots, num, parse, short } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Avatar, NoAccess } from '../../ui/bits'
import { accessOf, docView } from '../../lib/access'
import { DocsNav } from '../Docs'
import { ActAs, StagePill, useActor } from './Contracts'

export default function ContractPage({ id }: { id: string }) {
  const s = useApp()
  const who = useActor()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  /** A version picked to see what it changed */
  const [view, setView] = useState<Id | null>(null)
  const c = s.contracts.find(x => x.id === id)
  if (!c) {
    return (
      <div ref={ref}>
        <DocsNav at="contracts" />
        <PageHead title="Гэрээ олдсонгүй" sub="Устгагдсан байж магадгүй." actions={<a className="btn btn--glass" href="#docs-contracts">Бүх гэрээ</a>} />
      </div>
    )
  }
  if (!docView(s).contract(c)) {
    return (
      <div ref={ref}>
        <DocsNav at="contracts" />
        <NoAccess text="Та зөвхөн өөрийн оролцсон гэрээг харах эрхтэй." />
      </div>
    )
  }
  const roles = rolesOf(s, c.company)
  return (
    <div ref={ref} className="ctpage">
      <DocsNav at="contracts" />
      <a className="dback" href="#docs-contracts" data-enter><ChevronLeft className="ico" />Бүх гэрээ</a>
      <PageHead
        title={c.title}
        sub={`${CONTRACT_KIND[c.kind]}, ${c.party}${c.amount ? `, ${num(c.amount)} ₮` : ''}`}
        actions={<button type="button" className="btn btn--glass" onClick={() => open({ kind: 'contractPdf', id: c.id })}><FileText className="ico" />PDF-ээр харах</button>}
      />
      {accessOf(s, s.me, c.company).admin && <ActAs />}
      <div className="ctgrid" data-enter>
        <Paper c={c} editable={!view && canEdit(c, roles, who)} who={who} view={view} close={() => setView(null)} />
        <aside className="ctside">
          <Status c={c} who={who} />
          <Versions c={c} view={view} setView={setView} />
          <Log c={c} who={who} />
        </aside>
      </div>
    </div>
  )
}

const name = (people: { id: Id; given: string; family: string }[], id: Id) => {
  const p = people.find(x => x.id === id)
  return p ? short(p) : 'Устгагдсан ажилтан'
}

/** The contract as a sheet of paper; the people working on it now type straight into it */
function Paper({ c, editable, who, view, close }: { c: Contract; editable: boolean; who: Id; view: Id | null; close: () => void }) {
  const s = useApp()
  const company = s.companies.find(x => x.id === c.company)
  const lock = c.stage === 'draft' ? 'Хариуцсан ажилтан засна.'
    : c.stage === 'review' ? 'Санхүүгийн захирал, хуульч хянаж байхдаа засна.'
      : c.stage === 'canceled' ? 'Цуцалсан гэрээ.'
        : 'Хянаж дууссан тул текст өөрчлөгдөхгүй.'
  return (
    <article className="paper" aria-label="Гэрээний текст">
      <header className="paper__head">
        <span className="paper__co">{company?.name}</span>
        <span className="paper__no tnum">№ {c.number ?? '________'}{c.regDate ? `, ${dateDots(parse(c.regDate))}` : ''}</span>
        <h2 className="paper__name">{c.title}</h2>
        <p className="paper__kind">{CONTRACT_KIND[c.kind]}. Талууд: {company?.name}, {c.party}</p>
      </header>
      {view ? <Changes c={c} view={view} close={close} />
        : editable ? <Editor key={who} c={c} who={who} />
          : (
            <>
              <ol className="paper__clauses">
                {c.clauses.map((cl, i) => (
                  <li key={cl.id}>
                    <h3>{i + 1}. {cl.title}</h3>
                    <p>{cl.body}</p>
                  </li>
                ))}
              </ol>
              <p className="paper__lock">{lock}</p>
            </>
          )}
    </article>
  )
}

/** A body of text that grows with what is in it */
export function Grow({ value, label, onChange, className = 'paper__body', ...rest }: { value: string; label: string; onChange: (v: string) => void; className?: string } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return <textarea ref={ref} rows={1} className={className} value={value} aria-label={label} onChange={e => onChange(e.target.value)} {...rest} />
}

/** The text, saved a moment after each change; a person's edits stay one version until the next step of the process */
function Editor({ c, who }: { c: Contract; who: Id }) {
  const [clauses, setClauses] = useState(c.clauses)
  const [state, setState] = useState<'' | 'saving' | 'saved'>('')
  const timer = useRef(0)
  const latest = useRef(clauses)
  const added = useRef<Id | null>(null)
  const save = () => {
    window.clearTimeout(timer.current)
    timer.current = 0
    actions.editContract(c.id, who, latest.current)
    setState('saved')
  }
  // A change from elsewhere comes in while nothing is waiting to be saved
  useEffect(() => { if (!timer.current) setClauses(c.clauses) }, [c.clauses])
  // Leaving saves what is waiting
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) save() }, [])
  // A new clause gets the cursor in its heading
  useEffect(() => {
    if (!added.current) return
    document.querySelector<HTMLInputElement>(`[data-clause="${added.current}"] input`)?.select()
    added.current = null
  })
  const change = (next: Clause[]) => {
    latest.current = next
    setClauses(next)
    setState('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(save, 600)
  }
  const patch = (id: Id, p: Partial<Clause>) => change(clauses.map(x => (x.id === id ? { ...x, ...p } : x)))
  const add = () => {
    const id = cid()
    added.current = id
    change([...clauses, { id, title: 'Шинэ заалт', body: '' }])
  }

  return (
    <>
      <ol className="paper__clauses is-edit">
        {clauses.map((cl, i) => (
          <li key={cl.id} data-clause={cl.id}>
            <div className="paper__h">
              <span className="paper__n tnum" aria-hidden="true">{i + 1}.</span>
              <input className="paper__title" value={cl.title} aria-label={`${i + 1}-р заалтын гарчиг`} onChange={e => patch(cl.id, { title: e.target.value })} />
              <button type="button" className="ibtn ibtn--sm paper__drop" aria-label={`${i + 1}-р заалтыг хасах`} title="Заалт хасах"
                onClick={() => change(clauses.filter(x => x.id !== cl.id))}>
                <Trash2 className="ico" />
              </button>
            </div>
            <Grow value={cl.body} label={`${i + 1}-р заалт`} onChange={v => patch(cl.id, { body: v })} />
          </li>
        ))}
      </ol>
      <div className="paper__foot">
        <button type="button" className="btn btn--glass btn--sm" onClick={add}><Plus className="ico" />Заалт нэмэх</button>
        <span className="paper__saved" role="status">{state === 'saving' ? 'Хадгалж байна…' : state === 'saved' ? 'Хадгалагдсан' : 'Өөрчлөлт автоматаар хадгалагдана.'}</span>
      </div>
    </>
  )
}

const Pieces = ({ p }: { p: Piece[] }) => <>{p.map((x, i) => (x.k === 1 ? <ins key={i}>{x.t}</ins> : x.k === -1 ? <del key={i}>{x.t}</del> : <Fragment key={i}>{x.t}</Fragment>))}</>

/** A version's text with what it changed from the one before: added words in green, taken out ones struck through in red */
function Changes({ c, view, close }: { c: Contract; view: Id; close: () => void }) {
  const s = useApp()
  const i = c.versions.findIndex(v => v.id === view)
  const v = c.versions[i]
  if (!v) return null
  const before = c.versions[i - 1]
  const parts = before ? diffClauses(before.clauses, v.clauses) : v.clauses.map(cl => ({ id: cl.id, title: [{ t: cl.title, k: 0 as const }], body: [{ t: cl.body, k: 0 as const }], k: 0 as const }))
  const changed = parts.some(p => p.k !== 0 || p.title.some(x => x.k) || p.body.some(x => x.k))
  let n = 0
  return (
    <>
      <div className="paper__diff" role="status">
        <p>
          <b>{i + 1}-р хувилбар, {name(s.people, v.by)}</b>, {ago(v.at)}.{' '}
          {!before ? 'Эхний ноорог.' : changed ? <>Өмнөхөөс <ins>нэмсэн</ins>, <del>хассан</del> нь тэмдэглэгдсэн.</> : 'Өмнөхөөс өөрчлөлт алга.'}
        </p>
        <button type="button" className="btn btn--glass btn--sm" onClick={close}><X className="ico" />Одоогийн текст</button>
      </div>
      <ol className="paper__clauses is-diff">
        {parts.map(p => (
          <li key={p.id} className={p.k === 1 ? 'is-new' : p.k === -1 ? 'is-gone' : undefined}>
            <h3>{p.k === -1 ? '' : `${++n}. `}<Pieces p={p.title} /></h3>
            <p><Pieces p={p.body} /></p>
          </li>
        ))}
      </ol>
    </>
  )
}

const DONE_MSG = { send: 'Гэрээ илгээгдлээ.', deliver: 'Гэрээ харилцагчид хүргэгдлээ.' } as const
const APPROVE_MSG: Record<string, string> = { review: 'Зөвшөөрлөө.', clerk: 'Захиралд хүргүүллээ.', director: 'Гэрээ батлагдлаа.' }

/** Where the contract is: each stage with its people, then what the person can do now */
function Status({ c, who }: { c: Contract; who: Id }) {
  const s = useApp()
  const roles = rolesOf(s, c.company)
  const at = FLOW.indexOf(c.stage)
  const back = c.stage === 'draft' && c.resume ? [...c.events].reverse().find(e => e.kind === 'return') : undefined
  const mark = (i: number) => (c.stage === 'done' || i < at ? 'is-past' : i === at ? 'is-now' : '')
  const person = (role: ProcessRole) => name(s.people, roles[role])
  return (
    <section className="card glass ctstate" aria-labelledby="ctstate-h">
      <div className="ctstate__top">
        <h2 id="ctstate-h">Явц</h2>
        <StagePill c={c} />
      </div>
      {back && (
        <div className="ctback" role="note">
          <Undo2 className="ico" />
          <p><b>{name(s.people, back.by)} буцаасан:</b> {back.text}</p>
        </div>
      )}
      <ol className={`ctsteps${c.stage === 'canceled' ? ' is-off' : ''}`}>
        {FLOW.map((st, i) => (
          <li key={st} className={mark(i)}>
            <span className="ctsteps__dot" aria-hidden="true">{mark(i) === 'is-past' && <Check className="ico" />}</span>
            <span className="ctsteps__text">
              <b>{STAGE[st].label}</b>
              {st === 'draft' && <small>{name(s.people, c.owner)}, хариуцсан ажилтан</small>}
              {st === 'review' && REVIEW.map(r => (
                <small key={r} className={c.agreed.includes(r) ? 'is-ok' : undefined}>
                  {REVIEW_PART[r as 'finance' | 'legal']}: {person(r)}{c.agreed.includes(r) ? ', зөвшөөрсөн' : c.stage === 'review' ? ', хянаж буй' : ''}
                </small>
              ))}
              {(st === 'clerk' || st === 'register' || st === 'deliver') && <small>{person('clerk')}{st === 'register' && c.number ? `, № ${c.number}` : ''}</small>}
              {st === 'director' && <small>{person('director')}</small>}
            </span>
          </li>
        ))}
      </ol>
      <Actions c={c} who={who} />
    </section>
  )
}

/** What the person acting can do at this stage; to anyone else, who it waits for */
function Actions({ c, who }: { c: Contract; who: Id }) {
  const s = useApp()
  const roles = rolesOf(s, c.company)
  const now = deciders(c, roles)
  if (c.stage === 'done' || c.stage === 'canceled') return null
  const step = (st: 'send' | 'approve' | 'deliver') => {
    const stage = c.stage
    if (actions.contractStep(c.id, who, st)) toast(st === 'approve' ? APPROVE_MSG[stage] : DONE_MSG[st])
  }
  const asked = c.stage === 'draft' && c.asked.some(a => a.to === who && !a.done)
  if (!now.includes(who)) {
    return (
      <div className="ctact">
        {asked && <p className="ctact__ask"><MessageSquareQuote className="ico" />Таны саналыг хүссэн. «Түүх» хэсэгт саналаа бичнэ үү.</p>}
        <p className="ctact__wait">Одоо {now.map(id => name(s.people, id)).join(', ')} дээр байна.</p>
      </div>
    )
  }
  const sendBack = () => open({ kind: 'contractReason', id: c.id, step: 'return' })
  if (c.stage === 'draft') {
    // Fixed after being sent back: it goes straight to whoever sent it back
    const to = c.resume ? deciders({ ...c, stage: c.resume }, roles).map(id => name(s.people, id)) : []
    return (
      <div className="ctact">
        <button type="button" className="btn btn--accent" onClick={() => step('send')}><Send className="ico" />{c.resume ? 'Засаад илгээх' : 'Хянуулахаар илгээх'}</button>
        <p className="ctact__hint">{c.resume ? `${to.join(', ')} руу шууд очно. Өмнө нь зөвшөөрсөн хүн дахин хянахгүй.` : 'Санхүүгийн захирал, хуульч хоёр зэрэг хянана.'}</p>
        <div className="ctact__more">
          <button type="button" className="btn btn--glass btn--sm" onClick={() => open({ kind: 'contractAsk', id: c.id })}><MessageSquareQuote className="ico" />Санал хүсэх</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => open({ kind: 'contractReason', id: c.id, step: 'cancel' })}>Цуцлах</button>
        </div>
      </div>
    )
  }
  if (c.stage === 'register') {
    return (
      <div className="ctact">
        <button type="button" className="btn btn--accent" onClick={() => open({ kind: 'contractRegister', id: c.id })}><Stamp className="ico" />Дугаар олгох</button>
        <p className="ctact__hint">Захирал баталсан. Дугаар олгож, гарын үсэг, тамгатай хувийг хавсаргана.</p>
      </div>
    )
  }
  if (c.stage === 'deliver') {
    return (
      <div className="ctact">
        <button type="button" className="btn btn--accent" onClick={() => step('deliver')}><Truck className="ico" />Харилцагчид хүргүүлэх</button>
      </div>
    )
  }
  const label = c.stage === 'review' ? 'Зөвшөөрөх' : c.stage === 'clerk' ? (c.resume === 'director' ? 'Захиралд дахин хүргүүлэх' : 'Захиралд хүргүүлэх') : 'Батлах'
  return (
    <div className="ctact">
      <div className="ctact__row">
        <button type="button" className="btn btn--accent" onClick={() => step('approve')}><Check className="ico" />{label}</button>
        <button type="button" className="btn btn--glass" onClick={sendBack}><Undo2 className="ico" />Буцаах</button>
      </div>
      {c.stage === 'review' && <p className="ctact__hint">Засах зүйл байвал текстэд шууд засаж болно. Таны засвар тусдаа хувилбар болж хадгалагдана.</p>}
    </div>
  )
}

/** Every version, newest first; one opens to show what it changed */
function Versions({ c, view, setView }: { c: Contract; view: Id | null; setView: (v: Id | null) => void }) {
  const s = useApp()
  const rows = c.versions.map((v, i) => {
    const before = c.versions[i - 1]
    const changed = before ? diffClauses(before.clauses, v.clauses).filter(p => p.k !== 0 || p.title.some(x => x.k) || p.body.some(x => x.k)).length : 0
    return { v, i, changed }
  }).reverse()
  return (
    <section className="card glass ctver" aria-labelledby="ctver-h">
      <h2 id="ctver-h">Хувилбар <span className="tnum">{c.versions.length}</span></h2>
      <ul>
        {rows.map(({ v, i, changed }) => {
          const p = s.people.find(x => x.id === v.by)
          return (
            <li key={v.id}>
              <button type="button" className="ctver__row" aria-pressed={view === v.id} onClick={() => setView(view === v.id ? null : v.id)}>
                {p && <Avatar person={p} size="sm" />}
                <span className="ctver__text">
                  <b>{i + 1}. {name(s.people, v.by)}</b>
                  <small>{i === 0 ? 'Эхний ноорог' : changed ? `${changed} заалт өөрчилсөн` : 'Өөрчлөлт алга'}, {ago(v.at)}</small>
                </span>
                {i === c.versions.length - 1 && <span className="ctver__now">Одоогийнх</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** What a step did, in words after the person's name */
function what(e: ContractEvent, people: { id: Id; given: string; family: string }[]) {
  switch (e.kind) {
    case 'start': return 'ноорог эхлүүлсэн'
    case 'send': return e.to === 'review' ? 'хянуулахаар илгээсэн' : `${STAGE[e.to!].label.toLowerCase()} руу илгээсэн`
    case 'approve': return e.role === 'finance' ? 'зөвшөөрсөн (санхүү)' : e.role === 'legal' ? 'зөвшөөрсөн (хууль)' : e.role === 'clerk' ? 'захиралд хүргүүлсэн' : 'баталсан'
    case 'return': return e.to === 'clerk' ? 'бичиг хэрэгт буцаасан' : 'хариуцсан ажилтанд буцаасан'
    case 'register': return `${e.text} дугаар олгож бүртгэсэн`
    case 'deliver': return 'харилцагчид хүргүүлсэн'
    case 'cancel': return 'цуцалсан'
    case 'ask': return `санал хүссэн: ${(e.people ?? []).map(id => name(people, id)).join(', ')}`
    case 'opinion': return 'санал өгсөн'
    case 'note': return 'тэмдэглэл бичсэн'
  }
}

/** The history: every step and note, oldest first; a note or an opinion can be written here */
function Log({ c, who }: { c: Contract; who: Id }) {
  const s = useApp()
  const [text, setText] = useState('')
  const asked = c.asked.some(a => a.to === who && !a.done)
  const add = () => {
    if (!text.trim()) return
    actions.contractNote(c.id, who, text.trim())
    setText('')
    toast(asked ? 'Санал илгээгдлээ.' : 'Тэмдэглэл нэмэгдлээ.')
  }
  return (
    <section className="card glass ctlog" aria-labelledby="ctlog-h">
      <h2 id="ctlog-h">Түүх</h2>
      <ol>
        {c.events.map(e => {
          const p = s.people.find(x => x.id === e.by)
          const said = e.kind === 'note' || e.kind === 'opinion'
          return (
            <li key={e.id} className={`ctlog__${e.kind}`}>
              {p && <Avatar person={p} size="xs" />}
              <div className="ctlog__main">
                <p><b>{name(s.people, e.by)}</b> {what(e, s.people)} <time className="tnum" dateTime={e.at}>{ago(e.at)}</time></p>
                {e.text && e.kind !== 'register' && <q className={e.kind === 'return' ? 'is-back' : undefined}>{e.text}</q>}
              </div>
              {said && e.by === who && (
                <button type="button" className="ibtn ibtn--sm" aria-label="Тэмдэглэл устгах" title="Тэмдэглэл устгах" onClick={() => actions.dropContractNote(c.id, who, e.id)}><Trash2 className="ico" /></button>
              )}
            </li>
          )
        })}
      </ol>
      <form className="ctlog__form" onSubmit={e => { e.preventDefault(); add() }}>
        <label className="field__label" htmlFor="ctnote">{asked ? 'Таны санал' : 'Тэмдэглэл'}</label>
        <textarea id="ctnote" rows={2} value={text} onChange={e => setText(e.target.value)} placeholder={asked ? 'Саналаа бичнэ үү' : 'Тэмдэглэл бичих'} />
        <button type="submit" className="btn btn--glass btn--sm">{asked ? 'Санал илгээх' : 'Нэмэх'}</button>
      </form>
    </section>
  )
}
