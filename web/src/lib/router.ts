// Pages live in the address hash: #tasks, #project-p1, #hr-employees. Plain names only, so links also work inside a preview page.
import { useSyncExternalStore } from 'react'

export const PAGES = ['home', 'tasks', 'calendar', 'projects', 'insights', 'team', 'hr', 'preferences'] as const
export type Page = (typeof PAGES)[number]
export interface Route { page: Page; id?: string }

export function parse(hash: string): Route {
  const h = hash.replace(/^#/, '')
  if (h.startsWith('project-')) return { page: 'projects', id: h.slice(8) }
  // Human resources: #hr, #hr-employees, #hr-structure, #hr-new, #hr-<employee>, #hr-<employee>-edit
  if (h.startsWith('hr-')) return { page: 'hr', id: h.slice(3) }
  return { page: (PAGES as readonly string[]).includes(h) ? (h as Page) : 'home' }
}

let cached = { hash: '\0', route: parse('') }
const read = () => {
  if (cached.hash !== location.hash) cached = { hash: location.hash, route: parse(location.hash) }
  return cached.route
}

export const useRoute = () =>
  useSyncExternalStore(
    f => (addEventListener('hashchange', f), () => removeEventListener('hashchange', f)),
    read,
  )

export function go(page: Page, id?: string) {
  const h = id ? (page === 'projects' ? `project-${id}` : `${page}-${id}`) : page
  if (location.hash.slice(1) !== h) location.hash = h
}
