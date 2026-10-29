import { createContext, use, useLayoutEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { enter, leave } from '../lib/motion'

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
    d.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    if (phone()) enter([d], { transform: 'translateY(100%)' }, { duration: 0.5, ease: 'power3.out' })
    else if (kind === 'drawer') enter([d], { opacity: 0, transform: 'translateX(60px)' }, { duration: 0.5, ease: 'power3.out' })
    else enter([d], { opacity: 0, transform: 'scale(.92)' }, { duration: 0.5, ease: 'back.out(1.6)' })
  }, [kind])

  const requestClose = () => {
    const d = ref.current
    if (!d || closing.current) return
    closing.current = true
    const to = phone() ? { transform: 'translateY(100%)' } : kind === 'drawer' ? { opacity: 0, transform: 'translateX(60px)' } : { opacity: 0, transform: 'scale(.95)' }
    leave(d, to, { duration: 0.28, ease: 'power3.in' }).then(() => { d.close(); onClose() })
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
