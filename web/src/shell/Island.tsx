// The island: a black pill that holds the focus timer and short messages ("Дууссан: ...", with Undo).
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Check, ChevronUp, Info, Moon, Pause, Play, Plus, Square, TriangleAlert } from 'lucide-react'
import { getState } from '../lib/store'
import { clearNote, focus, focusLeft, setIslandOpen, tickFocus, useUi } from '../lib/ui'
import { gsap, reduced } from '../lib/motion'
import { clock } from '../lib/format'

type Mode = 'hidden' | 'compact' | 'note' | 'full'

const wideQuery = window.matchMedia('(width >= 1360px)')
const phoneQuery = window.matchMedia('(width <= 760px)')
const useQuery = (q: MediaQueryList) =>
  useSyncExternalStore(f => (q.addEventListener('change', f), () => q.removeEventListener('change', f)), () => q.matches)

function size(mode: Mode) {
  const vw = window.innerWidth
  if (mode === 'compact') return { width: 204, height: 38, borderRadius: 19 }
  if (mode === 'note') return { width: Math.min(384, vw - 24), height: 62, borderRadius: 31 }
  if (mode === 'full') return { width: Math.min(440, vw - 20), height: 168, borderRadius: 34 }
  return { width: 204, height: 38, borderRadius: 19 }
}

function Ring({ value, size: px, stroke = 3 }: { value: number; size: number; stroke?: number }) {
  const r = (px - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="island__ring" aria-hidden="true">
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} style={{ strokeWidth: stroke }}>
        <circle className="ring-track" cx={px / 2} cy={px / 2} r={r} />
        <circle className="ring-fill" cx={px / 2} cy={px / 2} r={r} strokeDasharray={c} strokeDashoffset={c * (1 - value)} />
      </svg>
    </span>
  )
}

export function Island() {
  const ui = useUi()
  const f = ui.focus
  const wide = useQuery(wideQuery)
  const phone = useQuery(phoneQuery)
  const body = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLElement | null>(null)
  const setInner = (el: HTMLElement | null) => { inner.current = el }
  const [, setTick] = useState(0)

  // Tick every second while the timer runs
  useEffect(() => {
    if (f.status !== 'running') return
    const id = window.setInterval(() => { tickFocus(); setTick(t => t + 1) }, 1000)
    return () => clearInterval(id)
  }, [f.status])

  const mode: Mode = ui.note ? 'note' : f.status === 'idle' ? 'hidden' : ui.islandOpen ? 'full' : 'compact'
  const docked = mode === 'compact' && (wide || phone)
  const right = wide && (mode === 'note' || mode === 'full')

  // Keep the page title clear of the docked island
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--isl-w', docked && wide ? '216px' : '0px')
  }, [docked, wide])

  // Morph between sizes
  const last = useRef<Mode>('hidden')
  useLayoutEffect(() => {
    const el = body.current!
    const from = last.current
    last.current = mode
    const target = size(mode)
    if (reduced()) {
      gsap.set(el, { ...target, opacity: mode === 'hidden' ? 0 : 1, scale: 1 })
      return
    }
    if (mode === 'hidden') {
      gsap.to(el, { opacity: 0, scale: 0.85, duration: 0.3, ease: 'power3.in' })
      return
    }
    if (from === 'hidden') gsap.fromTo(el, { ...size('compact'), opacity: 0, scale: 0.85 }, { ...target, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' })
    else {
      const grows = target.height >= el.offsetHeight
      gsap.to(el, { ...target, opacity: 1, scale: 1, duration: grows ? 0.5 : 0.35, ease: grows ? 'power3.inOut' : 'power3.in' })
    }
    if (inner.current) gsap.fromTo(inner.current, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.15 })
  }, [mode])

  // A click outside or Esc folds the open timer back
  useEffect(() => {
    if (mode !== 'full') return
    const onDown = (e: PointerEvent) => { if (!body.current?.contains(e.target as Node)) setIslandOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIslandOpen(false) }
    addEventListener('pointerdown', onDown)
    addEventListener('keydown', onKey)
    return () => { removeEventListener('pointerdown', onDown); removeEventListener('keydown', onKey) }
  }, [mode])

  const left = focusLeft(f)
  const progress = f.total ? 1 - left / f.total : 0
  const task = f.task ? getState().tasks.find(t => t.id === f.task) : undefined
  const paused = f.status === 'paused'
  const NoteIcon = ui.note?.kind === 'warn' ? TriangleAlert : ui.note?.kind === 'info' ? (f.status !== 'idle' ? Moon : Info) : Check

  return (
    <>
      <div className={`island${docked ? ' is-docked' : ''}${right ? ' is-right' : ''}${paused ? ' is-paused' : ''}`} data-mode={mode}>
        <div className="island__body" ref={body} style={{ opacity: 0 }}>
          {mode === 'compact' && (
            <button type="button" className="island__compact" ref={setInner} onClick={() => setIslandOpen(true)} aria-label={`Төвлөрөл, ${clock(left)} үлдсэн. Дэлгэх`}>
              <Ring value={progress} size={24} />
              <span className="island__label">Төвлөрөл</span>
              <span className="island__time">{clock(left)}</span>
            </button>
          )}
          {mode === 'note' && ui.note && (
            <div className="island__note" ref={setInner}>
              <span className={`island__ico island__ico--${ui.note.kind}`}><NoteIcon className="ico" /></span>
              <span className="island__msg">{ui.note.text}</span>
              {ui.note.undo && (
                <button type="button" className="island__undo" onClick={() => { ui.note?.undo?.(); clearNote() }}>Буцаах</button>
              )}
            </div>
          )}
          {mode === 'full' && (
            <div className="island__full" ref={setInner} role="group" aria-label="Төвлөрөх цаг">
              <div className="island__top">
                <Ring value={progress} size={40} stroke={4} />
                <span className="island__what">
                  <small>{paused ? 'Түр зогссон' : 'Төвлөрч байна'}</small>
                  <span className="island__task">{task ? task.title : `${Math.round(f.total / 60)} минутын төвлөрөл`}</span>
                </span>
                <span className="island__big">{clock(left)}</span>
              </div>
              <div className="island__ctrls">
                <button type="button" className="island__btn island__btn--fold" onClick={() => setIslandOpen(false)} aria-label="Хураах"><ChevronUp className="ico" /></button>
                <button type="button" className="island__btn" onClick={focus.addFive}><Plus className="ico" />5 мин</button>
                <button type="button" className="island__btn island__btn--round" onClick={paused ? focus.resume : focus.pause} aria-label={paused ? 'Үргэлжлүүлэх' : 'Түр зогсоох'}>
                  {paused ? <Play className="ico" /> : <Pause className="ico" />}
                </button>
                <button type="button" className="island__btn island__btn--round island__btn--stop" onClick={() => focus.end()} aria-label="Дуусгах"><Square className="ico" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="sr-only" role="status" aria-live="polite">{ui.note?.text}</div>
    </>
  )
}
