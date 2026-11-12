// Shared pieces of the deck: the theme, the three slide frames, and the drawing helpers (glass card, island,
// chips, icon rows). The look follows the user's own design system: a soft wallpaper, glass surfaces, Golos Text,
// one accent colour and the black "island". Sizes are inches on a 13.333 x 7.5 slide.
'use strict'
const fs = require('fs')
const path = require('path')
const pptxgen = require('pptxgenjs')

const A = f => path.join(__dirname, 'assets', f)
const W = 13.333, H = 7.5, MX = 0.62, CW = W - 2 * MX
const TOP = 1.82 // where a content slide's body begins

// The deck's font and its twelve theme colours (dk/lt and the six accents). post.py writes the same file into
// PowerPoint's own theme, so the colour picker offers the deck's colours.
const THEME = JSON.parse(fs.readFileSync(A('theme.json'), 'utf8'))
const FONT = THEME.font
const K = {
  text: '0F1017', text2: '4F5262', text3: '666978', white: 'FFFFFF', sep: 'D0D4DF', fill: 'E4E7EE', paper: 'FFFFFF',
  accent: 'B9440C', island: '000000', amber: 'FFB340',
  dText: 'F5F5F7', dText2: 'C3C4CE', dText3: 'A0A1AE',
}
// base: tints, dots and outlines; solid: where white text or an icon sits on it (4.5:1 against white)
const HUE = {
  teal: { base: '0EA5A4', solid: '0B7F7E' },
  blue: { base: '2F7CF6', solid: '2563D8' },
  indigo: { base: '5B5BD6', solid: '4F4FC9' },
  orange: { base: 'F2711C', solid: 'B9500A' },
  green: { base: '22A559', solid: '167F43' },
  purple: { base: '8B5CF6', solid: '6D3FD6' },
  pink: { base: 'E9468F', solid: 'C9357A' },
  mute: { base: '8A8D9C', solid: '5B5F6E' },
  copper: { base: 'B9440C', solid: 'B9440C' },
  red: { base: 'D92D3A', solid: 'C02631' },
}

const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE'
pres.theme = { headFontFace: FONT, bodyFontFace: FONT }
const SH = pres.ShapeType

// ---------- measuring text, so pills fit their words and nothing runs out of its box ----------
const WIDTHS = JSON.parse(fs.readFileSync(A('golos-widths.json'), 'utf8'))
const unknown = new Set()
const issues = []
function tw(text, pt, bold) {
  let u = 0
  for (const ch of String(text)) {
    const a = WIDTHS[bold ? 'bold' : 'regular'][ch.codePointAt(0)]
    if (a === undefined) { unknown.add(ch); u += 620 } else u += a
  }
  return (u / 1000) * (pt / 72)
}
/** Lines a text takes in a box `w` wide: words break at spaces and after hyphens, as PowerPoint breaks them */
function lineCount(text, pt, bold, w) {
  let n = 0
  for (const para of String(text).split('\n')) {
    n++
    let cur = 0
    for (const word of para.split(/(?<=[\s-])/)) {
      const bare = tw(word.replace(/\s+$/, ''), pt, bold)
      if (cur > 0 && cur + bare > w) { n++; cur = 0 }
      cur += tw(word, pt, bold)
    }
  }
  return n
}
const lineH = (pt, lsm) => (pt * 1.2 * lsm) / 72 // Golos Text is 1.2 em from ascender to descender
const defLsm = pt => (pt >= 26 ? 0.92 : pt >= 16 ? 1.0 : 1.1)
function textH(text, pt, bold, w, lsm = defLsm(pt)) { return lineCount(text, pt, bold, w * 0.985) * lineH(pt, lsm) }

