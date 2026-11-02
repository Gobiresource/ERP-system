// «Кемпэд гал гарвал» in 3D: the camp evacuation plan as a scale model (the plan printed on the floor, low walls),
// fire and smoke as particles, a moving camera. window.seek(t) draws the frame at t seconds and keeps no state, so any
// frame can be drawn again. All timing comes from voice.json (sentence and word times): a new recording re-times the
// video by itself (it must still have 7 sentences).
//   plan-video.svg, plan-geom.json   written by docs/hse/evacuation/plan.py
//   captions.json                    on-screen text by Gemini
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const load = async (f, as = 'json') => (await fetch(f))[as]()
const [geom, voice, caps, planSvg] = await Promise.all([load('./plan-geom.json'), load('./voice.json'), load('./captions.json'), load('./plan-video.svg', 'text')])

export const FPS = 30
const W = 1080, H = 1920
const SCALE = Number(new URLSearchParams(location.search).get('scale') || 1)   // 0.5 for a quick look
const LEAD = 0.8   // seconds before the voice starts
const TAIL = 2.8   // end card after the voice
const V3 = THREE.Vector3
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const ease = u => (u = clamp(u), u < .5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2)
const ramp = (t, a, d) => clamp((t - a) / d)                                   // 0 before a, 1 after a + d
const lerp = (a, b, u) => a + (b - a) * u
const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
const walk = u => {                                                             // steady walking pace, eased start and stop
  const a = .12, v = 1 / (1 - a)
  u = clamp(u)
  return u < a ? v * u * u / (2 * a) : u > 1 - a ? 1 - v * (1 - u) ** 2 / (2 * a) : v * (u - a / 2)
}

// ---- sentences and words, on the video clock ----------------------------------------------------------------------
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
  fire: S[0].a + 1.2, corridor: at(1, /коридорт/), press: at(1, /товч/), walk: S[2].a + 1.5, s3b: at(2, /коридор/),
  signs: S[3].a, routes: S[4].a, out: S[5].a, call: at(5, /зуун|101/), s6b: at(5, /кэмп|кемп/), check: at(5, /бүртгүүл/),
  ban: S[6].a + .1, end: S[6].b + .5,
}

// ---- world: plan page px / 100, x right, z down the plan, y up, the building centre at the origin -------------------
const CX = 793, CZ = 545, U = 100
const page = (x, y) => [geom.OX + x * geom.K, geom.OY + y * geom.K]          // photo px (as in plan.py) -> page px
const V = (x, y, h = 0) => { const [px, py] = page(x, y); return new V3((px - CX) / U, h, (py - CZ) / U) }
const P = (x, y, z) => new V3(x, y, z)

// ---- renderer, scene, lights --------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(SCALE)
renderer.setSize(W, H, false)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
const scene = new THREE.Scene()
const SKY = new THREE.Color(0xDCE2E7), SMOKY = new THREE.Color(0x59616A)
scene.background = SKY.clone()
scene.fog = new THREE.Fog(SKY.clone(), 18, 42)
const camera = new THREE.PerspectiveCamera(40, W / H, 0.03, 90)
camera.setViewOffset(W, H, 0, -150, W, H)                                       // the subject sits below the captions

const hemi = new THREE.HemisphereLight(0xFFFFFF, 0xB4BEC6, 1.25)
const sun = new THREE.DirectionalLight(0xFFF1DE, 1.7)
sun.position.set(-5, 9, 3.5)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 })
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.01
scene.add(hemi, sun, sun.target)

