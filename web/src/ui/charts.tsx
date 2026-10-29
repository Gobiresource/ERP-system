// Charts drawn as SVG, in the Pane look. Every chart has a tooltip (pointer and arrow keys) and a table for screen readers.
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import '../styles/charts.css'
import type { Hue } from '../lib/types'
import { enter, gsap, reduced } from '../lib/motion'

export type Tone = 'accent' | 'muted' | 'ink' | Hue
const stroke = (t: Tone) => (t === 'accent' ? 'var(--accent-ink)' : t === 'muted' ? 'var(--text-3)' : t === 'ink' ? 'var(--text)' : `var(--${t})`)

/** Width of an element, kept up to date */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current!
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Smooth line through points without overshooting (monotone cubic) */
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : ''
  const n = pts.length
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0])
  const m = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i])
  const t = pts.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2))
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`
  }
  return d
}

const niceMax = (v: number) => {
  if (v <= 4) return 4
  const step = Math.pow(10, Math.floor(Math.log10(v)))
  const n = Math.ceil(v / step)
  return (n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10) * step
}

export interface LineSeries {
  name: string
  values: number[]
  tone: Tone
  dashed?: boolean
  area?: boolean
}

/** Line chart with a crosshair tooltip. One y-axis only. */
export function LineChart({ series, labels, height = 220, unit, label, format = (v: number) => String(Math.round(v)) }: {
  series: LineSeries[]
  labels: string[]
  height?: number
  unit: string
  label: string
  format?: (v: number) => string
}) {
  const [box, w] = useWidth<HTMLDivElement>()
  const svg = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId()
  const ready = w > 0
  const n = labels.length
  const max = niceMax(Math.max(1, ...series.flatMap(s => s.values)))
  const top = 18
  const bottom = 26
  const ph = height - top - bottom
  const x = (i: number) => (n <= 1 ? 0 : 8 + (i / (n - 1)) * Math.max(0, w - 16))
  const y = (v: number) => top + ph - (v / max) * ph
  const ticks = [0, max / 2, max]
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 90))))

  // Lines draw themselves in once the width is known
  useLayoutEffect(() => {
    if (!ready || reduced() || !svg.current) return
    svg.current.querySelectorAll<SVGPathElement>('.chart__line').forEach(p => {
      if (p.classList.contains('is-dashed')) return void gsap.from(p, { opacity: 0, duration: 1.2, ease: 'power2.inOut' })
      const len = p.getTotalLength()
      gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' })
    })
    gsap.from(svg.current.querySelectorAll('.chart__area'), { opacity: 0, duration: 1, delay: 0.5 })
  }, [ready])

  const pick = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect()
    const i = Math.round(((clientX - r.left - 8) / Math.max(1, w - 16)) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setHover(h => Math.max(0, Math.min(n - 1, (h ?? n - 1) + (e.key === 'ArrowRight' ? 1 : -1))))
    } else if (e.key === 'Escape') setHover(null)
  }

  const tipLeft = hover === null ? 0 : Math.min(Math.max(0, x(hover) - 80), Math.max(0, w - 170))

  return (
    <div className="chart" ref={box} tabIndex={0} aria-label={`${label}. Сум товчоор утгыг харна.`} onKeyDown={onKey} onBlur={() => setHover(null)} onPointerLeave={() => setHover(null)}>
      {w > 0 && (
        <svg ref={svg} className="chart__svg" width={w} height={height} aria-hidden="true" onPointerMove={e => pick(e.clientX)} onPointerDown={e => pick(e.clientX)}>
          <defs>
            {series.filter(s => s.area).map((s, i) => (
              <linearGradient key={i} id={`${uid}-area-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: stroke(s.tone), stopOpacity: 0.26 }} />
                <stop offset="1" style={{ stopColor: stroke(s.tone), stopOpacity: 0 }} />
              </linearGradient>
            ))}
          </defs>
          <g className="chart__grid">
            {ticks.map(t => (
              <g key={t}>
                <line x1="0" x2={w} y1={y(t)} y2={y(t)} />
                <text x="0" y={y(t) - 6}>{format(t)} {unit}</text>
              </g>
            ))}
          </g>
          <g className="chart__x">
            {labels.map((l, i) => i === n - 1 || (i % step === 0 && n - 1 - i >= Math.ceil(step * 0.75)) ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{l}</text>
            ) : null)}
          </g>
          {series.map((s, si) => {
            const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number])
            const d = smooth(pts)
            return (
              <g key={s.name}>
                {s.area && <path className="chart__area" d={`${d} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${uid}-area-${series.filter(z => z.area).indexOf(s)})`} />}
                <path className={`chart__line${s.dashed ? ' is-dashed' : ''}`} d={d} style={{ stroke: stroke(s.tone) }} data-i={si} />
              </g>
            )
          })}
          {hover !== null && (
            <g>
              <line className="chart__cross" x1={x(hover)} x2={x(hover)} y1={top} y2={top + ph} />
              {series.map(s => <circle key={s.name} className="chart__dot" cx={x(hover)} cy={y(s.values[hover])} r="5" style={{ fill: stroke(s.tone) }} />)}
            </g>
          )}
        </svg>
      )}
      {hover !== null && (
        <div className="chart__tip" style={{ transform: `translate(${tipLeft}px, 4px)` }} role="status">
          <b>{labels[hover]}</b>
          {series.map(s => (
            <span key={s.name}>
              <i className={s.dashed ? 'is-dashed' : undefined} style={{ borderColor: stroke(s.tone) }} />
              {s.name}
              <strong>{format(s.values[hover])}</strong>
            </span>
          ))}
        </div>
      )}
      <DataTable caption={label} head={['', ...series.map(s => s.name)]} rows={labels.map((l, i) => [l, ...series.map(s => format(s.values[i]))])} />
    </div>
  )
}

