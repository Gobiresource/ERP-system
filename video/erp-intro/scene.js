// ERP intro video: a three.js scene that is a pure function of time. window.seek(t) draws the frame
// for t seconds; render.mjs captures each frame. Method: .claude/skills/cinematic-video/SKILL.md.
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { FPS, DURATION, AT, CAPTIONS, HOPS, WHIPS, PHONE_X, screenProgram } from './timeline.js'

const W = 1080, H = 1920
const SCALE = Number(new URLSearchParams(location.search).get('scale') || 1)   // 0.5 for a quick preview
const RED = 0xbc1f29, CLAY_WHITE = 0xf2eee8, FLOOR = 0x2a2522, FOG = 0x15110f

// ---------- small helpers ----------
const clamp01 = x => Math.min(1, Math.max(0, x))
const mix = (a, b, k) => a + (b - a) * k
const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k) }
const outCubic = x => 1 - (1 - clamp01(x)) ** 3
const inOutCubic = x => (x = clamp01(x), x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
const inOutExpo = x => (x = clamp01(x), x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2)
const rand = seed => { const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
// hand-held camera: two sines per axis with seeded phases
const shake = (t, seed, amp) => amp * (Math.sin(t * 1.3 + rand(seed) * 6.28) + 0.5 * Math.sin(t * 3.1 + rand(seed + 1) * 6.28))

// ---------- renderer, scene, camera ----------
const canvas = document.getElementById('gl')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(SCALE)
renderer.setSize(W, H, false)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
scene.background = new THREE.Color(FOG)
scene.fog = new THREE.Fog(FOG, 7, 17)
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.35

const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 60)
camera.setFocalLength(50)                       // 50 mm lens
camera.layers.enable(0)

// lights: warm key with soft shadows, hemisphere fill, cool rim from behind
const key = new THREE.SpotLight(0xffd2a6, 60, 30, 0.55, 0.65, 1.6)
key.position.set(2.5, 6.5, 5.5)
key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
key.shadow.bias = -0.0004
scene.add(key, key.target)
scene.add(new THREE.HemisphereLight(0xd6e0ff, 0x3a2a22, 0.55))
const rim = new THREE.DirectionalLight(0xbfd4ff, 1.6)
rim.position.set(-2, 4, -6)
scene.add(rim)

const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.95 }))
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

// ---------- logo: the red tile and the three white bands, extruded and bevelled ----------
const LOGO = await (await fetch('../logo/logo.json')).json()
const logo = new THREE.Group()           // pivot at the bottom centre, so squash and stretch start at the feet
const body = new THREE.Group()
logo.add(body)
{
  const r = LOGO.tile.radius
  const tile = new THREE.Shape()         // logo space: x right, y up, 1 x 1, origin bottom-left
  tile.moveTo(r, 1); tile.lineTo(1, 1); tile.lineTo(1, r)
  tile.absarc(1 - r, r, r, 0, -Math.PI / 2, true)
  tile.lineTo(0, 0); tile.lineTo(0, 1 - r)
  tile.absarc(r, 1 - r, r, Math.PI, Math.PI / 2, true)
  const depth = 0.16
  const tileGeo = new THREE.ExtrudeGeometry(tile, { depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 5, curveSegments: 28 })
  tileGeo.translate(-0.5, 0, -depth / 2)
  const clay = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0 })
  const tileMesh = new THREE.Mesh(tileGeo, clay(RED))
  tileMesh.castShadow = true
  body.add(tileMesh)
  for (const band of LOGO.bands) {
    const s = new THREE.Shape(band.map(([u, v]) => new THREE.Vector2(u, 1 - v)))
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.006, bevelSegments: 2 })
    g.translate(-0.5, 0, depth / 2 + 0.03)
    const m = new THREE.Mesh(g, clay(CLAY_WHITE))
    m.castShadow = true
    body.add(m)
  }
}
scene.add(logo)

