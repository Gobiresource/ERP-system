// Motion, with the values measured from the Pane demo (docs/design/pane-features.md, "Хөдөлгөөн ба эффект").
// Every helper does nothing when the system asks for reduced motion.
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { useLayoutEffect, type RefObject } from 'react'

gsap.registerPlugin(Flip)
export { gsap, Flip }

const query = window.matchMedia('(prefers-reduced-motion: reduce)')
export const reduced = () => query.matches

/** Page entrance: title letters rise, then cards and rows fade up, numbers count up. */
export function enterPage(root: HTMLElement) {
  if (reduced()) return
  const tl = gsap.timeline()
  tl.from(root.querySelectorAll('.head__title .ch'), { yPercent: 115, rotation: 6, duration: 0.85, ease: 'power4.out', stagger: 0.022 }, 0)
  tl.from(root.querySelectorAll('.head__sub, .head__stats > *, .head__actions > *'), { opacity: 0, y: 8, duration: 0.55, ease: 'power3.out', stagger: 0.035 }, 0.08)
  tl.from(root.querySelectorAll('[data-enter]'), { opacity: 0, y: 14, scale: 0.98, duration: 0.6, ease: 'power3.out', stagger: 0.05, clearProps: 'transform,opacity' }, 0.12)
  root.querySelectorAll<HTMLElement>('[data-count]').forEach(el => countUp(el))
  return tl
}

/** Counts a number up from 0. The element keeps its final text from React. */
export function countUp(el: HTMLElement) {
  if (reduced()) return
  const final = el.textContent ?? ''
  const target = parseFloat(el.dataset.count ?? '')
  if (!Number.isFinite(target)) return
  const decimals = (el.dataset.count!.split('.')[1] ?? '').length
  const o = { v: 0 }
  gsap.to(o, {
    v: target, duration: 1.1, ease: 'power2.out',
    onUpdate: () => { el.textContent = o.v.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') },
    onComplete: () => { el.textContent = final },
  })
}

/** Cards appearing on the task board */
export function popIn(targets: gsap.TweenTarget, stagger = 0.03) {
  if (reduced()) return
  gsap.from(targets, { opacity: 0, y: 14, scale: 0.94, duration: 0.55, ease: 'back.out(1.6)', stagger, clearProps: 'transform,opacity' })
}

/** The check mark when a task is completed, with a ripple */
export function checkPop(el: HTMLElement) {
  if (reduced()) return
  gsap.fromTo(el, { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.75, ease: 'back.out(3.4)', clearProps: 'transform' })
  const ring = document.createElement('span')
  ring.className = 'check-ring'
  el.parentElement?.append(ring)
  gsap.fromTo(ring, { scale: 0.5, opacity: 0.9 }, { scale: 2.8, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => ring.remove() })
}

/** Squash on drop */
export function settle(el: HTMLElement) {
  if (reduced()) return
  gsap.fromTo(el, { scaleX: 1.03, scaleY: 0.96 }, { scaleX: 1, scaleY: 1, duration: 0.65, ease: 'elastic.out(1, 0.45)', clearProps: 'transform' })
}

/** Records positions before a change; call the returned function after React has rendered. */
export function flip(targets: string | Element[] | NodeListOf<Element>, opts: Flip.FromToVars = {}) {
  if (reduced()) return () => {}
  const st = Flip.getState(targets)
  return () => Flip.from(st, { duration: 0.65, ease: 'power3.inOut', absolute: false, ...opts })
}

/**
 * The sliding highlight behind the selected item (side menu, tab bar, segmented controls).
 * `selector` finds the selected item inside `track`.
 */
export function useLens(track: RefObject<HTMLElement | null>, lens: RefObject<HTMLElement | null>, selector: string, key: unknown) {
  useLayoutEffect(() => {
    const t = track.current
    const l = lens.current
    if (!t || !l) return
    const place = (animate: boolean) => {
      const item = t.querySelector<HTMLElement>(selector)
      if (!item) return void gsap.to(l, { opacity: 0, duration: 0.2, overwrite: true })
      const box = { x: item.offsetLeft, y: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight, opacity: 1 }
      if (!animate || reduced()) gsap.set(l, { ...box, overwrite: true })
      else gsap.to(l, { ...box, duration: 0.5, ease: 'power3.inOut', overwrite: true })
    }
    place(l.dataset.ready === '1')
    l.dataset.ready = '1'
    // Snap into place when the layout changes size, e.g. when a window that holds it opens
    const ro = new ResizeObserver(() => { if (!gsap.isTweening(l)) place(false) })
    ro.observe(t)
    return () => ro.disconnect()
  }, [key, selector, track, lens])
}

/** Runs the page entrance once, and moves keyboard focus to the title after a page change. */
export function usePageEnter(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (document.body.dataset.navigated) el.querySelector<HTMLElement>('#page-title')?.focus({ preventScroll: true })
    const tl = enterPage(el)
    return () => void tl?.kill()
  }, [ref])
}
