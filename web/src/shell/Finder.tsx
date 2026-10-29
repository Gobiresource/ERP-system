// Search (Ctrl K): pages, tasks, projects, events, people, boards, documents and HR records of the current company in one list.
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { CalendarDays, ChevronRight, FilePen, FileText, FolderOpen, MessagesSquare, NotebookPen, Search } from 'lucide-react'
import { scoped, useApp } from '../lib/store'
import { chatName, myChats } from '../lib/chat'
import { open, setFinder, useUi } from '../lib/ui'
import { go } from '../lib/router'
import { dueLabel, hm, parse, short } from '../lib/format'
import { enter } from '../lib/motion'
import { Avatar, ProjectGlyph, STATUS } from '../ui/bits'
import { NAV } from './nav'
import { EMP_STATUS, hrScoped } from '../lib/hr'
import { DOC_KIND, seen } from '../lib/docs'
import { STAGE } from '../lib/contracts'
import { EmpAvatar } from '../screens/Hr'

interface Hit {
  id: string
  group: string
  title: string
  sub?: string
  lead: ReactNode
  run: () => void
}

const lower = (s: string) => s.toLocaleLowerCase('mn')

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? lower(text).indexOf(lower(q)) : -1
  if (i < 0) return <>{text}</>
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
}

export function Finder() {
  const ui = useUi()
  if (!ui.finder) return null
  return <FinderDialog />
}

