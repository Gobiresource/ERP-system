import { lazy, Suspense, useEffect, useRef, type ComponentType, type LazyExoticComponent } from 'react'
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
import { pageLabel } from './shell/nav'

const SCREENS: Record<Page, LazyExoticComponent<ComponentType<{ id?: string }>>> = {
  home: lazy(() => import('./screens/Home')),
  tasks: lazy(() => import('./screens/Tasks')),
  calendar: lazy(() => import('./screens/Calendar')),
  projects: lazy(() => import('./screens/Projects')),
  insights: lazy(() => import('./screens/Insights')),
  team: lazy(() => import('./screens/Team')),
  preferences: lazy(() => import('./screens/Settings')),
}

export function App() {
  const s = useApp()
  const ui = useUi()
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
        <Suspense fallback={null}>
          <Screen key={`${route.page}-${route.id ?? ''}-${s.company}`} id={route.id} />
        </Suspense>
      </main>
      <TabBar />
      <Dialogs dialog={ui.dialog} />
      <Finder />
    </div>
  )
}
