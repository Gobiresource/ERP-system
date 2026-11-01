// PDF in the browser: pdf.js (Mozilla, Apache-2.0) draws the pages, pdf-lib (MIT) writes the new file.
// Both load only when a PDF is opened (about 2 MB), and nothing is sent anywhere (docs/decisions.md, 2026-10-29).
// pdf.js comes in its "legacy" build, which also runs in browsers a few years old.
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PDFDocument } from 'pdf-lib'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

let pdfjs: Promise<typeof import('pdfjs-dist')> | null = null
const loadPdfjs = () =>
  (pdfjs ??= import('pdfjs-dist/legacy/build/pdf.mjs').then(m => {
    m.GlobalWorkerOptions.workerSrc = workerUrl
    return m
  }))
const loadPdfLib = () => import('pdf-lib')

/** An opened file: pdf.js draws it, pdf-lib copies its pages into the new file */
export interface Source {
  id: string
  name: string
  view: PDFDocumentProxy
  doc: PDFDocument
}

/** A page of the new file. `turn` is the user's quarter turns on top of the page's own rotation (`rot`). */
export interface Page {
  key: string
  src: string
  index: number
  rot: number
  turn: number
  /** Unrotated size in points */
  w: number
  h: number
  sign?: Sign
  /** What was written on it, placed while the page was turned by `turn` (as a signature) */
  marks?: { turn: number; list: Mark[] }
}

/**
 * Something written on a page: text, a yellow note, a highlight over what is there, or printed text covered in white and
 * written anew (`edit`; `min` is the box of what it covers). x, y, w and h are fractions of the page as it looked when
 * written on; `size` is the letters' size as a fraction of the page's width.
 */
export interface Mark {
  id: string
  kind: 'text' | 'note' | 'mark' | 'edit'
  x: number
  y: number
  w: number
  h: number
  text?: string
  size?: number
  min?: { w: number; h: number }
}

/** Times New Roman, the company's font, or its metric twin where it is missing */
export const MARK_FONT = '"Times New Roman", "Liberation Serif", Tinos, serif'
/** Line height and the room around a text, in letter sizes; tight for a covered line, so it does not reach the next one */
export const markLook = (kind: Mark['kind']) => (kind === 'edit' ? { line: 1.12, pad: 0.06 } : { line: 1.25, pad: 0.3 })
export const NOTE_BG = '#fff3a8'
const MARK_INK = '#1b1d26'

let ruler: CanvasRenderingContext2D | null = null
/** The box a text needs, as fractions of a page `ar` times as wide as it is tall: lines as typed, nothing wraps */
export function markBox(text: string, size: number, ar: number, kind: Mark['kind'] = 'text') {
  ruler ??= document.createElement('canvas').getContext('2d')!
  const { line, pad } = markLook(kind)
  const px = size * 1000
  ruler.font = `${px}px ${MARK_FONT}`
  const lines = text.split('\n')
  const w = Math.max(...lines.map(l => ruler!.measureText(l || ' ').width)) + 2 * pad * px
  const h = lines.length * px * line + 2 * pad * px
  return { w: w / 1000, h: (h / 1000) * ar }
}

/** A text, a note or a covered line drawn onto a page picture W by H pixels, where it sits */
function paintMark(x: CanvasRenderingContext2D, m: Mark, W: number, H: number) {
  const left = m.x * W
  const top = m.y * H
  if (m.kind === 'mark') {
    x.save()
    x.globalCompositeOperation = 'multiply'
    x.fillStyle = 'rgb(255 214 41 / .4)'
    x.fillRect(left, top, m.w * W, m.h * H)
    x.restore()
    return
  }
  if (m.kind !== 'text') {
    x.fillStyle = m.kind === 'note' ? NOTE_BG : '#fff'
    x.fillRect(left, top, m.w * W, m.h * H)
  }
  const { line, pad } = markLook(m.kind)
  const px = (m.size ?? 0.02) * W
  x.font = `${px}px ${MARK_FONT}`
  x.fillStyle = MARK_INK
  x.textBaseline = 'top'
  // As on screen: each line in a box `line` high, the letters in its middle
  ;(m.text ?? '').split('\n').forEach((l, i) => x.fillText(l, left + pad * px, top + pad * px + i * px * line + ((line - 1) / 2) * px))
}

