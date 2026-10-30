// Гэрээ: the contracts of the current ХХК. "Миний хийх" holds those waiting for the person, in the words of what they have
// to do; the others are by whether they are still going. Anyone may start one, and whoever does writes it.
import { useRef, useState } from 'react'
import { FilePen, FilePlus2, Inbox, Users } from 'lucide-react'
import '../../styles/screens/contracts.css'
import type { Contract, Id } from '../../lib/types'
import { useApp } from '../../lib/store'
import { open, setActAs, useUi } from '../../lib/ui'
import { go } from '../../lib/router'
import { usePageEnter } from '../../lib/motion'
import { FLOW, REVIEW, REVIEW_PART, ROLE, ROLES, STAGE, isClosed, rolesOf, todo } from '../../lib/contracts'
import { ago, num, short } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Seg } from '../../ui/Seg'
import { Avatar, Empty } from '../../ui/bits'
import { DocsNav } from '../Docs'

/** The person the contract pages act as: me, or whoever the demo switched to */
export function useActor() {
  const s = useApp()
  return useUi().actAs ?? s.me
}

/** How many contracts wait for the person in the current ХХК (the menu and the tab show it) */
export function useContractTodo() {
  const s = useApp()
  const who = useActor()
  const roles = rolesOf(s, s.company)
  return s.contracts.filter(c => c.company === s.company && todo(c, roles, who)).length
}

type Tab = 'todo' | 'open' | 'closed'

export default function Contracts() {
  const s = useApp()
  const who = useActor()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const roles = rolesOf(s, s.company)
  const all = s.contracts.filter(c => c.company === s.company).sort((a, b) => b.updated.localeCompare(a.updated))
  const mine = all.filter(c => todo(c, roles, who))
  const [tab, setTab] = useState<Tab>(mine.length ? 'todo' : 'open')
  const list = tab === 'todo' ? mine : tab === 'open' ? all.filter(c => !isClosed(c)) : all.filter(isClosed)

  return (
    <div ref={ref}>
      <DocsNav at="contracts" />
      <PageHead
        title="Гэрээ"
        sub="Гэрээний ноорог бэлтгэж, санхүү, хуулиар зэрэг хянуулаад захирлаар батлуулна."
        actions={<button type="button" className="btn btn--accent" onClick={() => open({ kind: 'newContract' })}><FilePlus2 className="ico" />Гэрээ үүсгэх</button>}
      />
      <ActAs />
      <div className="rtabs" data-enter>
        <Seg label="Гэрээ" value={tab} onChange={setTab} options={[
          { value: 'todo', label: <>Миний хийх{mine.length > 0 && <><span className="rtabs__count" aria-hidden="true">{mine.length}</span><span className="sr-only">({mine.length})</span></>}</> },
          { value: 'open', label: 'Явагдаж буй' },
          { value: 'closed', label: 'Дууссан' },
        ]} />
        <button type="button" className="btn btn--glass btn--sm" onClick={() => open({ kind: 'processRoles' })}><Users className="ico" />Үүрэг тохируулах</button>
      </div>
      <section className="card glass ctlist" aria-label={tab === 'todo' ? 'Миний хийх' : tab === 'open' ? 'Явагдаж буй' : 'Дууссан'} data-enter>
        {list.length ? (
          <ul>{list.map(c => <Row key={c.id} c={c} what={tab === 'todo' ? todo(c, roles, who) : null} />)}</ul>
        ) : tab === 'todo' ? (
          <Empty icon={<Inbox className="ico" />} title="Таны хийх гэрээ алга" text="Танаас хүлээж буй гэрээ энд харагдана." />
        ) : (
          <Empty icon={<FilePen className="ico" />} title="Гэрээ алга" text="Гэрээ үүсгэвэл энд харагдана." />
        )}
      </section>
    </div>
  )
}

function Row({ c, what }: { c: Contract; what: string | null }) {
  const s = useApp()
  const owner = s.people.find(p => p.id === c.owner)
  return (
    <li>
      <a className="ctrow" href={`#docs-contract-${c.id}`} onClick={e => { e.preventDefault(); go('docs', `contract-${c.id}`) }}>
        <span className="ctrow__ico" aria-hidden="true"><FilePen className="ico" /></span>
        <span className="ctrow__text">
          <b>{c.title}</b>
          <small>{c.party}{c.amount ? `, ${num(c.amount)} ₮` : ''}{c.number ? `, № ${c.number}` : ''}</small>
        </span>
        {what ? <span className="ctrow__todo">{what}</span> : <span className="ctrow__owner">{owner && <Avatar person={owner} size="xs" />}{owner ? short(owner) : ''}</span>}
        <span className="ctrow__state"><Progress c={c} /><StagePill c={c} /></span>
        <time className="ctrow__at tnum" dateTime={c.updated}>{ago(c.updated)}</time>
      </a>
    </li>
  )
}

/** The contract's state in a word; "Буцаагдсан" while it is back with its writer */
export function StagePill({ c }: { c: Contract }) {
  const back = c.stage === 'draft' && c.resume
  return <span className={`ctpill ctpill--${back ? 'back' : c.stage}`}>{back ? 'Буцаагдсан' : STAGE[c.stage].pill}</span>
}

/** A dot for each stage; review is two half dots, one for finance and one for the lawyer. The words are in StagePill. */
export function Progress({ c }: { c: Contract }) {
  const at = FLOW.indexOf(c.stage)
  return (
    <ol className={`ctdots${c.stage === 'canceled' ? ' is-off' : ''}`} aria-hidden="true">
      {FLOW.map((st, i) => (st === 'review' ? (
        <li key={st} className="ctdots__pair">
          {REVIEW.map(r => <i key={r} title={REVIEW_PART[r as 'finance' | 'legal']} className={c.agreed.includes(r) ? 'is-past' : i === at ? 'is-now' : i < at ? 'is-past' : ''} />)}
        </li>
      ) : <li key={st} className={i < at || c.stage === 'done' ? 'is-past' : i === at ? 'is-now' : ''} />))}
    </ol>
  )
}

/**
 * Demo only: work as another person of the process, to try each step (the writer, finance, the lawyer, the office, the
 * director, and anyone asked for an opinion; or `ids`). The real system knows who signed in.
 */
export function ActAs({ ids: given }: { ids?: Id[] }) {
  const s = useApp()
  const who = useActor()
  const roles = rolesOf(s, s.company)
  const ids = given ?? [...new Set<Id>([s.me, ...ROLES.map(r => roles[r]), ...s.contracts.filter(c => c.company === s.company).flatMap(c => [c.owner, ...c.asked.map(a => a.to)])])]
  const label = (id: Id) => {
    const p = s.people.find(x => x.id === id)
    const role = ROLES.find(r => roles[r] === id)
    return p ? `${short(p)}, ${role ? ROLE[role] : p.role}${id === s.me ? ' (та)' : ''}` : id
  }
  return (
    <div className="actas" data-enter>
      <span className="actas__tag">Туршилт</span>
      <label htmlFor="actas">Хэн болж ажиллах</label>
      <select id="actas" value={who} onChange={e => setActAs(e.target.value === s.me ? null : e.target.value)}>
        {ids.map(id => <option key={id} value={id}>{label(id)}</option>)}
      </select>
    </div>
  )
}
