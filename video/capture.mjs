// Screenshots of the ERP at phone size for the intro video, signed in as the sample employee
// (Ганзориг, "Ажилтан" rights). Also writes shots/geometry.json: where the fields, buttons and
// bottom-menu tabs are, so the video can show taps in the right places.
//   node capture.mjs [address]
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
const { chromium } = createRequire(import.meta.url)('playwright')

const URL = process.argv[2] || 'https://gobi-erp.gobiresource.workers.dev/'
const OUT = new globalThis.URL('./shots/', import.meta.url).pathname
const SCALE = 3
const box = async loc => {
  const b = await loc.boundingBox()
  return b && { x: b.x * SCALE, y: b.y * SCALE, w: b.width * SCALE, h: b.height * SCALE }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: SCALE, colorScheme: 'light',
  isMobile: true, hasTouch: true, locale: 'mn-MN', timezoneId: 'Asia/Ulaanbaatar',
})
const page = await ctx.newPage()
const shot = name => page.screenshot({ path: `${OUT}${name}.png` })
const geo = {}

await page.goto(URL, { waitUntil: 'networkidle' })
// the example accounts are only for the test version; employees will not see them
await page.addStyleTag({ content: '.login__demo { display: none !important }' })
await page.waitForTimeout(600)
const name = page.locator('input').first()
const pass = page.locator('input[type=password]')
const submit = page.locator('button[type=submit]')
geo.name = await box(name); geo.pass = await box(pass); geo.submit = await box(submit)
await shot('login-0')
await name.click(); await page.waitForTimeout(200); await shot('login-name-0')
const login = 'ganzorig', password = 'erp2026'
for (let i = 1; i <= login.length; i++) { await name.press(login[i - 1]); await shot(`login-name-${i}`) }
await pass.click(); await page.waitForTimeout(200); await shot('login-pass-0')
for (let i = 1; i <= password.length; i++) { await pass.press(password[i - 1]); await shot(`login-pass-${i}`) }
await submit.click()
await page.waitForTimeout(2500)

geo.tabs = []
for (const t of await page.locator('.tabbar .tab').all()) geo.tabs.push({ label: (await t.innerText()).trim(), ...(await box(t)) })
for (const p of ['home', 'tasks', 'requests', 'chat', 'calendar', 'docs', 'insights', 'projects', 'draft', 'team']) {
  await page.evaluate(h => { location.hash = h }, p)
  await page.waitForTimeout(1300)
  await shot(`page-${p}`)
}
// the «Бусад» menu with the rest of the sections
await page.evaluate(() => { location.hash = 'chat' })
await page.waitForTimeout(800)
await page.locator('.tabbar button.tab').click()
await page.waitForTimeout(700)
await shot('more-menu')
geo.more = []
for (const m of await page.locator('[role=menuitem]').all()) geo.more.push({ label: (await m.innerText()).trim(), ...(await box(m)) })

writeFileSync(`${OUT}geometry.json`, JSON.stringify(geo, null, 1))
await browser.close()
console.log('tabs:', geo.tabs.map(t => t.label).join(', '), '| more:', geo.more.map(m => m.label).join(', '))