/** The same numbers as a table, for screen readers (and for the "table" view where a screen offers one) */
export function DataTable({ caption, head, rows, visible }: { caption: string; head: string[]; rows: ReactNode[][]; visible?: boolean }) {
  return (
    <table className={visible ? 'dtable' : 'sr-only'}>
      <caption className={visible ? 'sr-only' : undefined}>{caption}</caption>
      <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j} className="tnum">{c}</td>))}</tr>)}</tbody>
    </table>
  )
}

/** Progress ring with the value in the middle */
export function Ring({ value, size = 64, width = 7, hue, children }: { value: number; size?: number; width?: number; hue?: Hue; children?: ReactNode }) {
  const r = (size - width) / 2
  const c = 2 * Math.PI * r
  const arc = useRef<SVGCircleElement>(null)
  const v = Math.max(0, Math.min(1, value))
  useLayoutEffect(() => {
    if (reduced() || !arc.current) return
    gsap.fromTo(arc.current, { strokeDashoffset: c }, { strokeDashoffset: c * (1 - v), duration: 1.4, ease: 'power3.inOut' })
  }, [c, v])
  return (
    <span className={`pring${hue ? ` hue--${hue}` : ''}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="pring__track" cx={size / 2} cy={size / 2} r={r} style={{ strokeWidth: width }} />
        <circle ref={arc} className="pring__arc" cx={size / 2} cy={size / 2} r={r} style={{ strokeWidth: width }} strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      <span className="pring__val">{children}</span>
    </span>
  )
}


/** Column chart in the Pane look: a track per column, the bar grows from the bottom. `null` = no data yet (future day). */
export function Bars({ values, labels, hi, tone = 'accent', label, unit, names = labels }: {
  values: (number | null)[]
  labels: string[]
  /** Highlighted column (e.g. today) */
  hi?: number
  tone?: Tone
  label: string
  unit: string
  /** Long names for the tooltip and the table, e.g. full weekday names */
  names?: string[]
}) {
  const box = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...values.map(v => v ?? 0)) * 1.15
  useLayoutEffect(() => {
    if (box.current) enter(box.current.querySelectorAll('.bars__bar'), { transform: 'scaleY(0)' }, { duration: 1.1, ease: 'power3.out', stagger: 0.08 })
  }, [])
  return (
    <div className="bars" ref={box} onPointerLeave={() => setHover(null)}>
      {values.map((v, i) => (
        <div key={i} className={`bars__col${i === hi ? ' is-hi' : ''}`} onPointerEnter={() => setHover(i)}>
          <span className="bars__track" tabIndex={0} aria-label={`${names[i]}: ${v === null ? 'мэдээлэл алга' : `${v} ${unit}`}`}
            onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            {v !== null && v > 0 && <i className="bars__bar" style={{ height: `${(v / max) * 100}%`, ['--bar' as string]: stroke(tone) }} />}
          </span>
          <span className="bars__lab" aria-hidden="true">{labels[i]}</span>
          {hover === i && v !== null && (
            <span className="chart__tip bars__tip" role="status"><b>{names[i]}</b><span>{label}<strong>{v} {unit}</strong></span></span>
          )}
        </div>
      ))}
    </div>
  )
}

/** Donut of parts of a whole. Colours follow each item (its project); the legend names them. */
export function Donut({ items, total, label, children }: { items: { key: string; value: number; hue: Hue; name: string }[]; total: number; label: string; children?: ReactNode }) {
  const svg = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const r = 64
  const c = 2 * Math.PI * r
  const gap = items.length > 1 ? 4 : 0
  let offset = 0
  useLayoutEffect(() => {
    if (reduced() || !svg.current) return
    gsap.from(svg.current.querySelectorAll('.donut__arc'), { strokeDasharray: `0 ${c}`, duration: 1.2, ease: 'power3.inOut', stagger: 0.06 })
  }, [c])
  return (
    <div className="donut" onPointerLeave={() => setHover(null)}>
      <svg ref={svg} viewBox="0 0 160 160" role="img" aria-label={label}>
        <circle className="donut__track" cx="80" cy="80" r={r} />
        {items.map(it => {
          const len = total ? (it.value / total) * c : 0
          const seg = (
            <circle key={it.key} className={`donut__arc hue--${it.hue}${hover && hover !== it.key ? ' is-dim' : ''}`} cx="80" cy="80" r={r}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-offset} onPointerEnter={() => setHover(it.key)} />
          )
          offset += len
          return seg
        })}
      </svg>
      <div className="donut__mid">{children}</div>
    </div>
  )
}

/** Thin columns with a y-axis (e.g. focus hours per day) and a tooltip per column */
export function Columns({ values, labels, tone = 'purple', unit, label, height = 220 }: { values: number[]; labels: string[]; tone?: Tone; unit: string; label: string; height?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const max = niceMax(Math.max(1, ...values))
  const tick = Math.max(1, Math.ceil(values.length / 8))
  useLayoutEffect(() => {
    if (box.current) enter(box.current.querySelectorAll('.hb__bar'), { transform: 'scaleY(0)' }, { duration: 1.1, ease: 'power3.out', stagger: 0.02 })
  }, [values.length])
  return (
    <div className="hb" ref={box} style={{ height }} onPointerLeave={() => setHover(null)}>
      <div className="hb__grid" aria-hidden="true">
        {[max, max / 2, 0].map(v => <span key={v}><em>{v} {unit}</em></span>)}
      </div>
      <div className="hb__cols">
        {values.map((v, i) => (
          <div key={i} className={`hb__col${i === values.length - 1 ? ' is-hi' : ''}${i === values.length - 1 || (i % tick === 0 && values.length - 1 - i >= Math.ceil(tick * 0.75)) ? ' is-tick' : ''}`}
            onPointerEnter={() => setHover(i)}>
            <span className="hb__track">
              <i className="hb__bar" style={{ height: `${(v / max) * 100}%`, ['--bar' as string]: stroke(tone) }} />
            </span>
            <span className="hb__lab" aria-hidden="true">{labels[i]}</span>
            {hover === i && <span className="chart__tip hb__tip" role="status"><b>{labels[i]}</b><span>{label}<strong>{v} {unit}</strong></span></span>}
          </div>
        ))}
      </div>
      <DataTable caption={label} head={['', label]} rows={labels.map((l, i) => [l, `${values[i]} ${unit}`])} />
    </div>
  )
}
