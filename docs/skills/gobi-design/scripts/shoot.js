// Pictures of a page for checking a design: desktop 1440x900 and phone 390x844, light and dark, and one with reduced
// motion. Prints page errors and any sideways overflow. With --scale it also opens the page at a real 125% and 150%
// screen scale (Playwright's deviceScaleFactor draws differently from a real scaled screen; thin lines show it).
// Usage: node shoot.js <url or file path> <out dir> [--scale]
// Needs Playwright with Chromium (npm i playwright; npx playwright install chromium) unless already installed.
const { chromium } = require('playwright')
const fs = require('fs'), path = require('path')
const [target, out = 'shots', flag] = process.argv.slice(2)
if (!target) { console.log('Usage: node shoot.js <url or file path> <out dir> [--scale]'); process.exit(1) }
const url = /^https?:|^file:/.test(target) ? target : 'file://' + path.resolve(target)
fs.mkdirSync(out, { recursive: true })
const look = async (p, name, w) => {
  const errors = []
  p.on('pageerror', e => errors.push(e.message))
  p.on('console', m => m.type() === 'error' && errors.push(m.text()))
  await p.goto(url, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  // Compared with the width asked for: a phone browser zooms out to fit a page that is too wide
  const over = await p.evaluate(w => document.documentElement.scrollWidth - w, w)
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  console.log(name.padEnd(22), over > 0 ? `OVERFLOW ${over}px sideways` : 'no sideways overflow', errors.length ? `| errors: ${errors.slice(0, 3).join(' / ')}` : '')
}
;(async () => {
  const b = await chromium.launch()
  for (const [w, h, dev] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: dev === 'phone' ? 3 : 1, isMobile: dev === 'phone', hasTouch: dev === 'phone' })
      await look(await ctx.newPage(), `${dev}-${scheme}`, w)
      await ctx.close()
    }
  }
  const rm = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await look(await rm.newPage(), 'desktop-reduced-motion', 1440)
  await b.close()
  if (flag === '--scale') {
    for (const s of [1.25, 1.5]) {
      const sb = await chromium.launch({ args: [`--force-device-scale-factor=${s}`, '--window-size=1440,900'] })
      const ctx = await sb.newContext({ viewport: null })
      await look(await ctx.newPage(), `desktop-scale-${s}`, 1440)
      await sb.close()
    }
  }
  console.log(`Pictures in ${path.resolve(out)}. Look at each one before calling the screen done.`)
})()