function FinderDialog() {
  const s = useApp()
  const sc = scoped(s)
  const hr = hrScoped(s)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDialogElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const d = ref.current!
    d.showModal()
    enter([d], { opacity: 0, transform: 'translateY(-12px) scale(.97)' }, { duration: 0.4, ease: 'back.out(1.7)' })
  }, [])

  const hits = useMemo(() => {
    const t = lower(q.trim())
    const has = (...xs: (string | undefined)[]) => !t || xs.some(x => x && lower(x).includes(t))
    const out: Hit[] = []
    const add = (items: Hit[]) => out.push(...items.slice(0, t ? 6 : 3))
    add(NAV.filter(n => has(n.label)).map(n => ({
      id: `page-${n.page}`, group: 'Хуудас', title: n.label, lead: <span className="lead"><n.icon className="ico" /></span>, run: () => go(n.page),
    })))
    // The PDF tool sits inside Бичиг хэрэг; typing "PDF" finds it
    if (t && has('PDF засах')) add([{ id: 'page-pdf', group: 'Хуудас', title: 'PDF засах', sub: 'Бичиг хэрэг', lead: <span className="lead"><FileText className="ico" /></span>, run: () => go('docs', 'pdf') }])
    if (!t) return out
    add(sc.tasks.filter(x => has(x.title)).map(x => {
      const p = sc.project(x.project)
      return {
        id: x.id, group: 'Ажил', title: x.title, sub: [p?.name, STATUS[x.status], dueLabel(x.due)].filter(Boolean).join(', '),
        lead: p ? <ProjectGlyph project={p} size="md" /> : <span className="lead"><CalendarDays className="ico" /></span>,
        run: () => open({ kind: 'task', id: x.id }),
      }
    }))
    add(sc.projects.filter(x => has(x.name, x.goal)).map(x => ({
      id: x.id, group: 'Төсөл', title: x.name, sub: x.goal, lead: <ProjectGlyph project={x} size="md" />, run: () => go('projects', x.id),
    })))
    add(sc.events.filter(x => has(x.title, x.where)).map(x => {
      const d = parse(x.start)
      return {
        id: x.id, group: 'Календарь', title: x.title, sub: `${dueLabel(x.start.slice(0, 10))}, ${hm(d)}`,
        lead: <span className="lead"><CalendarDays className="ico" /></span>, run: () => open({ kind: 'event', id: x.id }),
      }
    }))
    add(sc.people.filter(x => has(x.given, x.family, x.role, x.team)).map(x => ({
      id: x.id, group: 'Хүмүүс', title: short(x), sub: `${x.role}, ${x.team}`, lead: <Avatar person={x} size="md" />, run: () => open({ kind: 'person', id: x.id }),
    })))
    // Ноорог: my boards, also by what their cards say
    add(s.drafts.filter(d => d.company === s.company && d.owner === s.me && has(d.name, ...d.cards.map(c => c.text ?? c.file?.name))).map(d => ({
      id: d.id, group: 'Ноорог', title: d.name, sub: `${d.cards.length} зүйл`, lead: <span className="lead"><NotebookPen className="ico" /></span>, run: () => go('draft', d.id),
    })))
    // Зурвас: my chats by their name
    add(myChats(s).filter(c => has(chatName(c, s.people, s.me))).map(c => ({
      id: `chat-${c.id}`, group: 'Зурвас', title: chatName(c, s.people, s.me), sub: c.kind === 'group' ? `${c.members.length} гишүүн` : 'Хувийн зурвас',
      lead: <span className="lead"><MessagesSquare className="ico" /></span>, run: () => go('chat', c.id),
    })))
    // Бичиг хэрэг: the folder of each company I work in, and the documents I can see
    add(s.companies.filter(c => sc.me.companies.includes(c.id) && has(c.name)).map(c => ({
      id: `folder-${c.id}`, group: 'Хавтас', title: c.name, sub: 'Бичиг хэрэг', lead: <span className="lead"><FolderOpen className="ico" /></span>, run: () => go('docs', `folder-${c.id}`),
    })))
    add(s.docs.filter(d => d.company === s.company && seen(d, s.me) && has(d.name)).map(d => ({
      id: d.id, group: 'Бичиг баримт', title: d.name, sub: DOC_KIND[d.kind], lead: <span className="lead"><FileText className="ico" /></span>, run: () => open({ kind: 'doc', id: d.id }),
    })))
    // Contracts, also by the other side and the number
    add(s.contracts.filter(c => c.company === s.company && has(c.title, c.party, c.number ?? '')).map(c => ({
      id: c.id, group: 'Гэрээ', title: c.title, sub: `${c.party}, ${STAGE[c.stage].pill.toLowerCase()}`, lead: <span className="lead"><FilePen className="ico" /></span>, run: () => go('docs', `contract-${c.id}`),
    })))
    // HR records, also by code, registration number and phone
    add(hr.employees.filter(x => has(x.given, x.family, x.code, x.regNo, x.phone)).map(x => ({
      id: x.id, group: 'Ажилтан', title: short(x), sub: `${x.code}, ${hr.position(x.position)?.name ?? ''}, ${EMP_STATUS[x.status].toLowerCase()}`,
      lead: <EmpAvatar e={x} size="md" />, run: () => go('hr', x.id),
    })))
    return out
  }, [q, sc, hr, s])

  const current = Math.min(active, Math.max(0, hits.length - 1))
  const close = () => setFinder(false)
  const choose = (h: Hit) => { close(); h.run() }

  // Keep the chosen row in view
  useLayoutEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((current + 1) % Math.max(1, hits.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((current - 1 + hits.length) % Math.max(1, hits.length)) }
    else if (e.key === 'Enter' && hits[current]) { e.preventDefault(); choose(hits[current]) }
  }

  let lastGroup = ''
  return (
    <dialog ref={ref} className="finder" aria-label="Хайх" onClose={close} onClick={e => { if (e.target === ref.current) ref.current.close() }}>
      <div className="finder__bar glass glass--thick">
        <Search className="ico" />
        <input
          autoFocus
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="finder-list"
          aria-autocomplete="list"
          aria-activedescendant={hits[current] ? `hit-${hits[current].id}` : undefined}
          aria-label="Ажил, төсөл, хүн, хуудас хайх"
          placeholder="Ажил, төсөл, хүн, хуудас хайх"
          value={q}
          onChange={e => { setQ(e.target.value); setActive(0) }}
          onKeyDown={onKey}
        />
        <kbd>Esc</kbd>
      </div>
      {hits.length > 0 ? (
        <div className="finder__list glass glass--thick" role="listbox" id="finder-list" aria-label="Илэрц" ref={list}>
          {hits.map((h, i) => {
            const head = h.group !== lastGroup
            lastGroup = h.group
            return (
              <div key={h.id} role="presentation">
                {head && <p className="finder__group" role="presentation">{h.group}</p>}
                <div id={`hit-${h.id}`} role="option" aria-selected={i === current} className="finder__opt" onMouseMove={() => setActive(i)} onClick={() => choose(h)}>
                  {h.lead}
                  <span>
                    <b><Highlight text={h.title} q={q.trim()} /></b>
                    {h.sub && <small>{h.sub}</small>}
                  </span>
                  <ChevronRight className="ico go" />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="finder__list glass glass--thick" role="status">
          <p className="finder__empty">"{q.trim()}" гэсэн үгээр юу ч олдсонгүй.</p>
        </div>
      )}
    </dialog>
  )
}
