// The guided tour: teaches the ERP on its real screens, one step at a time. Everything goes dark except the element the
// step is about, and a card beside it says what it does. A step that asks for a press lets it through to the element
// itself; any other step keeps hands off, so nothing is saved by accident. Алгасах (or Esc) ends the tour at any step.
// The steps are in lib/tours.ts. The user's request, docs/decisions.md, 2026-11-14.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { MousePointerClick } from 'lucide-react'
import '../styles/tour.css'
import { actions } from '../lib/store'
import { close, endTour, getUi, open, setFinder, setTourStep, toast, useUi } from '../lib/ui'
import { reduced } from '../lib/motion'
import { TOURS, type Step, type Tour as TourData } from '../lib/tours'

/** The lit area, in screen pixels: the element and a little room round it */
interface Box { x: number; y: number; w: number; h: number; r: number }
const PAD = 8
/** How long a step waits for its element (a page or window still opening) before it does without */
const WAIT = 1800
/** After a step changes the page or the window, the old one is still on screen for a moment */
const SETTLE = 160

/** The first of the step's selectors with an element on screen */
function find(at: Step['at']): HTMLElement | null {
  for (const sel of at ? (Array.isArray(at) ? at : [at]) : []) {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0 && (el.checkVisibility?.({ visibilityProperty: true }) ?? true)) return el
    }
  }
  return null
}

const radii = new WeakMap<Element, number>()
function radiusOf(el: HTMLElement) {
  let r = radii.get(el)
  // A little rounder than the element, never so round that it cuts into a square one's corners
  if (r === undefined) radii.set(el, (r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 6, 28) + 4))
  return r
}

