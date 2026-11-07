// The soft light that follows the pointer over glass surfaces (--gx/--gy in .glass). Call startGlint() once.
// Only on devices with a real pointer; on touch screens the glass stays still.
function startGlint() {
  if (!window.matchMedia('(hover: hover)').matches) return
  let el = null, x = 0, y = 0, raf = 0
  const clear = () => { el?.style.removeProperty('--gx'); el?.style.removeProperty('--gy') }
  addEventListener('pointermove', e => {
    const g = e.target?.closest?.('.glass') ?? null
    if (g !== el) clear()
    el = g; x = e.clientX; y = e.clientY
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
