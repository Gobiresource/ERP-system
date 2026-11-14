// Walks every guided tour (Сургалт → ERP заавар, src/lib/tours.ts) with «Үргэлжлүүлэх», on a desktop and a phone, signed
// in as the example director. For each tour it says which steps showed, which were passed over (their element was not
// there) and which showed without a lit element. Run it after changing a screen: a class or an id a step points at may
// be gone, and the step would then be passed over without a word.
//
// Usage: build, serve web/dist on 4173 (npx vite preview --port 4173 --strictPort), then
//   node web/scripts/tour-walk.cjs [address] [tour id ...]
// Needs Playwright with Chromium (already in the cloud container; elsewhere: npm i playwright).
const { chromium } = require('playwright')
const args = process.argv.slice(2)
const BASE = /^https?:/.test(args[0] ?? '') ? args.shift() : 'http://localhost:4173'
const ONLY = args
let fails = 0
;(async () => {
  const b = await chromium.launch()
  for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    const ctx = await b.newContext(opts)
    // The session the sign-in page keeps: Б.Болд (u1), who may open everything
    await ctx.addInitScript(() => { if (!localStorage.getItem('erp:session')) localStorage.setItem('erp:session', JSON.stringify({ user: 'u1', until: Date.now() + 864e5 })) })
    const p = await ctx.newPage()
    p.setDefaultTimeout(6000)
    const errors = []
    p.on('pageerror', e => errors.push(e.message))
    // Without the server Ирц has nothing to read (502): not this script's business
    p.on('console', m => m.type() === 'error' && !/502|503|Failed to load resource/.test(m.text()) && errors.push(m.text()))
    await p.goto(`${BASE}/#training-erp`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(900)
    const ids = await p.$$eval('[data-tour-start]', els => els.map(e => e.dataset.tourStart))
    console.log(`\n=== ${name}: ${ids.length} tours`)
    for (const id of ids.filter(x => !ONLY.length || ONLY.includes(x))) {
      await p.goto(`${BASE}/#training-erp`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(500)
      await p.locator(`[data-tour-start="${id}"]`).click()
      const seen = [], bare = []
      let total = 0, title = ''
      for (let guard = 0; guard < 40; guard++) {
        // The card takes its place once the step's element is found, or given up on
        const shown = await p.waitForFunction(() => { const c = document.querySelector('.tour__card'); return !c || getComputedStyle(c).visibility !== 'hidden' }, null, { timeout: 6000 }).then(() => true, () => false)
        if (!shown) { console.log('   FAIL the card never showed'); fails++; break }
        const st = await p.evaluate(() => {
          const c = document.querySelector('.tour__card')
          if (!c) return null
          const r = c.getBoundingClientRect()
          return { count: c.querySelector('.tour__count').textContent, title: c.querySelector('.tour__title').textContent, lit: !!document.querySelector('.tour__ring'), off: r.x < 0 || r.y < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 }
        })
        if (!st) {
          // Gone for good, not just between two windows
          await p.waitForTimeout(500)
          if (await p.evaluate(() => !document.querySelector('.tour__card'))) break
          continue
        }
        const m = /^(.*), (\d+) \/ (\d+)$/.exec(st.count)
        title = m[1]; total = Number(m[3])
        seen.push(Number(m[2]))
        if (!st.lit) bare.push(`${m[2]} «${st.title}»`)
        if (st.off) { console.log(`   FAIL step ${m[2]}: the card is off the screen`); fails++ }
        await p.locator('.tour__card [data-go]').click()
        await p.waitForFunction(was => document.querySelector('.tour__count')?.textContent !== was, st.count, { timeout: 6000 }).catch(() => {})
      }
      const passed = Array.from({ length: total }, (_, i) => i + 1).filter(n => !seen.includes(n))
      const end = await p.evaluate(() => ({ tour: !!document.querySelector('.tour'), window: !!document.querySelector('dialog[open]'), hash: location.hash }))
      const bad = end.tour || end.window || end.hash !== '#training-erp'
      if (bad) fails++
      console.log(`${bad ? 'FAIL' : 'ok  '} ${id.padEnd(11)} «${title}» ${seen.length}/${total} shown${passed.length ? `, passed over: ${passed.join(',')}` : ''}${bare.length ? `, NO ELEMENT LIT: ${bare.join('; ')}` : ''}${bad ? ` | ended at ${JSON.stringify(end)}` : ''}`)
    }
    if (errors.length) { fails++; console.log(`PAGE ERRORS: ${[...new Set(errors)].slice(0, 5).join(' / ')}`) }
    await ctx.close()
  }
  await b.close()
  console.log(fails ? `FAILED ${fails}` : 'ALL OK')
  process.exit(fails ? 1 : 0)
})()
