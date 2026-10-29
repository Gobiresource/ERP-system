import { useEffect, useRef, type ComponentType } from 'react'
import { useApp } from './lib/store'
import { useRoute, type Page } from './lib/router'
import { applyAppearance } from './lib/theme'
import { Wallpaper } from './shell/Wallpaper'
import { Sidebar } from './shell/Sidebar'
import { Toolbar } from './shell/Toolbar'
import { Island } from './shell/Island'
import { TabBar } from './shell/TabBar'
import { Finder } from './shell/Finder'
import { Dialogs } from './dialogs/Dialogs'
import { pageLabel } from './shell/nav'
import Home from './screens/Home'
import Tasks from './screens/Tasks'
import Calendar from './screens/Calendar'
import Projects from './screens/Projects'
import Insights from './screens/Insights'
import Team from './screens/Team'
import Settings from './screens/Settings'

// All screens ship in one file: a page change never waits for the network (about 100 KB more on first load)
const SCREENS: Record<Page, ComponentType<{ id?: string }>> = {
  home: Home, tasks: Tasks, calendar: Calendar, projects: Projects, insights: Insights, team: Team, preferences: Settings,
}

export function App() {
  const s = useApp()
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

  const Screen = SCREENS[route.page]
  return (
    <div className="app">
      <a className="skip" href="#main" onClick={e => { e.preventDefault(); main.current?.focus() }}>Агуулга руу шилжих</a>
      <Wallpaper />
      <Sidebar />
      <Toolbar />
      <Island />
      <main id="main" className="main" ref={main} tabIndex={-1}>
        <Screen key={`${route.page}-${route.id ?? ''}-${s.company}`} id={route.id} />
      </main>
      <TabBar />
      <Dialogs />
      <Finder />
    </div>
  )
}
