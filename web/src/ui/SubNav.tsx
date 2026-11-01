// Tabs between the pages of one section, above each page title (Хүний нөөц, Ноорог)
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useLens } from '../lib/motion'

/**
 * Shows a tab whole in its row, with room for the focus ring. Sideways only, so the page itself never jumps. Focus alone
 * would not do it: the browser leaves a tab as it is while 32 px of it show.
 */
function reveal(tab?: Element | null) {
  const nav = tab?.closest('.subnav')
  if (!nav || !tab) return
  const n = nav.getBoundingClientRect(), t = tab.getBoundingClientRect()
  if (t.right > n.right - 8) nav.scrollLeft += t.right - n.right + 8
  else if (t.left < n.left + 8) nav.scrollLeft -= n.left + 8 - t.left
}

export function SubNav({ label, base, tabs, at }: { label: string; base: string; tabs: readonly (readonly [string, ReactNode])[]; at: string }) {
  const track = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLSpanElement>(null)
  useLens(track, lens, '[aria-current="page"]', at)
  // The row scrolls sideways on a phone, and beside the docked timer on wide screens: the current tab stays in view, also
  // when the row narrows, and so does a tab that Tab reaches
  useLayoutEffect(() => {
    const nav = track.current?.parentElement
    if (!nav) return
    const fit = () => reveal(track.current?.querySelector('[aria-current="page"]'))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [at])
  return (
    <nav className="subnav" aria-label={label} data-enter onFocus={e => reveal(e.target)}>
      <div className="seg" ref={track}>
        <span className="seg__pill" ref={lens} aria-hidden="true" />
        {tabs.map(([id, text]) => (
          <a key={id} className="seg__btn" href={id ? `#${base}-${id}` : `#${base}`} aria-current={at === id ? 'page' : undefined}>{text}</a>
        ))}
      </div>
    </nav>
  )
}
