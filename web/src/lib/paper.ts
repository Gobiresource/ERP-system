// Demo documents and prepared certificates are drawn as an A4 page (letterhead, title, text, signature line) and kept as a PDF.
// Every page says "ЖИШЭЭ" across it: these are samples of the prototype, not real documents.
import type { Doc, DocRequest } from './types'
import { actions, getState } from './store'
import { getFile, putFile, saveBlob } from './files'
import { imagesToPdf } from './pdf'
import { cid } from './draft'
import { dateDots, parse, short } from './format'

const W = 1240 // A4 at 150 dpi
const H = 1754
const M = 130
const FONT = '"Golos Text Variable", "Golos Text", sans-serif'

/** Breaks a line of text into rows that fit the width */
function wrap(x: CanvasRenderingContext2D, text: string, width: number) {
  const rows: string[] = []
  let row = ''
  for (const word of text.split(' ')) {
    const next = row ? `${row} ${word}` : word
    if (row && x.measureText(next).width > width) {
      rows.push(row)
      row = word
    } else row = next
  }
  if (row) rows.push(row)
  return rows
}

export async function paperPdf(p: { company: string; title: string; lines: string[]; date: string; signer?: string }) {
  await document.fonts.load(`700 34px ${FONT}`)
  await document.fonts.load(`400 28px ${FONT}`)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')!
  x.fillStyle = '#fff'
  x.fillRect(0, 0, W, H)

  // Letterhead
  x.fillStyle = '#1d2b6e'
  x.font = `700 34px ${FONT}`
  x.fillText(p.company, M, 160)
  x.fillStyle = '#5b5f6e'
  x.font = `400 22px ${FONT}`
  x.fillText('Улаанбаатар хот', M, 198)
  x.fillStyle = '#1d2b6e'
  x.fillRect(M, 224, W - 2 * M, 3)
  x.fillStyle = '#1b1d26'
  x.font = `400 24px ${FONT}`
  x.fillText(p.date, M, 284)

  // Title and text
  x.font = `700 40px ${FONT}`
  x.textAlign = 'center'
  wrap(x, p.title, W - 2 * M).forEach((row, i) => x.fillText(row, W / 2, 400 + i * 52))
  x.textAlign = 'left'
  x.font = `400 28px ${FONT}`
  let y = 520
  for (const line of p.lines) {
    for (const row of wrap(x, line, W - 2 * M)) {
      x.fillText(row, M, y)
      y += 46
    }
    y += 16
  }
  if (p.signer) x.fillText(p.signer, M, Math.max(y + 90, H - 420))

  // Marked as a sample, across the page and at the foot
  x.save()
  x.translate(W / 2, H / 2)
  x.rotate(-Math.PI / 6)
  x.textAlign = 'center'
  x.fillStyle = 'rgba(200, 30, 50, 0.1)'
  x.font = `800 200px ${FONT}`
  x.fillText('ЖИШЭЭ', 0, 70)
  x.restore()
  x.fillStyle = '#8a8d99'
  x.font = `400 20px ${FONT}`
  x.fillText('Туршилтын хувилбарын жишээ бичиг баримт', M, H - 90)

  const png = await new Promise<Blob>((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(new Error('canvas'))), 'image/png'))
  return imagesToPdf([png])
}

const signer = (id: string) => {
  const p = getState().people.find(x => x.id === id)
  return p ? `${p.role}   ________________   ${short(p)}` : undefined
}
const companyName = (id: string) => getState().companies.find(c => c.id === id)?.name ?? ''

/** The document's file. A demo document is drawn the first time and kept, so it looks the same the next time. */
export async function docBlob(d: Doc): Promise<Blob | undefined> {
  if (d.file) return getFile(d.file.id)
  if (!d.text) return undefined
  const blob = await paperPdf({ company: companyName(d.company), title: d.name, lines: d.text, date: dateDots(new Date(d.added)), signer: signer(d.by) })
  const file = { id: `f${cid()}`, name: `${d.name}.pdf`, type: 'application/pdf', size: blob.size, pages: 1 }
  try {
    await putFile(file.id, blob)
    actions.updateDoc(d.id, { file })
  } catch { /* shown this time, drawn again next time */ }
  return blob
}

export async function downloadDoc(d: Doc) {
  const blob = await docBlob(d)
  if (blob) saveBlob(d.file?.name ?? `${d.name}.pdf`, blob)
}

/** A sample of what the office sends back for a request, filled from the person's HR record */
export function requestPdf(r: DocRequest) {
  const s = getState()
  const p = s.people.find(x => x.id === r.by)
  const e = s.employees.find(x => x.user === r.by && x.company === r.company)
  const position = e && s.positions.find(x => x.id === e.position)?.name
  return paperPdf({
    company: companyName(r.company),
    title: r.what,
    date: dateDots(new Date()),
    signer: signer(s.me),
    lines: [
      `Овог, нэр: ${p ? `${p.family} ${p.given}` : ''}`,
      `Албан тушаал: ${position ?? p?.role ?? ''}`,
      `Хэлтэс: ${p?.team ?? ''}`,
      ...(e ? [`Ажилд орсон огноо: ${dateDots(parse(e.hired))}`] : []),
      `Зориулалт: ${r.purpose}`,
      ...(r.where ? [`Хаана өгөх: ${r.where}`] : []),
      'Ажилтны хүсэлтээр олгов.',
    ],
  })
}