// ---- the plan on the floor ----------------------------------------------------------------------------------------
const GROUND = '#E4E8EB'
{
  const x0 = 110, y0 = 80, x1 = 1476, y1 = 1015, k = 4                       // page area, texture pixels per page px
  const img = new Image()
  img.src = URL.createObjectURL(new Blob([planSvg], { type: 'image/svg+xml' }))
  await img.decode()
  const c = document.createElement('canvas')
  c.width = (x1 - x0) * k; c.height = (y1 - y0) * k
  const g = c.getContext('2d')
  g.fillStyle = GROUND; g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, -x0 * k, -y0 * k, 1587 * k, 1123 * k)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const floor = new THREE.Mesh(new THREE.PlaneGeometry((x1 - x0) / U, (y1 - y0) / U), new THREE.MeshLambertMaterial({ map: tex }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(((x0 + x1) / 2 - CX) / U, 0, ((y0 + y1) / 2 - CZ) / U)
  floor.receiveShadow = true
  scene.add(floor)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshLambertMaterial({ color: GROUND }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -.003
  ground.receiveShadow = true
  scene.add(ground)
}

// ---- people's routes (photo px, as in plan.py). Walls get a doorway wherever a route crosses them. -------------------
// The safe area outside the main exit (its real place is not known yet; drawn as a general area) and a spot there for
// each person who walks to it.
const SAFE_XY = [515, 700]
const SPOT_XY = Array.from({ length: 6 }, (_, i) => [SAFE_XY[0] + (i % 2 ? 26 : -26), SAFE_XY[1] - 43 + 43 * Math.floor(i / 2)])
const exitTL = [[181.5, 104], [181.5, 16], [181.5, -30]]
const toMain = [[514, 442], [514, 556]]
const yardL = [[204, 292], [300, 328], [420, 382], [504, 432]], yardR = [[650, 322], [600, 368], [545, 412], [522, 432]]
const ROUTES = [
  { path: [[214, 62], [214, 104], [178.5, 104], [181.5, 96], [181.5, 16], [181.5, -30]], a: T.corridor - 1.6, press: 2, still: true }, // 17
  { path: [[259.5, 72], [259.5, 104], ...exitTL], a: T.walk, d: 10.6, lead: true, still: true },                // room 18
  { path: [[305, 135], [305, 104], ...exitTL], a: T.routes, d: 6.0 },                                         // room 14
  { path: [[577, 72], [577, 104], ...exitTL], a: T.routes + .3, d: 7.0 },                                     // room 25
  { path: [[150, 262], [181.5, 262], [181.5, 292], ...yardL, ...toMain], a: T.routes + .2, d: 6.6, safe: 0 }, // 51
  { path: [[150, 377], [181.5, 377], [181.5, 300], ...yardL, ...toMain], a: T.routes + .6, d: 6.6, safe: 1 }, // 50
  { path: [[710, 165], [667, 165], [667, 322], ...yardR, ...toMain], a: T.routes + .1, d: 6.8, safe: 2 },     // 6
  { path: [[830, 247], [787, 247], [787, 104], [667, 104], [667, 322], ...yardR, ...toMain], a: T.routes, d: 7.2, safe: 3 }, // 34
  { path: [[830, 383], [787, 383], [787, 519.5], [540, 519.5], [533, 536], [514, 556]], a: T.routes + .4, d: 6.4, safe: 4 }, // 37
  { path: [[343, 480], [343, 519.5], [490, 519.5], [497, 536], [514, 556]], a: T.routes + .5, d: 5.6, safe: 5 },  // 46
]

// ---- walls: room edges, the yard sides with their doors, the outer walls with the exits open -------------------------
{
  const segs = []
  const add = (x0, y0, x1, y1, outer = false) => segs.push({ x0, y0, x1, y1, outer })
  for (const [, x0, y0, x1, y1] of geom.rects) { add(x0, y0, x1, y0); add(x1, y0, x1, y1); add(x1, y1, x0, y1); add(x0, y1, x0, y0) }
  add(554, 173, 554, 192); add(554, 192, 658, 192)                               // the alcove under rooms 8 and 7
  add(191, 173, 191, 284); add(191, 299, 191, 437)                               // yard side with the door by room 51
  add(658, 192, 658, 312); add(658, 333, 658, 437)                               // yard side with the door by room 5
  for (const w of geom.walls) for (let i = 0; i < w.length - 1; i++) add(...w[i], ...w[i + 1], true)
  const seen = new Set()
  const walls = segs.filter(s => {
    const key = [[s.x0, s.y0], [s.x1, s.y1]].map(String).sort().join('|') + s.outer
    return !seen.has(key) && seen.add(key)
  })
  // where a route crosses a wall, cut a doorway 12 px wide
  const cross = (a, b, c, d) => {
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0]
    if (Math.abs(den) < 1e-9) return null
    const q = [c[0] - a[0], c[1] - a[1]], u = (q[0] * s[1] - q[1] * s[0]) / den, v = (q[0] * r[1] - q[1] * r[0]) / den
    return u > 0 && u < 1 && v > 0 && v < 1 ? v : null
  }
  const pieces = []
  for (const w of walls) {
    const len = Math.hypot(w.x1 - w.x0, w.y1 - w.y0), cuts = []
    for (const r of ROUTES) for (let i = 0; i < r.path.length - 1; i++) {
      const v = cross(r.path[i], r.path[i + 1], [w.x0, w.y0], [w.x1, w.y1])
      if (v !== null) cuts.push([v - 6 / len, v + 6 / len])
    }
    cuts.sort((a, b) => a[0] - b[0])
    let from = 0
    for (const [a, b] of [...cuts, [1, 1]]) {
      if (a > from) pieces.push({ ...w, x0: lerp(w.x0, w.x1, from), y0: lerp(w.y0, w.y1, from), x1: lerp(w.x0, w.x1, a), y1: lerp(w.y0, w.y1, a) })
      from = Math.max(from, b)
    }
  }
  const box = (s, thick, h) => {
    const a = V(s.x0, s.y0), b = V(s.x1, s.y1)
    const gb = new THREE.BoxGeometry(a.distanceTo(b) + thick, h, thick)
    gb.rotateY(-Math.atan2(b.z - a.z, b.x - a.x))
    gb.translate((a.x + b.x) / 2, h / 2, (a.z + b.z) / 2)
    return gb
  }
  const inner = new THREE.Mesh(mergeGeometries(pieces.filter(s => !s.outer).map(s => box(s, .028, .2))), new THREE.MeshLambertMaterial({ color: 0xF4F6F8 }))
  const outer = new THREE.Mesh(mergeGeometries(pieces.filter(s => s.outer).map(s => box(s, .06, .26))), new THREE.MeshLambertMaterial({ color: 0x86909A }))
  for (const m of [inner, outer]) { m.castShadow = true; m.receiveShadow = true; scene.add(m) }
  // the shed and the round building in the yard
  const grey = new THREE.MeshLambertMaterial({ color: 0xE6EAED })
  const shed = new THREE.Mesh(new THREE.BoxGeometry(.72, .28, .73), grey)
  shed.position.copy(V(371, 287.5, .14)); shed.castShadow = shed.receiveShadow = true; scene.add(shed)
  const ger = new THREE.Group()
  const gw = new THREE.Mesh(new THREE.CylinderGeometry(.65, .65, .2, 48), grey); gw.position.y = .1
  const roof = new THREE.Mesh(new THREE.ConeGeometry(.69, .22, 48), grey); roof.position.y = .31
  ger.add(gw, roof); ger.position.copy(V(473, 290)); ger.traverse(o => { o.castShadow = o.receiveShadow = true }); scene.add(ger)
}

// ---- textures drawn on canvas ---------------------------------------------------------------------------------------
await document.fonts.load('760 64px "Golos Text Variable"')
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
const radial = stops => canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
  for (const [o, c] of stops) gr.addColorStop(o, c)
  g.fillStyle = gr; g.fillRect(0, 0, w, w)
})
const FLAME = radial([[0, 'rgba(255,255,255,1)'], [.2, 'rgba(255,255,255,.75)'], [.5, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']])
const CHAR = radial([[0, 'rgba(20,12,8,.95)'], [.6, 'rgba(30,18,10,.7)'], [1, 'rgba(30,18,10,0)']])
const SMOKE = canvasTex(256, 256, (g, w) => {                                   // a soft puff with some lumps
  for (let i = 0; i < 16; i++) {
    const x = w / 2 + (rnd(i) - .5) * w * .36, y = w / 2 + (rnd(i + 50) - .5) * w * .36, r = w * (.16 + .17 * rnd(i + 90))
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, w, w)
  }
})
const sprite = (map, additive) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }))
  scene.add(s)
  return s
}
const label = (text, color) => canvasTex(1024, 256, (g, w, h) => {
  g.font = '760 112px "Golos Text Variable"'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.lineWidth = 22; g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineJoin = 'round'
  g.strokeText(text, w / 2, h / 2 + 6)
  g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 6)
})
const flat = (map, w, h) => {                                                   // a picture lying on the floor
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }))
  m.rotation.order = 'YXZ'; m.rotation.x = -Math.PI / 2
  scene.add(m)
  return m
}

