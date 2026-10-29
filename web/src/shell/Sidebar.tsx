import { useRef } from 'react'
import { scoped, useApp } from '../lib/store'
import { useRoute } from '../lib/router'
import { useLens } from '../lib/motion'
import { CompanySwitcher } from './CompanySwitcher'
import { AccountMenu } from './AccountMenu'
import { NAV } from './nav'
import { myChats, unread } from '../lib/chat'

export function Sidebar() {
  const s = useApp()
  const route = useRoute()
  const { tasks, projects } = scoped(s)
  const open = tasks.filter(t => t.assignees.includes(s.me) && t.status !== 'done').length
  const fresh = myChats(s).reduce((n, c) => n + unread(c, s.messages, s.me), 0)
  const pinned = projects.filter(p => p.pinned)
  const track = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLSpanElement>(null)
  useLens(track, lens, '[aria-current="page"]', route.page)

  return (
    <aside className="side glass" aria-label="Хажуугийн цэс">
      <CompanySwitcher variant="brand" />
      <nav aria-label="Үндсэн цэс">
        <div className="nav__track" ref={track}>
          <span className="nav__lens" ref={lens} aria-hidden="true" />
          {NAV.map(n => (
            <a key={n.page} href={`#${n.page}`} className="nav__item" title={n.label} aria-current={route.page === n.page ? 'page' : undefined}>
              <n.icon className="ico" />
              <span className="nav__text">{n.label}</span>
              {n.page === 'tasks' && open > 0 && (
                <span className="nav__count">{open}<span className="sr-only"> дуусаагүй ажил</span></span>
              )}
              {n.page === 'chat' && fresh > 0 && (
                <span className="nav__count">{fresh}<span className="sr-only"> шинэ зурвас</span></span>
              )}
            </a>
          ))}
        </div>
      </nav>
      {pinned.length > 0 && (
        <div className="side__group">
          <p className="side__label" id="pinned-label">Онцолсон төслүүд</p>
          <ul className="pinned" aria-labelledby="pinned-label">
            {pinned.map(p => (
              <li key={p.id}>
                <a href={`#project-${p.id}`} className={`hue--${p.hue}`} aria-current={route.id === p.id ? 'page' : undefined}>
                  <i aria-hidden="true" />
                  <span>{p.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <AccountMenu variant="side" />
    </aside>
  )
}