let current = '' // the slide being drawn, for the warnings
/** A list item given as bare words or runs becomes { text }. (A string's own .bold is a method, so never read options off one.) */
const item = it => (typeof it === 'string' || Array.isArray(it) ? { text: it } : it)
const plain = text => (Array.isArray(text) ? text.map(r => r.text + (r.options && r.options.breakLine ? '\n' : '')).join('') : String(text))
/** The first letter made capital, for words that come from data (the reading) */
const cap = text => text.charAt(0).toUpperCase() + text.slice(1)
/** The user's rule (2026-11-12): every text on a slide begins with a capital letter: list lines, pills, captions.
 *  `code: true` exempts what must stay as written, such as a JSON key. */
function capital(text, o) {
  if (!(o && o.code) && /^\p{Ll}/u.test(plain(text))) issues.push(`${current}: "${plain(text).slice(0, 40)}" begins with a small letter`)
}

/** A text box with no inner margin. `text` is a string or runs; mixed weights go on the runs, never on `o.bold`. */
function txt(s, text, o) {
  const pt = o.pt ?? 14
  const lsm = o.lsm ?? defLsm(pt)
  const str = plain(text)
  capital(text, o)
  const bold = !!o.bold || (Array.isArray(text) && text.some(r => r.options && r.options.bold))
  if (o.wrap === false) {
    if (o.w && tw(str, pt, bold) > o.w + 0.01) issues.push(`${current}: "${str.slice(0, 40)}" is ${tw(str, pt, bold).toFixed(2)} wide in ${o.w.toFixed(2)}`)
  } else if (o.w && o.h) {
    const paras = str.split('\n').length
    const need = textH(str, pt, bold, o.w, lsm) + ((paras - 1) * (o.after ?? 0)) / 72
    if (need > o.h + 0.03) issues.push(`${current}: "${str.slice(0, 40)}" needs ${need.toFixed(2)} of ${o.h.toFixed(2)} in`)
  }
  const opts = {
    x: o.x, y: o.y, w: o.w, h: o.h, fontSize: pt, color: o.color ?? K.text, align: o.align ?? 'left', valign: o.valign ?? 'top',
    margin: 0, lineSpacingMultiple: lsm, isTextBox: true, lang: o.lang ?? 'mn-MN', objectName: o.name ?? 'Бичвэр',
  }
  if (o.bold) opts.bold = true
  if (o.after) opts.paraSpaceAfter = o.after
  if (o.wrap === false) opts.wrap = false
  if (o.spacing) opts.charSpacing = o.spacing
  if (o.italic) opts.italic = true
  s.addText(text, opts)
}

// ---------- surfaces ----------
/** The glass card: translucent white with a bright rim and a soft shadow from above */
function glass(s, x, y, w, h, o = {}) {
  const dark = o.dark
  s.addShape(SH.roundRect, {
    x, y, w, h, rectRadius: o.r ?? 0.24,
    fill: { color: o.fill ?? K.white, transparency: o.t ?? (dark ? 91 : 34) },
    line: { color: o.line ?? K.white, width: o.lw ?? 1, transparency: o.lt ?? (dark ? 80 : 0) },
    shadow: o.shadow === false ? undefined : { type: 'outer', color: dark ? '000000' : '101E5A', blur: 28, offset: 10, angle: 90, opacity: dark ? 0.3 : 0.13 },
    objectName: o.name ?? 'Шилэн карт',
  })
}
/** A solid surface: paper white, or the island's black */
function solid(s, x, y, w, h, o = {}) {
  s.addShape(SH.roundRect, {
    x, y, w, h, rectRadius: o.r ?? 0.2, fill: { color: o.fill ?? K.paper },
    line: o.line ? { color: o.line, width: o.lw ?? 0.75 } : undefined,
    shadow: o.shadow === false ? undefined : { type: 'outer', color: '101E5A', blur: 18, offset: 6, angle: 90, opacity: 0.14 },
    objectName: o.name ?? 'Хавтан',
  })
}

