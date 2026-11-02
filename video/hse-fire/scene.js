// «Кемпэд гал гарвал» video: the camp evacuation plan, animated to the ElevenLabs voice. window.seek(t) draws the frame
// at t seconds and nothing else keeps state, so any frame can be drawn again. Every scene is keyed to the sentence
// and word times in voice.json: a new recording re-times the video by itself (it must still have 7 sentences).
//   plan-video.svg, plan-geom.json   written by docs/hse/evacuation/plan.py
//   captions.json                    on-screen text by Gemini
const load = async (f, as = 'json') => (await fetch(f))[as]()
const [geom, voice, caps, planSvg] = await Promise.all([load('./plan-geom.json'), load('./voice.json'), load('./captions.json'), load('./plan-video.svg', 'text')])

export const FPS = 30
const LEAD = 0.8   // seconds before the voice starts
const TAIL = 2.8   // end card after the voice
const NS = 'http://www.w3.org/2000/svg'
const P = (x, y) => [geom.OX + x * geom.K, geom.OY + y * geom.K]
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const ease = u => (u < .5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2)
const ramp = (t, a, d) => clamp((t - a) / d)          // 0 before a, 1 after a + d

// Sentences and words, on the video clock
const words = voice.segments.flatMap(s => s.words).filter(w => w.text.trim())
  .map(w => ({ text: w.text.trim(), a: w.start_time + LEAD, b: w.end_time + LEAD }))
const S = []
for (let cur = [], i = 0; i < words.length; i++) {
  cur.push(words[i])
  if (/[.!?]$/.test(words[i].text) || i === words.length - 1) { S.push({ a: cur[0].a, b: cur.at(-1).b, words: cur }); cur = [] }
}
const at = (i, re) => (S[i].words.find(w => re.test(w.text.toLowerCase())) ?? S[i].words[0]).a
const DURATION = S.at(-1).b + TAIL
const T = {
  fire: S[0].a + 1.4, press: at(1, /товч/), smoke: S[1].b - .4, walk: S[2].a + .6, s3b: at(2, /коридор/),
  signs: S[3].a, routes: S[4].a, out: S[5].a, call: at(5, /зуун|101/), s6b: at(5, /кэмп|кемп/), check: at(5, /бүртгүүл/),
  ban: S[6].a + .1, end: S[6].b + .5,
}

// ---- the plan, inside a camera group --------------------------------------------------------------------------
const doc = new DOMParser().parseFromString(planSvg, 'image/svg+xml').documentElement
document.getElementById('plan').append(...[...doc.childNodes].map(n => document.importNode(n, true)))
const cam = document.getElementById('cam')
const fx = document.getElementById('fx')
const el = (tag, attrs = {}, parent = fx) => {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  parent.append(e)
  return e
}
const set = (e, attrs) => { for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v) }
const defs = el('defs', {}, document.getElementById('view'))
defs.innerHTML = `
  <radialGradient id="glow"><stop offset="0" stop-color="#FF6A00" stop-opacity=".75"/><stop offset=".45" stop-color="#FF3B1F" stop-opacity=".35"/>
    <stop offset="1" stop-color="#FF3B1F" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="9"/></filter>`

// Camera shots in plan page coordinates: centre and zoom (card pixels per plan pixel)
const FULL = { cx: 793, cy: 545, z: .82 }
const room = n => P(...geom.rooms[n])
const [fx20, fy20] = room('20')
const SHOTS = [
  { t: 0, ...FULL },
  { t: S[1].a - .4, cx: 565, cy: 280, z: 1.9 },             // fire in room 20 and the alarm button at the corridor end
  { t: S[2].a - .3, cx: 520, cy: 255, z: 1.85 },            // smoke in the corridor, someone leaves by the near exit
  { t: S[3].a - .3, cx: 700, cy: 460, z: 1.25 },            // the green signs in the corridors
  { t: S[4].a - .3, ...FULL },                               // everyone follows the arrows out
  { t: S[5].a - .3, cx: 892, cy: 965, z: 1.45 },            // outside the main exit: the safe area
  { t: S[6].a - .3, cx: 892, cy: 905, z: 1.6 },             // no going back in
  { t: T.end - .2, ...FULL },
]
function camera(t) {
  let i = SHOTS.findLastIndex(s => s.t <= t)
  const s = SHOTS[Math.max(i, 0)], p = SHOTS[Math.max(i - 1, 0)]
  const u = ease(ramp(t, s.t, 1.1))
  const z = Math.exp(Math.log(p.z) + (Math.log(s.z) - Math.log(p.z)) * u)
  return { cx: p.cx + (s.cx - p.cx) * u, cy: p.cy + (s.cy - p.cy) * u, z }
}

