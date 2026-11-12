// The conference deck, slide by slide. Words come from the user's paper (assets/notes.json holds its paragraphs for the
// speaker notes); the two example slides show a real reading of an invented sample page (assets/reading.json).
// Run: node build.js out/raw.pptx, then post.py writes the theme colours and puts the font inside the file
// (README.md has the two commands). Helpers and the look are in lib.js.
'use strict'
const fs = require('fs')
const path = require('path')
const { pres, SH, A, W, MX, CW, TOP, K, HUE, tw, lineCount, lineH, defLsm, textH, txt, glass, solid, icon, iconTile, badge, pill, chips, rows, stack, arrowDot, arrowLine, sourceLine, content, dark, issues, unknown, usedIcons } = require('./lib')

const OUT = process.argv[2] || path.join(__dirname, 'out', 'deck.pptx')
const N = JSON.parse(fs.readFileSync(A('notes.json'), 'utf8'))
const READ = JSON.parse(fs.readFileSync(A('reading.json'), 'utf8'))
const FAINT = JSON.parse(fs.readFileSync(A('specimen-boxes.json'), 'utf8')).faint

const TITLE = 'Төрөлжсөн архивын цаасан болон цахим баримтыг хиймэл оюун ухаанаар ялгаж, ангилан цэгцлэх туршилтын загвар ба судалгааны эргэлтэд оруулах давуу тал'
pres.title = TITLE
pres.author = 'А.Уянгаа'
pres.subject = '«Архивын баримтыг судалгааны эргэлтэд оруулах нь» эрдэм шинжилгээний бага хурал'

const SEC = { intro: 'Удиртгал', why: 'Яагаад хэрэгтэй вэ', model: 'Загварын бүтэц', pilot: 'Туршилтын загвар ба жишээ', gain: 'Үр ашиг ба аюулгүй байдал', end: 'Төгсгөл' }
const heading = (s, text, x, y, w, o = {}) => txt(s, text, { x, y, w, h: o.h ?? 0.58, pt: o.pt ?? 17, bold: true, valign: 'middle', color: o.color, name: 'Гарчиг' })
const label = (s, text, x, y, w, o = {}) => txt(s, text, { x, y, w, h: 0.26, pt: 12.5, bold: true, color: o.color ?? K.text2, name: 'Шошго' })

// ---------- 1. Нүүр ----------
pres.addSection({ title: SEC.intro })
{
  const s = dark(SEC.intro, 'Нүүр', TITLE, N.title)
  const pw = pill(s, 'Эрдэм шинжилгээний бага хурал', 0.7, 0.62, { tone: 'glass', bold: true, h: 0.4 })
  txt(s, '«Архивын баримтыг судалгааны эргэлтэд оруулах нь»', { x: 0.7 + pw + 0.2, y: 0.62, w: 6.4, h: 0.4, pt: 14, color: K.dText2, valign: 'middle', wrap: false, name: 'Хурлын нэр' })
  s.addImage({ path: A('folder-orange.png'), x: 9.02, y: 1.72, w: 3.66, h: 3.44, altText: 'Баримт бичигтэй шилэн хавтас', objectName: 'Шилэн хавтас' })
  pill(s, 'Тушаал', 8.6, 1.5, { tone: 'island', dot: 'teal', pt: 13, h: 0.42 })
  pill(s, 'Хот төлөвлөлт', 11.2, 2.42, { tone: 'island', dot: 'orange', pt: 13, h: 0.42 })
  pill(s, 'Орос эх, монгол орчуулга', 9.72, 4.98, { tone: 'island', dot: 'indigo', pt: 13, h: 0.42 })
  const meta = (name, value, x, y, w, o = {}) => {
    txt(s, name, { x, y, w, h: 0.24, pt: 11.5, color: K.dText3, name: 'Шошго' })
    txt(s, value, { x, y: y + 0.27, w, h: o.h ?? 0.52, pt: o.pt ?? 13.5, bold: o.bold, color: K.dText, name: 'Утга' })
  }
  meta('Илтгэгч', 'А.Уянгаа', 0.7, 5.2, 3.45, { pt: 16, bold: true, h: 0.34 })
  meta('Хэзээ, хаана', '2026 оны 11 дүгээр сар, Эрдэнэт хот', 4.45, 5.2, 4.2, { h: 0.34 })
  meta('Судалгааны чиглэл', 'Эрдэнэт хот, үйлдвэртэй холбоотой бусад сэдэв', 0.7, 6.03, 3.45)
  meta('Зохион байгуулагч', '«Эрдэнэт үйлдвэр» ТӨҮГ-ын Хүний нөөц, захиргааны хэлтэс, Төрөлжсөн архив', 4.45, 6.03, 4.25)
}

// ---------- 2. Түүх ----------
{
  const s = content(SEC.intro, ['1', 'Удиртгал'], 'Хагас зуун жилийн баримтын сан', N.history)
  const y = TOP, tH = 2.3
  glass(s, MX, y, CW, tH)
  const col = (CW - 0.6) / 4
  s.addShape(SH.line, { x: MX + 0.38, y: y + 0.95, w: CW - 0.76, h: 0, line: { color: K.sep, width: 1.5 }, objectName: 'Цаг хугацааны шугам' })
  const TIMELINE = [
    ['1973', 'Монгол-Зөвлөлтийн Засгийн газар хоорондын хэлэлцээрээр үйлдвэр, хотыг байгуулах ажил эхэлсэн'],
    ['1974', 'Ерөнхий захирал В.Шлыковын 08 тоот тушаалаар үйлдвэрийн архив байгуулагдсан', '9 дүгээр сарын 30'],
    ['2002', 'Төрөлжсөн архивын 03007 тоот гэрчилгээ авсан'],
    ['2005', 'Төрийн архивын статус авч, үндэсний архивын сан хөмрөгийн жишиг нэгж болсон'],
  ]
  TIMELINE.forEach(([year, text, day], i) => {
    const cx = MX + 0.3 + i * col
    txt(s, year, { x: cx, y: y + 0.26, w: col - 0.2, h: 0.46, pt: 22, bold: true, name: 'Он' })
    if (day) pill(s, day, cx + tw(year, 22, true) + 0.14, y + 0.31, { tone: 'quiet', pt: 12, h: 0.32 })
    s.addShape(SH.ellipse, { x: cx, y: y + 0.87, w: 0.16, h: 0.16, fill: { color: K.accent }, line: { color: K.white, width: 1.5 }, objectName: 'Цэг' })
    txt(s, text, { x: cx, y: y + 1.2, w: col - 0.2, h: 1.0, pt: 13, color: K.text2 })
  })

  const y2 = y + tH + 0.2, h2 = 2.3, sw = 4.5
  glass(s, MX, y2, sw, h2)
  label(s, 'Сан хөмрөг', MX + 0.3, y2 + 0.26, 2.6)
  txt(s, '35 тонн', { x: MX + 0.3, y: y2 + 0.52, w: 2.75, h: 0.72, pt: 42, bold: true, wrap: false, spacing: -0.8, name: 'Тоо' })
  txt(s, 'гаруй зураг төсөл, техник эдийн засгийн баримт, кино, гэрэл зураг, дуу авианы баримт [6]', { x: MX + 0.3, y: y2 + 1.26, w: 2.78, h: 0.96, pt: 13, color: K.text2 })
  s.addImage({ path: A('folder-teal.png'), x: MX + 3.06, y: y2 + 0.5, w: 1.22, h: 1.147, altText: 'Баримт бичигтэй шилэн хавтас', objectName: 'Шилэн хавтас' })

  const cx2 = MX + sw + 0.22, cw2 = W - MX - cx2
  glass(s, cx2, y2, cw2, h2)
  txt(s, 'Бүхий л салбарын түүхэн баримт хадгалагддаг', { x: cx2 + 0.3, y: y2 + 0.24, w: cw2 - 0.6, h: 0.28, pt: 13.5, bold: true })
  chips(s, ['Үйлдвэрийн технологийн горим', 'Барилга байгууламжийн зураг төсөл', 'Хот төлөвлөлт', 'Нийтийн аж ахуй', 'Байгаль орчин', 'Эрүүл мэнд', 'Боловсрол', 'Эдийн засаг'], { x: cx2 + 0.3, y: y2 + 0.7, w: cw2 - 0.6, pt: 12, h: 0.36, gap: 0.1 })
  sourceLine(s, 'Эх сурвалж: Төрөлжсөн архивын танилцуулга [2], Архивын ерөнхий газар [6]')
}