const usedIcons = new Set() // which icon pictures the deck needs (build.js lists them in out/icons-used.json)
function icon(s, name, hue, x, y, size, alt) {
  usedIcons.add(`${name}-${hue}.png`)
  s.addImage({ path: A(`icons/${name}-${hue}.png`), x, y, w: size, h: size, altText: alt ?? 'Дүрс', objectName: 'Дүрс' })
}
/** An icon on a tinted square, the way the app shows a category */
function iconTile(s, name, hue, x, y, size = 0.58, alt) {
  const dark = hue === 'white'
  s.addShape(SH.roundRect, {
    x, y, w: size, h: size, rectRadius: size * 0.28,
    fill: { color: dark ? K.white : HUE[hue].base, transparency: dark ? 86 : 86 },
    line: { color: dark ? K.white : HUE[hue].base, width: 0.75, transparency: dark ? 70 : 62 },
    objectName: 'Дүрсний суурь',
  })
  icon(s, name, hue, x + size * 0.23, y + size * 0.23, size * 0.54, alt)
}
/** A numbered dot */
function badge(s, n, hue, x, y, d = 0.36, pt = 12.5) {
  s.addText(String(n), {
    shape: SH.ellipse, x, y, w: d, h: d, fill: { color: HUE[hue] ? HUE[hue].solid : hue }, fontSize: pt, bold: true, color: K.white,
    align: 'center', valign: 'middle', margin: 0, isTextBox: true, lang: 'mn-MN', objectName: 'Дугаар',
  })
}

const PILL = {
  plain: { fill: K.white, t: 22, line: K.sep, color: K.text },
  quiet: { fill: K.fill, t: 0, line: null, color: K.text2 },
  dark: { fill: K.island, t: 0, line: null, color: K.white },
  glass: { fill: K.white, t: 86, line: K.white, lt: 72, color: K.dText },
  accent: { fill: K.accent, t: 0, line: null, color: K.white },
}
/** A pill sized to its words. Returns its width. `tone` is a PILL name or a hue (tinted, with the hue's outline). */
function pill(s, label, x, y, o = {}) {
  const pt = o.pt ?? 12.5, h = o.h ?? 0.36, pad = o.pad ?? 0.16, bold = !!o.bold
  capital(label, o)
  const dot = o.dot ? 0.2 : 0
  const w = o.w ?? tw(label, pt, bold) * 1.03 + pad * 2 + dot
  const tone = PILL[o.tone ?? 'plain']
  const hue = HUE[o.tone]
  const fill = tone ? { color: tone.fill, transparency: tone.t } : o.solid ? { color: hue.solid } : { color: hue.base, transparency: 86 }
  const line = tone ? (tone.line ? { color: tone.line, width: 0.75, transparency: tone.lt ?? 0 } : undefined) : o.solid ? undefined : { color: hue.base, width: 0.75, transparency: 55 }
  const color = tone ? tone.color : o.solid ? K.white : K.text
  s.addShape(SH.roundRect, { x, y, w, h, rectRadius: h / 2, fill, line, objectName: 'Шошго' })
  if (o.dot) s.addShape(SH.ellipse, { x: x + pad - 0.02, y: y + h / 2 - 0.05, w: 0.1, h: 0.1, fill: { color: HUE[o.dot].base }, objectName: 'Цэг' })
  s.addText(label, {
    x: x + pad + dot - 0.02, y, w: w - pad * 2 - dot + 0.04, h, fontSize: pt, bold, color, align: o.dot ? 'left' : 'center', valign: 'middle',
    margin: 0, wrap: false, isTextBox: true, lang: o.lang ?? 'mn-MN', objectName: 'Шошгоны бичвэр',
  })
  return w
}
/** Pills flowing into rows inside `o.w`. Returns the y below the last row. */
function chips(s, labels, o) {
  const pt = o.pt ?? 12.5, h = o.h ?? 0.36, gap = o.gap ?? 0.1, pad = o.pad ?? 0.16
  let x = o.x, y = o.y
  for (const label of labels) {
    const w = tw(label, pt, !!o.bold) * 1.03 + pad * 2 + (o.dot ? 0.2 : 0)
    if (x > o.x && x + w > o.x + o.w + 0.005) { x = o.x; y += h + gap }
    pill(s, label, x, y, { ...o, w })
    x += w + gap
  }
  return y + h
}

