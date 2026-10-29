// Tabs between the pages of one section, above each page title (Хүний нөөц, Ноорог)
import { useRef } from 'react'
import { useLens } from '../lib/motion'

export function SubNav({ label, base, tabs, at }: { label: string; base: string; tabs: readonly (readonly [string, string])[]; at: string }) {
  const track = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLSpanElement>(null)
  useLens(track, lens, '[aria-current="page"]', at)
  return (
    <nav className="subnav" aria-label={label} data-enter>
      <div className="seg" ref={track}>
        <span className="seg__pill" ref={lens} aria-hidden="true" />
        {tabs.map(([id, text]) => (
          <a key={id} className="seg__btn" href={id ? `#${base}-${id}` : `#${base}`} aria-current={at === id ? 'page' : undefined}>{text}</a>
        ))}
      </div>
    </nav>
  )
}