// ---- fire in room 20 -----------------------------------------------------------------------------------------------
const FIRE = V(350.5, 59)
const ROOM = [.56, .9]                                                           // room 20 inside, world units, x by z
const char = flat(CHAR, .62, .99); char.position.copy(FIRE).setY(.004)
const flames = Array.from({ length: 70 }, () => sprite(FLAME, false))
const cores = Array.from({ length: 16 }, () => sprite(FLAME, true))
const embers = Array.from({ length: 60 }, () => sprite(FLAME, true))
const glow = sprite(FLAME, true)
const fireLight = new THREE.PointLight(0xFF7A2A, 0, 3.5, 2)
fireLight.position.copy(FIRE).setY(.5)
scene.add(fireLight)
const fireSize = t => ease(ramp(t, T.fire, 2.2)) * (1 + .6 * ramp(t, S[1].a, 10))

// smoke: a thick column from the fire, and a low layer creeping along the corridor in front of the room
const column = Array.from({ length: 120 }, () => sprite(SMOKE, false))
const layer = Array.from({ length: 40 }, () => sprite(SMOKE, false))
const CORRIDOR_Z = V(0, 104).z

// alarm: the red button on the corridor wall, a flashing light, rings on the floor
const ALARM = V(183, 104)
const button = new THREE.Mesh(new THREE.BoxGeometry(.02, .07, .07), new THREE.MeshBasicMaterial({ color: 0xC8231A }))
button.position.copy(V(173.7, 104, .13))
scene.add(button)
const ringGeo = new THREE.RingGeometry(.9, 1, 64).rotateX(-Math.PI / 2)
const ring = (color, p) => {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }))
  m.position.copy(p).setY(.012)
  scene.add(m)
  return m
}
const alarmRings = Array.from({ length: 3 }, () => ring(0xE0301E, ALARM))
const alarmLight = new THREE.PointLight(0xFF2A1A, 0, 3, 2)
alarmLight.position.copy(ALARM).setY(.9)
scene.add(alarmLight)

// green signs in the corridors: arrows on the floor pointing the way out. Exits: columns of green light.
const ARROW = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#00A34F'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 28); g.fill()
  g.fillStyle = '#fff'; g.beginPath()
  g.moveTo(50, 52); g.lineTo(146, 52); g.lineTo(146, 26); g.lineTo(208, 64); g.lineTo(146, 102); g.lineTo(146, 76); g.lineTo(50, 76); g.closePath(); g.fill()
})
const CHEVRON = canvasTex(128, 128, g => {
  g.strokeStyle = '#00A34F'; g.lineWidth = 30; g.lineCap = g.lineJoin = 'round'
  g.beginPath(); g.moveTo(40, 22); g.lineTo(88, 64); g.lineTo(40, 106); g.stroke()
})
const WAY = { right: 0, left: Math.PI, up: Math.PI / 2, down: -Math.PI / 2 }
const signPlates = geom.signs.map(([x, y, way]) => {
  const m = flat(ARROW, .42, .21)
  m.rotation.y = WAY[way]
  m.position.copy(V(x, y))
  const dir = P(Math.cos(WAY[way]), 0, -Math.sin(WAY[way]))
  const chevrons = Array.from({ length: 3 }, () => { const c = flat(CHEVRON, .13, .13); c.rotation.y = WAY[way]; return c })
  return { m, dir, chevrons }
})
const signRings = geom.signs.map(([x, y]) => ring(0x00A34F, V(x, y)))
const EXITS = [[181.5, 23], [191, 292], [658, 322], [515, 530]].map(([x, y]) => V(x, y))
const beamTex = canvasTex(4, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)')
  g.fillStyle = gr; g.fillRect(0, 0, w, h)
})
const beams = EXITS.map(p => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, 1.6, 32, 1, true),
    new THREE.MeshBasicMaterial({ map: beamTex, color: 0x18C46C, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
  m.position.copy(p).setY(.8)
  scene.add(m)
  return m
})
const exitRings = EXITS.map(p => ring(0x00A34F, p))

