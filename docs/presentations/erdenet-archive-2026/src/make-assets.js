// Pictures the deck cannot draw with PowerPoint's own shapes: the two wallpapers (soft glows, as in the Pane look),
// the user's glass folder (docs/skills/gobi-design/assets/demo.html, #glassfolder) and lucide icons in the deck's hues.
const { chromium } = require('playwright')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const OUT = process.argv[2] || path.join(__dirname, 'assets')
fs.mkdirSync(OUT, { recursive: true })

// Wallpapers: a neutral base with two soft glows, copper for Erdenet's ore and teal for its patina
const WALLS = {
  light: `background:
      radial-gradient(52% 62% at 88% 6%, rgb(242 113 28 / .20) 0%, transparent 70%),
      radial-gradient(46% 58% at 4% 100%, rgb(14 165 164 / .20) 0%, transparent 72%),
      radial-gradient(40% 46% at 58% 108%, rgb(227 160 8 / .10) 0%, transparent 70%),
      #e9ebf1;`,
  dark: `background:
      radial-gradient(58% 70% at 92% 4%, rgb(196 80 15 / .50) 0%, transparent 70%),
      radial-gradient(50% 62% at 0% 104%, rgb(13 148 136 / .42) 0%, transparent 72%),
      radial-gradient(36% 44% at 56% 112%, rgb(245 184 46 / .14) 0%, transparent 70%),
      #0f1016;`,
}

// The user's own glass folder, exactly as in the design system; only the colour pair changes
const folder = (id, from, to) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 376" width="800" height="752"><defs><linearGradient id="${id}-bg" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient><linearGradient id="${id}-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".5" stop-color="#fff" stop-opacity=".32"/><stop offset="1" stop-color="#fff" stop-opacity=".16"/></linearGradient><radialGradient id="${id}-shine" cx=".2" cy="0" r="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient><clipPath id="${id}-card"><rect width="400" height="376" rx="38"/></clipPath><clipPath id="${id}-front"><path d="M0 176Q0 146 30 146H140C154 146 162 150 170 158L188 176C196 184 204 188 218 188H380Q400 188 400 208V376H0Z"/></clipPath><filter id="${id}-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="20"/></filter><filter id="${id}-ps" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#1b1340" flood-opacity=".16"/></filter></defs><g clip-path="url(#${id}-card)"><rect width="400" height="376" fill="url(#${id}-bg)"/><rect width="400" height="376" fill="url(#${id}-shine)"/><g transform="rotate(9 272 160)" filter="url(#${id}-ps)"><rect x="200" y="62" width="146" height="196" rx="16" fill="#eceef3"/><rect x="222" y="86" width="82" height="11" rx="5.5" fill="#dcdfe6"/></g><g transform="rotate(2 212 150)" filter="url(#${id}-ps)"><rect x="130" y="42" width="164" height="214" rx="17" fill="#f6f7f9"/><rect x="152" y="66" width="104" height="12" rx="6" fill="#e1e4e9"/><rect x="152" y="88" width="70" height="10" rx="5" fill="#eceef2"/></g><g transform="rotate(-11 150 178)" filter="url(#${id}-ps)"><rect x="66" y="74" width="168" height="208" rx="18" fill="#ffffff"/><rect x="90" y="100" width="116" height="16" rx="8" fill="#d8dbe2"/><rect x="90" y="128" width="120" height="66" rx="10" fill="#eff1f4"/></g><g clip-path="url(#${id}-front)"><g filter="url(#${id}-blur)"><rect width="400" height="376" fill="url(#${id}-bg)"/><g opacity=".62"><g transform="rotate(9 272 160)" filter="url(#${id}-ps)"><rect x="200" y="62" width="146" height="196" rx="16" fill="#eceef3"/><rect x="222" y="86" width="82" height="11" rx="5.5" fill="#dcdfe6"/></g><g transform="rotate(2 212 150)" filter="url(#${id}-ps)"><rect x="130" y="42" width="164" height="214" rx="17" fill="#f6f7f9"/><rect x="152" y="66" width="104" height="12" rx="6" fill="#e1e4e9"/><rect x="152" y="88" width="70" height="10" rx="5" fill="#eceef2"/></g><g transform="rotate(-11 150 178)" filter="url(#${id}-ps)"><rect x="66" y="74" width="168" height="208" rx="18" fill="#ffffff"/><rect x="90" y="100" width="116" height="16" rx="8" fill="#d8dbe2"/><rect x="90" y="128" width="120" height="66" rx="10" fill="#eff1f4"/></g></g></g><path d="M0 176Q0 146 30 146H140C154 146 162 150 170 158L188 176C196 184 204 188 218 188H380Q400 188 400 208V376H0Z" fill="url(#${id}-glass)"/></g><path d="M0 176Q0 146 30 146H140C154 146 162 150 170 158L188 176C196 184 204 188 218 188H380Q400 188 400 208V376H0Z" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2"/></g></svg>`

