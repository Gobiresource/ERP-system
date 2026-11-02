// Render the ERP intro frame by frame in headless Chromium.
//   node render.mjs --stills 1,2.5,9   a few still frames to out/still-<t>.png
//   node render.mjs                     every sub-frame to frames/, then python3 build.py makes the MP4
//   --scene=hse-fire                    another video folder (default erp-intro)
// Sub-frames: 180° shutter, a little jitter; build.py averages them into motion blur (the cinematic-video skill).
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
const { chromium } = createRequire(import.meta.url)('playwright')

const ROOT = new URL('.', import.meta.url).pathname
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.woff2': 'font/woff2' }
const server = createServer(async (req, res) => {
  const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return }
  try { res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(await readFile(path)) }
  catch { res.writeHead(404).end() }
})
await new Promise(ok => server.listen(0, '127.0.0.1', ok))
// --preview: half size, 30 fps, no motion blur, to check the cut quickly
const PREVIEW = process.argv.includes('--preview')
const SCENE = (process.argv.find(a => a.startsWith('--scene=')) ?? '--scene=erp-intro').slice(8)   // a folder next to this file
const url = `http://127.0.0.1:${server.address().port}/${SCENE}/index.html${PREVIEW ? '?scale=0.5' : ''}`

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: PREVIEW ? 0.5 : 1 })
page.on('console', m => m.type() === 'error' && console.error('page:', m.text()))
page.on('pageerror', e => console.error('page error:', e.message))
await page.goto(url)
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 })
const { DURATION, EVENTS } = await page.evaluate(() => ({ DURATION, EVENTS }))
const FPS = PREVIEW ? 30 : await page.evaluate(() => FPS)

const arg = process.argv.indexOf('--stills')
await mkdir(join(ROOT, 'out'), { recursive: true })
if (arg > 0) {
  for (const t of process.argv[arg + 1].split(',').map(Number)) {
    const t0 = Date.now()
    await page.evaluate(t => window.seek(t), t)
    await page.screenshot({ path: join(ROOT, `out/still-${t}.png`) })
    console.log(`t=${t}s ${Date.now() - t0} ms`)
  }
} else {
  await mkdir(join(ROOT, 'frames'), { recursive: true })
  await writeFile(join(ROOT, 'out/events.json'), JSON.stringify({ DURATION, FPS, EVENTS }))
  const frames = Math.round(DURATION * FPS)
  const list = []
  const start = Date.now()
  for (let f = 0; f < frames; f++) {
    const n = PREVIEW ? 1 : await page.evaluate(f => window.subframes(f), f)
    const subs = []
    for (let k = 0; k < n; k++) {
      // spread over half a frame (180° shutter) centred on the frame time, with a small fixed jitter
      const jitter = n > 1 ? (Math.sin((f * 7 + k) * 12.9898) * 0.5 + 0.5) * 0.6 - 0.3 : 0
      const t = n > 1 ? (f + 0.5 * ((k + 0.5 + jitter) / n - 0.5)) / FPS : f / FPS
      await page.evaluate(t => window.seek(t), t)
      const file = `f${String(f).padStart(5, '0')}_${k}.jpg`
      await page.screenshot({ path: join(ROOT, 'frames', file), type: 'jpeg', quality: 94 })
      subs.push(file)
    }
    list.push(subs)
    if (f % 60 === 0) console.log(`frame ${f}/${frames}  ${((Date.now() - start) / 1000).toFixed(0)} s`)
  }
  await writeFile(join(ROOT, 'frames/list.json'), JSON.stringify(list))
}
await browser.close()
server.close()