// ---- people in hi-vis vests and yellow helmets ----------------------------------------------------------------------
const bodyGeo = new THREE.CapsuleGeometry(.046, .075, 4, 12), headGeo = new THREE.SphereGeometry(.041, 18, 12)
const vest = new THREE.MeshLambertMaterial({ color: 0xF07A12 }), helmet = new THREE.MeshLambertMaterial({ color: 0xF7C833 })
const stripeGeo = new THREE.CylinderGeometry(.049, .049, .014, 20), stripe = new THREE.MeshLambertMaterial({ color: 0xE8EEF2 })
const TICK = canvasTex(128, 128, g => {
  g.fillStyle = '#00A34F'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill()
  g.strokeStyle = '#fff'; g.lineWidth = 16; g.lineCap = g.lineJoin = 'round'
  g.beginPath(); g.moveTo(36, 66); g.lineTo(56, 86); g.lineTo(94, 44); g.stroke()
})
const PEOPLE = ROUTES.map(r => {
  const path = r.safe === undefined ? r.path : [...r.path, SPOT_XY[r.safe]]   // on to their spot in the safe area
  const pts = path.map(q => V(...q))
  const len = pts.slice(1).map((q, i) => q.distanceTo(pts[i]))
  const total = len.reduce((a, b) => a + b, 0)
  const g = new THREE.Group(), fig = new THREE.Group()
  const body = new THREE.Mesh(bodyGeo, vest); body.position.y = .093
  const band = new THREE.Mesh(stripeGeo, stripe); band.position.y = .1
  const head = new THREE.Mesh(headGeo, helmet); head.position.y = .205
  for (const m of [body, band, head]) { m.castShadow = true; fig.add(m) }
  g.add(fig)
  g.rotation.order = 'YXZ'
  scene.add(g)
  // keep the walking speed when the walk to the safe area is added on
  const d = r.d && r.safe !== undefined ? r.d * total / len.slice(0, -1).reduce((a, b) => a + b, 0) : r.d
  return { ...r, d, pts, len, total, g, fig, tick: sprite(TICK, false) }
})
function distAt(p, t) {                                                         // how far along its route a person is at t
  if (p.press === undefined) return walk((t - p.a) / p.d) * p.total
  const d1 = p.len.slice(0, p.press).reduce((a, b) => a + b, 0), arrive = T.press - .15, leave = T.press + .75
  return t < leave ? walk((t - p.a) / (arrive - p.a)) * d1 : d1 + walk((t - leave) / 3.4) * (p.total - d1)
}
function along(p, d) {
  for (let i = 0; i < p.len.length; i++) {
    if (d <= p.len[i]) return { pos: p.pts[i].clone().lerp(p.pts[i + 1], p.len[i] ? d / p.len[i] : 0), dir: p.pts[i + 1].clone().sub(p.pts[i]) }
    d -= p.len[i]
  }
  return { pos: p.pts.at(-1).clone(), dir: p.pts.at(-1).clone().sub(p.pts.at(-2)) }
}
const LEADER = PEOPLE.find(p => p.lead)
const leadAt = t => along(LEADER, distAt(LEADER, t)).pos
const crouchAt = t => ease(ramp(t, T.s3b - 1, .6))

const SAFE = V(...SAFE_XY)
const safe = new THREE.Group()
{
  const rr = (w, h, r) => { const s = new THREE.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return s }
  const edgeS = rr(1.6, 2.0, .26); edgeS.holes.push(rr(1.5, 1.9, .21))
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(rr(1.6, 2.0, .26)).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2FB36B, transparent: true, depthWrite: false }))
  const edge = new THREE.Mesh(new THREE.ShapeGeometry(edgeS).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x00A34F, transparent: true, depthWrite: false }))
  fill.position.y = .006; edge.position.y = .008
  safe.add(fill, edge)
  safe.position.copy(SAFE)
  scene.add(safe)
}
const safeLabel = sprite(label('Аюулгүй талбай', '#00843D'), false)
const phone = sprite(canvasTex(512, 200, (g, w, h) => {
  g.fillStyle = '#D52B1E'; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 56); g.fill()
  g.save(); g.translate(48, 52); g.scale(4, 4); g.strokeStyle = '#fff'; g.lineWidth = 2; g.lineCap = g.lineJoin = 'round'
  g.stroke(new Path2D('M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384'))
  g.restore()
  g.font = '820 124px "Golos Text Variable"'; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText('101', 196, h / 2 + 8)
}), false)
const ban = sprite(canvasTex(256, 256, g => {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fill()
  g.strokeStyle = '#D52B1E'; g.lineWidth = 30; g.beginPath(); g.arc(128, 128, 100, 0, 7); g.stroke()
  g.lineCap = 'round'; g.beginPath(); g.moveTo(58, 58); g.lineTo(198, 198); g.stroke()
}), false)
const MAIN = V(515, 530)