/** Where the logo is at t: x on the stage, height, squash (sy, sx keeps the volume) and lean. */
function logoAt(t) {
  let x = HOPS[0].from, y = 0, sy = 1, lean = 0
  for (const { t0, T, from, to, h } of HOPS) {
    if (t < t0 - 0.14) break
    x = from
    if (t < t0) {                                          // gather: 20 % squash in 0.14 s
      sy = 1 - 0.2 * smooth(0, 1, (t - (t0 - 0.14)) / 0.14)
    } else if (t < t0 + T) {                               // flight on a parabola, stretched at take-off
      const u = (t - t0) / T
      x = mix(from, to, u)
      y = 4 * h * u * (1 - u)
      const stretch = 1 + 0.18 * (1 - smooth(0, 0.45, u)) + 0.07 * smooth(0.7, 1, u)
      sy = mix(0.8, stretch, smooth(0, 0.06, t - t0))
      lean = -Math.sign(to - from) * THREE.MathUtils.degToRad(10) * Math.sin(Math.PI * u)
    } else {                                               // land flat, then settle like a spring (~4 Hz)
      x = to
      const k = t - (t0 + T)
      sy = 1 - 0.24 * Math.exp(-k * 9) * Math.cos(2 * Math.PI * 4 * k)
    }
  }
  return { x, y, sy, sx: 1 / Math.sqrt(sy), lean }
}

// ---------- phone with the app's screen ----------
const phone = new THREE.Group()
const PW = 0.8, PH = 1.66, PD = 0.09
{
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 0.32, metalness: 0.65 })
  const shell = new THREE.Mesh(new RoundedBoxGeometry(PW, PH, PD, 8, 0.11), bodyMat)
  shell.castShadow = true
  phone.add(shell)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.035, PH - 0.035), new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.08, metalness: 0.2 }))
  glass.position.z = PD / 2 + 0.0005
  phone.add(glass)
  for (const [y, h] of [[0.42, 0.16], [0.2, 0.16]]) {        // volume buttons on the left, power on the right
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.02, h, 0.03, 2, 0.008), bodyMat)
    b.position.set(-PW / 2 - 0.006, y, 0); phone.add(b)
  }
  const p = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.24, 0.03, 2, 0.008), bodyMat)
  p.position.set(PW / 2 + 0.006, 0.3, 0); phone.add(p)
}
scene.add(phone)

// The screen is drawn last on its own (layer 1, no tone mapping) so the app's colours stay exact.
const SW = 780, SH = 1688, SR = 66                          // screen canvas: the 1170 x 2532 shots at 2/3
const screenCanvas = document.createElement('canvas')
screenCanvas.width = SW; screenCanvas.height = SH
const sctx = screenCanvas.getContext('2d')
const screenTex = new THREE.CanvasTexture(screenCanvas)
screenTex.colorSpace = THREE.SRGBColorSpace
screenTex.anisotropy = 8
const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.735, 0.735 * SH / SW),
  new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, fog: false, depthTest: false, transparent: true }))
screen.position.z = PD / 2 + 0.002
screen.layers.set(1)
phone.add(screen)

const GEO = await (await fetch('../shots/geometry.json')).json()
const PROGRAM = screenProgram(GEO)
const SHOTS = {}
await Promise.all([...new Set(PROGRAM.filter(e => e.img).map(e => e.img))].map(name => new Promise((ok, fail) => {
  const im = new Image(); im.onload = () => ok(SHOTS[name] = im); im.onerror = fail; im.src = `../shots/${name}.png`
})))

