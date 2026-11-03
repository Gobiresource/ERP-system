// «Кемпэд гал гарвал» in 3D: the camp evacuation plan as a scale model (the plan printed on the floor, low walls), the
// company logo in the round pit in the yard, fire and smoke as particles, people as dots, seen from above. window.seek(t)
// draws the frame at t seconds and keeps no state, so any frame can be drawn again. All timing comes from voice.json
// (sentence and word times): a new recording re-times the video by itself (it must still have 7 sentences).
//   plan-video.svg, plan-geom.json   written by docs/hse/evacuation/plan.py
//   captions.json                    on-screen text by Gemini
//   ../logo/logo.json                the company logo, traced from the picture
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const load = async (f, as = 'json') => (await fetch(f))[as]()
const [geom, voice, caps, planSvg, LOGO] = await Promise.all([load('./plan-geom.json'), load('./voice.json'), load('./captions.json'),
  load('./plan-video.svg', 'text'), load('../logo/logo.json')])

export const FPS = 30
const W = 1080, H = 1920
const SCALE = Number(new URLSearchParams(location.search).get('scale') || 1)   // 0.5 for a quick look
const LEAD = 0.8   // seconds before the voice starts
const TAIL = 2.8   // end card after the voice
const V3 = THREE.Vector3
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const ease = u => (u = clamp(u), u < .5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2)
const smooth = u => (u = clamp(u), u * u * (3 - 2 * u))
const ramp = (t, a, d) => clamp((t - a) / d)                                   // 0 before a, 1 after a + d
const lerp = (a, b, u) => a + (b - a) * u
const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
const walk = (u, a = .12) => {                                                  // steady pace, eased start and stop
  const v = 1 / (1 - a)
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
  signs: S[3].a, gate: at(3, /^гарц/), routes: S[4].a, out: S[5].a, call: at(5, /зуун|101/), s6b: at(5, /кэмп|кемп/),
  check: at(5, /нэрээ/) - .1, ban: S[6].a + .1, end: S[6].b + .5,
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
scene.fog = new THREE.Fog(SKY.clone(), 80, 200)
const camera = new THREE.PerspectiveCamera(30, W / H, 1, 200)

const hemi = new THREE.HemisphereLight(0xFFFFFF, 0xB4BEC6, 1.25)
const sun = new THREE.DirectionalLight(0xFFF1DE, 1.7)
sun.position.set(-5, 9, 3.5)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 })
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.01
scene.add(hemi, sun, sun.target)

// ---- the plan on the floor, with the round pit in the yard cut out (about 40 cm deep) -------------------------------
const GROUND = '#E4E8EB'
const PIT = V(473, 290), PIT_R = .65, PIT_D = .09
const ground = (x0, z0, x1, z1, mat) => {                                      // a rectangle of ground, the pit left open
  const s = new THREE.Shape([new THREE.Vector2(x0, -z1), new THREE.Vector2(x1, -z1), new THREE.Vector2(x1, -z0), new THREE.Vector2(x0, -z0)])
  s.holes.push(new THREE.Path().absarc(PIT.x, -PIT.z, PIT_R, 0, Math.PI * 2, true))
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 96).rotateX(-Math.PI / 2), mat)
  m.receiveShadow = true
  scene.add(m)
  return m
}
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
  const [fx0, fz0, fx1, fz1] = [(x0 - CX) / U, (y0 - CZ) / U, (x1 - CX) / U, (y1 - CZ) / U]
  const floor = ground(fx0, fz0, fx1, fz1, new THREE.MeshLambertMaterial({ map: tex }))
  const pos = floor.geometry.attributes.position, uv = floor.geometry.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - fx0) / (fx1 - fx0), 1 - (pos.getZ(i) - fz0) / (fz1 - fz0))
  ground(-70, -70, 70, 70, new THREE.MeshLambertMaterial({ color: GROUND })).position.y = -.003
  // the pit: its side and bottom, and the company logo lying on the bottom
  const side = new THREE.Mesh(new THREE.CylinderGeometry(PIT_R, PIT_R, PIT_D, 96, 1, true),
    new THREE.MeshLambertMaterial({ color: 0xC9C2B8, side: THREE.BackSide, shadowSide: THREE.DoubleSide }))
  side.position.copy(PIT).setY(-PIT_D / 2)
  side.castShadow = side.receiveShadow = true
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(PIT_R, 96).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xBDB5AA }))
  bottom.position.copy(PIT).setY(-PIT_D)
  bottom.receiveShadow = true
  scene.add(side, bottom)
  const r = LOGO.tile.radius, tile = new THREE.Shape()                          // logo space: 1 x 1, y up, two round corners
  tile.moveTo(r, 1); tile.lineTo(1, 1); tile.lineTo(1, r); tile.absarc(1 - r, r, r, 0, -Math.PI / 2, true)
  tile.lineTo(0, 0); tile.lineTo(0, 1 - r); tile.absarc(r, 1 - r, r, Math.PI, Math.PI / 2, true)
  const logo = new THREE.Group()
  logo.add(new THREE.Mesh(new THREE.ExtrudeGeometry(tile, { depth: .05, bevelThickness: .012, bevelSize: .012, bevelSegments: 3, curveSegments: 24 })
    .translate(-.5, -.5, 0), new THREE.MeshLambertMaterial({ color: LOGO.red })))
  for (const band of LOGO.bands) {
    logo.add(new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(band.map(([u, v]) => new THREE.Vector2(u, 1 - v))), { depth: .016, bevelEnabled: false })
      .translate(-.5, -.5, .062), new THREE.MeshLambertMaterial({ color: 0xF6F3EE })))
  }
  logo.rotation.x = -Math.PI / 2                                                 // lying down, its top towards the north
  logo.scale.setScalar(.8)
  logo.position.copy(PIT).setY(-PIT_D + .002)
  logo.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true })
  scene.add(logo)
}

