// A small form in a window, laid out like Pane: close on the left, title in the middle, the main button on the right.
// Errors follow our rules: empty required fields are reported on submit, in a list at the top that links to each field.
import { useLayoutEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Sheet, useCloseSheet } from './Sheet'

export type Errors = Record<string, string>

export function FormSheet({ title, sub, submit, onSubmit, onClose, errors, children, wide }: {
  title: string
  sub?: string
  submit: string
  /** Return true when saved; the window then closes */
  onSubmit: () => boolean
  onClose: () => void
  errors: Errors
  children: ReactNode
  wide?: boolean
}) {
  return (
    <Sheet label={title} onClose={onClose} closeButton={false} wide={wide}>
      <FormBody title={title} sub={sub} submit={submit} onSubmit={onSubmit} errors={errors}>{children}</FormBody>
    </Sheet>
  )
}

function FormBody({ title, sub, submit, onSubmit, errors, children }: { title: string; sub?: string; submit: string; onSubmit: () => boolean; errors: Errors; children: ReactNode }) {
  const close = useCloseSheet()
  const summary = useRef<HTMLDivElement>(null)
  const count = Object.keys(errors).length

  useLayoutEffect(() => {
    if (count) summary.current?.focus()
  }, [errors, count])

  const send = (e: FormEvent) => {
    e.preventDefault()
    if (onSubmit()) close()
  }

  return (
    <form className="mform" onSubmit={send} noValidate>
      <div className="mform__head">
        <button type="button" className="ibtn ibtn--glass" onClick={close} aria-label="Болих">
          <X className="ico" />
        </button>
        <div className="mform__titles">
          <h2 className="mform__title">{title}</h2>
          {sub && <p className="mform__sub">{sub}</p>}
        </div>
        <button type="submit" className="btn btn--accent">{submit}</button>
      </div>
      {count > 0 && (
        <div className="mform__errors" role="alert" tabIndex={-1} ref={summary}>
          <b>Дараах {count === 1 ? 'талбарыг' : 'талбаруудыг'} шалгана уу:</b>
          <ul>
            {Object.entries(errors).map(([id, msg]) => (
              <li key={id}><a href={`#${id}`} onClick={e => { e.preventDefault(); document.getElementById(id)?.focus() }}>{msg}</a></li>
            ))}
          </ul>
        </div>
      )}
      <div className="mform__grid">{children}</div>
    </form>
  )
}

/** Label, control, hint and error, wired together for screen readers */
export function Field({ id, label, hint, error, wide, optional, children }: {
  id: string
  label: string
  hint?: string
  error?: string
  wide?: boolean
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div className={`field${wide ? ' field--wide' : ''}`}>
      <label className="field__label" htmlFor={id}>{label}{optional && ' (заавал биш)'}</label>
      {children}
      {hint && <span className="field__hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="field__error" id={`${id}-error`}>{error}</span>}
    </div>
  )
}

/** aria props for a control inside <Field> */
export const fieldAria = (id: string, error?: string, hint?: boolean) => ({
  id,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined,
})
