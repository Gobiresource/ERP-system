import { useEffect, useRef, type ComponentType } from 'react'
import { useApp } from './lib/store'
import { useUi } from './lib/ui'
import { useRoute, type Page } from './lib/router'
import { applyAppearance } from './lib/theme'
import { Wallpaper } from './shell/Wallpaper'
import { Sidebar } from './shell/Sidebar'
import { Toolbar } from './shell/Toolbar'
import { Island } from './shell/Island'
import { TabBar } from './shell/TabBar'
import { Finder } from './shell/Finder'
import { Dialogs } from './dialogs/Dialogs'
import { navFor, pageLabel } from './shell/nav'
import Home from './screens/Home'
import Tasks from './screens/Tasks'
import Chat from './screens/Chat'
import Calendar from './screens/Calendar'
import Projects from './screens/Projects'
import Draft from './screens/Draft'
import Insights from './screens/Insights'
import Team from './screens/Team'
import Hr from './screens/Hr'
import Docs from './screens/Docs'
import Settings from './screens/Settings'
import Admin from './screens/Admin'
import Login from './screens/Login'
import { NoAccess } from './ui/bits'

// All screens ship in one file: a page change never waits for the network (about 100 KB more on first load)
const SCREENS: Record<Page, ComponentType<{ id?: string }>> = {
  home: Home, tasks: Tasks, chat: Chat, calendar: Calendar, projects: Projects, draft: Draft, insights: Insights, team: Team, hr: Hr, docs: Docs, admin: Admin, preferences: Settings,
}

export function App() {
  const s = useApp()
  const { session } = useUi()
  const route = useRoute()
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)

  useEffect(() => applyAppearance(s.settings), [s.settings])

  useEffect(() => {
    const company = s.companies.find(c => c.id === s.company)?.name
    document.title = `${pageLabel(route.page)} · ${company}`
  }, [route.page, s.company, s.companies])

  // After the first page, a page change scrolls up and focuses the new title (see usePageEnter)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    document.body.dataset.navigated = '1'
    window.scrollTo(0, 0)
  }, [route.page, route.id])

  if (!session) return <Login />
  // A page outside the person's rights says so instead of showing anything
  const Screen = navFor(s).some(n => n.page === route.page) ? SCREENS[route.page] : NoAccess
  return (
    <div className="app">
      <a className="skip" href="#main" onClick={e => { e.preventDefault(); main.current?.focus() }}>Агуулга руу шилжих</a>
      <Wallpaper />
      <Sidebar />
      <Toolbar />
      <Island />
      <main id="main" className="main" ref={main} tabIndex={-1}>
        {/* A page starts afresh for each record and company. Зурвас stays: changing chats keeps the list where it was. */}
        <Screen key={route.page === 'chat' ? 'chat' : `${route.page}-${route.id ?? ''}-${s.company}`} id={route.id} />
      </main>
      <TabBar />
      <Dialogs />
      <Finder />
    </div>
  )
}