// ---- effects ---------------------------------------------------------------------------------------------------
const smoke = Array.from({ length: 9 }, (_, i) => el('circle', { fill: '#59636C', filter: 'url(#soft)' }))
const glow = el('circle', { cx: fx20, cy: fy20, fill: 'url(#glow)' })
const flame = el('g')
el('circle', { r: 19, fill: '#E2401C' }, flame)
el('path', { d: 'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4', fill: 'none', stroke: '#fff',
  'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', transform: 'translate(-12 -12.5)' }, flame)
const [ax, ay] = P(183, 104)
const ripples = Array.from({ length: 3 }, () => el('circle', { cx: ax, cy: ay, fill: 'none', stroke: '#D52B1E' }))
const signRings = geom.signs.map(([x, y, way]) => {
  const [sx, sy] = P(x, y), w = way === 'up' ? 44 : 90, h = way === 'up' ? 90 : 44
  return el('rect', { x: sx - w / 2, y: sy - h / 2, width: w, height: h, rx: 10, fill: 'none', stroke: '#00843D' })
})
const EXITS = [[181.5, 23], [191, 292], [658, 322], [515, 530]].map(([x, y]) => P(x, y))
const exitRings = EXITS.map(([x, y]) => el('circle', { cx: x, cy: y, fill: 'none', stroke: '#00843D' }))

// The safe area outside the main exit (its real place is not known yet; drawn as a general area)
const [sax, say] = P(515, 690)
const safe = el('g')
el('rect', { x: sax - 170, y: say - 70, width: 340, height: 140, rx: 26, fill: '#E3F3E8', stroke: '#00843D', 'stroke-width': 3, 'stroke-dasharray': '10 8' }, safe)
const safeLabel = el('text', { x: sax, y: say + 104, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700, fill: '#00843D' }, safe)
safeLabel.textContent = 'Аюулгүй талбай'

// People: walk along the routes on the plan (photo pixels), reach an exit by the end of sentence 5
const exitTL = [[181.5, 104], [181.5, 16], [181.5, -14]]
const toMain = [[514, 442], [514, 548]]
const yardL = [[204, 292], [300, 328], [420, 382], [504, 432]], yardR = [[650, 322], [600, 368], [545, 412], [522, 432]]
const PEOPLE = [
  { path: [[259.5, 72], [259.5, 104], ...exitTL], a: T.walk, d: 5.6 },                                  // room 18, sentence 3
  { path: [[305, 125], [305, 104], ...exitTL], a: T.routes, d: 5.6 },                                  // room 14
  { path: [[577, 82], [577, 104], ...exitTL], a: T.routes + .3, d: 6.8 },                              // room 25
  { path: [[160, 262], [181.5, 262], [181.5, 292], ...yardL, ...toMain], a: T.routes + .2, d: 6.4, safe: 0 },   // 51
  { path: [[160, 377], [181.5, 377], [181.5, 300], ...yardL, ...toMain], a: T.routes + .6, d: 6.4, safe: 1 },   // 50
  { path: [[700, 165], [667, 165], [667, 322], ...yardR, ...toMain], a: T.routes + .1, d: 6.6, safe: 2 },       // 6
  { path: [[820, 247], [787, 247], [787, 104], [667, 104], [667, 322], ...yardR, ...toMain], a: T.routes, d: 7.0, safe: 3 }, // 34
  { path: [[820, 383], [787, 383], [787, 519.5], [540, 519.5], [533, 536], [514, 548]], a: T.routes + .4, d: 6.2, safe: 4 }, // 37
  { path: [[343, 490], [343, 519.5], [490, 519.5], [497, 536], [514, 548]], a: T.routes + .5, d: 5.4, safe: 5 },  // 46
].map(p => {
  const pts = p.path.map(q => P(...q))
  const len = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]))
  const g = el('g')
  el('circle', { r: 12, fill: '#1F2429', stroke: '#fff', 'stroke-width': 3.5 }, g)
  const tick = el('g', {}, g)
  el('circle', { r: 11, cx: 0, cy: -26, fill: '#00843D' }, tick)
  el('path', { d: 'M-5 -26 -1.5 -22.5 5 -29.5', fill: 'none', stroke: '#fff', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, tick)
  return { ...p, pts, len, total: len.reduce((a, b) => a + b, 0), g, tick }
})
function along(p, u) {
  let d = u * p.total
  for (let i = 0; i < p.len.length; i++) {
    if (d <= p.len[i]) { const k = p.len[i] ? d / p.len[i] : 0; return [p.pts[i][0] + (p.pts[i + 1][0] - p.pts[i][0]) * k, p.pts[i][1] + (p.pts[i + 1][1] - p.pts[i][1]) * k] }
    d -= p.len[i]
  }
  return p.pts.at(-1)
}
const SPOTS = Array.from({ length: 6 }, (_, i) => [sax - 105 + (i % 3) * 105, say - 26 + Math.floor(i / 3) * 52])