// ---- people's routes (photo px, as in plan.py). Walls get a doorway wherever a route crosses them. -------------------
// The safe area outside the main exit (its real place is not known yet; drawn as a general area) has a spot for each
// person. Most walk the green arrows to the main exit; the three who leave by the top left exit come round the
// building out of sight and walk in from the west.
const SAFE_XY = [515, 700]
const WALK = 40                                                                 // photo px a second, a brisk walk
const MAIN_OUT = [514, 556]                                                     // just outside the main exit
const exitTL = [[181.5, 104], [181.5, 16], [181.5, -30]]
const yardL = [[204, 292], [300, 328], [420, 382], [504, 432]], yardR = [[650, 322], [600, 368], [545, 412], [522, 432]]
const toMain = [[514, 442], MAIN_OUT]
const polyLen = pts => pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0)
const viaMain = (path, tOut) => ({ path, a: tOut - polyLen(path.slice(0, path.indexOf(MAIN_OUT) + 1)) / WALK, d: polyLen(path) / WALK })
const ROUTES = [
  { legs: [                                                                     // room 17: presses the red button
    { path: [[214, 62], [214, 104], [178.5, 104]], a: T.corridor - 1.6, d: T.press - .15 - (T.corridor - 1.6) },
    { path: [[178.5, 104], [181.5, 96], [181.5, 16], [181.5, -30]], a: T.press + .75, d: 3.4, hide: true },
    { path: [[300, 610], [440, 660], [482, 716]], a: T.out - 1 }] },
  { legs: [                                                                     // room 18: leaves through the smoke
    { path: [[259.5, 72], [259.5, 104], ...exitTL], a: T.walk, d: 10.6, hide: true },
    { path: [[290, 640], [440, 670], [482, 684]], a: T.out - .4 }] },
  { legs: [                                                                     // room 14: follows behind them
    { path: [[305, 135], [305, 104], ...exitTL], a: T.walk + 2.5, d: 12.5, hide: true },
    { path: [[310, 580], [440, 630], [482, 652]], a: T.out + .2 }] },
  { call: true, legs: [viaMain([[343, 480], [343, 519.5], [490, 519.5], [497, 536], MAIN_OUT, [515, 748]], T.out - 3.5)] },  // 46
  { legs: [viaMain([[830, 383], [787, 383], [787, 519.5], [540, 519.5], [533, 536], MAIN_OUT, [548, 748]], T.out - 2.9)] },  // 37
  { legs: [viaMain([[150, 262], [181.5, 262], [181.5, 292], ...yardL, ...toMain, [482, 748]], T.out - 2.3)] },             // 51
  { legs: [viaMain([[150, 377], [181.5, 377], [181.5, 300], ...yardL, ...toMain, [515, 716]], T.out - 1.7)] },             // 50
  { legs: [viaMain([[577, 72], [577, 104], [667, 104], [667, 322], ...yardR, ...toMain, [548, 716]], T.out - 1.1)] },       // 25
  { legs: [viaMain([[710, 165], [667, 165], [667, 322], ...yardR, ...toMain, [515, 684]], T.out - .5)] },                  // 6
  { legs: [viaMain([[830, 247], [787, 247], [787, 104], [667, 104], [667, 322], ...yardR, ...toMain, [548, 684]], T.out + .1)] }, // 34
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
  const paths = ROUTES.flatMap(r => r.legs.map(l => l.path))
  const pieces = []
  for (const w of walls) {
    const len = Math.hypot(w.x1 - w.x0, w.y1 - w.y0), cuts = []
    for (const path of paths) for (let i = 0; i < path.length - 1; i++) {
      const v = cross(path[i], path[i + 1], [w.x0, w.y0], [w.x1, w.y1])
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
  const shed = new THREE.Mesh(new THREE.BoxGeometry(.72, .28, .73), new THREE.MeshLambertMaterial({ color: 0xE6EAED }))   // the shed in the yard
  shed.position.copy(V(371, 287.5, .14)); shed.castShadow = shed.receiveShadow = true; scene.add(shed)
}

// ---- textures drawn on canvas ---------------------------------------------------------------------------------------
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
const ALARM = V(183, 104), BUTTON = V(173.7, 104, .13)
const button = new THREE.Mesh(new THREE.BoxGeometry(.02, .07, .07), new THREE.MeshBasicMaterial({ color: 0xC8231A }))
button.position.copy(BUTTON)
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

// green signs in the corridors: arrows just above the walls with chevrons running the way they point. Exits: green rings.
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
const EXIT_ON = [T.routes + 1, T.gate, T.routes + 1, T.routes + 1]            // the yard door by room 51 lights up first
const exitRings = EXITS.map(p => ring(0x00A34F, p))

// ---- people: dots, as on the plan --------------------------------------------------------------------------------------
const dotGeo = new THREE.CircleGeometry(.07, 32).rotateX(-Math.PI / 2), edgeGeo = new THREE.RingGeometry(.068, .092, 32).rotateX(-Math.PI / 2)
const DOT = new THREE.MeshBasicMaterial({ color: 0x1F2429 }), EDGE = new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
function dot() {
  const g = new THREE.Group()
  for (const m of [new THREE.Mesh(edgeGeo, EDGE), new THREE.Mesh(dotGeo, DOT)]) { m.position.y = .03; g.add(m) }
  scene.add(g)
  return g
}
const TICK = canvasTex(128, 128, g => {
  g.fillStyle = '#00A34F'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill()
  g.strokeStyle = '#fff'; g.lineWidth = 16; g.lineCap = g.lineJoin = 'round'
  g.beginPath(); g.moveTo(36, 66); g.lineTo(56, 86); g.lineTo(94, 44); g.stroke()
})
// each leg of a route becomes a curve with rounded corners, walked at a steady pace
function rounded(points, r = .1) {
  const pts = points.map(q => V(...q)), path = new THREE.CurvePath()
  let from = pts[0]
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], ra = Math.min(r, p.distanceTo(pts[i - 1]) / 2), rb = Math.min(r, p.distanceTo(pts[i + 1]) / 2)
    const a = p.clone().addScaledVector(pts[i - 1].clone().sub(p).normalize(), ra), b = p.clone().addScaledVector(pts[i + 1].clone().sub(p).normalize(), rb)
    if (from.distanceTo(a) > 1e-6) path.add(new THREE.LineCurve3(from, a))
    path.add(new THREE.QuadraticBezierCurve3(a, p, b))
    from = b
  }
  path.add(new THREE.LineCurve3(from, pts.at(-1)))
  return path
}
const PEOPLE = ROUTES.map((r, n) => ({ ...r, n, g: dot(), tick: sprite(TICK, false),
  legs: r.legs.map(l => { const curve = rounded(l.path), L = curve.getLength(); return { ...l, curve, L, d: l.d ?? polyLen(l.path) / WALK } }) }))
