// Render plan.svg to plan.png (A3 landscape, 2x) and plan.pdf (A3) with the preinstalled Playwright.
//   node render.mjs
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
const { chromium } = createRequire(import.meta.url)('playwright')

const here = new URL('.', import.meta.url).pathname
const svg = await readFile(here + 'plan.svg', 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1587, height: 1123 }, deviceScaleFactor: 2 })
await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`)
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: here + 'plan.png', clip: { x: 0, y: 0, width: 1587, height: 1123 } })
await page.pdf({ path: here + 'plan.pdf', width: '420mm', height: '297mm', printBackground: true, pageRanges: '1',
  margin: { top: '0', right: '0', bottom: '0', left: '0' }, scale: 420 / 25.4 * 96 / 1587 })
await browser.close()
console.log('plan.png, plan.pdf')
