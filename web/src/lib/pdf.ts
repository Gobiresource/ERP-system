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

/** A PDF from page pictures (PNG), each filling an A4 page */
export async function imagesToPdf(pngs: Blob[]) {
  const lib = await loadPdfLib()
  const out = await lib.PDFDocument.create()
  for (const png of pngs) {
    const img = await out.embedPng(new Uint8Array(await png.arrayBuffer()))
    out.addPage([595.28, 841.89]).drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 })
  }
  return new Blob([(await out.save()) as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
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
    const page = copied.get(p.src)!.get(p.index)!
    page.setRotation(lib.degrees((p.rot + p.turn) % 360))
    out.addPage(page)
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
 * Where to draw a signature: the page's points (origin bottom left) of the picture's own bottom-left corner, for a page
 * shown turned by r degrees clockwise. The picture is then drawn turned by r the other way, so it looks upright.
 */
export function signSpot(s: Sign, r: number, W: number, H: number) {
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
