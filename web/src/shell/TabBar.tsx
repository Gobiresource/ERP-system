// Phone navigation: floating tab bar at the bottom and a round search button.
import { useRef } from 'react'
import { LayoutGrid, Search } from 'lucide-react'
import { useRoute } from '../lib/router'
import { setFinder } from '../lib/ui'
import { useLens } from '../lib/motion'
import { go } from '../lib/router'
import { Menu, MenuItem, usePopover } from '../ui/Popover'
import { NAV } from './nav'

const MAIN = NAV.slice(0, 4)
const MORE = NAV.slice(4)

export function TabBar() {
  const route = useRoute()
  const track = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLSpanElement>(null)
  const pop = usePopover()
  const inMore = MORE.some(n => n.page === route.page)
  useLens(track, lens, '[data-on]', route.page)

  return (
    <nav className="tabbar" aria-label="Үндсэн цэс">
      <div className="tabbar__bar glass">
        <div className="tabbar__track" ref={track}>
          <span className="tabbar__lens" ref={lens} aria-hidden="true" />
          {MAIN.map(n => (
            <a key={n.page} href={`#${n.page}`} className="tab" aria-current={route.page === n.page ? 'page' : undefined} data-on={route.page === n.page || undefined}>
              <n.icon className="ico" />
              <span>{n.label}</span>
            </a>
          ))}
          <button ref={pop.anchor} type="button" className="tab" aria-haspopup="menu" aria-expanded={pop.open} onClick={pop.toggle} data-on={inMore || undefined}
            aria-current={inMore ? 'page' : undefined}>
            <LayoutGrid className="ico" />
            <span>Бусад</span>
          </button>
        </div>
      </div>
      <button type="button" className="tabbar__search glass" onClick={() => setFinder(true)} aria-label="Хайх">
        <Search className="ico" />
      </button>
      <Menu state={pop} label="Бусад хуудас" placement="top-end">
        {MORE.map(n => (
          <MenuItem key={n.page} icon={<n.icon className="ico" />} onSelect={() => { pop.close(); go(n.page) }}>{n.label}</MenuItem>
        ))}
      </Menu>
    </nav>
  )
}
