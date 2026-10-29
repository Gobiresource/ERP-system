// Pages live in the address hash: #tasks, #project-p1. Plain names only, so links also work inside a preview page.
import { useSyncExternalStore } from 'react'

export const PAGES = ['home', 'tasks', 'calendar', 'projects', 'insights', 'team', 'preferences'] as const
export type Page = (typeof PAGES)[number]
export interface Route { page: Page; id?: string }

export function parse(hash: string): Route {
  const h = hash.replace(/^#/, '')
  if (h.startsWith('project-')) return { page: 'projects', id: h.slice(8) }
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
  const h = page === 'projects' && id ? `project-${id}` : page
  if (location.hash.slice(1) !== h) location.hash = h
}
