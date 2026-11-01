import { createContext, use, useLayoutEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { enter, leave } from '../lib/motion'

const SheetContext = createContext<() => void>(() => {})
/** Closes the surrounding window with its animation */
export const useCloseSheet = () => use(SheetContext)

/**
 * A window on top of the page (native <dialog>): `modal` in the middle, `drawer` on the right, `full` over the whole
 * screen (a file to look at). On phones modal and drawer become a sheet from the bottom. Esc, the close button and a
 * click outside close it.
 */
export function Sheet({ kind = 'modal', label, onClose, children, wide, closeButton = true }: {
  kind?: 'modal' | 'drawer' | 'full'
  label: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  /** Forms draw their own close button in the header */
  closeButton?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const closing = useRef(false)
  const phone = () => window.matchMedia('(width <= 760px)').matches

  useLayoutEffect(() => {
    const d = ref.current!
    // When the focused control goes away (Болих closes an inline confirmation, a step swaps its buttons), focus would fall
    // to <body>. It stays in the part drawn anew where the control was: on the latest control focused before that is
    // there again, found by its name (Болих brings back the Устгах that opened it), or else on that part's first control
    // (the next step's button), or else on the window's first one
    const names: string[] = []
    let last: Element | null = null
    const nameOf = (el: Element) => el.tagName + (el.id || el.getAttribute('aria-label') || el.textContent)
    const onFocus = (e: FocusEvent) => { last = e.target as Element; if (names.push(nameOf(last)) > 20) names.shift() }
    const lost = new MutationObserver(records => {
      if (closing.current || !last || last.isConnected || document.activeElement !== document.body) return
      const where = records.find(r => [...r.removedNodes].some(n => n.contains(last)))?.target ?? d
      const all = [...d.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')]
      const here = all.filter(el => where.contains(el))
      for (let i = names.length - 1; i >= 0 && document.activeElement === document.body; i--) here.find(el => nameOf(el) === names[i])?.focus()
      for (const el of [...here, ...all]) if (document.activeElement === document.body) el.focus()
    })
    d.addEventListener('focusin', onFocus)
    lost.observe(d, { childList: true, subtree: true })
    if (!d.open) d.showModal()
    d.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    if (kind === 'full') enter([d], { opacity: 0 }, { duration: 0.25, ease: 'power2.out' })
    else if (phone()) enter([d], { transform: 'translateY(100%)' }, { duration: 0.5, ease: 'power3.out' })
    else if (kind === 'drawer') enter([d], { opacity: 0, transform: 'translateX(60px)' }, { duration: 0.5, ease: 'power3.out' })
    else enter([d], { opacity: 0, transform: 'scale(.92)' }, { duration: 0.5, ease: 'back.out(1.6)' })
    return () => {
      d.removeEventListener('focusin', onFocus)
      lost.disconnect()
      // Closed, and the control that opened it is gone (the task was deleted, or moved to another column): the page title,
      // as after a page change, rather than <body>
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) (document.getElementById('page-title') ?? document.getElementById('main'))?.focus({ preventScroll: true })
      })
    }
  }, [kind])

  const requestClose = () => {
    const d = ref.current
    if (!d || closing.current) return
    closing.current = true
    const to = kind === 'full' ? { opacity: 0 } : phone() ? { transform: 'translateY(100%)' } : kind === 'drawer' ? { opacity: 0, transform: 'translateX(60px)' } : { opacity: 0, transform: 'scale(.95)' }
    leave(d, to, { duration: kind === 'full' ? 0.18 : 0.28, ease: 'power3.in' }).then(() => { d.close(); onClose() })
  }

  return (
    <dialog
      ref={ref}
      className={kind === 'full' ? 'viewer' : `${kind}${wide ? ' modal--wide' : ''} glass glass--thick`}
      aria-label={label}
      onCancel={e => { e.preventDefault(); requestClose() }}
      onClick={e => {
        // The backdrop only: a drawer is taller than its content, and a click under the content lands on the dialog too
        const r = e.currentTarget.getBoundingClientRect()
        if (e.target === e.currentTarget && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) requestClose()
      }}
    >
      <div className="sheet__inner">
        <span className="grabber" aria-hidden="true" />
        {closeButton && (
          <button type="button" className="ibtn ibtn--glass sheet__close" onClick={requestClose} aria-label="Хаах">
            <X className="ico" />
          </button>
        )}
        <SheetContext value={requestClose}>{children}</SheetContext>
      </div>
    </dialog>
  )
}