// ---------- 3. Асуудал ----------
{
  const s = content(SEC.intro, ['1', 'Асуудал дэвшүүлэлт'], 'Хадгалалт өндөр түвшинд, харин хайлт гар аргаар', N.problem)
  const y = TOP, cw = 5.72, ch = 3.5, bx = W - MX - cw
  glass(s, MX, y, cw, ch)
  iconTile(s, 'hand', 'mute', MX + 0.3, y + 0.3, 0.58, 'Гар ажиллагаа')
  heading(s, 'Өнөөгийн практик', MX + 1.06, y + 0.3, 4.3)
  txt(s, 'Сканнердаж хадгалсан олон мянган зурган файл, хавтаснаас нэг сэдэвт хамаарах баримтыг архивын ажилтан, судлаачид гар аргаар:', { x: MX + 0.3, y: y + 1.1, w: cw - 0.6, h: 0.82, pt: 14 })
  rows(s, [{ icon: 'file-search', text: 'Ялгаж түүвэрлэнэ', bold: true }, { icon: 'list-ordered', text: 'Товъёог үйлдэнэ', bold: true }, { icon: 'layers', text: 'Агуулгаар нь багцална', bold: true }], { x: MX + 0.3, y: y + 2.1, w: cw - 0.6, pt: 14, hue: 'mute' })

  arrowDot(s, W / 2, y + ch / 2)

  glass(s, bx, y, cw, ch)
  iconTile(s, 'scan-text', 'copper', bx + 0.3, y + 0.3, 0.58, 'Хиймэл оюун ухаанаар унших')
  heading(s, 'Дэвшүүлж буй шийдэл', bx + 1.06, y + 0.3, 4.3)
  txt(s, 'Цаасан болон цахим файлыг хиймэл оюун ухаанаар автоматаар уншиж, гурван шинжээр ялган ангилж цэгцлэх туршилтын загвар:', { x: bx + 0.3, y: y + 1.1, w: cw - 0.6, h: 0.82, pt: 14 })
  rows(s, [{ icon: 'book-open', text: 'Утга агуулгаар', bold: true }, { icon: 'folder-tree', text: 'Салбар чиглэлээр', bold: true }, { icon: 'calendar', text: 'Он дарааллаар', bold: true }], { x: bx + 0.3, y: y + 2.1, w: cw - 0.6, pt: 14, hue: 'copper' })

  const qy = y + ch + 0.24
  solid(s, MX, qy, CW, 1.04, { fill: K.island, r: 0.3, name: 'Асуулт' })
  txt(s, 'Сканнердаж хавтаслах боломж байсаар атал яагаад заавал хиймэл оюун ухаан гэж?', { x: MX + 0.42, y: qy, w: 8.3, h: 1.04, pt: 17, bold: true, color: K.white, valign: 'middle', name: 'Асуулт' })
  const aw = tw('Дөрвөн бодит шалтгаан', 13, true) * 1.03 + 0.4
  pill(s, 'Дөрвөн бодит шалтгаан', MX + CW - 0.42 - aw, qy + 0.31, { tone: 'accent', bold: true, pt: 13, h: 0.42, w: aw })
}

// ---------- 4–7. Дөрвөн шалтгаан ----------
pres.addSection({ title: SEC.why })
{
  const s = content(SEC.why, ['2.1', '1-р шалтгаан', { of: 4, on: [1] }], 'Сканнердсан зураг бол хайж болох өгөгдөл биш', N.r1)
  const y = TOP, cw = 5.72, ch = 4.7, bx = W - MX - cw
  const side = (x, o) => {
    glass(s, x, y, cw, ch)
    iconTile(s, o.icon, o.hue, x + 0.3, y + 0.3, 0.58, o.alt)
    heading(s, o.title, x + 1.06, y + 0.3, 4.3)
    const y2 = rows(s, o.points, { x: x + 0.3, y: y + 1.14, w: cw - 0.6, pt: 14 })
    label(s, o.label, x + 0.3, y + 2.58, cw - 0.6)
    chips(s, ['өгүүлбэр', 'хүснэгт', 'инженерийн штамп', 'гар бичмэл тэмдэглэгээ'], { x: x + 0.3, y: y + 2.9, w: cw - 0.6, tone: o.chip })
    pill(s, o.result, x + 0.3, y + ch - 0.74, { tone: o.tone, solid: true, bold: true, pt: 13, h: 0.44 })
    if (y2 > y + 2.42) issues.push(`${o.title}: the points run into the label`)
  }
  side(MX, { icon: 'image-off', hue: 'mute', alt: 'Зурган файл', title: 'Уламжлалт цахимжуулалт', points: ['Сканнердахад компьютерт зөвхөн зурган файл үүснэ.', 'Файлын нэр, хавтасны бүртгэлээс өөр мэдээлэл системд байхгүй.'], label: 'Эдгээрээр хайх боломжгүй', chip: 'quiet', tone: 'dark', result: '«Харанхуй өгөгдөл» болж үлдэнэ' })
  arrowDot(s, W / 2, y + ch / 2)
  side(bx, { icon: 'scan-text', hue: 'teal', alt: 'Уншсан бичвэр', title: 'Хиймэл оюун ухааны сан', points: ['Файл бүрийн доторх текстийг бүрэн уншина.', 'Ямар агуулгатай, аль цех нэгж, хороололд хамаарахыг автоматаар таньж цэгцэлнэ.'], label: 'Эдгээрээр хайна', chip: 'teal', tone: 'teal', result: 'Жинхэнэ утгаараа хайлт хийгддэг ухаалаг сан' })
}
{
  const s = content(SEC.why, ['2.2', '2-р шалтгаан', { of: 4, on: [2] }], 'Орос баримтыг монгол түлхүүр үгээр олдог болно', N.r2)
  const y = TOP, ch = 4.5, lw = 5.75
  glass(s, MX, y, lw, ch)
  iconTile(s, 'languages', 'blue', MX + 0.3, y + 0.3, 0.58, 'Хэл')
  heading(s, 'Хэлний саад', MX + 1.06, y + 0.3, 4.3)
  stack(s, [
    'Иж бүрэн зураг төслийг Зөвлөлтийн «Гипроцветмет» институт, барилга угсралтыг «Медьмолибденстрой» нэгтгэл удирдан гүйцэтгэсэн.',
    '1974–1990-ээд оны захиргааны болон техникийн дийлэнх суурь баримт орос хэлээр, тухайн үеийн стандартын товчилсон нэр томьёогоор бичигдсэн.',
    { text: 'Загвар орос баримтыг унших явцдаа нэр томьёог монгол хэл рүү давхар хөрвүүлж индексжүүлнэ.', bold: true },
  ], { x: MX + 0.3, y: y + 1.14, w: lw - 0.6, pt: 14, gap: 0.2 })

  const rx = MX + lw + 0.25, rw = W - MX - rx
  glass(s, rx, y, rw, ch)
  const c1 = rx + 0.3, w1 = 2.72, c2 = c1 + w1 + 0.52, w2 = rw - 0.6 - w1 - 0.52
  label(s, 'Орос эх баримтад', c1, y + 0.34, w1)
  label(s, 'Монгол индекст', c2, y + 0.34, w2)
  const PAIRS = [['Обогатительная фабрика', 'Баяжуулах фабрик'], ['Микрорайон', 'Бичил хороолол'], ['Хвостовое хозяйство', 'Хаягдлын аж ахуй'], ['ТЭО', 'ТЭЗҮ']]
  PAIRS.forEach(([ru, mn], i) => {
    const py = y + 0.76 + i * 0.72
    solid(s, c1, py, w1, 0.54, { r: 0.14, shadow: false, line: K.sep, name: 'Орос нэр томьёо' })
    txt(s, ru, { x: c1 + 0.18, y: py, w: w1 - 0.3, h: 0.54, pt: 13.5, valign: 'middle', wrap: false, lang: 'ru-RU' })
    icon(s, 'arrow-right', 'blue', c1 + w1 + 0.13, py + 0.14, 0.26, 'Сум')
    s.addShape(SH.roundRect, { x: c2, y: py, w: w2, h: 0.54, rectRadius: 0.14, fill: { color: HUE.blue.base, transparency: 86 }, line: { color: HUE.blue.base, width: 0.75, transparency: 55 }, objectName: 'Монгол нэр томьёо' })
    txt(s, mn, { x: c2 + 0.18, y: py, w: w2 - 0.3, h: 0.54, pt: 13.5, bold: true, valign: 'middle', wrap: false })
  })
  txt(s, 'Жишээ нэр томьёо. Залуу судлаач монгол түлхүүр үгээрээ орос эх баримтыг төвөггүй шүүж олно.', { x: c1, y: y + 3.74, w: rw - 0.6, h: 0.56, pt: 13, color: K.text2 })
}
{
  const s = content(SEC.why, ['2.3', '3-р шалтгаан', { of: 4, on: [3] }], 'Нэг баримт хэд хэдэн сэдэвт зэрэг хамаарна', N.r3)
  const y = TOP, ch = 4.3, lw = 4.95
  glass(s, MX, y, lw, ch)
  iconTile(s, 'tags', 'orange', MX + 0.3, y + 0.3, 0.58, 'Шошго')
  heading(s, '35 тонн сан, олон сэдэв', MX + 1.06, y + 0.3, 3.6)
  stack(s, [
    'Баримт үүссэн он, байгууллагын бүтцийн нэгжээрээ хадгаламжийн нэгжид ордог.',
    'Гэтэл нэг тушаал, нэг тайланд хэд хэдэн асуудал хамтдаа бичигдсэн байх нь элбэг.',
    { text: 'Загвар хуудас, заалт бүрийг уншаад нэг баримтад хэд хэдэн сэдвийн таг автоматаар онооно.', bold: true },
  ], { x: MX + 0.3, y: y + 1.14, w: lw - 0.6, pt: 14, gap: 0.2 })

  const bx = MX + lw + 0.25, bw = W - MX - bx
  glass(s, bx, y, bw, ch)
  pill(s, 'Хадгалалт: он, бүтцийн нэгжээр', bx + 0.4, y + 0.34, { tone: 'quiet' })
  pill(s, 'Хайлт: сэдвийн тагаар', bx + 3.72, y + 0.34, { tone: 'quiet' })
  const dx = bx + 0.72, dy = y + 1.02, dw = 2.0, dh = 2.6
  solid(s, dx, dy, dw, dh, { r: 0.12, name: 'Баримт' })
  s.addShape(SH.roundRect, { x: dx + 0.26, y: dy + 0.3, w: 1.05, h: 0.13, rectRadius: 0.06, fill: { color: 'D4D8E1' }, objectName: 'Мөр' })
  ;[1.48, 1.48, 1.2, 1.48, 1.34, 0.9, 1.48, 1.1].forEach((lw2, i) => s.addShape(SH.roundRect, { x: dx + 0.26, y: dy + 0.62 + i * 0.22, w: lw2, h: 0.08, rectRadius: 0.04, fill: { color: 'E6E9EF' }, objectName: 'Мөр' }))
  txt(s, 'Нэг тушаал эсвэл нэг тайлан', { x: dx - 0.4, y: dy + dh + 0.14, w: dw + 0.8, h: 0.26, pt: 12.5, color: K.text2, align: 'center' })
  const TAGS = [['Хот төлөвлөлт', 'teal'], ['Байгаль орчин', 'green'], ['Хөдөлмөр хамгаалал', 'orange'], ['Эдийн засаг', 'indigo']]
  const tx = bx + 3.72, ox = dx + dw + 0.06, oy = dy + dh / 2
  TAGS.forEach(([name, hue], i) => {
    const ty = y + 1.08 + i * 0.68, my = ty + 0.23
    const up = my < oy
    s.addShape(SH.line, { x: ox, y: Math.min(my, oy), w: tx - 0.06 - ox, h: Math.abs(my - oy), flipV: up, line: { color: HUE[hue].base, width: 1.5 }, objectName: 'Холбоос' })
    pill(s, name, tx, ty, { tone: 'plain', dot: hue, pt: 14, h: 0.46, pad: 0.2 })
  })
  sourceLine(s, 'Эх сурвалж: Архивын ерөнхий газрын сан хөмрөгийн мэдээлэл [6]')
}
{
  const s = content(SEC.why, ['2.4', '4-р шалтгаан', { of: 4, on: [4] }], 'Эх баримтыг эргүүлэх тусам элэгдэнэ', N.r4)
  const lane = (y, tag, tone, steps) => {
    const h = 2.24
    glass(s, MX, y, CW, h)
    pill(s, tag, MX + 0.3, y + 0.28, { tone, solid: true, bold: true, pt: 12.5, h: 0.38 })
    const sw = (CW - 0.6 - 2 * 0.56) / 3
    steps.forEach((st, i) => {
      const sx = MX + 0.3 + i * (sw + 0.56)
      iconTile(s, st.icon, st.hue, sx, y + 0.94, 0.58, st.alt)
      txt(s, st.text, { x: sx + 0.76, y: y + 0.9, w: sw - 0.86, h: 1.12, pt: 14, bold: st.bold })
      if (i < 2) icon(s, 'arrow-right', 'mute', sx + sw + 0.15, y + 1.1, 0.26, 'Сум')
    })
  }
  lane(TOP, 'Өнөөдөр', 'dark', [
    { icon: 'users', hue: 'mute', alt: 'Судлаач', text: 'Судлаач өөрт хэрэгтэй хэдхэн хуудас мэдээллийг хайна.' },
    { icon: 'files', hue: 'mute', alt: 'Олон хавтас', text: 'Олон арван хавтас эх баримт захиалж, гар аргаар эргүүлнэ.' },
    { icon: 'triangle-alert', hue: 'red', alt: 'Анхааруулга', text: 'Ажилтны ачаалал нэмэгдэж, 50 жилийн настай цаасан эх баримт элэгдэнэ.', bold: true },
  ])
  lane(TOP + 2.24 + 0.25, 'Ухаалаг сантай бол', 'teal', [
    { icon: 'search', hue: 'teal', alt: 'Хайлт', text: 'Судлаач эхлээд цахим сангаас хайна.' },
    { icon: 'map-pin', hue: 'teal', alt: 'Байршил', text: 'Яг аль хадгаламжийн нэгжийн хэддүгээр хуудсанд байгааг оновчтой тогтооно.' },
    { icon: 'shield-check', hue: 'green', alt: 'Хамгаалагдсан', text: 'Гараар эргүүлэх давтамж буурч, физик элэгдэл багасна.', bold: true },
  ])
}

