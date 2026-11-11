// Renders the invented sample page (specimen.html) to assets/specimen.png and writes where each part truly sits
// (assets/specimen-boxes.json, fractions of the page), to compare the model's own boxes with and to place the "?" mark.
// The deck shows assets/specimen.jpg: the very picture the model read (README.md). Make a new JPEG from the PNG only
// together with a new reading.
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

;(async () => {
  const out = process.argv[2] || path.join(__dirname, 'assets')
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1040, height: 800 }, deviceScaleFactor: 2 })
  await page.goto('file://' + path.join(__dirname, 'specimen.html'))
  await page.waitForTimeout(300)
  await page.locator('#page').screenshot({ path: path.join(out, 'specimen.png') })
  const boxes = await page.evaluate(() => {
    const W = 1040, H = 800
    const pick = (...ids) => {
      const rs = ids.map(id => document.getElementById(id).getBoundingClientRect())
      const x0 = Math.min(...rs.map(r => r.left)), y0 = Math.min(...rs.map(r => r.top))
      const x1 = Math.max(...rs.map(r => r.right)), y1 = Math.max(...rs.map(r => r.bottom))
      return [x0 / W, y0 / H, x1 / W, y1 / H].map(v => +v.toFixed(4))
    }
    return { header: pick('hdr'), kind: pick('kind', 'meta'), title: pick('title'), body: pick('body'), table: pick('tbl'), signature: pick('sign', 'signature'), stamp: pick('stamp'), sample: pick('sample'), faint: (() => { const r = document.querySelector('.faint').getBoundingClientRect(); return [r.left / W, r.top / H, r.right / W, r.bottom / H].map(v => +v.toFixed(4)) })() }
  })
  fs.writeFileSync(path.join(out, 'specimen-boxes.json'), JSON.stringify(boxes, null, 2))
  console.log(JSON.stringify(boxes))
  await browser.close()
})()