// ---- camera: one shot per part of the voice. A shot is a function of time; the next shot takes over with a blend. --
const two = (v, u) => typeof v === 'number' ? v : lerp(v[0], v[1], u)          // a number, or [from, to]
const spline = (pos, look, fov = 40, roll = 0) => {
  const pc = new THREE.CatmullRomCurve3(pos, false, 'centripetal'), lc = new THREE.CatmullRomCurve3(look, false, 'centripetal')
  return u => ({ pos: pc.getPoint(clamp(u)), look: lc.getPoint(clamp(u)), fov: two(fov, u), roll: two(roll, u) })
}
const orbit = (c, r, h, a, fov = 40, roll = 0) => u => {                       // a = 0: the camera south of c, looking north
  const ang = two(a, u), rad = two(r, u)
  return { pos: P(c.x + rad * Math.sin(ang), two(h, u), c.z + rad * Math.cos(ang)), look: c.clone(), fov: two(fov, u), roll: two(roll, u) }
}
const F = FIRE, A = ALARM, E = MAIN, SW = V(181, 340), SE = V(668, 366), deg = Math.PI / 180
const SHOTS = [
  { t: 0, blend: 0, ease: true, // high over the camp, swooping down on the burning room
    at: spline([P(6.5, 11.5, 12), P(2.4, 6.2, 5.0), P(F.x + 1.5, 2.0, F.z + 2.9)], [P(0, 0, 0), P(-.8, 0, -1.6), P(F.x, .35, F.z)], [34, 40]) },
  { t: S[1].a - .6, blend: 1.2, // circle the fire
    at: orbit(F.clone().setY(.75), [3.0, 2.3], [1.5, 1.0], [35 * deg, -30 * deg], 42, [-3 * deg, 2 * deg]) },
  { t: T.corridor + .2, blend: 1.3, // a worker from the next room runs to the red button and presses it
    at: spline([P(A.x + 1.3, 1.3, A.z - 1.0), P(A.x + .85, .95, A.z - .65)], [P(A.x + .25, .1, A.z), P(A.x - .05, .12, A.z + .05)], [42, 40]) },
  { t: S[2].a - .5, blend: 1.2, follow: true },                                  // with a worker leaving through the smoke
  { t: S[3].a - .4, blend: 1.6, ease: true, // the green signs point the way: one close, then up over the yard to the others
    at: spline([SW.clone().add(P(1.0, 1.0, 1.0)), SW.clone().add(P(1.3, 1.5, 1.5)), P(.2, 4.4, 5.2), SE.clone().add(P(1.3, 1.6, 1.6))],
      [SW.clone().add(P(0, .15, 0)), SW.clone().add(P(0, .1, .1)), P(0, 0, 1.0), SE.clone().add(P(0, .1, 0))], [42, 40]) },
  { t: S[4].a - .4, blend: 1.4, // along the routes: the yard doors, across the yard, out of the main exit
    at: spline([P(5.6, 4.4, 3.6), P(2.8, 3.6, 6.2), P(E.x - 1.6, 2.6, E.z + 4.0)], [P(3.0, 0, .3), P(.6, 0, 1.6), P(E.x, 0, E.z)]) },
  { t: S[5].a - .5, blend: 1.4, // outside: down to the safe area
    at: spline([P(E.x - 1.2, 3.0, E.z + 5.6), P(E.x + .6, 2.2, E.z + 6.0), P(E.x + 1.4, 1.5, E.z + 5.4)],
      [P(E.x, 0, E.z + 1.6), P(E.x, .2, E.z + 2.3), P(E.x, .2, E.z + 2.3)], [40, 38]) },
  { t: S[6].a - .45, blend: 1.0, // push in on the main exit
    at: spline([P(E.x + .6, 1.1, E.z + 3.2), P(E.x + .2, .75, E.z + 2.1)], [P(E.x, .3, E.z), P(E.x, .33, E.z)], [42, 38]) },
  { t: T.end - .35, blend: 1.6, // pull back and up: the camp, the smoke, everyone safe
    at: spline([P(E.x + .8, 1.3, E.z + 3.4), P(3.0, 5.0, 10.5), P(4.5, 9.0, 13.5)], [P(E.x, .3, E.z), P(-.4, .8, -.6), P(-.6, 1.2, -1.2)], [40, 36]) },
]
SHOTS.forEach((s, i) => { s.dur = (SHOTS[i + 1]?.t ?? DURATION) - s.t })
// follow: behind the worker, smoothed over the last second so the turns swing the camera round gently
function heading(t) {
  const d = new V3()
  for (let k = 0; k < 10; k++) { const tk = t - 1 + k / 9; d.add(leadAt(tk + .2).sub(leadAt(tk - .2))) }
  d.y = 0
  return d.lengthSq() < 1e-8 ? P(0, 0, 1) : d.normalize()
}
function follow(t) {
  const p = new V3()
  for (let k = 0; k < 8; k++) p.add(leadAt(t - .5 + k * .5 / 7))
  p.multiplyScalar(1 / 8)
  const d = heading(t), turn = d.clone().cross(heading(t - .35)).y
  let a = Math.atan2(-d.x, d.z)                                                 // 0 walking south, π/2 west, π north
  if (a < -Math.PI / 2) a += 2 * Math.PI
  const u = clamp(a / (Math.PI / 2), 0, 2)
  const off = u < 1 ? P(.6, .8, .9).lerp(P(.9, .7, .15), u) : P(.9, .7, .15).lerp(P(.5, .75, .7), u - 1)
  off.y -= .08 * crouchAt(t)
  return { pos: p.clone().add(off), look: p.clone().addScaledVector(d, .1).add(P(0, .1, 0)), fov: 46, roll: clamp(turn * .5, -.1, .1) }
}
const poseAt = (s, t) => s.follow ? follow(t) : s.at(s.ease ? ease((t - s.t) / s.dur) : clamp((t - s.t) / s.dur))
function cameraAt(t) {
  const i = Math.max(0, SHOTS.findLastIndex(s => s.t <= t))
  let c = poseAt(SHOTS[i], t)
  const k = SHOTS[i].blend ? ease(ramp(t, SHOTS[i].t, SHOTS[i].blend)) : 1
  if (k < 1) {
    const p = poseAt(SHOTS[i - 1], t)
    c = { pos: p.pos.lerp(c.pos, k), look: p.look.lerp(c.look, k), fov: lerp(p.fov, c.fov, k), roll: lerp(p.roll, c.roll, k) }
  }
  // hand-held: a little shake, more near the fire
  const near = clamp(1.6 - c.pos.distanceTo(FIRE) / 2) * fireSize(t)
  const amp = .008 + .018 * near
  const hand = (a, b, o) => amp * (Math.sin(t * a + o) + .6 * Math.sin(t * b + 2 * o))
  c.pos.x += hand(1.1, 2.9, 0); c.pos.y += hand(1.4, 3.3, 1); c.look.x += hand(.9, 2.3, 2); c.look.y += hand(1.2, 2.7, 3)
  return c
}

