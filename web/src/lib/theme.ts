// Applies the appearance settings to <html>. Цайвар is the look everyone starts with, and Бараан comes only when the
// person chose it: neither the device's setting nor the page that shows the app turns it on (the user's decision,
// docs/decisions.md, 2026-11-15).
import { useSyncExternalStore } from 'react'
import type { Settings } from './types'
import { reduced } from './motion'

const root = document.documentElement
let current: Settings | null = null

let pending = false

/** With `animate`, the change cross-fades (when the browser can). Calls during the fade are applied when it runs. */
export function applyAppearance(s: Settings, animate = false) {
  current = s
  if (pending) return
  const apply = () => {
    pending = false
    const c = current!
    root.dataset.mode = c.theme
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