/** Rows of a small icon and a line of text; each row is as tall as its text. Returns the y below the last row. */
function rows(s, items, o) {
  const pt = o.pt ?? 14, gap = o.gap ?? 0.16, ic = o.icon ?? 0.26, indent = ic + 0.16
  let y = o.y
  for (const raw of items) {
    const it = item(raw)
    const text = it.text
    const bold = !!it.bold
    const h = textH(plain(text), pt, bold || Array.isArray(text), o.w - indent)
    if (it.icon) icon(s, it.icon, it.hue ?? o.hue ?? 'mute', o.x, y + (lineH(pt, defLsm(pt)) - ic) / 2, ic, it.alt)
    else s.addShape(SH.ellipse, { x: o.x + ic / 2 - 0.04, y: y + lineH(pt, defLsm(pt)) / 2 - 0.04, w: 0.08, h: 0.08, fill: { color: o.dotColor ?? K.text3 }, objectName: 'Цэг' })
    txt(s, text, { x: o.x + indent, y, w: o.w - indent, h: h + 0.02, pt, bold, color: it.color ?? o.color ?? K.text, name: 'Мөр' })
    y += h + gap
  }
  return y - gap
}

/** The black island at the top left: the section, and dots when the slide is one of a set of four */
function island(s, num, label, dots) {
  const h = 0.37, y = 0.42, pad = 0.17, pt = 12
  const numW = tw(num, pt, true), labW = tw(label, pt, false)
  const dotsW = dots ? 0.2 + dots.of * 0.09 + (dots.of - 1) * 0.06 : 0
  const sep = num ? 0.11 : 0
  const w = pad + numW + sep + labW + dotsW + pad
  s.addShape(SH.roundRect, { x: MX, y, w, h, rectRadius: h / 2, fill: { color: K.island }, shadow: { type: 'outer', color: '000000', blur: 14, offset: 5, angle: 90, opacity: 0.28 }, objectName: 'Арал' })
  s.addText(num ? [{ text: num, options: { bold: true, color: K.amber } }, { text: '  ' + label, options: { color: K.white } }] : [{ text: label, options: { color: K.white } }], {
    x: MX + pad, y, w: numW + labW + 0.4, h, fontSize: pt, valign: 'middle', margin: 0, wrap: false, isTextBox: true, lang: 'mn-MN', objectName: 'Хэсгийн нэр',
  })
  if (dots) {
    let x = MX + pad + numW + sep + labW + 0.2
    for (let i = 1; i <= dots.of; i++) {
      const on = dots.on.includes(i)
      s.addShape(SH.ellipse, { x, y: y + h / 2 - 0.045, w: 0.09, h: 0.09, fill: { color: on ? K.amber : K.white, transparency: on ? 0 : 70 }, objectName: 'Явцын цэг' })
      x += 0.15
    }
  }
}

/** A round glass button with an arrow, between two cards */
function arrowDot(s, cx, cy, o = {}) {
  const d = o.d ?? 0.44
  s.addShape(SH.ellipse, { x: cx - d / 2, y: cy - d / 2, w: d, h: d, fill: { color: o.dark ? K.island : K.white }, shadow: { type: 'outer', color: '101E5A', blur: 12, offset: 4, angle: 90, opacity: 0.18 }, objectName: 'Сум' })
  icon(s, 'arrow-right', o.dark ? 'white' : 'ink', cx - d * 0.27, cy - d * 0.27, d * 0.54, 'Сум')
}
/** A thin arrow along a row */
function arrowLine(s, x1, y, x2, color = K.text3) {
  s.addShape(SH.line, { x: x1, y, w: x2 - x1, h: 0, line: { color, width: 1.25, endArrowType: 'triangle' }, objectName: 'Сум' })
}
function sourceLine(s, text, dark) {
  txt(s, text, { x: MX, y: 6.99, w: 11.1, h: 0.26, pt: 11, color: dark ? K.dText3 : K.text3, name: 'Эх сурвалж' })
}