function legAt(p, t) {                                                          // the leg in use at t and how far along it
  const i = p.legs.findLastIndex(l => t >= l.a)
  if (i < 0) return { l: p.legs[0], s: 0 }                                       // standing in the room, not left yet
  const l = p.legs[i], u = (t - l.a) / l.d
  if (u >= 1 && l.hide) return null                                              // out of sight until the next leg
  return { l, s: walk(u, Math.min(.15, .45 / l.d)) * l.L }
}
const CALL = canvasTex(256, 256, g => {                                         // a phone by whoever calls 101
  g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fill()
  g.save(); g.translate(56, 56); g.scale(6, 6); g.strokeStyle = '#D52B1E'; g.lineWidth = 2.2; g.lineCap = g.lineJoin = 'round'
  g.stroke(new Path2D('M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384'))
  g.restore()
})
const call = sprite(CALL, false)

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
const ban = sprite(canvasTex(256, 256, g => {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fill()
  g.strokeStyle = '#D52B1E'; g.lineWidth = 30; g.beginPath(); g.arc(128, 128, 100, 0, 7); g.stroke()
  g.lineCap = 'round'; g.beginPath(); g.moveTo(58, 58); g.lineTo(198, 198); g.stroke()
}), false)
const MAIN = V(515, 530)

