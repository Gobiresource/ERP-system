import { useRef, type ReactNode } from 'react'
import { useLens } from '../lib/motion'

export interface SegOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

/** Segmented control: one of a few options, with a sliding highlight. */
export function Seg<T extends string>({ value, options, onChange, label, small, className = '' }: {
  value: T
  options: SegOption<T>[]
  onChange: (v: T) => void
  label: string
  small?: boolean
  className?: string
}) {
  const track = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLSpanElement>(null)
  useLens(track, lens, '[aria-pressed="true"]', value)
  return (
    <div className={`seg${small ? ' seg--sm' : ''} ${className}`} role="group" aria-label={label} ref={track}>
      <span className="seg__pill" ref={lens} aria-hidden="true" />
      {options.map(o => (
        <button type="button" key={o.value} className="seg__btn" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}