function drawScreen(t) {
  // which shot is up, and a slide in progress
  let cur = null, prev = null, slideK = 1
  for (const e of PROGRAM) {
    if (e.t > t || !e.img) continue
    prev = cur; cur = e.img
    slideK = e.kind === 'slide' ? inOutCubic((t - e.t) / 0.38) : 1
  }
  sctx.save()
  sctx.clearRect(0, 0, SW, SH)
  sctx.beginPath(); sctx.roundRect(0, 0, SW, SH, SR); sctx.clip()
  if (prev && slideK < 1) {
    sctx.drawImage(SHOTS[prev], -slideK * SW * 0.35, 0, SW, SH)       // the old screen moves a little and dims
    sctx.fillStyle = `rgba(0,0,0,${0.18 * slideK})`; sctx.fillRect(0, 0, SW, SH)
    sctx.shadowColor = 'rgba(0,0,0,0.25)'; sctx.shadowBlur = 30
    sctx.drawImage(SHOTS[cur], (1 - slideK) * SW, 0, SW, SH)
    sctx.shadowBlur = 0
  } else if (cur) sctx.drawImage(SHOTS[cur], 0, 0, SW, SH)
  // taps: a finger dot comes in, presses, a ripple spreads
  const k = SW / 1170
  for (const e of PROGRAM) {
    if (e.kind !== 'tap' || t < e.t - 0.3 || t > e.t + 0.6) continue
    const x = (e.target.x + e.target.w / 2) * k, y = (e.target.y + e.target.h / 2) * k
    const d = t - e.t
    if (d < 0.3) {
      const a = d < 0 ? smooth(-0.3, -0.1, d) : 1 - smooth(0.1, 0.3, d)
      const s = d < 0 ? mix(1.25, 1, smooth(-0.3, 0, d)) : mix(0.84, 1, smooth(0, 0.2, d))
      sctx.beginPath(); sctx.arc(x, y, 34 * s, 0, Math.PI * 2)
      sctx.fillStyle = `rgba(255,255,255,${0.55 * a})`; sctx.fill()
      sctx.lineWidth = 3; sctx.strokeStyle = `rgba(20,24,40,${0.35 * a})`; sctx.stroke()
    }
    if (d > 0) {
      const p = clamp01(d / 0.5)
      sctx.beginPath(); sctx.arc(x, y, mix(30, 92, outCubic(p)), 0, Math.PI * 2)
      sctx.lineWidth = 5; sctx.strokeStyle = `rgba(25,90,230,${0.45 * (1 - p)})`; sctx.stroke()
    }
  }
  sctx.restore()
  screenTex.needsUpdate = true
}

