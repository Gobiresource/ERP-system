import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Check } from 'lucide-react'
import { enter } from '../lib/motion'

export interface PopState<T extends HTMLElement = HTMLButtonElement> {
  anchor: RefObject<T | null>
  open: boolean
  toggle: () => void
  close: () => void
}

/** State for a button that opens a popover */
export function usePopover<T extends HTMLElement = HTMLButtonElement>(): PopState<T> {
  const anchor = useRef<T>(null)
  const [open, setOpen] = useState(false)
  const closedAt = useRef(0)
  // A click on the button right after the popover closed itself (click outside) should not reopen it
  const toggle = useCallback(() => Date.now() - closedAt.current > 250 && setOpen(o => !o), [])
  const close = useCallback(() => {
    closedAt.current = Date.now()
    setOpen(false)
  }, [])
  return { anchor, open, toggle, close }
}

type Placement = 'bottom-end' | 'bottom-start' | 'top-start' | 'top-end'

/** A small floating panel next to its button. Uses the browser's popover layer: Esc and a click outside close it. */
export function Popover({ state, children, label, placement = 'bottom-end', className = '', role }: {
  state: PopState<HTMLElement>
  children: ReactNode
  label: string
  placement?: Placement
  className?: string
  role?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { open, anchor, close } = state

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'closed') {
        close()
        if (!document.activeElement || document.activeElement === document.body || el.contains(document.activeElement)) anchor.current?.focus()
      }
    }
    el.addEventListener('toggle', onToggle)
    return () => el.removeEventListener('toggle', onToggle)
  }, [close, anchor])

  useLayoutEffect(() => {
    const el = ref.current
    const a = anchor.current
    if (!el || !a) return
    if (!open) {
      if (el.matches(':popover-open')) el.hidePopover()
      return
    }
    el.showPopover()
    const r = a.getBoundingClientRect()
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    let top = placement.startsWith('bottom') ? r.bottom + 8 : r.top - h - 8
    if (placement.startsWith('bottom') && top + h > vh - 12 && r.top - h - 8 > 12) top = r.top - h - 8
    if (placement.startsWith('top') && top < 12) top = r.bottom + 8
    let left = placement.endsWith('end') ? r.right - w : r.left
    left = Math.min(Math.max(12, left), vw - w - 12)
    el.style.top = `${Math.max(12, top)}px`
    el.style.left = `${left}px`
    el.style.transformOrigin = `${placement.endsWith('end') ? 'right' : 'left'} ${top > r.top ? 'top' : 'bottom'}`
    enter([el], { opacity: 0, transform: `translateY(${top > r.top ? -6 : 6}px) scale(.96)` }, { duration: 0.32, ease: 'back.out(1.8)' })
    el.querySelector<HTMLElement>('[role^="menuitem"], button, a, input')?.focus()
  }, [open, anchor, placement])

  return (
    <div ref={ref} popover="auto" className={`pop glass glass--thick ${className}`} role={role} aria-label={role ? label : undefined}>
      {open && children}
    </div>
  )
}

/** Arrow keys move between items of a menu */
export function menuKeys(e: KeyboardEvent<HTMLElement>) {
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
  const i = items.indexOf(document.activeElement as HTMLElement)
  const go = (n: number) => { e.preventDefault(); items[(n + items.length) % items.length]?.focus() }
  if (e.key === 'ArrowDown') go(i + 1)
  else if (e.key === 'ArrowUp') go(i - 1)
  else if (e.key === 'Home') go(0)
  else if (e.key === 'End') go(items.length - 1)
}

export function Menu({ state, label, children, placement }: { state: PopState<HTMLElement>; label: string; children: ReactNode; placement?: Placement }) {
  return (
    <Popover state={state} label={label} placement={placement} className="menu">
      <div role="menu" aria-label={label} onKeyDown={menuKeys}>{children}</div>
    </Popover>
  )
}

export function MenuItem({ children, icon, onSelect, checked, danger, hint }: {
  children: ReactNode
  icon?: ReactNode
  onSelect: () => void
  checked?: boolean
  danger?: boolean
  hint?: string
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      className={`menu__item${danger ? ' is-danger' : ''}`}
      onClick={onSelect}
    >
      <span>{children}</span>
      {hint && <kbd>{hint}</kbd>}
      {checked ? <Check className="ico menu__check" /> : icon}
    </button>
  )
}