const phone = el('g')
el('rect', { x: -92, y: -38, width: 184, height: 76, rx: 22, fill: '#D52B1E' }, phone)
el('path', { d: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384',
  fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', transform: 'translate(-74 -18) scale(1.5)' }, phone)
const phoneText = el('text', { x: 22, y: 15, 'text-anchor': 'middle', 'font-size': 44, 'font-weight': 800, fill: '#fff' }, phone)
phoneText.textContent = '101'

const [mx, my] = P(515, 530)
const ban = el('g')
el('circle', { cx: mx, cy: my, r: 52, fill: '#fff', stroke: '#D52B1E', 'stroke-width': 11 }, ban)
el('path', { d: `M${mx - 35} ${my - 35}L${mx + 35} ${my + 35}`, stroke: '#D52B1E', 'stroke-width': 11, 'stroke-linecap': 'round' }, ban)

// ---- captions and subtitles ------------------------------------------------------------------------------------
const CAPS = [
  { t: 0, badge: '', text: caps.T, kicker: '' },
  { t: S[1].a, badge: '1', text: caps.S2 }, { t: S[2].a, badge: '2', text: caps.S3a }, { t: T.s3b, badge: '3', text: caps.S3b },
  { t: S[3].a, badge: '4', text: caps.S4 }, { t: S[4].a, badge: '5', text: caps.S5 }, { t: S[5].a, badge: '6', text: caps.S6a },
  { t: T.s6b, badge: '7', text: caps.S6b }, { t: S[6].a, badge: '8', text: caps.S7 }, { t: T.end, badge: '', text: caps.T, kicker: '' },
]
const capA = document.getElementById('capA'), capB = document.getElementById('capB'), kicker = document.getElementById('kicker')
const capHtml = c => (c.badge ? `<div class="badge">${c.badge}</div>` : '') + `<div class="cap__text">${c.text}</div>`
const sub = document.getElementById('sub'), endCard = document.getElementById('end')
const subSpans = S.map(s => s.words.map(w => {
  const span = document.createElement('span')
  span.textContent = w.text + ' '
  return span
}))

window.seek = t => {
  // camera
  const c = camera(t)
  cam.setAttribute('transform', `translate(500 470) scale(${c.z}) translate(${-c.cx} ${-c.cy})`)

  // fire, smoke, alarm
  const f = ease(ramp(t, T.fire, .6))
  const flick = 1 + .06 * Math.sin(t * 13) + .04 * Math.sin(t * 7.3)
  set(glow, { r: 70 * f * flick * (1 + .5 * ramp(t, T.smoke, 6)), opacity: f })
  set(flame, { transform: `translate(${fx20} ${fy20 - 4}) scale(${f * (1 + .05 * Math.sin(t * 9))})`, opacity: f })
  smoke.forEach((s, i) => {
    const u = ramp(t, T.smoke + i * .35, 7), side = i % 2 ? -1 : 1
    const x = fx20 + side * (25 + i * 34) * ease(u), y = P(0, 104)[1] + Math.sin(i * 1.7 + t * .8) * 6
    set(s, { cx: x, cy: y, r: (16 + i * 2.2) * (.4 + 1.1 * ease(u)), opacity: .34 * ease(clamp(u * 3)) * (1 - .6 * ramp(t, T.out, 2)) })
  })
  ripples.forEach((r, i) => {
    const on = t >= T.press && t < S[1].b + 1.2
    const u = on ? ((t - T.press) / 1.2 + i / 3) % 1 : 0
    set(r, { r: 14 + 46 * u, 'stroke-width': 5 * (1 - u), opacity: on ? 1 - u : 0 })
  })

  // signs, exits
  const signsOn = clamp(ramp(t, T.signs, .4) - ramp(t, S[3].b + .2, .4))
  signRings.forEach(r => set(r, { 'stroke-width': 7, opacity: signsOn * (.6 + .4 * Math.sin(t * 6)) }))
  const exitsOn = clamp(ramp(t, T.routes + 1.5, .4) - ramp(t, S[4].b + .5, .4))
  exitRings.forEach((r, i) => {
    const u = (t * .9 + i * .25) % 1
    set(r, { r: 16 + 40 * u, 'stroke-width': 6 * (1 - u), opacity: exitsOn * (1 - u) })
  })

  // people
  PEOPLE.forEach(p => {
    const u = ease(ramp(t, p.a, p.d))
    let [x, y] = along(p, u)
    let vis = t >= p.a ? 1 : 0
    if (p.safe === undefined) vis *= 1 - ramp(t, p.a + p.d - .3, .3)       // left by the top exit, out of the picture
    else {                                                                    // walk on to the safe area
      const v = ease(ramp(t, T.out + .2 + p.safe * .12, 2.6))
      const [ex, ey] = p.pts.at(-1), [sx, sy] = SPOTS[p.safe]
      if (v > 0) { x = ex + (sx - ex) * v; y = ey + (sy - ey) * v }
    }
    set(p.g, { transform: `translate(${x} ${y})`, opacity: vis })
    const k = ease(ramp(t, T.check + (p.safe ?? 0) * .1, .35))
    set(p.tick, { opacity: p.safe === undefined ? 0 : k, transform: `translate(0 ${6 * (1 - k)})` })
  })
  set(safe, { opacity: ease(ramp(t, T.out, .6)) })
  const ph = ease(ramp(t, T.call, .35))
  set(phone, { transform: `translate(${sax - 250} ${say - 60}) scale(${.6 + .4 * ph})`, opacity: ph * (1 - ramp(t, T.s6b + 1, .4)) })
  const b = ramp(t, T.ban, .35)
  set(ban, { opacity: b * (1 - ramp(t, T.end, .4)), transform: `translate(${mx} ${my}) scale(${.6 + .4 * ease(b) + .06 * Math.sin(clamp(b) * Math.PI)}) translate(${-mx} ${-my})` })

  // captions: cross-fade when the text changes
  const i = CAPS.findLastIndex(c => c.t <= t), cur = CAPS[i], prev = CAPS[i - 1]
  const u = ease(ramp(t, cur.t, .35))
  capA.innerHTML = capHtml(cur)
  capA.style.cssText = `opacity:${prev ? u : 1};transform:translateY(${prev ? 24 * (1 - u) : 0}px)`
  capB.innerHTML = prev && u < 1 ? capHtml(prev) : ''
  capB.style.cssText = `opacity:${1 - u};transform:translateY(${-24 * u}px)`
  kicker.textContent = cur.kicker ?? caps.T
  kicker.style.opacity = cur.kicker === '' ? 0 : 1

  // subtitles: the sentence being spoken, words darken as they are said
  const si = Math.max(0, S.findLastIndex(s => s.a - .25 <= t))
  const endOn = ramp(t, T.end, .4)
  sub.replaceChildren(...subSpans[si])
  S[si].words.forEach((w, j) => { subSpans[si][j].style.color = t >= w.a ? '#1F2429' : '#A9B2BA' })
  sub.style.opacity = 1 - endOn
  endCard.style.opacity = endOn
  endCard.style.transform = `translateY(${30 * (1 - ease(endOn))}px)`
}

const EVENTS = { lead: LEAD, press: T.press, out: T.out, ban: T.ban, end: T.end }
Object.assign(window, { DURATION, FPS, EVENTS, subframes: () => 1 })
await document.fonts.ready
window.seek(0)
window.ready = true