// ---- camera: always from above, north up as on the posted plan; it only glides and zooms between a few views ----------
const TILT = 10 * Math.PI / 180, SPAN = 2 * Math.tan(15 * Math.PI / 180) * W / H     // picture width per unit of distance
const FULL = { x: 0, z: 1.55, w: 12.6 }                                         // the whole camp and the safe area
const VIEWS = [                                                                 // from t, glide for d seconds to: centre x, z and width w
  { t: 0, x: PIT.x, z: PIT.z, w: 2.4 },                                         // the logo in the yard
  { t: 1, d: 2.6, ...FULL },
  { t: S[1].a - .8, x: -2.45, z: -2.75, w: 4.4 },                               // the fire, the corridor, the button, the near exit
  { t: S[3].a - .5, ...FULL },                                                  // the signs and the routes
  { t: S[5].a - .5, x: MAIN.x, z: 4.55, w: 4.8 },                               // the main exit and the safe area
  { t: T.end - .3, ...FULL },
]
function cameraAt(t) {
  const i = Math.max(0, VIEWS.findLastIndex(v => v.t <= t)), b = VIEWS[i], a = VIEWS[Math.max(0, i - 1)]
  const u = smooth(ramp(t, b.t, b.d ?? 1.6))
  const x = lerp(a.x, b.x, u), z = lerp(a.z, b.z, u), dist = Math.exp(lerp(Math.log(a.w), Math.log(b.w), u)) / SPAN
  return { pos: P(x, dist * Math.cos(TILT), z + dist * Math.sin(TILT)), look: P(x, 0, z) }
}

// ---- post: bloom for the fire, light grain and vignette --------------------------------------------------------------
const composer = new EffectComposer(renderer)
composer.setPixelRatio(SCALE)
composer.setSize(W, H)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .55, .4, 1.0))
composer.addPass(new OutputPass())
const film = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, seed: { value: 0 }, grain: { value: .03 }, vignette: { value: .35 }, fade: { value: 0 } },
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
  { t: 0, text: caps.T },
  { t: S[1].a, badge: '1', text: caps.S2 }, { t: S[2].a, badge: '2', text: caps.S3a }, { t: T.s3b, badge: '3', text: caps.S3b },
  { t: S[3].a, badge: '4', text: caps.S4 }, { t: S[4].a, badge: '5', text: caps.S5 }, { t: S[5].a, badge: '6', text: caps.S6a },
  { t: T.s6b, badge: '7', text: caps.S6b }, { t: S[6].a, badge: '8', text: caps.S7 }, { t: T.end, text: caps.T },
]
const capA = document.getElementById('capA'), capB = document.getElementById('capB')
const capHtml = c => c.badge
  ? `<div class="kicker">${caps.T}</div><div class="row"><div class="badge">${c.badge}</div><div class="cap__text">${c.text}</div></div>`
  : `<div class="title">${c.text}</div>`
const endCard = document.getElementById('end')