// ---- post: bloom for the fire, light grain and vignette --------------------------------------------------------------
const composer = new EffectComposer(renderer)
composer.setPixelRatio(SCALE)
composer.setSize(W, H)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .55, .4, 1.0))
composer.addPass(new OutputPass())
const film = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, seed: { value: 0 }, grain: { value: .035 }, vignette: { value: .4 }, fade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float seed, grain, vignette, fade; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb += (hash(floor(vUv * vec2(1080.0, 1920.0))) - 0.5) * grain;
      float d = distance(vUv * vec2(0.5625, 1.0), vec2(0.28125, 0.5));
      c.rgb *= mix(1.0, smoothstep(0.9, 0.32, d), vignette);
      gl_FragColor = vec4(c.rgb * (1.0 - fade), 1.0);
    }`,
})
composer.addPass(film)

// ---- captions ------------------------------------------------------------------------------------------------------
const CAPS = [
  { t: 0, badge: '', text: caps.T },
  { t: S[1].a, badge: '1', text: caps.S2 }, { t: S[2].a, badge: '2', text: caps.S3a }, { t: T.s3b, badge: '3', text: caps.S3b },
  { t: S[3].a, badge: '4', text: caps.S4 }, { t: S[4].a, badge: '5', text: caps.S5 }, { t: S[5].a, badge: '6', text: caps.S6a },
  { t: T.s6b, badge: '7', text: caps.S6b }, { t: S[6].a, badge: '8', text: caps.S7 }, { t: T.end, badge: '', text: caps.T },
]
const capA = document.getElementById('capA'), capB = document.getElementById('capB')
const capHtml = c => `<div class="panel">${c.badge ? `<div class="kicker">${caps.T}</div>` : ''}<div class="row">` +
  (c.badge ? `<div class="badge">${c.badge}</div>` : '') + `<div class="cap__text">${c.text}</div></div></div>`
const endCard = document.getElementById('end')

// ---- the frame at t --------------------------------------------------------------------------------------------------
window.seek = t => {
  t = Math.max(0, t)                                                            // the first sub-frame starts a hair before 0
  const c = cameraAt(t)
  camera.position.copy(c.pos); camera.fov = c.fov; camera.updateProjectionMatrix(); camera.lookAt(c.look); camera.rotateZ(c.roll)
  const nearCam = s => clamp((s.position.distanceTo(camera.position) - .3) / .6)   // smoke fades out right at the lens
  const eye = camera.position.clone(), worker = leadAt(t).setY(.1), ray = worker.clone().sub(eye), rl = ray.length()
  ray.normalize()
  const sight = q => {                                                          // distance from the camera-to-worker line
    if (t < S[2].a - 1 || t > S[3].a) return 9
    const v = q.clone().sub(eye), d = clamp(v.dot(ray), 0, rl)
    return v.sub(ray.clone().multiplyScalar(d)).length()
  }

  // mood: the light drops and the sky turns smoky while the fire burns, and comes back once people are outside
  const mood = ramp(t, T.fire, 3) * (1 - ramp(t, S[3].a + 1, 5))
  hemi.intensity = 1.25 * (1 - .25 * mood)
  sun.intensity = 1.7 * (1 - .3 * mood)
  scene.background.copy(SKY).lerp(SMOKY, mood * .45)
  scene.fog.color.copy(scene.background)

  // fire: flames rise, cool from yellow to red and shrink; embers drift up; the glow and the light flicker
  const f = fireSize(t), lit = t >= T.fire ? 1 : 0
  char.material.opacity = .9 * ease(ramp(t, T.fire, 3))
  flames.forEach((s, i) => {
    const life = .55 + .55 * rnd(i), u = (((t - T.fire) / life + rnd(i + 100)) % 1 + 1) % 1
    const sway = Math.sin(t * 3.1 + i) * .05 * u
    s.position.set(FIRE.x + (rnd(i + 200) - .5) * ROOM[0] * .9 + sway, .03 + u * (.45 + .5 * rnd(i + 300)) * (.55 + .6 * f), FIRE.z + (rnd(i + 400) - .5) * ROOM[1] * .85)
    const k = (.14 + .16 * rnd(i + 500)) * (1 - .45 * u) * f
    s.scale.set(k, k * 1.5, 1)
    const c = u < .35 ? [lerp(2.2, 1.8, u / .35), lerp(1.5, .55, u / .35), lerp(.5, .08, u / .35)]
      : [lerp(1.8, .4, (u - .35) / .65), lerp(.55, .07, (u - .35) / .65), lerp(.08, .02, (u - .35) / .65)]
    s.material.color.setRGB(...c)
    s.material.opacity = lit * clamp(u / .08) * (1 - u) ** .6 * .92
  })
  cores.forEach((s, i) => {
    s.position.set(FIRE.x + (rnd(i + 3000) - .5) * ROOM[0] * .7, .08 + .1 * rnd(i + 3100), FIRE.z + (rnd(i + 3200) - .5) * ROOM[1] * .7)
    s.scale.setScalar((.28 + .14 * rnd(i + 3300)) * f * (1 + .15 * Math.sin(t * 13 + i * 2)))
    s.material.color.setRGB(.9, .42, .08)
    s.material.opacity = lit * .55
  })
  embers.forEach((s, i) => {
    const life = 1.8 + 1.6 * rnd(i + 7), u = (((t - T.fire) / life + rnd(i + 600)) % 1 + 1) % 1
    s.position.set(FIRE.x + (rnd(i + 700) - .5) * .5 + Math.sin(t * 2 + i) * .18 * u, .1 + u * (1.3 + 1.2 * rnd(i + 800)) * f, FIRE.z + (rnd(i + 900) - .5) * .7 + .25 * u)
    const k = .022 + .026 * rnd(i + 1000)
    s.scale.set(k, k, 1)
    s.material.color.setRGB(3, 1.1, .2)
    s.material.opacity = lit * (1 - u) * (.55 + .45 * Math.sin(t * 19 + i)) * clamp(f)
  })
  glow.position.copy(FIRE).setY(.3)
  glow.scale.setScalar(1.0 * f * (1 + .07 * Math.sin(t * 11)))
  glow.material.color.setRGB(.4, .14, .03)
  glow.material.opacity = lit * .6
  fireLight.intensity = f * (1.6 + .5 * Math.sin(t * 17) + .35 * Math.sin(t * 29.3))

  // smoke column: each puff rises, swells and fades, then starts again; the bottom glows with the fire
  const sStart = T.fire + .4
  column.forEach((s, i) => {
    const life = 6.5 + 4 * rnd(i + 1200), age = (((t - sStart) / life + rnd(i + 1100)) % 1 + 1) % 1 * life
    if (t - sStart < age) { s.visible = false; return }                         // not born yet
    const u = age / life
    s.visible = true
    s.position.set(FIRE.x + (rnd(i + 1300) - .5) * .7 * Math.sqrt(age) + Math.sin(age * .7 + i) * .14,
      .5 + Math.sqrt(age) * (1.1 + .6 * rnd(i + 1400)),
      FIRE.z + .17 * age + (rnd(i + 1500) - .5) * .5)
    const k = (.5 + 1.9 * u) * (.75 + .25 * clamp(f))
    s.scale.set(k, k, 1)
    s.material.rotation = rnd(i + 1600) * 6.28 + age * .12 * (rnd(i + 1700) - .5)
    const shade = .06 + .24 * u, heat = .55 * clamp(1 - age / .7) * clamp(f)
    s.material.color.setRGB(shade + .9 * heat, shade * 1.02 + .3 * heat, shade * 1.07 + .04 * heat)
    s.material.opacity = .9 * ease(u / .1) * (1 - ease((u - .45) / .55)) * nearCam(s)
  })
  // smoke layer: creeps along the corridor both ways from the burning room
  const lStart = T.corridor - 1.2
  layer.forEach((s, i) => {
    const b = lStart + (i / layer.length) * 8, age = t - b
    if (age <= 0) { s.visible = false; return }
    s.visible = true
    const side = i % 2 ? -1 : 1, reach = Math.min(2.7, .4 * age) * (.3 + .7 * rnd(i + 1800))
    s.position.set(FIRE.x + side * reach, .24 + .05 * Math.sin(t * .6 + i) + .14 * rnd(i + 1900), CORRIDOR_Z + (rnd(i + 2000) - .5) * .2)
    const k = .32 + .22 * rnd(i + 2100) + .04 * Math.min(age, 6)
    s.scale.set(k * 1.5, k, 1)
    s.material.rotation = rnd(i + 2200) * 6.28 + t * .05 * (rnd(i + 2300) - .5)
    const shade = .2 + .1 * rnd(i + 2400)
    s.material.color.setRGB(shade, shade, shade * 1.05)
    s.material.opacity = .42 * ease(age / 1.5) * (1 - .55 * ramp(t, T.out, 3)) * nearCam(s) * clamp((sight(s.position) - .1) / .14)
  })

  // alarm: the button and a light flash red, rings spread on the floor
  const on = t >= T.press && t < S[2].a + 2.5
  const blink = on && Math.sin((t - T.press) * 14) > -.2
  alarmRings.forEach((m, i) => {
    const u = on ? ((t - T.press) / 1.1 + i / 3) % 1 : 0
    m.scale.setScalar(.06 + .55 * u)
    m.material.opacity = on ? (1 - u) * .95 : 0
  })
  alarmLight.intensity = blink ? .6 : 0
  button.material.color.setRGB(...(blink ? [3, .25, .18] : [.6, .03, .02]))

  // signs, exits
  const signsOn = clamp(ramp(t, T.signs - .2, .4) - ramp(t, S[4].b, .5))
  const pulse = ramp(t, T.signs - .2, .4) - ramp(t, S[3].b + .3, .4)
  signPlates.forEach(({ m, dir, chevrons }, i) => {
    m.position.y = .015 + .23 * ease(signsOn)
    m.scale.setScalar(1 + .2 * pulse * (.5 + .5 * Math.sin(t * 6 + i)))
    m.material.opacity = signsOn
    chevrons.forEach((c, j) => {
      const u = (t * .9 + j / 3) % 1
      c.position.copy(m.position).setY(.02).addScaledVector(dir, .12 + .55 * u)
      c.material.opacity = signsOn * Math.sin(Math.PI * u)
    })
  })
  signRings.forEach((m, i) => {
    const u = (t * .8 + i * .17) % 1
    m.scale.setScalar(.12 + .3 * u)
    m.material.opacity = clamp(pulse) * (1 - u)
  })
  const exitsOn = clamp(ramp(t, T.routes + 1, .5) - ramp(t, S[4].b + .6, .5))
  beams.forEach((m, i) => { m.material.opacity = exitsOn * (.5 + .15 * Math.sin(t * 5 + i)); m.scale.set(1, .4 + .6 * ease(exitsOn), 1); m.position.y = .8 * (.4 + .6 * ease(exitsOn)) })
  exitRings.forEach((m, i) => {
    const u = (t * .9 + i * .25) % 1
    m.scale.setScalar(.12 + .42 * u)
    m.material.opacity = exitsOn * (1 - u)
  })

  // people
  PEOPLE.forEach(p => {
    const d = distAt(p, t)
    const { pos, dir } = along(p, d)
    const walking = d > 0 && d < p.total && !(p.press !== undefined && Math.abs(t - T.press - .3) < .45)
    const shown = p.still ? 1 : ease(ramp(t, p.a, .3))
    const vis = shown > 0 && (p.safe !== undefined || d < p.total - 1e-4)
    const crouch = p.lead ? crouchAt(t) : 0
    const lean = p.press !== undefined ? .35 * Math.sin(Math.PI * ramp(t, T.press - .25, .8)) : 0
    p.g.visible = vis
    p.g.position.copy(pos)
    p.g.scale.setScalar(shown)
    p.fig.position.y = walking ? Math.abs(Math.sin(t * 10 + p.a)) * .012 : 0
    p.fig.scale.set(1, 1 - .3 * crouch, 1)
    if (dir.lengthSq() > 1e-6) p.g.rotation.y = Math.atan2(dir.x, dir.z)
    p.g.rotation.x = .45 * crouch + lean
    const k = p.safe === undefined ? 0 : ease(ramp(t, T.check + p.safe * .1, .35))
    p.tick.visible = vis && k > 0
    p.tick.position.copy(pos).setY(.36 + .04 * (1 - k))
    p.tick.scale.setScalar(.15 * k)
  })
  const sa = ease(ramp(t, T.out, .6))
  safe.visible = sa > 0
  safe.children[0].material.opacity = .22 * sa
  safe.children[1].material.opacity = .9 * sa
  safeLabel.position.copy(SAFE).add(P(0, .2, -1.18))
  safeLabel.scale.set(1.2, .3, 1)
  safeLabel.material.opacity = sa * (1 - ramp(t, S[6].a - .6, .4))
  const ph = ease(ramp(t, T.call, .35)) * (1 - ramp(t, T.s6b + 1, .4))
  phone.position.copy(SAFE).add(P(0, .85, -.4))
  phone.scale.set(.82 * (.6 + .4 * ph), .32 * (.6 + .4 * ph), 1)
  phone.material.opacity = ph
  const bn = ramp(t, T.ban, .35)
  ban.position.copy(MAIN).setY(.4)
  ban.scale.setScalar(.4 * (.6 + .4 * ease(bn)) * (1 + .08 * Math.sin(clamp(bn) * Math.PI)))
  ban.material.opacity = bn * (1 - ramp(t, T.end, .4))

  film.uniforms.seed.value = (Math.floor(t * FPS) % 97) * 1.618
  film.uniforms.fade.value = 1 - ramp(t, 0, .5) * (1 - ramp(t, DURATION - .5, .5))
  composer.render()

  // captions: cross-fade when the text changes
  const ci = CAPS.findLastIndex(x => x.t <= t), cur = CAPS[ci], prev = CAPS[ci - 1]
  const out = ramp(t, cur.t, .15), v = ease(ramp(t, cur.t + .1, .3))           // the old panel goes, then the new one comes in
  capA.innerHTML = capHtml(cur)
  capA.style.cssText = `opacity:${prev ? v : 1};transform:translateY(${prev ? 20 * (1 - v) : 0}px)`
  capB.innerHTML = prev && out < 1 ? capHtml(prev) : ''
  capB.style.cssText = `opacity:${1 - out}`
  const endOn = ramp(t, T.end, .4)
  endCard.style.opacity = endOn
  endCard.style.transform = `translateY(${30 * (1 - ease(endOn))}px)`
}

const EVENTS = { lead: LEAD, fire: T.fire, press: T.press, out: T.out, ban: T.ban, end: T.end }
Object.assign(window, { DURATION, FPS, EVENTS, subframes: () => 2 })
window.seek(0)
window.ready = true
