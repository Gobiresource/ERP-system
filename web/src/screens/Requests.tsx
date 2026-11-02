// Хүсэлт: a person's requests and those that came to them (docs/decisions.md, 2026-11-01). Ээлжийн амралт, илүү цаг and
// шинэ ажилтан авах go through their steps (lib/hrRequests.ts); a request for a document goes to the office (lib/docs.ts),
// whose people see every one of the ХХК among those that came. An admin may try each step as someone else, as in Гэрээ.
import { useRef, useState } from 'react'
import { Clock, FileDown, Inbox, Plus, Printer, Send, TreePalm, UserPlus } from 'lucide-react'
import '../styles/screens/docs.css'
import '../styles/screens/contracts.css'
import type { DocRequest, HrRequest, HrRequestKind, Id } from '../lib/types'
import { scoped, useApp } from '../lib/store'
import { open } from '../lib/ui'
import { usePageEnter } from '../lib/motion'
import { isOpen } from '../lib/docs'
import { accessOf, docView } from '../lib/access'
import { HR_KIND, STEPS, actorsOf, doOf, hoursText, involves, mayAct, pillOf, spanMinutes, waitsFor } from '../lib/hrRequests'
import { daysFromToday, dueLabel, parse, short, weekday } from '../lib/format'
import { dots } from '../lib/hr'
import { PageHead } from '../ui/PageHead'
import { Seg } from '../ui/Seg'
import { Avatar, Empty } from '../ui/bits'
import { ReqPill, Steps } from './Docs'
import { ActAs, useActor } from './docs/Contracts'

type Tab = 'mine' | 'in'
type Kind = HrRequestKind | 'doc'

export const KIND_ICON: Record<HrRequestKind, typeof TreePalm> = { leave: TreePalm, overtime: Clock, hire: UserPlus }
export const KIND_HUE = { leave: 'orange', overtime: 'blue', hire: 'green' } as const
const KINDS: { value: Kind | 'all'; label: string }[] = [
  { value: 'all', label: 'Бүгд' }, { value: 'leave', label: 'Ээлжийн амралт' }, { value: 'overtime', label: 'Илүү цаг' },
  { value: 'hire', label: 'Ажилтан авах' }, { value: 'doc', label: 'Бичиг баримт' },
]

/** Requests waiting for the person in the current ХХК: their steps, their own sent back, and the office's new ones */
export function useRequestTodo() {
  const s = useApp()
  const who = useActor()
  const keeps = docView(s).edit(s.company)
  return s.hrRequests.filter(r => r.company === s.company && waitsFor(s, r, who)).length
    + (keeps ? s.requests.filter(r => r.company === s.company && r.status === 'sent').length : 0)
}

/** "2026.11.16–11.20"; "2026.11.07, Бямба, 10:00–14:00"; the position */
export function whatOf(r: HrRequest, positions: { id: Id; name: string }[]) {
  if (r.kind === 'leave') return `${dots(r.from)}–${r.to.slice(0, 4) === r.from.slice(0, 4) ? dots(r.to).slice(5) : dots(r.to)}`
  if (r.kind === 'overtime') return `${dots(r.date)}, ${weekday(parse(r.date))}, ${r.start}–${r.end}`
  return positions.find(p => p.id === r.position)?.name ?? 'Албан тушаал'
}
/** "Ажлын 5 өдөр", "4 цаг", "1 хүн" */
export const amountOf = (r: HrRequest) =>
  r.kind === 'leave' ? `Ажлын ${r.days} өдөр` : r.kind === 'overtime' ? hoursText(r.minutes ?? spanMinutes(r.start, r.end)) : `${r.count} хүн`