/** A text or a note alone, as a PNG for the file */
function drawMark(m: Mark, W: number, H: number) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(m.w * W))
  c.height = Math.max(1, Math.ceil(m.h * H))
  paintMark(c.getContext('2d')!, { ...m, x: 0, y: 0 }, W, H)
  return c.toDataURL('image/png')
}

/**
 * A signature (PNG) on a page. Placed while the page was turned by `turn`: x, y and w are fractions of the page as it
 * looked then, and `ratio` is the picture's height over its width. Turning the page later turns the signature with it.
 */
export interface Sign {
  png: string
  x: number
  y: number
  w: number
  ratio: number
  turn: number
}

export class OpenError extends Error {}

/** Reads a PDF file. Throws OpenError with the reason the user should see. */
export async function openPdf(file: Blob, name: string, id: string): Promise<{ src: Source; pages: Page[] }> {
  const [lib, js] = await Promise.all([loadPdfLib(), loadPdfjs()])
  const bytes = new Uint8Array(await file.arrayBuffer())
  let doc: PDFDocument
  try {
    doc = await lib.PDFDocument.load(bytes, { updateMetadata: false })
  } catch (e) {
    if (e instanceof lib.EncryptedPDFError) throw new OpenError(`${name} файл нууц үгээр хамгаалагдсан тул засах боломжгүй.`)
    throw new OpenError(`${name} файлыг нээж чадсангүй. Файл гэмтсэн эсвэл PDF биш байж магадгүй.`)
  }
  // pdf.js takes its own copy: it hands the bytes over to its worker
  const view = await js.getDocument({ data: bytes.slice() }).promise
  const pages = doc.getPages().map((p, index) => {
    const box = p.getCropBox()
    return { key: `${id}:${index}`, src: id, index, rot: ((p.getRotation().angle % 360) + 360) % 360, turn: 0, w: box.width, h: box.height }
  })
  return { src: { id, name, view, doc }, pages }
}

/** Opens a PDF only to look at it */
export async function viewPdf(file: Blob) {
  const js = await loadPdfjs()
  return js.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
}

/** A picture of a page as the PDF shows it (its own rotation, not the user's turns), `size` pixels on the longer side */
export async function drawPage(src: Pick<Source, 'view'>, index: number, size: number, turn = 0): Promise<HTMLCanvasElement> {
  const page = await src.view.getPage(index + 1)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: size / Math.max(base.width, base.height), rotation: (page.rotate + turn) % 360 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvas, viewport }).promise
  page.cleanup()
  return canvas
}

/** A PDF from page pictures (PNG or JPEG), each filling an A4 page */
export async function imagesToPdf(pics: Blob[]) {
  const lib = await loadPdfLib()
  const out = await lib.PDFDocument.create()
  for (const pic of pics) {
    const bytes = new Uint8Array(await pic.arrayBuffer())
    const img = pic.type === 'image/jpeg' ? await out.embedJpg(bytes) : await out.embedPng(bytes)
    out.addPage([595.28, 841.89]).drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 })
  }
  return new Blob([(await out.save()) as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
}

const toBlob = (bytes: Uint8Array) => new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })

/** A file for each group of pages (0-based) of one PDF, the pages copied as they are */
export async function pickPages(file: Blob, groups: number[][]) {
  const lib = await loadPdfLib()
  const src = await lib.PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true })
  const out: Blob[] = []
  for (const g of groups) {
    const doc = await lib.PDFDocument.create()
    for (const page of await doc.copyPages(src, g)) doc.addPage(page)
    out.push(toBlob(await doc.save()))
  }
  return out
}

/** One PDF of several, one after another */
export async function joinPdfs(files: Blob[]) {
  const lib = await loadPdfLib()
  const doc = await lib.PDFDocument.create()
  for (const f of files) {
    const src = await lib.PDFDocument.load(new Uint8Array(await f.arrayBuffer()), { ignoreEncryption: true })
    for (const page of await doc.copyPages(src, src.getPageIndices())) doc.addPage(page)
  }
  return toBlob(await doc.save())
}

