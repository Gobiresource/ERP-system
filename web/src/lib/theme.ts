// Applies the appearance settings to <html>. "system" follows the page that shows the app (data-theme), then the OS.
import { useSyncExternalStore } from 'react'
import type { Settings } from './types'
import { reduced } from './motion'

const root = document.documentElement
const mq = window.matchMedia('(prefers-color-scheme: dark)')
let current: Settings | null = null

export function resolveMode(theme: Settings['theme']): 'light' | 'dark' {
  if (theme !== 'system') return theme
  const host = root.dataset.theme
  if (host === 'dark' || host === 'light') return host
  return mq.matches ? 'dark' : 'light'
}

let pending = false

/** With `animate`, the change cross-fades (when the browser can). Calls during the fade are applied when it runs. */
export function applyAppearance(s: Settings, animate = false) {
  current = s
  if (pending) return
  const apply = () => {
    pending = false
    const c = current!
    root.dataset.mode = resolveMode(c.theme)
    root.dataset.accent = c.accent
    root.dataset.wall = c.wall
    root.dataset.glass = c.glass
    root.classList.toggle('is-solid', c.solid)
  }
  if (animate && 'startViewTransition' in document && !reduced()) {
    pending = true
    document.startViewTransition(apply)
  } else apply()
}

const refresh = () => current && applyAppearance(current)
mq.addEventListener('change', refresh)
new MutationObserver(refresh).observe(root, { attributes: true, attributeFilter: ['data-theme'] })

/** 'light' or 'dark', as shown right now */
export const useMode = () =>
  useSyncExternalStore(
    f => {
      const mo = new MutationObserver(f)
      mo.observe(root, { attributes: true, attributeFilter: ['data-mode'] })
      return () => mo.disconnect()
    },
    () => (root.dataset.mode === 'dark' ? 'dark' : 'light'),
  )