/** A dot for being sent and one for each step, as for a document request */
export function HrSteps({ r }: { r: HrRequest }) {
  const n = STEPS[r.kind].length + 1
  const at = r.status === 'done' ? n : r.step + 1
  return (
    <ol className={`rsteps${r.status === 'returned' || r.status === 'canceled' ? ' is-declined' : ''}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <li key={i} className={i < at ? 'is-past' : i === at ? 'is-now' : ''} />)}
    </ol>
  )
}

const TONE = { wait: '', ok: ' rpill--ready', bad: ' rpill--declined', off: '' }
/** What the person has to do, when it is theirs; otherwise where it stands */
export function HrPill({ r, who }: { r: HrRequest; who: Id }) {
  const s = useApp()
  if (r.status === 'returned' && r.by === who) return <span className="rpill rpill--todo">Засаад илгээх</span>
  if (mayAct(s, r, who)) return <span className="rpill rpill--todo">{doOf(r)}</span>
  const p = pillOf(r)
  return <span className={`rpill${TONE[p.tone]}`}>{p.text}</span>
}

interface Item { id: Id; kind: Kind; waits: boolean; open: boolean; at: string; hr?: HrRequest; doc?: DocRequest }

export default function Requests() {
  const s = useApp()
  const who = useActor()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const rights = accessOf(s, s.me, s.company)
  const keeps = docView(s).edit(s.company)
  const hr = s.hrRequests.filter(r => r.company === s.company && involves(s, r, who))
  const docs = s.requests.filter(r => r.company === s.company)
  const hrItem = (r: HrRequest): Item => ({ id: r.id, kind: r.kind, waits: waitsFor(s, r, who), open: r.status === 'open' || r.status === 'returned', at: r.history[r.history.length - 1].at, hr: r })
  const docItem = (office: boolean) => (r: DocRequest): Item => ({ id: r.id, kind: 'doc', waits: office && r.status === 'sent', open: isOpen(r), at: r.steps[r.steps.length - 1].at, doc: r })
  // Waiting for the person first, then those still going, the newest on top
  const order = (a: Item, b: Item) => Number(b.waits) - Number(a.waits) || Number(b.open) - Number(a.open) || b.at.localeCompare(a.at)
  const mine = [...hr.filter(r => r.by === who).map(hrItem), ...docs.filter(r => r.by === s.me).map(docItem(false))].sort(order)
  const came = [...hr.filter(r => r.by !== who).map(hrItem), ...(keeps ? docs.map(docItem(true)) : [])].sort(order)
  const waiting = { mine: mine.filter(i => i.waits).length, in: came.filter(i => i.waits).length }
  const [pick, setTab] = useState<Tab>(waiting.in > 0 ? 'in' : 'mine')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  // Ирсэн хүсэлт only for someone things come to: whoever keeps the office, or has a step in a request
  const twoTabs = came.length > 0 || keeps
  const tab = twoTabs ? pick : 'mine'
  const all = tab === 'mine' ? mine : came
  const list = kind === 'all' ? all : all.filter(i => i.kind === kind)
  // Whoever takes part in the ХХК's requests, for an admin to try their steps
  const people = [...new Set<Id>([s.me, ...s.hrRequests.filter(r => r.company === s.company).flatMap(r => [r.by, ...STEPS[r.kind].flatMap(st => actorsOf(s, r, st))])])]
  const count = (n: number) => n > 0 && <><span className="rtabs__count" aria-hidden="true">{n}</span><span className="sr-only">({n})</span></>

  return (
    <div ref={ref} className="rpage">
      <PageHead
        title="Хүсэлт"
        sub="Ээлжийн амралт, илүү цаг, шинэ ажилтан авах, бичиг баримтын хүсэлтээ гаргаж, явцыг нь харна."
        actions={<button type="button" className="btn btn--accent" onClick={() => open({ kind: 'newRequest' })}><Plus className="ico" />Хүсэлт гаргах</button>}
      />
      {rights.admin && <ActAs ids={people} />}
      <div className="rtabs" data-enter>
        {twoTabs && (
          <Seg label="Хүсэлт" value={tab} onChange={setTab} options={[
            { value: 'mine', label: <>Миний хүсэлт{count(waiting.mine)}</> },
            { value: 'in', label: <>Ирсэн хүсэлт{count(waiting.in)}</> },
          ]} />
        )}
        <div className="rkinds"><Seg small label="Хүсэлтийн төрөл" value={kind} onChange={setKind} options={KINDS} /></div>
      </div>
      <section className="card glass rlist" aria-label={tab === 'mine' ? 'Миний хүсэлт' : 'Ирсэн хүсэлт'} data-enter>
        {list.length ? (
          <ul>{list.map(i => (i.hr ? <HrRow key={i.id} r={i.hr} who={who} came={tab === 'in'} /> : <DocRow key={i.id} r={i.doc!} office={tab === 'in'} />))}</ul>
        ) : all.length ? (
          <Empty icon={<Inbox className="ico" />} title="Энэ төрлийн хүсэлт алга" />
        ) : tab === 'mine' ? (
          <Empty icon={<Send className="ico" />} title="Хүсэлт алга" text="Ээлжийн амралт, илүү цаг, шинэ ажилтан авах, бичиг баримтын хүсэлтээ эндээс гаргана." />
        ) : (
          <Empty icon={<Inbox className="ico" />} title="Ирсэн хүсэлт алга" text="Таны батлах хүсэлт энд харагдана." />
        )}
      </section>
      <p className="rpage__hint" data-enter>Өвчний болон бусад чөлөөг Timely-ээр хүснэ.</p>
    </div>
  )
}

function HrRow({ r, who, came }: { r: HrRequest; who: Id; came: boolean }) {
  const s = useApp()
  const p = scoped(s).person(r.by) ?? s.people.find(x => x.id === r.by)
  const Icon = KIND_ICON[r.kind]
  const what = whatOf(r, s.positions)
  return (
    <li>
      <button type="button" className="rrow" onClick={() => open({ kind: 'hrRequest', id: r.id })}>
        {came && p ? <Avatar person={p} size="md" /> : <span className={`rrow__ico rrow__ico--hue hue--${KIND_HUE[r.kind]}`} aria-hidden="true"><Icon className="ico" /></span>}
        <span className="rrow__text">
          <b>{came && p ? short(p) : HR_KIND[r.kind]}</b>
          <small>{came ? `${HR_KIND[r.kind]} · ${what}` : what}</small>
        </span>
        <span className="rrow__form tnum">{amountOf(r)}</span>
        <span className="rrow__need" />
        <span className="rrow__state"><HrSteps r={r} /><HrPill r={r} who={who} /></span>
      </button>
    </li>
  )
}

function DocRow({ r, office }: { r: DocRequest; office: boolean }) {
  const s = useApp()
  const p = scoped(s).person(r.by)
  const late = isOpen(r) && daysFromToday(r.need) < 0
  return (
    <li>
      <button type="button" className="rrow" onClick={() => open({ kind: 'request', id: r.id, office })}>
        {office && p ? <Avatar person={p} size="md" /> : <span className="rrow__ico" aria-hidden="true">{r.paper ? <Printer className="ico" /> : <FileDown className="ico" />}</span>}
        <span className="rrow__text">
          <b>{office && p ? short(p) : r.what}</b>
          <small>{office ? `${r.what}, ${r.purpose}` : `Бичиг баримт · ${r.purpose}`}</small>
        </span>
        <span className="rrow__form">{r.paper ? `Цаасаар, ${r.copies} хувь` : 'Цахимаар'}</span>
        <span className={`rrow__need tnum${late ? ' is-late' : ''}`}>{late ? 'Хугацаа хэтэрсэн' : isOpen(r) ? dueLabel(r.need) : ''}</span>
        <span className="rrow__state"><Steps r={r} /><ReqPill r={r} /></span>
      </button>
    </li>
  )
}