// ---- the frame at t --------------------------------------------------------------------------------------------------
window.seek = t => {
  t = Math.max(0, t)                                                            // the first sub-frame starts a hair before 0
  const c = cameraAt(t)
  camera.position.copy(c.pos); camera.lookAt(c.look)

  // mood: the light drops and the sky turns smoky while the fire burns, and comes back once people are outside
  const mood = ramp(t, T.fire, 3) * (1 - ramp(t, S[3].a + 1, 5))
  hemi.intensity = 1.25 * (1 - .25 * mood)
  sun.intensity = 1.7 * (1 - .3 * mood)
  scene.background.copy(SKY).lerp(SMOKY, mood * .3)
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
      FIRE.z - .22 * age + (rnd(i + 1500) - .5) * .5)            // the wind takes it north, off the camp
    const k = (.5 + 1.9 * u) * (.75 + .25 * clamp(f))
    s.scale.set(k, k, 1)
    s.material.rotation = rnd(i + 1600) * 6.28 + age * .12 * (rnd(i + 1700) - .5)
    const shade = .06 + .24 * u, heat = .55 * clamp(1 - age / .7) * clamp(f)
    s.material.color.setRGB(shade + .9 * heat, shade * 1.02 + .3 * heat, shade * 1.07 + .04 * heat)
    s.material.opacity = .9 * ease(u / .1) * (1 - ease((u - .45) / .55))
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
    s.material.opacity = .42 * ease(age / 1.5) * (1 - .55 * ramp(t, T.out, 3))
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
  EXITS.forEach((_, i) => {
    const on = clamp(ramp(t, EXIT_ON[i], .5) - ramp(t, S[4].b + .6, .5)), u = (t * .9 + i * .25) % 1
    exitRings[i].scale.setScalar(.12 + .42 * u)
    exitRings[i].material.opacity = on * (1 - u)
  })

  // people: dots walking their legs; a green tick by each one once they have registered
  PEOPLE.forEach(p => {
    const st = legAt(p, t)
    p.g.visible = !!st
    p.tick.visible = false
    if (!st) return
    const pos = st.l.curve.getPoint(st.s / st.l.L)
    p.g.position.copy(pos)
    if (p.call) {
      const k = smooth(ramp(t, T.call - .2, .4)) * (1 - smooth(ramp(t, T.s6b + .6, .4)))
      call.position.copy(pos).add(P(.12, .2, -.12))
      call.scale.setScalar(.2 * k * (1 + .08 * Math.sin(t * 9)))
      call.material.opacity = k
    }
    const k = st.l === p.legs.at(-1) ? ease(ramp(t, T.check + p.n * .06, .3)) : 0
    p.tick.visible = k > 0
    p.tick.position.copy(pos).add(P(.1, .2, -.1))
    p.tick.scale.setScalar(.17 * k)
  })
  const sa = ease(ramp(t, T.routes, .6))
  safe.visible = sa > 0
  safe.children[0].material.opacity = .22 * sa
  safe.children[1].material.opacity = .9 * sa
  const bn = ramp(t, T.ban, .35)
  ban.position.copy(MAIN).setY(.4)
  ban.scale.setScalar(.4 * (.6 + .4 * ease(bn)) * (1 + .08 * Math.sin(clamp(bn) * Math.PI)))
  ban.material.opacity = bn * (1 - ramp(t, T.end, .4))

  film.uniforms.seed.value = (Math.floor(t * FPS) % 97) * 1.618
  film.uniforms.fade.value = 1 - ramp(t, 0, .5) * (1 - ramp(t, DURATION - .5, .5))
  composer.render()

  // captions: the old one goes, then the new one comes in
  const ci = CAPS.findLastIndex(x => x.t <= t), cur = CAPS[ci], prev = CAPS[ci - 1]
  const out = ramp(t, cur.t, .15), v = ease(ramp(t, cur.t + .1, .3))
  capA.innerHTML = capHtml(cur)
  capA.style.cssText = `opacity:${prev ? v : 1};transform:translateY(${prev ? 16 * (1 - v) : 0}px)`
  capB.innerHTML = prev && out < 1 ? capHtml(prev) : ''
  capB.style.cssText = `opacity:${1 - out}`
  const endOn = ramp(t, T.end, .4)
  endCard.style.opacity = endOn
  endCard.style.transform = `translateY(${30 * (1 - ease(endOn))}px)`
}

const EVENTS = { lead: LEAD, fire: T.fire, press: T.press, out: T.out, ban: T.ban, end: T.end }
Object.assign(window, { DURATION, FPS, EVENTS, subframes: () => 2 })
await document.fonts.load('760 64px "Golos Text Variable"')
window.seek(0)
window.ready = true
