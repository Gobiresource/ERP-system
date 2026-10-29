// The soft light that follows the pointer over glass surfaces (--gx/--gy in .glass).
export function startGlint() {
  if (!window.matchMedia('(hover: hover)').matches) return
  let el: HTMLElement | null = null
  let x = 0
  let y = 0
  let raf = 0
  const clear = () => {
    el?.style.removeProperty('--gx')
    el?.style.removeProperty('--gy')
  }
  addEventListener('pointermove', e => {
    const g = (e.target as Element | null)?.closest?.<HTMLElement>('.glass') ?? null
    if (g !== el) clear()
    el = g
    x = e.clientX
    y = e.clientY
    if (el && !raf) {
      raf = requestAnimationFrame(() => {
        raf = 0
        if (!el) return
        const r = el.getBoundingClientRect()
        el.style.setProperty('--gx', `${x - r.left}px`)
        el.style.setProperty('--gy', `${y - r.top}px`)
      })
    }
  }, { passive: true })
  document.documentElement.addEventListener('pointerleave', () => { clear(); el = null })
}
