// What happens when in the ERP intro video. Everything on screen is computed from t (seconds),
// so any frame can be rendered on its own. Shot images and tap positions come from ../shots
// (capture.mjs); shot pixels are 1170 x 2532 (a 390 x 844 phone at 3x).
export const FPS = 60
export const ADDRESS = 'gobi-erp.gobiresource.workers.dev'

// Beats in order with their length; start times are added up below.
const BEATS = [
  ['logo', 4.2], ['title', 3.4], ['open', 5.0], ['login', 4.6], ['home', 4.4], ['tasks', 4.4],
  ['requests', 4.4], ['chat', 4.4], ['calendar', 5.0], ['docs', 5.0], ['more', 5.4], ['outro', 7.4],
]
export const AT = {}
let t = 0
for (const [name, len] of BEATS) { AT[name] = t; t += len }
export const DURATION = t

// Captions. place: 'top' above the phone, 'bottom' under the logo. Text checked with Gemini (decisions.md).
export const CAPTIONS = [
  { from: 2.5, to: AT.title, place: 'bottom', title: 'Говь Ресурс' },
  { from: AT.title + 0.2, to: AT.open - 0.3, place: 'bottom', title: 'Шинэ ERP систем', body: 'Ажил, хүсэлт, бичиг баримт нэг дор' },
  { from: AT.open + 0.3, to: AT.login, place: 'top', title: 'Хаанаас нээх вэ?', body: 'Утас, компьютерын хөтчөөр дараах хаягаар орно.', chip: ADDRESS },
  { from: AT.login, to: AT.home, place: 'top', title: 'Нэвтрэх', body: 'Нэвтрэх нэр, нууц үгээ бичээд «Нэвтрэх» товчийг дарна.', note: 'Нууц үгээ мартсан бол удирдлагадаа хандана уу.' },
  { from: AT.home, to: AT.tasks, place: 'top', title: 'Нүүр', body: 'Өнөөдрийн ажил, тов, зорилгоо нэг дороос харна.' },
  { from: AT.tasks, to: AT.requests, place: 'top', title: 'Ажил', body: 'Хийх ажлаа нэмж, явцаа хянана.' },
  { from: AT.requests, to: AT.chat, place: 'top', title: 'Хүсэлт', body: 'Ээлжийн амралт, илүү цаг, бичиг баримтын хүсэлтээ гаргана.' },
  { from: AT.chat, to: AT.calendar, place: 'top', title: 'Зурвас', body: 'Хамт олон, багтайгаа зурвас бичилцэнэ.' },
  { from: AT.calendar, to: AT.docs, place: 'top', title: 'Календарь', body: 'Хурал, уулзалтын товоо төлөвлөнө.' },
  { from: AT.docs, to: AT.more, place: 'top', title: 'Бичиг хэрэг', body: 'Гэрээ, тушаал, журам, маягт нь компани бүрийн хавтсанд хадгалагдана.' },
  { from: AT.more, to: AT.outro, place: 'top', title: 'Бусад', body: 'Тайлан, Төсөл, Ноорог, Баг энд байрлана.' },
  { from: AT.outro + 1.4, to: 99, place: 'bottom', title: 'Өнөөдрөөс ашиглаж эхэлцгээе!', chip: ADDRESS },
]

// Logo hops: take-off time, time in the air, x on the stage before and after, height.
export const HOPS = [
  { t0: 0.9, T: 0.55, from: 2.9, to: 1.35, h: 0.9 },
  { t0: 1.75, T: 0.62, from: 1.35, to: 0, h: 1.15 },
  { t0: AT.open - 0.55, T: 0.5, from: 0, to: -3.2, h: 0.85 },
  { t0: AT.outro + 0.35, T: 0.62, from: -3.2, to: 0, h: 1.15 },
]

// Camera whips between the logo (x = 0) and the phone (x = PHONE_X): start time, length 0.25 s.
export const PHONE_X = 4.6
export const WHIPS = [{ t0: AT.open - 0.3, to: 'phone' }, { t0: AT.outro, to: 'logo' }]

// The phone screen: shot changes (show = instant, slide = new screen comes in from the right) and taps.
// Tap x, y are in shot pixels; named targets are looked up in shots/geometry.json.
export function screenProgram(geo) {
  const P = []
  const show = (t, img) => P.push({ t, kind: 'show', img })
  const slide = (t, img) => P.push({ t, kind: 'slide', img })
  const tap = (t, target) => P.push({ t, kind: 'tap', target })
  const tab = label => geo.tabs.find(x => x.label === label)
  const item = label => geo.more.find(x => x.label === label)

  show(0, 'login-0')
  // sign in: tap the name, type it letter by letter, then the password, then the button
  let s = AT.login + 0.45
  tap(s, geo.name); show(s + 0.12, 'login-name-0')
  for (let i = 1; i <= 8; i++) show(s + 0.3 + i * 0.13, `login-name-${i}`)
  s += 1.55
  tap(s, geo.pass); show(s + 0.12, 'login-pass-0')
  for (let i = 1; i <= 7; i++) show(s + 0.3 + i * 0.12, `login-pass-${i}`)
  s += 1.35
  tap(s, geo.submit)
  slide(s + 0.3, 'page-home')
  // bottom-menu sections
  for (const [beat, label, img] of [['tasks', 'Ажил', 'page-tasks'], ['requests', 'Хүсэлт', 'page-requests'], ['chat', 'Зурвас', 'page-chat']]) {
    tap(AT[beat] + 0.25, tab(label)); slide(AT[beat] + 0.5, img)
  }
  // sections under «Бусад»
  for (const [beat, label, img] of [['calendar', 'Календарь', 'page-calendar'], ['docs', 'Бичиг хэрэг', 'page-docs']]) {
    tap(AT[beat] + 0.25, tab('Бусад')); show(AT[beat] + 0.5, 'more-menu')
    tap(AT[beat] + 1.25, item(label)); slide(AT[beat] + 1.5, img)
  }
  tap(AT.more + 0.25, tab('Бусад')); show(AT.more + 0.5, 'more-menu')
  const quick = ['page-insights', 'page-projects', 'page-draft', 'page-team']
  quick.forEach((img, i) => slide(AT.more + 1.5 + i * 0.95, img))
  return P.sort((a, b) => a.t - b.t)
}