// ---------- 8. Харьцуулалт ----------
{
  const s = content(SEC.why, ['2', 'Харьцуулалт'], 'Уламжлалт арга, ухаалаг сан хоёрын ялгаа', N.table)
  const y = TOP, h = 4.8
  glass(s, MX, y, CW, h)
  const colW = [2.45, 4.57, 4.57]
  const line = { type: 'solid', pt: 0.75, color: K.sep }, none = { type: 'none' }
  const head = (t, accent) => ({ text: t, options: { bold: true, fontSize: 13, color: accent ? K.accent : K.text2, border: [none, none, { type: 'solid', pt: 1.25, color: 'B9BDCB' }, none], valign: 'middle' } })
  const cell = (t, o = {}, last) => ({ text: t, options: { fontSize: 13.5, color: o.mute ? K.text2 : K.text, bold: !!o.bold, border: [none, none, last ? none : line, none], valign: 'middle' } })
  const ROWS = [
    ['Баримтын ангилал ба ялгалт', 'Ажилтан баримт бүрийг гараар уншиж, данс, товъёогт нэгбүрчлэн бүртгэдэг тул хугацаа их зарцуулна.', 'Төрөл, огноо, сэдэв, холбогдох салбарыг автоматаар тодорхойлж, зөв ангилалд хуваарилна.'],
    ['Бичвэр болон хүснэгт танилт', 'Бүдгэрсэн бичгийн машины дардас, хортой цаасны хуулбар, гар бичмэл, инженерийн зургийн штампыг энгийн программ таньдаггүй.', 'Бүдгэрсэн үгийн уншлагыг санал болгож, эргэлзээтэй хэсгийг [?]-ээр тэмдэглэнэ. Эцсийн бичвэрийг архивч баталгаажуулна. Хүснэгтийг бүтцээр нь задална.'],
    ['Орос-монгол хэлний хайлт', 'Орос баримтыг зөвхөн орос гарчиг эсвэл архивчийн гараар бичсэн товч тэмдэглэлээр л баримжаалан хайдаг.', 'Бүх агуулгыг орос-монгол хос индексээр бүртгэж, монгол асуултаар орос эх баримтыг шууд гаргаж ирнэ.'],
    ['Баримт хоорондын уялдаа', 'Удирдлагын тушаал, зураг төсөл, санхүүгийн гүйцэтгэл өөр өөр хавтсанд салангид хадгалагддаг.', 'Нэг объект, нэг тушаалын дугаарт хамаарах бүх баримтыг Мэдлэгийн графаар хооронд нь автоматаар холбож цэгцэлнэ.'],
  ]
  const table = [[head('Асуудлын хүрээ'), head('Уламжлалт гар ажиллагаа ба энгийн сканнер'), head('Хиймэл оюун ухаанаар ялгаж цэгцлэх сан', true)]]
  ROWS.forEach((r, i) => table.push([cell(r[0], { bold: true }, i === 3), cell(r[1], { mute: true }, i === 3), cell(r[2], {}, i === 3)]))
  const need = ROWS.map(r => Math.max(...r.map((t, c) => lineCount(t, 13.5, c === 0, (colW[c] - 0.32) * 0.985))))
  const free = h - 0.4 - 0.5 - need.reduce((a, n) => a + n * lineH(13.5, 1), 0)
  const rowH = [0.5, ...need.map(n => n * lineH(13.5, 1) + free / 4)]
  if (free < 0.6) issues.push(`table: only ${free.toFixed(2)} in left for the rows' margins`)
  // The right column carries the point of the slide: a soft tint behind it
  s.addShape(SH.roundRect, { x: MX + 0.25 + colW[0] + colW[1] + 0.02, y: y + 0.16, w: colW[2] - 0.04, h: h - 0.32, rectRadius: 0.16, fill: { color: K.accent, transparency: 93 }, objectName: 'Тодруулга' })
  s.addTable(table, { x: MX + 0.25, y: y + 0.2, w: CW - 0.5, colW, rowH, margin: [0.06, 0.16, 0.06, 0.16], lang: 'mn-MN', objectName: 'Харьцуулсан хүснэгт' })
}