// ---------- floating triangles behind, for depth (they fall out of focus) ----------
const tri = new THREE.Shape([new THREE.Vector2(0, 0.6), new THREE.Vector2(-0.52, -0.3), new THREE.Vector2(0.52, -0.3)])
const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 })
triGeo.center()
const floaters = []
for (let i = 0; i < 16; i++) {
  const m = new THREE.Mesh(triGeo, new THREE.MeshStandardMaterial({ color: i % 3 ? RED : CLAY_WHITE, roughness: 0.8 }))
  const s = 0.18 + rand(i + 3) * 0.32
  m.scale.setScalar(s)
  m.userData = { x: -3.5 + rand(i) * 11.5, y: 0.6 + rand(i + 9) * 2.6, z: -2.4 - rand(i + 5) * 4.5, spin: (rand(i + 7) - 0.5) * 0.6, ph: rand(i + 11) * 6.28 }
  // While the phone is on screen the depth of field is off (it is the slowest step in software
  // rendering) and each triangle is shown as a flat, already-blurred picture instead.
  const soft = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTriangle(i % 3 ? '#bc1f29' : '#f2eee8'), color: 0xc8c4c0, depthWrite: false }))
  soft.scale.setScalar(s * 1.9)
  m.userData.soft = soft
  floaters.push(m); scene.add(m, soft)
}
function softTriangle(color) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')
  g.filter = 'blur(16px)'; g.fillStyle = color
  g.beginPath(); g.moveTo(128, 50); g.lineTo(208, 188); g.lineTo(48, 188); g.closePath(); g.fill()
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ---------- post: depth of field, bloom, then film grain and vignette ----------
const composer = new EffectComposer(renderer)
composer.setPixelRatio(SCALE)
composer.setSize(W, H)
composer.addPass(new RenderPass(scene, camera))
const bokeh = new BokehPass(scene, camera, { focus: 4, aperture: 0.0016, maxblur: 0.009 })
composer.addPass(bokeh)
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.22, 0.55, 0.92))
composer.addPass(new OutputPass())
const film = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, seed: { value: 0 }, grain: { value: 0.045 }, vignette: { value: 0.55 }, fade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float seed, grain, vignette, fade; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb += (hash(vUv * vec2(1080.0, 1920.0)) - 0.5) * grain;
      float d = distance(vUv * vec2(0.5625, 1.0), vec2(0.28125, 0.5));
      c.rgb *= mix(1.0, smoothstep(0.78, 0.22, d), vignette);
      gl_FragColor = vec4(c.rgb * (1.0 - fade), 1.0);
    }`,
})
composer.addPass(film)

// ---------- camera rigs ----------
/** the logo's stage position, followed 0.3 s late and averaged over a short window (not its height) */
function lagged(t) {
  let s = 0
  for (let i = -3; i <= 3; i++) s += logoAt(t - 0.3 + i * 0.05).x
  return s / 7
}
const introPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.35, 0.7, 5.9), new THREE.Vector3(0.15, 0.88, 5.5),
  new THREE.Vector3(-0.05, 1.0, 5.2), new THREE.Vector3(0, 1.05, 4.85),
])
function logoRig(t) {
  const x = lagged(t)
  const intro = t < AT.open
  const k = intro ? clamp01(t / AT.open) : clamp01((t - AT.outro) / (DURATION - AT.outro))
  const off = introPath.getPoint(intro ? inOutCubic(k) : 0.55 + 0.45 * inOutCubic(k))
  return { pos: new THREE.Vector3(x + off.x, off.y, off.z), look: new THREE.Vector3(x, 0.08, 0), focusAt: new THREE.Vector3(logoAt(t).x, 0.5, 0) }
}
const phoneY = t => 1.32 + 0.015 * Math.sin(t * 2 * Math.PI / 4)
function phoneRig(t) {
  const k = clamp01((t - AT.open) / (AT.outro - AT.open))
  const d = mix(4.4, 4.05, k)
  const sway = 0.06 * Math.sin(t * 0.35)
  return { pos: new THREE.Vector3(PHONE_X + sway, phoneY(t) + 0.12, d), look: new THREE.Vector3(PHONE_X, phoneY(t) + 0.2, 0), focusAt: new THREE.Vector3(PHONE_X, phoneY(t), 0) }
}
function cameraAt(t) {
  // which rig, and a 0.25 s whip between them
  let from = 'logo', w = null
  for (const wh of WHIPS) {
    if (t >= wh.t0) { from = wh.to; w = wh }
  }
  const rig = name => (name === 'phone' ? phoneRig(t) : logoRig(t))
  let r = rig(from)
  if (w && t < w.t0 + 0.25) {
    const a = rig(w.to === 'phone' ? 'logo' : 'phone'), k = inOutExpo((t - w.t0) / 0.25)
    r = { pos: a.pos.clone().lerp(r.pos, k), look: a.look.clone().lerp(r.look, k), focusAt: a.focusAt.clone().lerp(r.focusAt, k) }
  }
  r.pos.x += shake(t, 1, 0.006); r.pos.y += shake(t, 2, 0.005)
  r.look.x += shake(t, 3, 0.004); r.look.y += shake(t, 4, 0.003)
  return r
}

// ---------- captions (HTML on top of the canvas) ----------
const overlay = document.getElementById('overlay')
const caps = CAPTIONS.map(c => {
  const el = document.createElement('div')
  el.className = `cap cap--${c.place}`
  const part = (cls, text) => { if (!text) return null; const p = document.createElement('div'); p.className = cls; p.textContent = text; el.append(p); return p }
  const parts = [part('cap__title', c.title), part('cap__body', c.body), part('cap__note', c.note), part('cap__chip', c.chip)].filter(Boolean)
  overlay.append(el)
  return { c, el, parts }
})
function drawCaptions(t) {
  for (const { c, el, parts } of caps) {
    const on = t >= c.from - 0.05 && t < c.to
    el.style.display = on ? '' : 'none'
    if (!on) continue
    const out = 1 - smooth(c.to - 0.28, c.to, t)
    parts.forEach((p, i) => {
      const k = outCubic((t - c.from - i * 0.12) / 0.45)
      p.style.opacity = (k * out).toFixed(3)
      p.style.transform = `translateY(${((1 - k) * 28).toFixed(1)}px)`
    })
  }
}

// ---------- one frame ----------
function seek(t) {
  const L = logoAt(t)
  logo.position.set(L.x, L.y, 0)
  logo.scale.set(L.sx, L.sy, L.sx)
  logo.rotation.z = L.lean
  logo.visible = t < AT.open + 0.6 || t > AT.outro - 0.2

  phone.visible = t > AT.title + 1.5 && t < AT.outro + 0.6
  phone.position.set(PHONE_X, phoneY(t), 0)
  phone.rotation.set(-0.03, 0.055 * Math.sin(t * 2 * Math.PI / 9), 0.004 * Math.sin(t * 0.7))
  if (phone.visible) drawScreen(t)

  // the phone part (between the two whips, which hide the switch) uses the blurred pictures, no depth of field
  const phonePart = t > WHIPS[0].t0 + 0.12 && t < WHIPS[1].t0 + 0.12
  bokeh.enabled = !phonePart
  for (const f of floaters) {
    const u = f.userData
    f.position.set(u.x + 0.08 * Math.sin(t * 0.3 + u.ph), u.y + 0.1 * Math.sin(t * 0.45 + u.ph), u.z)
    f.rotation.set(t * u.spin * 0.6 + u.ph, t * u.spin + u.ph, 0.3 * Math.sin(t * 0.2 + u.ph))
    u.soft.position.copy(f.position)
    u.soft.material.rotation = f.rotation.y * 0.5
    f.visible = !phonePart
    u.soft.visible = phonePart
  }

  const C = cameraAt(t)
  camera.position.copy(C.pos)
  camera.lookAt(C.look)
  camera.updateMatrixWorld()
  key.target.position.copy(C.focusAt)
  bokeh.uniforms.focus.value = camera.position.distanceTo(C.focusAt)

  film.uniforms.seed.value = (Math.floor(t * FPS) % 97) * 1.618
  film.uniforms.fade.value = 1 - smooth(0, 0.7, t) * (1 - smooth(DURATION - 0.8, DURATION, t))

  camera.layers.set(0)
  composer.render()
  if (phone.visible) {                                     // the app screen on top, exact colours
    camera.layers.set(1)
    const bg = scene.background
    scene.background = null
    renderer.autoClear = false
    renderer.render(scene, camera)
    renderer.autoClear = true
    scene.background = bg
  }
  drawCaptions(t)
  document.getElementById('shade').style.opacity = film.uniforms.fade.value.toFixed(3)
}

// motion blur: more sub-frames when something moves fast
function subframes(frame) {
  const t = frame / FPS
  if (WHIPS.some(w => t > w.t0 - 0.05 && t < w.t0 + 0.32)) return 4
  if (HOPS.some(h => t > h.t0 - 0.16 && t < h.t0 + h.T + 0.12)) return 3
  if (PROGRAM.some(e => e.kind === 'slide' && t > e.t - 0.02 && t < e.t + 0.42)) return 3
  return 1
}

// sound cues for sfx.py
const EVENTS = [
  ...HOPS.flatMap(h => [{ t: h.t0, kind: 'takeoff' }, { t: h.t0 + h.T, kind: 'land', h: h.h }]),
  ...WHIPS.map(w => ({ t: w.t0, kind: 'whip' })),
  ...PROGRAM.filter(e => e.kind !== 'show' || /-[1-9]$/.test(e.img)).map(e => ({ t: e.t, kind: e.kind === 'show' ? 'key' : e.kind })),
  ...CAPTIONS.map(c => ({ t: c.from, kind: 'caption' })),
]

await document.fonts.ready
Object.assign(window, { seek, subframes, DURATION, FPS, EVENTS, ready: true })
