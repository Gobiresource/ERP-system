// Top toolbar: search, create, light/dark, notifications (and the company + personal menu on small screens).
import { useEffect, useLayoutEffect, useRef } from 'react'
import { AtSign, BadgeCheck, Bell, CalendarClock, CalendarPlus, CircleCheck, FolderPlus, ListChecks, MessageSquarePlus, Moon, Plus, Search, SquareCheck, Sun, UserPlus } from 'lucide-react'
import type { NoteKind } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { focus, open, setFinder } from '../lib/ui'
import { go } from '../lib/router'
import { useMode } from '../lib/theme'
import { ago } from '../lib/format'
import { Empty } from '../ui/bits'
import { Menu, MenuItem, Popover, usePopover } from '../ui/Popover'
import { CompanySwitcher } from './CompanySwitcher'
import { AccountMenu, setTheme } from './AccountMenu'

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
export const modKey = isMac ? '⌘' : 'Ctrl'

export function Toolbar() {
  const tools = useRef<HTMLDivElement>(null)

  // The wide layout keeps the page title clear of the toolbar (--tools-w in styles/shell.css)
  useLayoutEffect(() => {
    const el = tools.current!
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--tools-w', `${el.offsetWidth}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="toolbar">
      <div className="toolbar__company">
        <CompanySwitcher variant="pill" />
      </div>
      <div className="toolbar__tools glass" ref={tools}>
        <button type="button" className="search-pill" onClick={() => setFinder(true)} aria-label="Хайх" aria-keyshortcuts="Control+K Meta+K /">
          <Search className="ico" />
          <span>Хайх</span>
          <kbd>{modKey} K</kbd>
        </button>
        <CreateMenu />
        <ThemeButton />
        <Notifications />
        <AccountMenu variant="toolbar" />
      </div>
    </div>
  )
}

function CreateMenu() {
  const s = useApp()
  const pop = usePopover()
  const minutes = s.settings.focus.work
  const pick = (fn: () => void) => () => { pop.close(); fn() }

  // N opens this menu (src/shell/hotkeys.ts)
  useEffect(() => {
    const onOpen = () => pop.toggle()
    addEventListener('erp:create', onOpen)
    return () => removeEventListener('erp:create', onOpen)
  }, [pop.toggle])

  return (
    <>
      <button ref={pop.anchor} type="button" className="tbtn" aria-label="Үүсгэх" aria-haspopup="menu" aria-expanded={pop.open} aria-keyshortcuts="N" onClick={pop.toggle}>
        <Plus className="ico" />
      </button>
      <Menu state={pop} label="Үүсгэх">
        <MenuItem icon={<SquareCheck className="ico" />} onSelect={pick(() => open({ kind: 'newTask' }))}>Шинэ ажил</MenuItem>
        <MenuItem icon={<CalendarPlus className="ico" />} onSelect={pick(() => open({ kind: 'newEvent' }))}>Шинэ тов</MenuItem>
        <MenuItem icon={<FolderPlus className="ico" />} onSelect={pick(() => open({ kind: 'newProject' }))}>Шинэ төсөл</MenuItem>
        <MenuItem icon={<MessageSquarePlus className="ico" />} onSelect={pick(() => open({ kind: 'newChat' }))}>Шинэ зурвас</MenuItem>
        <hr />
        <MenuItem icon={<Moon className="ico" />} onSelect={pick(() => focus.start(minutes))}>{minutes} минут төвлөрөх</MenuItem>
      </Menu>
    </>
  )
}

function ThemeButton() {
  const mode = useMode()
  const next = mode === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" className="tbtn tbtn--theme" aria-label={next === 'dark' ? 'Бараан горим' : 'Цайвар горим'} onClick={() => setTheme(next)}>
      {mode === 'dark' ? <Sun className="ico" /> : <Moon className="ico" />}
    </button>
  )
}

const NOTE_ICON: Record<NoteKind, typeof Bell> = {
  mention: AtSign, review: ListChecks, approval: BadgeCheck, moved: CalendarClock, done: CircleCheck, invite: UserPlus,
}

function Notifications() {
  const s = useApp()
  const { notices } = scoped(s)
  const pop = usePopover()
  const unread = notices.filter(n => !n.read).length
  const list = [...notices].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <>
      <button ref={pop.anchor} type="button" className="tbtn" aria-haspopup="dialog" aria-expanded={pop.open} onClick={pop.toggle}
        aria-label={unread ? `Мэдэгдэл, ${unread} уншаагүй` : 'Мэдэгдэл'}>
        <Bell className="ico" />
        {unread > 0 && <span className="badge-dot" aria-hidden="true" />}
      </button>
      <Popover state={pop} label="Мэдэгдэл" role="dialog" className="pop--wide">
        <div className="pop__head">
          <h2 className="pop__title">Мэдэгдэл</h2>
          {unread > 0 && <button type="button" className="btn btn--ghost btn--sm" onClick={actions.markAllRead}>Бүгдийг уншсанд тооцох</button>}
        </div>
        {list.length === 0 && <Empty title="Мэдэгдэл алга" text="Шинэ зүйл гарахад энд харагдана." />}
        {list.map(n => {
          const Icon = NOTE_ICON[n.kind]
          return (
            <button key={n.id} type="button" className={`pop__row${n.read ? '' : ' is-unread'}`}
              onClick={() => {
                actions.markRead(n.id)
                pop.close()
                if (n.task) open({ kind: 'task', id: n.task })
                else if (n.project) go('projects', n.project)
              }}>
              <span className="lead"><Icon className="ico" /></span>
              <span>
                <b>{n.text}</b>
                <small>{!n.read && <span className="sr-only">Уншаагүй. </span>}{ago(n.at)}</small>
              </span>
            </button>
          )
        })}
      </Popover>
    </>
  )
}