// ---------- 9–11. Дөрвөн шат ----------
pres.addSection({ title: SEC.model })
const STAGES = [
  { hue: 'teal', icon: 'scan-text', name: 'Файл хүлээн авах ба харааны танилт', short: 'Сканнердсан зураг, PDF, зураг төслийн файлыг багцаар авч, цэвэрлээд уншина.' },
  { hue: 'blue', icon: 'folder-tree', name: 'Автомат ангилал ба сэдэвчилсэн багцлалт', short: 'Баримтын хэлбэр, судалгааны салбар чиглэлээр хоёр түвшинд ангилна.' },
  { hue: 'indigo', icon: 'waypoints', name: 'Мета-өгөгдөл ялгалт ба Мэдлэгийн граф', short: 'Огноо, дугаар, байгууллага, объект, үзүүлэлтийг сугалж, баримтуудыг холбоно.' },
  { hue: 'orange', icon: 'search', name: 'Ухаалаг хайлт ба судалгааны лавлагаа', short: 'Түлхүүр үг, огноо, салбар эсвэл энгийн монгол асуултаар хайна.' },
]
{
  const s = content(SEC.model, ['3', 'Загварын бүтэц'], 'Баримтыг дөрвөн шатаар боловсруулна', N.pipeline)
  glass(s, MX, TOP, CW, 0.62, { r: 0.2 })
  icon(s, 'bookmark', 'copper', MX + 0.26, TOP + 0.18, 0.26, 'Эрхэм зорилго')
  txt(s, [{ text: 'Төрөлжсөн архивын эрхэм зорилго: ', options: { bold: true } }, { text: 'үйлдвэрийн түүхийг нандигнан хадгалж, ирээдүй хойч үедээ өвлүүлэн үлдээх [4]' }], { x: MX + 0.66, y: TOP, w: CW - 0.9, h: 0.62, pt: 13.5, valign: 'middle', name: 'Эрхэм зорилго' })
  const y = TOP + 0.84, cw = 2.79, gap = 0.31, ch = 3.06
  STAGES.forEach((st, i) => {
    const x = MX + i * (cw + gap)
    glass(s, x, y, cw, ch)
    badge(s, i + 1, st.hue, x + 0.26, y + 0.28)
    txt(s, `${i + 1}-р шат`, { x: x + 0.74, y: y + 0.28, w: 1.2, h: 0.36, pt: 12.5, bold: true, color: K.text2, valign: 'middle' })
    iconTile(s, st.icon, st.hue, x + cw - 0.84, y + 0.2, 0.58, st.name)
    txt(s, st.name, { x: x + 0.26, y: y + 0.96, w: cw - 0.52, h: 0.86, pt: 16, bold: true })
    txt(s, st.short, { x: x + 0.26, y: y + 1.88, w: cw - 0.48, h: 1.02, pt: 13, color: K.text2 })
    if (i < 3) arrowDot(s, x + cw + gap / 2, y + ch / 2, { d: 0.36 })
  })
  const by = y + ch + 0.2
  glass(s, MX, by, CW, 0.7, { r: 0.22 })
  const IN = 'цаасан баримт, сканнердсан зураг, PDF файл', OUT_ = 'уншигдах, хайгдах, ангилагдах ухаалаг сан'
  let x = MX + 0.24
  x += pill(s, 'Оролт', x, by + 0.17, { tone: 'quiet', bold: true }) + 0.16
  txt(s, IN, { x, y: by, w: tw(IN, 13.5, false) + 0.05, h: 0.7, pt: 13.5, valign: 'middle', wrap: false })
  x += tw(IN, 13.5, false) + 0.3
  arrowLine(s, x, by + 0.35, x + 0.5)
  x += 0.74
  x += pill(s, 'Гаралт', x, by + 0.17, { tone: 'accent', bold: true }) + 0.16
  txt(s, OUT_, { x, y: by, w: tw(OUT_, 13.5, true) + 0.05, h: 0.7, pt: 13.5, bold: true, valign: 'middle', wrap: false })
  if (x + tw(OUT_, 13.5, true) > MX + CW - 0.2) issues.push('slide 9: the input and output line is too long')
}
{
  const s = content(SEC.model, ['3', '1, 2-р шат', { of: 4, on: [1, 2] }], '1–2-р шат: уншиж таниад, ангилна', N.s12)
  // 1-р шат: three steps in a row, then the parts it tells apart
  const y = TOP, h1 = 2.04
  glass(s, MX, y, CW, h1)
  badge(s, 1, 'teal', MX + 0.3, y + 0.27)
  heading(s, STAGES[0].name, MX + 0.82, y + 0.16, 6, { pt: 16 })
  const STEPS = [['files', 'Сканнердсан зураг, PDF файл, зураг төслийг багцаар оруулна.'], ['sparkles', 'Хазайлтыг тэгшилж, толбо, бүдгэрэлтийг арилгана.'], ['scan-text', 'Текстийг уншиж, хэсгүүдийг тус тусад нь ялган таньдаг:']]
  const sw = (CW - 0.6 - 2 * 0.5) / 3
  STEPS.forEach(([ic, text], i) => {
    const sx = MX + 0.3 + i * (sw + 0.5)
    icon(s, ic, 'teal', sx, y + 0.89, 0.26, 'Алхам')
    txt(s, text, { x: sx + 0.4, y: y + 0.84, w: sw - 0.44, h: 0.52, pt: 13.5 })
    if (i < 2) icon(s, 'arrow-right', 'mute', sx + sw + 0.12, y + 0.94, 0.24, 'Сум')
  })
  chips(s, ['толгой хэсэг', 'тушаалын дугаар', 'үндсэн заалтууд', 'тоон хүснэгт', 'булангийн штамп', 'гарын үсэг', 'тамга тэмдэг'], { x: MX + 0.3, y: y + 1.5, w: CW - 0.6, tone: 'teal', pt: 12, h: 0.34, gap: 0.09 })

  // 2-р шат: two levels of classes, side by side
  const y2 = y + h1 + 0.2, h2 = 2.58
  glass(s, MX, y2, CW, h2)
  badge(s, 2, 'blue', MX + 0.3, y2 + 0.27)
  heading(s, STAGES[1].name, MX + 0.82, y2 + 0.16, 5, { pt: 16 })
  icon(s, 'shield-check', 'blue', MX + 6.0, y2 + 0.3, 0.26, 'Хэвээр үлдэнэ')
  txt(s, 'Сан хөмрөг, данс, хадгаламжийн нэгж хэвээр үлдэнэ. Ангилал нь түүн дээр нэмэгдэх сэдэвчилсэн хайлтын индекс.', { x: MX + 6.38, y: y2 + 0.2, w: CW - 6.68, h: 0.48, pt: 12, color: K.text2 })
  const aw = 4.99, bx = MX + 0.3 + aw + 0.35, bw = CW - 0.6 - aw - 0.35
  label(s, 'Баримтын хэлбэрээр', MX + 0.3, y2 + 0.92, aw)
  chips(s, ['Тушаал', 'Протокол', 'ТЭЗҮ', 'Барилгын ажлын зураг', 'Акт', 'Статистик тайлан', 'Албан бичиг'], { x: MX + 0.3, y: y2 + 1.22, w: aw, pt: 12, h: 0.34, gap: 0.09 })
  label(s, 'Судалгааны салбар чиглэлээр', bx, y2 + 0.92, bw)
  const end = chips(s, ['Хот, нийтийн аж ахуй', 'Байгаль орчин', 'Хүнс ба хөдөө аж ахуй', 'Эрүүл мэнд', 'Боловсрол', 'Нийгэм', 'Эдийн засаг', 'Хот төлөвлөлт ба дэд бүтэц', 'Үйлдвэрлэл технологи'], { x: bx, y: y2 + 1.22, w: bw, tone: 'blue', pt: 12, h: 0.34, gap: 0.09 })
  if (end > y2 + h2 - 0.14) issues.push('slide 10: the chips run out of the second card')
}
{
  const s = content(SEC.model, ['3', '3, 4-р шат', { of: 4, on: [3, 4] }], '3–4-р шат: баримтыг холбож, хайлтад бэлдэнэ', N.s34)
  const y = TOP, ch = 4.8, lw = 6.9
  glass(s, MX, y, lw, ch)
  badge(s, 3, 'indigo', MX + 0.3, y + 0.32)
  heading(s, STAGES[2].name, MX + 0.82, y + 0.21, lw - 1.1, { pt: 16 })
  label(s, 'Сугалж авах түлхүүр мэдээлэл', MX + 0.3, y + 1.0, 3.3)
  rows(s, [
    { icon: 'calendar', text: 'Он, сар, өдөр, дугаар' },
    { icon: 'building-2', text: 'Гаргасан байгууллага, гарын үсэг зурсан албан тушаалтан' },
    { icon: 'map-pin', text: 'Газар зүйн болон үйлдвэрлэлийн объект' },
    { icon: 'ruler', text: 'Гол тоон үзүүлэлт, инженерийн норматив' },
  ], { x: MX + 0.3, y: y + 1.4, w: 3.2, pt: 13.5, hue: 'indigo', gap: 0.2 })
  // the knowledge graph: one object in the middle, the papers that mention it around
  const gx = MX + 5.16, gy = y + 2.36
  const NODES = [['Тушаал', -1.28, -1.1], ['Зураг төсөл', 0.2, -1.22], ['Акт', -1.02, 1.0], ['Тайлан', 0.5, 0.92]]
  NODES.forEach(([name, dx, dy]) => {
    const nw = tw(name, 12.5, false) * 1.03 + 0.32
    const ax = gx + dx + nw / 2, ay = gy + dy + 0.18
    s.addShape(SH.line, { x: Math.min(ax, gx), y: Math.min(ay, gy), w: Math.abs(ax - gx), h: Math.abs(ay - gy), flipV: (ax < gx) !== (ay < gy), line: { color: HUE.indigo.base, width: 1.25 }, objectName: 'Холбоос' })
  })
  NODES.forEach(([name, dx, dy]) => pill(s, name, gx + dx, gy + dy, { tone: 'plain' }))
  const cwid = tw('Баяжуулах фабрик', 13, true) * 1.03 + 0.4
  pill(s, 'Баяжуулах фабрик', gx - cwid / 2, gy - 0.22, { tone: 'indigo', solid: true, bold: true, pt: 13, h: 0.44, w: cwid })
  txt(s, 'Нэг объект, нэг шийдвэрт хамаарах өөр өөр оны баримт нэг сүлжээнд холбогдоно.', { x: MX + 3.72, y: y + 3.84, w: lw - 4.0, h: 0.74, pt: 12.5, color: K.text2 })

  const rx = MX + lw + 0.25, rw = W - MX - rx
  glass(s, rx, y, rw, ch)
  badge(s, 4, 'orange', rx + 0.3, y + 0.32)
  heading(s, STAGES[3].name, rx + 0.82, y + 0.21, rw - 1.1, { pt: 16 })
  solid(s, rx + 0.3, y + 1.06, rw - 0.6, 0.52, { r: 0.26, name: 'Хайлтын талбар' })
  icon(s, 'search', 'mute', rx + 0.46, y + 1.19, 0.26, 'Хайлт')
  txt(s, 'Түлхүүр үг, огноо, салбар, асуулт', { x: rx + 0.84, y: y + 1.06, w: rw - 1.3, h: 0.52, pt: 13, color: K.text3, valign: 'middle', wrap: false })
  label(s, 'Хариунд баримтын байршлыг заана', rx + 0.3, y + 1.84, rw - 0.6)
  solid(s, rx + 0.3, y + 2.14, rw - 0.6, 1.56, { r: 0.16, shadow: false, line: K.sep, name: 'Байршил' })
  ;['Сан хөмрөг', 'Данс', 'Хадгаламжийн нэгж', 'Хуудас'].forEach((name, i) => {
    const ly = y + 2.26 + i * 0.335, lx = rx + 0.46 + i * 0.32
    icon(s, i === 0 ? 'library' : 'corner-down-right', 'orange', lx, ly + 0.04, 0.24, 'Түвшин')
    txt(s, name, { x: lx + 0.34, y: ly, w: 2.4, h: 0.32, pt: 13, bold: true, valign: 'middle', wrap: false })
  })
  label(s, 'Хамт гаргаж өгнө', rx + 0.3, y + 3.88, rw - 0.6)
  chips(s, ['Монгол орчуулга', 'Товч хураангуй'], { x: rx + 0.3, y: y + 4.18, w: rw - 0.6, tone: 'orange' })
}