/** Brings the element clear of the toolbar above and a phone's tab bar below */
function reveal(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  const top = 84, bottom = innerHeight - 96
  if (r.top >= top && r.bottom <= bottom) return
  el.scrollIntoView({ block: r.height > bottom - top ? 'start' : 'center', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' })
}

/**
 * The page and the window a step is shown over: its own, or those of the last step before it that set them. Makes them
 * so, then runs the step's own preparation. Not ok when the step has nothing to show: no such record to open, or a
 * step the person may not take.
 */
function prepare(steps: Step[], at: number): { ok: boolean; changed: boolean; window?: boolean } {
  let page: Step['page'], win: Step['win'] = null
  for (const s of steps.slice(0, at + 1)) {
    if (s.page !== undefined) page = s.page
    if (s.win !== undefined) win = s.win
  }
  const hash = typeof page === 'function' ? page() : page
  const dialog = typeof win === 'function' ? win() : win
  if ((page && hash === undefined) || (win && !dialog) || steps[at].when?.() === false) return { ok: false, changed: false }
  let changed = false
  if (hash !== undefined && location.hash.slice(1) !== hash) { location.hash = hash; changed = true }
  const now = getUi().dialog
  const same = dialog ? JSON.stringify(now) === JSON.stringify(dialog) : !now
  if (!same) dialog ? open(dialog) : close()
  if (getUi().finder) setFinder(false)
  steps[at].before?.()
  return { ok: true, changed: changed || !same || !!steps[at].before, window: !same }
}

/** Beside the lit element: under it, else over it, else at its side, else over the half of the screen it is not in */
function place(card: HTMLElement, b: Box | null) {
  const vw = innerWidth, vh = innerHeight, cw = card.offsetWidth, ch = card.offsetHeight, M = 12, GAP = 12
  const clamp = (v: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(v, hi)))
  let left = (vw - cw) / 2, top = (vh - ch) / 2
  if (b) {
    left = b.x + b.w / 2 - cw / 2
    if (b.y + b.h + GAP + ch <= vh - M) top = b.y + b.h + GAP
    else if (b.y - GAP - ch >= M) top = b.y - GAP - ch
    else if (b.x + b.w + GAP + cw <= vw - M) [left, top] = [b.x + b.w + GAP, b.y]
    else if (b.x - GAP - cw >= M) [left, top] = [b.x - GAP - cw, b.y]
    else top = b.y + b.h / 2 < vh / 2 ? vh - ch - M : M
  }
  // On screen wherever the element is: it may still be scrolling into view
  return { left: clamp(left, M, vw - cw - M), top: clamp(top, M, vh - ch - M) }
}

/** Keeps a suffix on the line of the word it belongs to: «Ээлжийн амралт»-ыг, ХХК-ийн */
const joined = (text: string) => text.replace(/([»\p{L}\d])-(?=\p{L})/gu, '$1-\u2060')

export function Tour() {
  const { tour } = useUi()
  const data = tour && TOURS.find(t => t.id === tour.id)
  return tour && data ? <Run key={tour.id} tour={data} at={tour.at} /> : null
}

function Run({ tour, at }: { tour: TourData; at: number }) {
  const step = tour.steps[at]
  const last = at === tour.steps.length - 1
  /** Which way the person is going, so a step with nothing to show is passed over the same way */
  const way = useRef(1)
  /** The open window the layer sits in: a modal window lets nothing outside it be pressed */
  const [host, setHost] = useState<Element | null>(null)
  /**
   * What is lit and where the card stands, with the step they were found for. Until a new step finds its own element,
   * the last one stays lit (no flash of full dark between steps) while the card waits out of sight.
   */
  const [geo, setGeo] = useState<{ at: number; box: Box | null; pos: { left: number; top: number } | null }>({ at: -1, box: null, pos: null })
  const live = geo.at === at
  const box = geo.box
  const pos = live ? geo.pos : null
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const target = useRef<HTMLElement | null>(null)

  const finish = () => {
    actions.tourDone(tour.id)
    endTour()
    toast(`«${tour.title}» заавар дууслаа.`)
  }
  const move = (to: number) => {
    way.current = to > at ? 1 : -1
    if (to >= tour.steps.length) finish()
    else if (to >= 0) setTourStep(to)
  }

  // A step: the page and window it needs, then its element is looked for on every frame, since pages and windows move
  // while they open and the page can be scrolled
  useEffect(() => {
    const ready = prepare(tour.steps, at)
    if (!ready.ok) return move(at + way.current)
    // The window the layer sat in is closing: out of it in the same breath, or the layer would be gone with it for a moment
    if (ready.window) setHost(null)
    target.current = null
    const since = performance.now() + (ready.changed ? SETTLE : 0)
    let raf = 0, seen: Element | null = null, tops = 0, asked = 0, away = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const windows = document.querySelectorAll('dialog[open]')
      const h = windows[windows.length - 1] ?? null
      setHost(was => (was === h ? was : h))
      // A menu or panel that opened since lies over the layer: the layer goes back on top of it
      const n = document.querySelectorAll(':popover-open:not(.tour)').length
      const el0 = root.current
      if (n > tops && el0?.matches(':popover-open')) { el0.hidePopover(); el0.showPopover() }
      tops = n
      if (performance.now() < since) return
      const el = find(step.at)
      target.current = el
      let next: Box | null = null
      if (el) {
        const r = el.getBoundingClientRect(), now = performance.now()
        // Into view when found, and again when its top stays out of view: a scroll started by the step before can
        // carry it away after it was found
        const out = r.top < 0 || r.top > innerHeight - 60
        away = out ? away || now : 0
        if (el !== seen || (out && now - away > 350 && now - asked > 700)) { reveal((seen = el)); asked = now }
        next = { x: Math.round(r.left) - PAD, y: Math.round(r.top) - PAD, w: Math.round(r.width) + PAD * 2, h: Math.round(r.height) + PAD * 2, r: radiusOf(el) }
        // The whole screen cannot be told from the rest of it: the card stands alone
        if (next.w >= innerWidth && next.h >= innerHeight) next = null
      } else if (step.at && performance.now() - since < WAIT) {
        return // still opening
      } else if (step.at && step.optional) {
        cancelAnimationFrame(raf)
        return move(at + way.current)
      }
      const p = card.current ? place(card.current, next) : null
      const b = next
      // Drawn in this same frame: a window sliding in would otherwise leave the light a frame or two behind it
      flushSync(() => setGeo(g => {
        const sameBox = g.box === b || (!!g.box && !!b && g.box.x === b.x && g.box.y === b.y && g.box.w === b.w && g.box.h === b.h && g.box.r === b.r)
        const samePos = g.pos === p || (!!g.pos && !!p && g.pos.left === p.left && g.pos.top === p.top)
        return g.at === at && sameBox && samePos ? g : { at, box: b, pos: p }
      }))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, at])

  // In the top layer, and again whenever the layer moves into or out of a window
  useLayoutEffect(() => {
    const el = root.current
    if (el && !el.matches(':popover-open')) el.showPopover?.()
  }, [host])

  // The step's main button takes focus once the card has its place, so Enter goes on and a screen reader reads the step
  const shown = !!pos
  useEffect(() => {
    if (shown) card.current?.querySelector<HTMLElement>('[data-go]')?.focus({ preventScroll: true })
  }, [at, shown, host])

  // A press on the lit element goes on to the next step, after the element has done its own work
  useEffect(() => {
    if (!step.click) return
    const onClick = (e: MouseEvent) => {
      if (target.current && e.target instanceof Node && target.current.contains(e.target)) setTimeout(() => move(at + 1), 0)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at])

  // Esc ends the tour. Tab stays on the card (and the lit element when it is to be pressed). The app's own shortcuts rest.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        endTour()
      } else if (e.key === 'Tab') {
        e.preventDefault()
        const el = step.click && target.current?.matches('a[href], button, input, select, textarea, [tabindex]') ? [target.current] : []
        const stops = [...el, ...(card.current?.querySelectorAll<HTMLElement>('button') ?? [])]
        const i = stops.indexOf(document.activeElement as HTMLElement)
        stops[(i + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [at, step.click])

  return createPortal(
    <div className="tour" popover="manual" ref={root}>
      {box ? (
        <>
          <div className="tour__ring" style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: box.r }} />
          {/* Unseen: they keep presses off everything round the lit element */}
          <div style={{ left: 0, top: 0, right: 0, height: Math.max(0, box.y) }} />
          <div style={{ left: 0, top: box.y + box.h, right: 0, bottom: 0 }} />
          <div style={{ left: 0, top: box.y, width: Math.max(0, box.x), height: box.h }} />
          <div style={{ left: box.x + box.w, top: box.y, right: 0, height: box.h }} />
          {/* …and off the element itself while it is only explained, or still the step before's */}
          {!(live && step.click) && <div style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />}
        </>
      ) : <div className="tour__dim" />}
      <div key={at} className="tour__card glass glass--thick" ref={card} role="dialog" aria-labelledby="tour-t" aria-describedby="tour-x"
        style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}>
        <p className="tour__count">{tour.title}, {at + 1} / {tour.steps.length}</p>
        <h2 className="tour__title" id="tour-t">{joined(step.title)}</h2>
        <p className="tour__text" id="tour-x">{joined(step.text)}</p>
        {/* There before the card takes its place too, so its height does not change under it */}
        {step.click && (!live || box) && <p className="tour__hint"><MousePointerClick className="ico" />Гэрэлтсэн хэсэг дээр дарна уу.</p>}
        <div className="tour__btns">
          <button type="button" className="btn btn--ghost btn--sm tour__skip" onClick={endTour}>Алгасах</button>
          {at > 0 && <button type="button" className="btn btn--glass btn--sm" onClick={() => move(at - 1)}>Буцах</button>}
          <button type="button" className="btn btn--accent btn--sm" data-go onClick={() => move(at + 1)}>{last ? 'Дуусгах' : 'Үргэлжлүүлэх'}</button>
        </div>
      </div>
    </div>,
    host ?? document.body,
  )
}
