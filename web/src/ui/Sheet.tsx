import { createContext, use, useLayoutEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { gsap, reduced } from '../lib/motion'

const SheetContext = createContext<() => void>(() => {})
/** Closes the surrounding window with its animation */
export const useCloseSheet = () => use(SheetContext)

/**
 * A window on top of the page (native <dialog>): `modal` in the middle, `drawer` on the right.
 * On phones both become a sheet from the bottom. Esc, the close button and a click outside close it.
 */
export function Sheet({ kind = 'modal', label, onClose, children, wide, closeButton = true }: {
  kind?: 'modal' | 'drawer'
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
    if (!d.open) d.showModal()
    if (reduced()) return
    const from = phone() ? { yPercent: 100, duration: 0.5, ease: 'power3.out' }
      : kind === 'drawer' ? { x: 60, opacity: 0, duration: 0.5, ease: 'power3.out' }
      : { scale: 0.92, opacity: 0, duration: 0.5, ease: 'back.out(1.6)' }
    gsap.from(d, { ...from, clearProps: 'transform,opacity' })
  }, [kind])

  const requestClose = () => {
    const d = ref.current
    if (!d || closing.current) return
    closing.current = true
    const done = () => { d.close(); onClose() }
    if (reduced()) return done()
    const to = phone() ? { yPercent: 100 } : kind === 'drawer' ? { x: 60, opacity: 0 } : { scale: 0.95, opacity: 0 }
    gsap.to(d, { ...to, duration: 0.28, ease: 'power3.in', onComplete: done })
  }

  return (
    <dialog
      ref={ref}
      className={`${kind}${wide ? ' modal--wide' : ''} glass glass--thick`}
      aria-label={label}
      onCancel={e => { e.preventDefault(); requestClose() }}
      onClick={e => { if (e.target === ref.current) requestClose() }}
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