// ---------- 12. Өгөгдлийн бүтэц ----------
pres.addSection({ title: SEC.pilot })
{
  const s = content(SEC.pilot, ['4.1', 'Туршилтын загвар'], 'Хуудас бүр нэг стандарт бүтцээр бичигдэнэ', N.schema)
  txt(s, [{ text: 'Erdenet-Archive-AI-Parser v0.1', options: { bold: true } }, { text: ' прототип сканнердсан хуудсыг уншаад стандарт JSON бүтцээр ангилж цэгцэлнэ.' }], { x: MX, y: TOP - 0.08, w: CW, h: 0.3, pt: 14, name: 'Тайлбар' })
  let px = MX
  ;['Олон хэлбэрт OCR', 'Мэргэжлийн орчуулга', 'Автомат ангилал ба таг', 'Каталогийн индекс'].forEach((name, i) => {
    px += pill(s, name, px, TOP + 0.36, { tone: i === 3 ? 'accent' : 'plain', bold: true, pt: 12.5, h: 0.38 })
    if (i < 3) { icon(s, 'arrow-right', 'mute', px + 0.1, TOP + 0.43, 0.24, 'Сум'); px += 0.44 }
  })
  const FIELDS = [
    ['map-pin', 'teal', 'Архив дахь байршил', 'archive_location', 'Сан хөмрөг, данс, хадгаламжийн нэгж, хуудасны дугаар'],
    ['tags', 'blue', 'Автомат ангилал', 'auto_classification', 'Баримтын төрөл, судалгааны чиглэл, түлхүүр үгс'],
    ['file-text', 'indigo', 'Баримтын мэдээлэл', 'document_metadata', 'Огноо, дугаар, эх хэл, байгууллага, гарын үсэг зурсан хүн'],
    ['languages', 'purple', 'Эх бичвэр ба орчуулга', 'transcription', 'Машинаар уншсан эх бичвэр, эргэлзээтэй хэсэг [?], монгол орчуулга'],
    ['ruler', 'orange', 'Объект ба үзүүлэлт', 'extracted_entities_and_metrics', 'Нэр, тоон утга ба нэгж, холбогдох хороолол, цех, байршил'],
    ['book-open', 'green', 'Товч агуулга', 'catalog_summary', 'Каталогийн бүртгэлд орох баримтын товч агуулга'],
    ['badge-check', 'pink', 'Баталгаажуулалт', 'verification', 'Машин уншсан, хянасан, баталгаажсан; эргэлзээтэй хэсгүүд'],
    ['lock', 'mute', 'Хандалтын түвшин', 'access_level', 'Нээлттэй эсвэл хязгаарлалттай'],
  ]
  const gy = TOP + 0.94, gap = 0.2, cw = (CW - 3 * gap) / 4, ch = 1.9
  FIELDS.forEach(([ic, hue, name, key, text], i) => {
    const x = MX + (i % 4) * (cw + gap), y = gy + Math.floor(i / 4) * (ch + gap)
    glass(s, x, y, cw, ch, { r: 0.2 })
    iconTile(s, ic, hue, x + 0.2, y + 0.2, 0.46, name)
    txt(s, name, { x: x + 0.78, y: y + 0.18, w: cw - 0.94, h: 0.5, pt: 13.5, bold: true, valign: 'middle' })
    txt(s, text, { x: x + 0.2, y: y + 0.8, w: cw - 0.38, h: 0.7, pt: 12.5, color: K.text2 })
    txt(s, key, { x: x + 0.2, y: y + ch - 0.34, w: cw - 0.3, h: 0.22, pt: 10.5, color: K.text3, wrap: false, lang: 'en-US', name: 'JSON түлхүүр' })
  })
}