// The colour pairs are the design system's folder-<hue>-from / -to; the deck uses these two
const FOLDERS = { orange: ['#fbc138', '#dc7a06'], teal: ['#3ddcc5', '#0d9488'] }

// lucide icons (ISC), drawn in one colour at 1.8 stroke as the design system asks
const HUES = { teal: '#0b8a89', blue: '#2563d8', indigo: '#4f4fc9', orange: '#c2540a', green: '#167f43', purple: '#6d3fd6', pink: '#c9357a', ink: '#0f1017', white: '#ffffff', mute: '#5b5f6e', copper: '#b9440c', red: '#c02631' }
// The icon pictures the deck uses, as "<lucide name>-<hue>.png"; add a line there to draw a new one
const ICONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'icons.json'), 'utf8'))

;(async () => {
  const browser = await chromium.launch()
  for (const [name, css] of Object.entries(WALLS)) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
    await page.setContent(`<html><body style="margin:0"><div style="width:1920px;height:1080px;${css}"></div></body></html>`)
    const png = await page.screenshot({ type: 'png' })
    // A little noise keeps the soft glows from banding once the picture is compressed
    const noise = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: { r: 128, g: 128, b: 128 }, noise: { type: 'gaussian', mean: 128, sigma: 2.2 } } }).png().toBuffer()
    await sharp(png).composite([{ input: noise, blend: 'soft-light' }]).jpeg({ quality: 93, chromaSubsampling: '4:4:4' }).toFile(path.join(OUT, `wall-${name}.jpg`))
    await page.close()
  }
  for (const [name, [from, to]] of Object.entries(FOLDERS)) {
    const page = await browser.newPage({ viewport: { width: 800, height: 752 }, deviceScaleFactor: 1.5 })
    await page.setContent(`<html><body style="margin:0;background:transparent">${folder(name, from, to)}</body></html>`)
    await page.screenshot({ path: path.join(OUT, `folder-${name}.png`), omitBackground: true })
    await page.close()
  }
  await browser.close()

  const dir = path.join(__dirname, 'node_modules/lucide-static/icons')
  const missing = []
  fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true })
  for (const fileName of ICONS) {
    const [, name, hue] = fileName.match(/^(.+)-([a-z]+)\.png$/)
    const file = path.join(dir, name + '.svg')
    if (!fs.existsSync(file) || !HUES[hue]) { missing.push(fileName); continue }
    const tinted = fs.readFileSync(file, 'utf8').replace(/stroke="currentColor"/g, `stroke="${HUES[hue]}"`).replace(/stroke-width="2"/g, 'stroke-width="1.8"').replace(/width="24"/, 'width="192"').replace(/height="24"/, 'height="192"')
    await sharp(Buffer.from(tinted), { density: 576 }).resize(192, 192).png().toFile(path.join(OUT, 'icons', fileName))
  }
  console.log('walls, folders, icons done; missing icons:', missing.join(', ') || 'none')
})()