// ---------- the three frames ----------
const NUM = { x: W - MX - 0.8, y: 6.97, w: 0.8, h: 0.28, fontSize: 11, align: 'right' }
pres.defineSlideMaster({
  title: 'Нүүр',
  background: { path: A('wall-dark.jpg') },
  objects: [{ placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 1.46, w: 7.95, h: 3.3, fontSize: 32, bold: true, color: K.dText, align: 'left', valign: 'top', margin: 0 }, text: '' } }],
})
pres.defineSlideMaster({
  title: 'Агуулга',
  background: { path: A('wall-light.jpg') },
  objects: [{ placeholder: { options: { name: 'title', type: 'title', x: MX, y: 0.93, w: CW, h: 0.66, fontSize: 32, bold: true, color: K.text, align: 'left', valign: 'top', margin: 0 }, text: '' } }],
  slideNumber: { ...NUM, color: K.text3 },
})
pres.defineSlideMaster({
  title: 'Харанхуй',
  background: { path: A('wall-dark.jpg') },
  objects: [{ placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 1.55, w: 11.2, h: 1.7, fontSize: 34, bold: true, color: K.dText, align: 'left', valign: 'top', margin: 0 }, text: '' } }],
  slideNumber: { ...NUM, color: K.dText3 },
})

let count = 0
/** A light content slide: island, one-line title, speaker notes */
function content(section, isl, title, notes) {
  current = `slide ${++count}`
  const s = pres.addSlide({ masterName: 'Агуулга', sectionTitle: section })
  island(s, isl[0], isl[1], isl[2])
  if (tw(title, 32, true) > CW) issues.push(`${current}: the title "${title}" is ${tw(title, 32, true).toFixed(2)} in wide, more than one line`)
  s.addText(title, { placeholder: 'title', lang: 'mn-MN', lineSpacingMultiple: 0.92, charSpacing: -0.4 })
  if (notes) s.addNotes(notes)
  return s
}
function dark(section, master, title, notes, titleOpts = {}) {
  current = `slide ${++count}`
  const s = pres.addSlide({ masterName: master, sectionTitle: section })
  s.addText(title, { placeholder: 'title', lang: 'mn-MN', lineSpacingMultiple: 0.95, charSpacing: -0.3, ...titleOpts })
  if (notes) s.addNotes(notes)
  return s
}

module.exports = { pres, SH, A, W, H, MX, CW, TOP, THEME, K, HUE, tw, lineCount, lineH, defLsm, textH, txt, glass, solid, icon, iconTile, badge, pill, chips, rows, island, arrowDot, arrowLine, sourceLine, content, dark, issues, unknown }

/** Paragraphs in one text box, with a gap between them; the box is as tall as the measure says. Returns the y below. */
function stack(s, items, o) {
  const pt = o.pt ?? 14, gap = o.gap ?? 0.18
  const its = items.map(item)
  const runs = []
  let h = 0
  its.forEach((it, i) => {
    const last = i === its.length - 1
    const parts = Array.isArray(it.text) ? it.text : [{ text: it.text, options: {} }]
    parts.forEach((r, j) => runs.push({ text: r.text, options: { ...(r.options || {}), bold: !!(it.bold || (r.options && r.options.bold)), color: it.color ?? o.color ?? K.text, breakLine: j === parts.length - 1 && !last } }))
    h += textH(plain(it.text), pt, !!it.bold, o.w) + (last ? 0 : gap)
  })
  s.addText(runs, { x: o.x, y: o.y, w: o.w, h: h + 0.04, fontSize: pt, valign: 'top', margin: 0, lineSpacingMultiple: defLsm(pt), paraSpaceAfter: gap * 72, isTextBox: true, lang: o.lang ?? 'mn-MN', objectName: 'Бичвэр' })
  return o.y + h
}
PILL.island = { fill: '16171D', t: 6, line: K.white, lt: 76, color: K.dText }
module.exports.stack = stack
module.exports.cap = cap
module.exports.usedIcons = usedIcons
module.exports.plain = plain