// ---------- 13–14. Жишээ: нэг баримт ----------
const PART = {
  header: ['Толгой хэсэг', 'teal'], type_number_date: ['Төрөл, огноо, дугаар', 'blue'], title: ['Гарчиг', 'indigo'], clauses: ['Үндэслэл ба заалтууд', 'purple'],
  table: ['Тоон хүснэгт', 'orange'], signature: ['Гарын үсэг', 'green'], stamp: ['Тамга тэмдэг', 'pink'], other_mark: ['Бусад тэмдэглэгээ', 'red'],
}
// What the model read in each part, cut to one line; its full wording is in assets/reading.json
const SAID = {
  header: 'Байгууллагын нэр: «Горно-обогатительный комбинат»',
  type_number_date: 'Тушаал, 1981 оны 5 дугаар сарын 12, № 214, Эрдэнэт хот',
  title: '3-р бичил хороололд 140 ортой хүүхдийн цэцэрлэг ашиглалтад оруулах тухай',
  clauses: 'Үндэслэл ба 3 заалт. Хугацаа бүдэг: 25 мая [?]',
  table: '3 багана: хүүхдийн цэцэрлэг, 140 ор, 01.06.1981',
  signature: 'Ерөнхий захирал, хөх бэхээр зурсан гарын үсэг, И. Иванов',
  stamp: 'Дугуй тамга, голд нь «Общий отдел»',
  other_mark: 'Улаан хүрээтэй дардас: «Образец» буюу загвар',
}
const SAMPLE_NOTE = 'Зохиомол жишээ хуудас, архивын бодит баримт биш.'
// The sample page's two punch holes, as fractions of its width and height (specimen.html)
const HOLES = [[33.5 / 1040, 259.5 / 800], [33.5 / 1040, 539.5 / 800]]
{
  const notes = 'Энэ бол жишээ болгон зохиосон хуудас, архивын бодит баримт биш. Хиймэл оюун ухааны харааны загвар хуудсыг бодитоор уншиж, хэсэг хэсгээр нь ялган таньсан: толгой хэсэг, төрөл, огноо, дугаар, гарчиг, заалтууд, тоон хүснэгт, гарын үсэг, тамга. Зураг дээрх хүрээнүүд нь загварын өөрийнх нь заасан байрлал. Нугалаасан дээр бүдгэрсэн «25 мая» гэсэн огноог загвар таамаглаж нөхөөгүй, [?] гэж тэмдэглэсэн. Архивын жинхэнэ сканнердсан хуудсаар солих бол зургийг сонгоод Change Picture командыг ашиглаж, хүрээ болон баруун талын бичвэрийг шинэ уншилтаар солино.'
  const s = content(SEC.pilot, ['4.2', 'Жишээ баримт'], 'Жишээ: нэг баримтыг хэрхэн таньдаг вэ', notes)
  const ix = MX, iy = TOP, iw = 5.7, ih = (iw * 800) / 1040
  s.addImage({ path: A('specimen.jpg'), x: ix, y: iy, w: iw, h: ih, altText: 'Жишээ баримт: орос хэлээр бичгийн машинаар бичсэн тушаал. Зохиомол хуудас.', objectName: 'Жишээ баримт', shadow: { type: 'outer', color: '101E5A', blur: 22, offset: 8, angle: 90, opacity: 0.22 } })
  READ.regions.forEach((r, i) => {
    const [y0, x0, y1, x1] = r.box_2d.map(v => v / 1000)
    const hue = PART[r.part][1], pad = 0.035
    const bx = ix + x0 * iw - pad, by = iy + y0 * ih - pad, bw = (x1 - x0) * iw + 2 * pad, bh = (y1 - y0) * ih + 2 * pad
    s.addShape(SH.roundRect, { x: bx, y: by, w: bw, h: bh, rectRadius: 0.05, fill: { color: HUE[hue].base, transparency: 91 }, line: { color: HUE[hue].solid, width: 1.5 }, objectName: `Хүрээ ${i + 1}: ${PART[r.part][0]}` })
    // The number sits left of the frame's top corner, clear of the words and of the page's two punch holes;
    // for the two parts that lie over others, on the right corner
    const right = r.part === 'stamp' || r.part === 'other_mark'
    let cx = right ? bx + bw : bx - 0.12, cy = by - 0.03
    for (const [hx, hy] of HOLES) {
      const dx = cx - (ix + hx * iw), dy = cy - (iy + hy * ih), need = Math.sqrt(Math.max(0, 0.24 * 0.24 - dx * dx))
      if (!right && Math.abs(dy) < need) cy = iy + hy * ih + (dy < 0 ? -need : need)
    }
    badge(s, i + 1, hue, cx - 0.13, cy - 0.13, 0.26, 10)
  })
  const mark = (x, y) => s.addText('?', { shape: SH.ellipse, x, y, w: 0.24, h: 0.24, fill: { color: K.amber }, line: { color: K.white, width: 1 }, fontSize: 11, bold: true, color: K.text, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: 'Эргэлзээтэй хэсэг' })
  mark(ix + FAINT[2] * iw + 0.04, iy + ((FAINT[1] + FAINT[3]) / 2) * ih - 0.12)
  const cy = iy + ih + 0.12
  mark(ix, cy + 0.01)
  txt(s, [{ text: 'Бүдгэрсэн «25 мая»: ', options: { bold: true } }, { text: 'таамаглаж нөхөөгүй, [?] гэж тэмдэглэсэн.' }], { x: ix + 0.34, y: cy, w: iw - 0.34, h: 0.26, pt: 11.5, valign: 'middle', wrap: false, name: 'Эргэлзээтэй хэсэг' })
  txt(s, SAMPLE_NOTE, { x: ix, y: cy + 0.3, w: iw, h: 0.24, pt: 11.5, color: K.text3, name: 'Тайлбар' })

  const rx = ix + iw + 0.26, rw = W - MX - rx, rh = ih + 0.64
  glass(s, rx, iy, rw, rh)
  let y = iy + 0.2
  READ.regions.forEach((r, i) => {
    const [name, hue] = PART[r.part]
    badge(s, i + 1, hue, rx + 0.26, y + 0.01, 0.28, 10.5)
    txt(s, name, { x: rx + 0.7, y, w: rw - 0.96, h: 0.26, pt: 13, bold: true, wrap: false })
    const h = textH(SAID[r.part], 12, false, rw - 0.96)
    txt(s, SAID[r.part], { x: rx + 0.7, y: y + 0.26, w: rw - 0.96, h: h + 0.02, pt: 12, color: K.text2 })
    y += 0.26 + h + 0.085
  })
  if (y - 0.085 > iy + rh - 0.14) issues.push(`slide 13: the list ends at ${(y - 0.085).toFixed(2)}, the card at ${(iy + rh).toFixed(2)}`)
}
{
  const notes = 'Уншсан бичвэрээс загвар баримтын төрөл, судалгааны чиглэл, түлхүүр үг, огноо, дугаар, байгууллага, объект, тоон үзүүлэлтийг ялгаж, монгол орчуулга ба каталогийн товч агуулгыг гаргасан. Нэг тушаал хэд хэдэн чиглэлд зэрэг хамаарч байгааг анзаарна уу: боловсрол, хот төлөвлөлт, нийтийн аж ахуй, нийгэм. Эргэлзээтэй [?] хэсгийг архивч эх баримттай тулгаж баталгаажуулна. Энэ бол зохиомол жишээ хуудсан дээрх бодит уншилт бөгөөд туршилтын үр дүн биш. Туршилтын хэмжүүрийг туршилтын дараа танилцуулна.'
  const s = content(SEC.pilot, ['4.2', 'Жишээ баримт'], 'Жишээ: уншсаны дараа юу гардаг вэ', notes)
  const y = TOP, ch = 4.8, lw = 6.5, rx = MX + lw + 0.22, rw = W - MX - rx
  const cls = READ.auto_classification, meta = READ.document_metadata
  const fields = cls.secondary_tags.filter(t => /^[А-ЯӨҮЁ]/.test(t)), words = cls.secondary_tags.filter(t => !/^[А-ЯӨҮЁ]/.test(t))

  // left: the clause with the faded date, as the model read it and as it translated it
  glass(s, MX, y, lw, ch)
  iconTile(s, 'languages', 'purple', MX + 0.26, y + 0.24, 0.5, 'Орчуулга')
  heading(s, 'Эх бичвэр ба орчуулга', MX + 0.92, y + 0.2, lw - 1.2, { pt: 16 })
  const tr = READ.transcription
  const src = tr.original_text.split('\n'), at = src.findIndex(l => l.startsWith('2. '))
  const ru = `${src[at]} ${src[at + 1]}`.replace('мая[?]', 'мая [?]')
  const mn = tr.mongolian_translation.split('\n').find(l => l.startsWith('2. ')).replace('25-ны[?]', '25-ны [?]')
  const marked = text => text.split('[?]').flatMap((part, i, all) => [{ text: part, options: {} }, ...(i < all.length - 1 ? [{ text: '[?]', options: { bold: true, color: K.accent } }] : [])])
  const tw3 = lw - 0.52, inner = tw3 - 0.4
  label(s, 'Машинаар уншсан эх бичвэр, орос хэлээр', MX + 0.26, y + 0.9, tw3)
  const ruH = textH(ru, 13.5, false, inner * 0.98) + 0.3
  solid(s, MX + 0.26, y + 1.18, tw3, ruH, { r: 0.14, shadow: false, line: K.sep, name: 'Эх бичвэр' })
  txt(s, marked(ru), { x: MX + 0.46, y: y + 1.33, w: inner, h: ruH - 0.28, pt: 13.5, lang: 'ru-RU', name: 'Эх бичвэр' })
  const my = y + 1.18 + ruH + 0.17
  label(s, 'Монгол орчуулга', MX + 0.26, my, tw3)
  const mnH = textH(mn, 13.5, false, inner * 0.98) + 0.3
  s.addShape(SH.roundRect, { x: MX + 0.26, y: my + 0.28, w: tw3, h: mnH, rectRadius: 0.14, fill: { color: HUE.purple.base, transparency: 89 }, line: { color: HUE.purple.base, width: 0.75, transparency: 55 }, objectName: 'Орчуулга' })
  txt(s, marked(mn), { x: MX + 0.46, y: my + 0.43, w: inner, h: mnH - 0.28, pt: 13.5, name: 'Орчуулга' })
  const fy0 = my + 0.28 + mnH + 0.18
  const META = [['Огноо', meta.date], ['Дугаар', meta.document_number], ['Эх хэл', { ru: 'орос', mn: 'монгол', mixed: 'холимог' }[meta.original_language]], ['Төлөв', READ.verification.status], ['Хандалт', READ.access_level]]
  let mx = MX + 0.26
  META.forEach(([k, v]) => {
    const mw = Math.max(tw(v, 13, true), tw(k, 11, false)) + 0.06
    txt(s, k, { x: mx, y: fy0, w: mw, h: 0.22, pt: 11, color: K.text3, wrap: false, name: 'Талбар' })
    txt(s, v, { x: mx, y: fy0 + 0.22, w: mw, h: 0.26, pt: 13, bold: true, wrap: false, name: 'Утга' })
    mx += mw + 0.3
  })
  if (mx - 0.3 > MX + lw - 0.2) issues.push('slide 14: the fields under the translation are wider than the card')
  if (fy0 + 0.48 > y + ch - 0.14) issues.push(`slide 14: the left card's fields end at ${(fy0 + 0.48).toFixed(2)}, the card at ${(y + ch).toFixed(2)}`)

  // right: how the page was classified
  glass(s, rx, y, rw, ch)
  iconTile(s, 'tags', 'blue', rx + 0.26, y + 0.24, 0.5, 'Ангилал')
  heading(s, 'Ангилал', rx + 0.92, y + 0.2, 2.4, { pt: 16 })
  label(s, 'Баримтын төрөл', rx + 0.26, y + 0.9, 1.9)
  pill(s, cls.document_type, rx + 0.26, y + 1.18, { tone: 'teal', solid: true, bold: true })
  label(s, 'Үндсэн чиглэл', rx + 2.5, y + 0.9, 1.9)
  pill(s, cls.primary_research_domain, rx + 2.5, y + 1.18, { tone: 'blue', solid: true, bold: true })
  label(s, 'Давхар хамаарах чиглэл', rx + 0.26, y + 1.72, rw - 0.52)
  const fy = chips(s, fields, { x: rx + 0.26, y: y + 2.0, w: rw - 0.52, tone: 'blue', pt: 12, h: 0.34, gap: 0.09 })
  label(s, 'Түлхүүр үг', rx + 0.26, fy + 0.2, rw - 0.52)
  const ky = chips(s, words, { x: rx + 0.26, y: fy + 0.48, w: rw - 0.52, tone: 'quiet', pt: 12, h: 0.34, gap: 0.09 })
  const ent = READ.extracted_entities_and_metrics[0]
  txt(s, 'Объект ба тоон үзүүлэлт', { x: rx + 0.26, y: ky + 0.18, w: rw - 0.52, h: 0.22, pt: 11, color: K.text3, wrap: false, name: 'Талбар' })
  txt(s, `${ent.entity_or_metric.replace(/\s*\(.*\)/, '')}, ${ent.value}, ${ent.related_unit}`, { x: rx + 0.26, y: ky + 0.4, w: rw - 0.52, h: 0.26, pt: 13, bold: true, wrap: false, name: 'Утга' })
  if (ky + 0.66 > y + ch - 0.14) issues.push(`slide 14: the right card's last line ends at ${(ky + 0.68).toFixed(2)}, the card at ${(y + ch).toFixed(2)}`)
  sourceLine(s, 'Архивч [?] тэмдэгтэй хэсгийг эх баримттай тулгаж баталгаажуулна. Зохиомол жишээ хуудсан дээрх бодит уншилт, туршилтын үр дүн биш.')
}

