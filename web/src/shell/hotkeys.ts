// Keyboard shortcuts. Uses the physical key (e.code), so they work with the Mongolian keyboard layout too.
import { getState } from '../lib/store'
import { focus, getUi, open, setFinder, setIslandOpen } from '../lib/ui'
import { go, type Page } from '../lib/router'
import { NAV, navFor } from './nav'

/** G then a page's letter (shell/nav.ts) */
const GO: Record<string, Page> = Object.fromEntries(NAV.map(n => [`Key${n.key}`, n.page]))

const typing = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable)

export function startHotkeys() {
  let gAt = 0
  addEventListener('keydown', e => {
    // Not on the sign-in page: a key pressed there would act once the person is in
    if (!getUi().session) return
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
      e.preventDefault()
      setFinder(!getUi().finder)
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
    if (typing(document.activeElement) || document.querySelector('dialog[open]') || getUi().finder) return

    // Only the pages the person may open, as in the menu
    if (Date.now() - gAt < 1200 && navFor(getState()).some(n => n.page === GO[e.code])) {
      gAt = 0
      e.preventDefault()
      return go(GO[e.code])
    }
    switch (e.code) {
      case 'KeyG': gAt = Date.now(); break
      case 'Slash':
        e.preventDefault()
        if (e.shiftKey) open({ kind: 'shortcuts' })
        else setFinder(true)
        break
      case 'KeyN': e.preventDefault(); dispatchEvent(new Event('erp:create')); break
      case 'KeyT': e.preventDefault(); open({ kind: 'newTask' }); break
      case 'KeyF': {
        e.preventDefault()
        const f = getUi().focus
        if (f.status === 'idle') focus.start(getState().settings.focus.work)
        else setIslandOpen(true)
        break
      }
    }
  })
}