/** Builds the new file from the pages in their order, with their turns and signatures */
export async function buildPdf(pages: Page[], sources: Map<string, Source>) {
  const lib = await loadPdfLib()
  const out = await lib.PDFDocument.create()
  // Copy each file's pages in one go, so the pages share their fonts and pictures
  const copied = new Map<string, Map<number, import('pdf-lib').PDFPage>>()
  for (const [id, src] of sources) {
    const wanted = [...new Set(pages.filter(p => p.src === id).map(p => p.index))]
    if (!wanted.length) continue
    const list = await out.copyPages(src.doc, wanted)
    copied.set(id, new Map(wanted.map((index, i) => [index, list[i]])))
  }
  for (const p of pages) {
    if (p.marks?.list.some(m => m.kind === 'edit')) {
      await flatPage(out, lib, p, sources.get(p.src)!)
      continue
    }
    const page = copied.get(p.src)!.get(p.index)!
    page.setRotation(lib.degrees((p.rot + p.turn) % 360))
    out.addPage(page)
    if (p.marks?.list.length) {
      // As a signature: placed on the page as it looked then, turned with it since. Texts go in as pictures, so any
      // letters (Ө, Ү) show as they did on screen; highlights as see-through yellow
      const box = page.getCropBox()
      const r = (p.rot + p.marks.turn) % 360
      const side = r === 90 || r === 270
      const DW = side ? box.height : box.width
      const DH = side ? box.width : box.height
      for (const m of p.marks.list) {
        const at = signSpot({ x: m.x, y: m.y, w: m.w, ratio: (m.h * DH) / (m.w * DW) }, r, box.width, box.height)
        const place = { x: box.x + at.x, y: box.y + at.y, width: at.w, height: at.h, rotate: lib.degrees(r) }
        if (m.kind === 'mark') page.drawRectangle({ ...place, color: lib.rgb(1, 0.84, 0.16), opacity: 0.4, blendMode: lib.BlendMode.Multiply })
        else page.drawImage(await out.embedPng(drawMark(m, DW * 3, DH * 3)), place)
      }
    }
    if (p.sign) {
      const box = page.getCropBox()
      const r = (p.rot + p.sign.turn) % 360
      const img = await out.embedPng(p.sign.png)
      const at = signSpot(p.sign, r, box.width, box.height)
      page.drawImage(img, { x: box.x + at.x, y: box.y + at.y, width: at.w, height: at.h, rotate: lib.degrees(r) })
    }
  }
  return out.save()
}

/**
 * A page with printed text covered and written anew, as one picture of it with everything written on it: what was
 * covered is gone from the file, not only hidden under white. About 290 dpi on A4; the signature stays a picture on top.
 */
async function flatPage(out: PDFDocument, lib: typeof import('pdf-lib'), p: Page, src: Source) {
  const t = p.marks!.turn
  const canvas = await drawPage(src, p.index, 2400, t)
  const x = canvas.getContext('2d')!
  for (const m of p.marks!.list) paintMark(x, m, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9))
  if (!blob) throw new Error('canvas')
  const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
  // The new page is the old one as it looked when written on; the user's turns since then go on top
  const side = (p.rot + t) % 180 !== 0
  const W = side ? p.h : p.w
  const H = side ? p.w : p.h
  const page = out.addPage([W, H])
  page.drawImage(jpg, { x: 0, y: 0, width: W, height: H })
  page.setRotation(lib.degrees((p.turn - t + 360) % 360))
  if (p.sign) {
    const r = (p.sign.turn - t + 360) % 360
    const at = signSpot(p.sign, r, W, H)
    page.drawImage(await out.embedPng(p.sign.png), { x: at.x, y: at.y, width: at.w, height: at.h, rotate: lib.degrees(r) })
  }
}

/**
 * Where to draw a signature: the page's points (origin bottom left) of the picture's own bottom-left corner, for a page
 * shown turned by r degrees clockwise. The picture is then drawn turned by r the other way, so it looks upright.
 */
export function signSpot(s: Pick<Sign, 'x' | 'y' | 'w' | 'ratio'>, r: number, W: number, H: number) {
  const side = r === 90 || r === 270
  const DW = side ? H : W
  const DH = side ? W : H
  const w = s.w * DW
  const h = w * s.ratio
  const dx = s.x * DW
  const dy = s.y * DH + h
  const [x, y] = r === 90 ? [dy, dx] : r === 180 ? [W - dx, dy] : r === 270 ? [W - dy, H - dx] : [dx, H - dy]
  return { x, y, w, h }
}