// ---------- 15. Судлаачдад ----------
{
  const s = content(SEC.pilot, ['4.3', 'Судлаачдад'], 'Салбар бүрийн судлаачдад нээгдэх боломж', N.fields)
  const gap = 0.2, cw = (CW - gap) / 2, ch = 2.35
  const CARDS = [
    ['map', 'teal', 'Хот төлөвлөлт, дэд бүтэц,\nхот, нийтийн аж ахуй', 'Бичил хорооллын ерөнхий төлөвлөгөө, дулаан, цэвэр бохир ус, цахилгааны шугам сүлжээний зураг төсөл, ашиглалтад хүлээн авсан акт', 'Барилга, шугам сүлжээний анхны зураг, өөрчлөлтийн түүхийг нэг дор багцлан судална.'],
    ['leaf', 'green', 'Байгаль орчин, эрүүл мэнд,\nхүнс, хөдөө аж ахуй', 'Хаягдлын аж ахуй, ногоон бүс, ус, хөрс, агаарын хэмжилтийн тайлан, уурхайчдын эрүүл мэнд, сувилал, хүнсний хангамж', 'Олон арван жилийн хүснэгтэн мэдээллийг нэгтгэж, олон жилийн динамик судалгаа хийнэ.'],
    ['users', 'indigo', 'Нийгэм, боловсрол, соёл', 'Анхны илгээлтийн эзэд, мэргэжилтнүүдийн бүртгэл, орон сууцны хуваарилалт, сургууль, цэцэрлэг, соёлын ордны түүхэн баримт', 'Орос хэлний бэрхшээлгүйгээр анхдагч баримтыг сэдэв тус бүрээр түүвэрлэнэ.'],
    ['factory', 'orange', 'Үйлдвэрлэл ба эдийн засаг', 'Техник эдийн засгийн үндэслэл, хүчин чадлын өргөтгөл, бүтээгдэхүүн үйлдвэрлэл, хөдөлмөрийн бүтээмж, санхүүгийн тайлан тэнцэл', '50 жилийн техник-эдийн засгийн үзүүлэлтийг он дарааллаар шүүж, харьцуулсан шинжилгээ хийнэ.'],
  ]
  CARDS.forEach(([ic, hue, name, what, gain], i) => {
    const x = MX + (i % 2) * (cw + gap), y = TOP + Math.floor(i / 2) * (ch + gap)
    glass(s, x, y, cw, ch)
    iconTile(s, ic, hue, x + 0.28, y + 0.22, 0.56, name.replace('\n', ' '))
    txt(s, name, { x: x + 1.02, y: y + 0.22, w: cw - 1.3, h: 0.56, pt: 15, bold: true, valign: 'middle' })
    const h = textH(what, 12.5, false, cw - 0.56)
    txt(s, what, { x: x + 0.28, y: y + 0.92, w: cw - 0.56, h: h + 0.02, pt: 12.5, color: K.text2 })
    icon(s, 'corner-down-right', hue, x + 0.28, y + 0.92 + h + 0.13, 0.24, 'Үр дүн')
    txt(s, gain, { x: x + 0.62, y: y + 0.92 + h + 0.1, w: cw - 0.9, h: 0.52, pt: 13, bold: true })
    if (y + 0.92 + h + 0.1 + 0.5 > y + ch - 0.12) issues.push(`slide 15: "${name}" runs out of its card`)
  })
}

// ---------- 16–18. Үр ашиг, аюулгүй байдал, замын зураглал ----------
pres.addSection({ title: SEC.gain })
{
  const s = content(SEC.gain, ['5.1', 'Үр өгөөж'], 'Архивын ажилд гарах шууд үр өгөөж', N.results)
  const gap = 0.24, cw = (CW - gap) / 2, ch = 4.24, y = TOP
  glass(s, MX, y, cw, ch)
  iconTile(s, 'timer', 'teal', MX + 0.32, y + 0.32, 0.66, 'Хурд')
  heading(s, 'Хайлт ба түүвэрлэлтийн хурд', MX + 1.18, y + 0.32, cw - 1.5, { pt: 18, h: 0.66 })
  txt(s, 'Олон зуун хуудас баримтаас тодорхой сэдэвт хамаарах файл, тоон үзүүлэлтийг ялгаж олох хугацааг бууруулна.', { x: MX + 0.32, y: y + 1.28, w: cw - 0.64, h: 0.82, pt: 14.5 })
  solid(s, MX + 0.32, y + 2.5, cw - 0.64, 1.44, { r: 0.18, shadow: false, line: K.sep, name: 'Туршилт' })
  icon(s, 'flask-conical', 'teal', MX + 0.54, y + 2.72, 0.3, 'Туршилт')
  txt(s, 'Хэмнэлтийн хэмжээг туршилтаар тогтооно', { x: MX + 1.0, y: y + 2.7, w: cw - 1.6, h: 0.3, pt: 13.5, bold: true })
  txt(s, 'Нэг сэдвийн баримтыг гараар ба системээр хайх хугацааг харьцуулна.', { x: MX + 1.0, y: y + 3.04, w: cw - 1.6, h: 0.56, pt: 13, color: K.text2 })

  const bx = MX + cw + gap
  glass(s, bx, y, cw, ch)
  iconTile(s, 'list-checks', 'orange', bx + 0.32, y + 0.32, 0.66, 'Автоматжуулалт')
  heading(s, 'Бүртгэл ба товъёогийн автоматжуулалт', bx + 1.18, y + 0.32, cw - 1.5, { pt: 18, h: 0.66 })
  txt(s, 'Баримтын товъёог, нэр төрлийн ангилал, мета-өгөгдөл шивэх гар ажлыг автоматжуулна [5].', { x: bx + 0.32, y: y + 1.28, w: cw - 0.64, h: 0.82, pt: 14.5 })
  solid(s, bx + 0.32, y + 2.5, cw - 0.64, 1.44, { r: 0.18, shadow: false, line: K.sep, name: 'Үүргийн өөрчлөлт' })
  txt(s, 'Сан хөмрөгийн эрхлэгч, архивчийн үүрэг', { x: bx + 0.54, y: y + 2.7, w: cw - 1.1, h: 0.3, pt: 13.5, bold: true })
  const pw = pill(s, 'Гараар шивэх', bx + 0.54, y + 3.2, { tone: 'quiet', pt: 13, h: 0.42 })
  arrowLine(s, bx + 0.54 + pw + 0.16, y + 3.41, bx + 0.54 + pw + 0.72)
  pill(s, 'Хянан баталгаажуулах', bx + 0.54 + pw + 0.88, y + 3.2, { tone: 'orange', solid: true, bold: true, pt: 13, h: 0.42 })
}
{
  const s = content(SEC.gain, ['5.2', 'Аюулгүй байдал'], 'Мэдээллийн аюулгүй байдлын хосолмол горим', N.security)
  const gap = 0.24, cw = (CW - gap) / 2, ch = 4.62, y = TOP
  glass(s, MX, y, cw, ch)
  iconTile(s, 'globe', 'teal', MX + 0.32, y + 0.32, 0.66, 'Нээлттэй')
  heading(s, 'Нээлттэй судалгааны сан', MX + 1.18, y + 0.32, cw - 1.5, { pt: 18, h: 0.66 })
  rows(s, [
    { icon: 'book-open', text: 'Нууцын зэрэглэлгүй, эрдэм шинжилгээнд нээлттэй түүхэн баримтыг цахим уншлагын танхимаар судлаачдад хүргэнэ.' },
    { icon: 'file-check', text: 'Гадаад AI API-аар боловсруулахдаа архивын бичгээр зөвшөөрөл авч, өгөгдлийг загвар сургахад ашигладаггүй төлбөртэй нөхцөлийг сонгоно.' },
    { icon: 'user-check', text: 'Хүний нэр, хувийн мэдээлэлтэй баримтыг Хүний хувийн мэдээлэл хамгаалах тухай хуулийн [8] дагуу «хязгаарлалттай» гэж тэмдэглэнэ.' },
  ], { x: MX + 0.32, y: y + 1.3, w: cw - 0.64, pt: 14, hue: 'teal', gap: 0.22 })

  const bx = MX + cw + gap
  solid(s, bx, y, cw, ch, { fill: K.island, r: 0.24, name: 'Хаалттай горим' })
  iconTile(s, 'lock', 'white', bx + 0.32, y + 0.32, 0.66, 'Хаалттай')
  heading(s, 'Дотоод сүлжээний хаалттай горим', bx + 1.18, y + 0.32, cw - 1.5, { pt: 18, h: 0.66, color: K.white })
  rows(s, [
    { icon: 'key-round', text: 'Үйлдвэрийн технологийн нууц, хүний нөөцийн хувийн хэрэг, санхүүгийн хаалттай баримт.' },
    { icon: 'globe', text: 'Гадаад интернет сүлжээнд гаргахгүй.' },
    { icon: 'server', text: 'Үйлдвэрийн дотоод сервер дээр, тусгаарлагдсан орчинд боловсруулж цэгцэлнэ.' },
  ], { x: bx + 0.32, y: y + 1.3, w: cw - 0.64, pt: 14, hue: 'white', color: K.dText, gap: 0.22 })
}
{
  const s = content(SEC.gain, ['5.3', 'Замын зураглал'], 'Туршилтаас бүрэн нэвтрүүлэлт рүү', N.roadmap)
  const gap = 0.3, cw = (CW - 2 * gap) / 3, y = TOP + 0.5, ch = 2.62
  s.addShape(SH.line, { x: MX + 0.2, y: TOP + 0.22, w: CW - 0.4, h: 0, line: { color: 'B9BDCB', width: 1.5, endArrowType: 'triangle' }, objectName: 'Замын шугам' })
  const STEPS = [
    ['teal', 'Туршилтын шатны баталгаажуулалт', 'Түүхэн ач холбогдолтой 500–1,000 хуудас орос-монгол баримтыг сонгож [7], туршилтын загвараар ангилан цахим каталогийн нарийвчлалыг шалгана.'],
    ['blue', 'Ухаалаг уншлагын танхимын модуль', 'Төрөлжсөн архивын цахим хуудасны онлайн лавлагааны хэсэгт сэдэвчилсэн болон утга зүйн ухаалаг хайлтыг туршилтын байдлаар холбоно.'],
    ['orange', 'Бүрэн хэмжээний сан бүрдүүлэлт', 'Зураг төсөл, захиргаа, хүний нөөцийн сан хөмрөгийг үе шаттайгаар оруулж, салбар бүрийн судлаачдад зориулсан сэдэвчилсэн цахим хөмрөг бүрдүүлнэ.'],
  ]
  STEPS.forEach(([hue, name, text], i) => {
    const x = MX + i * (cw + gap)
    badge(s, i + 1, hue, x + 0.26, TOP + 0.02, 0.4, 14)
    glass(s, x, y, cw, ch)
    txt(s, name, { x: x + 0.28, y: y + 0.26, w: cw - 0.56, h: 0.6, pt: 15.5, bold: true })
    txt(s, text, { x: x + 0.28, y: y + 0.96, w: cw - 0.56, h: 1.5, pt: 13.5, color: K.text2 })
  })
  const my = y + ch + 0.22
  glass(s, MX, my, CW, 1.3, { r: 0.22 })
  icon(s, 'ruler', 'copper', MX + 0.28, my + 0.2, 0.26, 'Хэмжүүр')
  txt(s, [{ text: 'Туршилтаар хэмжих үзүүлэлт. ', options: { bold: true } }, { text: 'Үр дүнг туршилтын дараа танилцуулна.', options: { color: K.text2 } }], { x: MX + 0.66, y: my + 0.17, w: CW - 1.0, h: 0.32, pt: 13, valign: 'middle', name: 'Хэмжүүр' })
  const METRICS = ['Төрөл, салбарын ангиллыг архивын товъёогтой тулгасан нарийвчлал', 'Огноо, дугаар, байгууллага талбарын зөв хувь', 'OCR-ын тэмдэгтийн алдааны хувь']
  // the first is the longest: it gets the widest column, so each takes two lines at most
  const MW = [4.9, 3.6, CW - 0.56 - 0.6 - 4.9 - 3.6]
  let mx = MX + 0.28
  METRICS.forEach((text, i) => {
    icon(s, 'check', 'copper', mx, my + 0.66, 0.24, 'Үзүүлэлт')
    txt(s, text, { x: mx + 0.36, y: my + 0.62, w: MW[i] - 0.4, h: 0.52, pt: 13 })
    mx += MW[i] + 0.3
  })
}

// ---------- 19–21. Төгсгөл ----------
pres.addSection({ title: SEC.end })
{
  const s = dark(SEC.end, 'Харанхуй', 'Архивын үнэт өв бүх салбарын судлаачийн гарт бэлэн, цэгцтэй эх сурвалж болно', N.conclusion)
  pill(s, 'Дүгнэлт', 0.7, 0.62, { tone: 'glass', bold: true, h: 0.4 })
  txt(s, '35 тонн зураг төсөл, түүхэн баримтыг судалгааны идэвхтэй эргэлтэд оруулах гол түлхүүр нь цаасан болон зурган файлыг ухаалаг өгөгдлийн сан болгон цэгцлэх явдал.', { x: 0.7, y: 3.06, w: 10.6, h: 0.62, pt: 15, color: K.dText2 })
  const WORDS = [
    ['scan-text', 'Уншигдах', 'Бичвэр, хүснэгт, инженерийн штамп өгөгдөл болно.'],
    ['search', 'Хайгдах', 'Монгол түлхүүр үгээр орос эх баримт олдоно.'],
    ['folder-tree', 'Ангилагдах', 'Салбар, огноо, объектоор автоматаар багцлагдана.'],
  ]
  const gap = 0.26, cw = (W - 1.4 - 2 * gap) / 3, y = 4.02, ch = 1.76
  WORDS.forEach(([ic, word, text], i) => {
    const x = 0.7 + i * (cw + gap)
    glass(s, x, y, cw, ch, { dark: true })
    iconTile(s, ic, 'white', x + 0.28, y + 0.28, 0.56, word)
    txt(s, word, { x: x + 1.02, y: y + 0.28, w: cw - 1.3, h: 0.56, pt: 21, bold: true, color: K.dText, valign: 'middle', wrap: false })
    txt(s, text, { x: x + 0.28, y: y + 1.04, w: cw - 0.56, h: 0.54, pt: 13, color: K.dText2 })
  })
  const oy = y + ch + 0.36
  icon(s, 'check', 'white', 0.72, oy + 0.03, 0.26, 'Үр дүн')
  txt(s, 'Орос-монгол хэлний бэрхшээл буурна', { x: 1.1, y: oy, w: 4.6, h: 0.32, pt: 14.5, bold: true, color: K.dText, valign: 'middle', wrap: false })
  icon(s, 'check', 'white', 5.92, oy + 0.03, 0.26, 'Үр дүн')
  txt(s, 'Гар ажиллагааны удаашрал буурна', { x: 6.3, y: oy, w: 4.6, h: 0.32, pt: 14.5, bold: true, color: K.dText, valign: 'middle', wrap: false })
}
{
  const s = content(SEC.end, ['', 'Эх сурвалж'], 'Ашигласан эх сурвалж', '')
  const REFS = [
    ['Архив, албан хэрэг хөтлөлтийн тухай хууль. Эрх зүйн мэдээллийн нэгдсэн систем.', 'https://legalinfo.mn/mn/detail?lawId=15370'],
    ['«Эрдэнэт үйлдвэр» ТӨҮГ-ын Төрөлжсөн архив. Төрөлжсөн архивын танилцуулга.', 'https://archives.erdenetmc.mn/Home/Pages?pagecont=2-1'],
    ['«Эрдэнэт үйлдвэр» ТӨҮГ-ын Төрөлжсөн архив. Үндсэн чиг, үүрэг.', 'https://archives.erdenetmc.mn/Home/Pages?pagecont=2-2'],
    ['«Эрдэнэт үйлдвэр» ТӨҮГ-ын Төрөлжсөн архив. Эрхэм зорилго.', 'https://archives.erdenetmc.mn/Home/Pages?pagecont=2-3'],
    ['«Эрдэнэт үйлдвэр» ТӨҮГ-ын Төрөлжсөн архив. Бүтэц зохион байгуулалт.', 'https://archives.erdenetmc.mn/Home/Pages?pagecont=2-5'],
    ['Архивын ерөнхий газар. «Эрдэнэт үйлдвэр» ТӨҮГ-ын Төрөлжсөн архивын сан хөмрөг ба зориулалтын байрны мэдээлэл.', 'https://www.archives.gov.mn/content/397'],
    ['Архивын ерөнхий газар. Салбарын баримтын хадгалах хугацааны жагсаалт ба хамтын ажиллагаа.', 'https://www.archives.gov.mn/content/396'],
    ['Хүний хувийн мэдээлэл хамгаалах тухай хууль (2021). Эрх зүйн мэдээллийн нэгдсэн систем.', 'https://legalinfo.mn/mn/detail?lawId=16390288615991'],
  ]
  glass(s, MX, TOP, CW, 4.8)
  const gap = 0.4, cw = (CW - 0.6 - gap) / 2
  let ry = 0
  REFS.forEach(([name, url], i) => {
    if (i % 4 === 0) ry = TOP + 0.32
    const x = MX + 0.3 + Math.floor(i / 4) * (cw + gap)
    const h = textH(name, 12.5, false, cw - 0.5)
    txt(s, `[${i + 1}]`, { x, y: ry, w: 0.46, h: 0.26, pt: 12.5, bold: true, color: K.accent, wrap: false })
    txt(s, name, { x: x + 0.5, y: ry, w: cw - 0.5, h: h + 0.02, pt: 12.5 })
    s.addText([{ text: url, options: { hyperlink: { url } } }], { x: x + 0.5, y: ry + h + 0.05, w: cw - 0.5, h: 0.26, fontSize: 11.5, margin: 0, valign: 'top', isTextBox: true, lang: 'en-US', objectName: 'Холбоос' })
    ry += h + 0.05 + 0.26 + 0.3
  })
}
{
  const s = dark(SEC.end, 'Харанхуй', 'Анхаарал тавьсанд баярлалаа', 'Асуулт, хариулт.', { fontSize: 40 })
  pill(s, 'Эрдэм шинжилгээний бага хурал', 0.7, 0.62, { tone: 'glass', bold: true, h: 0.4 })
  txt(s, 'А.Уянгаа', { x: 0.7, y: 2.56, w: 7, h: 0.4, pt: 18, bold: true, color: K.dText })
  txt(s, '«Архивын баримтыг судалгааны эргэлтэд оруулах нь»', { x: 0.7, y: 3.02, w: 7.6, h: 0.3, pt: 14, color: K.dText2, wrap: false })
  txt(s, '2026 оны 11 дүгээр сар, Эрдэнэт хот', { x: 0.7, y: 3.36, w: 7.4, h: 0.3, pt: 14, color: K.dText2 })
  glass(s, 0.7, 4.3, 3.9, 0.96, { dark: true, r: 0.3 })
  iconTile(s, 'message-circle-question', 'white', 0.92, 4.5, 0.56, 'Асуулт')
  txt(s, 'Асуулт, хариулт', { x: 1.68, y: 4.5, w: 2.8, h: 0.56, pt: 18, bold: true, color: K.dText, valign: 'middle', wrap: false })
  s.addImage({ path: A('folder-orange.png'), x: 9.02, y: 1.72, w: 3.66, h: 3.44, altText: 'Баримт бичигтэй шилэн хавтас', objectName: 'Шилэн хавтас' })
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
pres.writeFile({ fileName: OUT }).then(() => {
  fs.writeFileSync(path.join(path.dirname(OUT), 'icons-used.json'), JSON.stringify([...usedIcons].sort(), null, 1))
  console.log('wrote', OUT)
  if (unknown.size) console.log('letters the font lacks:', [...unknown].join(' '))
  console.log(issues.length ? 'check:\n  ' + issues.join('\n  ') : 'every text fits its box by measure')
})
