// Demo documents and prepared certificates are drawn as an A4 page (letterhead, title, text, signature line) and kept as a PDF.
// Every page says "ЖИШЭЭ" across it: these are samples of the prototype, not real documents.
import type { Contract, Doc, DocRequest, MonthReport } from './types'
import { actions, getState } from './store'
import { getFile, putFile, saveBlob } from './files'
import { imagesToPdf } from './pdf'
import { cid } from './draft'
import { dateDots, monthTitle, parse, short } from './format'
import { CONTRACT_KIND, contractLines, rolesOf } from './contracts'
import { total } from './reports'

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

/** A line of text, or a clause heading in bold */
export type PaperLine = string | { head: string }

/**
 * An A4 document: the letterhead and title on the first page, then the text, onto as many pages as it needs, and the
 * signature lines at the end. `number` goes on the right of the date line.
 */
export async function paperPdf(p: { company: string; title: string; lines: PaperLine[]; date: string; number?: string; signer?: string; signers?: string[] }) {
  await document.fonts.load(`700 34px ${FONT}`)
  await document.fonts.load(`400 28px ${FONT}`)
  const pages: HTMLCanvasElement[] = []
  let x!: CanvasRenderingContext2D
  let y = 0
  const newPage = () => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    x = c.getContext('2d')!
    x.fillStyle = '#fff'
    x.fillRect(0, 0, W, H)
    x.fillStyle = '#1b1d26'
    pages.push(c)
    y = 170
  }
  /** Starts a new page when `h` more pixels would not fit above the foot */
  const room = (h: number) => {
    if (y + h > H - 190) newPage()
  }

  // Letterhead, date and number, title
  newPage()
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
  if (p.number) {
    x.textAlign = 'right'
    x.fillText(p.number, W - M, 284)
    x.textAlign = 'left'
  }
  x.font = `700 40px ${FONT}`
  x.textAlign = 'center'
  const title = wrap(x, p.title, W - 2 * M)
  title.forEach((row, i) => x.fillText(row, W / 2, 400 + i * 52))
  x.textAlign = 'left'
  y = 400 + title.length * 52 + 68

  // The text: a heading keeps its first rows with it
  for (const line of p.lines) {
    const head = typeof line !== 'string'
    x.font = `${head ? 700 : 400} 28px ${FONT}`
    const rows = wrap(x, head ? line.head : line, W - 2 * M)
    if (head) room(46 * 3 + 12)
    for (const row of rows) {
      room(46)
      x.font = `${head ? 700 : 400} 28px ${FONT}`
      x.fillText(row, M, y)
      y += 46
    }
    y += head ? 4 : 16
  }
  const signers = p.signers ?? (p.signer ? [p.signer] : [])
  if (signers.length) {
    y += 70
    room(signers.length * 80)
    x.font = `400 28px ${FONT}`
    // A short text keeps its signature low on the page, as before
    if (pages.length === 1 && !p.signers) y = Math.max(y + 20, H - 420)
    for (const line of signers) {
      x.fillText(line, M, y)
      y += 80
    }
  }

  // Every page is marked as a sample, across it and at its foot, and numbered when there are several
  pages.forEach((c, i) => {
    const d = c.getContext('2d')!
    d.save()
    d.translate(W / 2, H / 2)
    d.rotate(-Math.PI / 6)
    d.textAlign = 'center'
    d.fillStyle = 'rgba(200, 30, 50, 0.1)'
    d.font = `800 200px ${FONT}`
    d.fillText('ЖИШЭЭ', 0, 70)
    d.restore()
    d.fillStyle = '#8a8d99'
    d.font = `400 20px ${FONT}`
    d.fillText('Туршилтын хувилбарын жишээ бичиг баримт', M, H - 90)
    if (pages.length > 1) {
      d.textAlign = 'right'
      d.fillText(`${i + 1} / ${pages.length}`, W - M, H - 90)
    }
  })

  const pngs = await Promise.all(pages.map(c => new Promise<Blob>((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(new Error('canvas'))), 'image/png'))))
  return imagesToPdf(pngs)
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

/** A contract's paper copy as it reads now: its number once registered, both sides to sign at the end */
export function contractPdf(c: Contract) {
  const s = getState()
  const company = companyName(c.company)
  const head = s.people.find(p => p.id === rolesOf(s, c.company).director)
  return paperPdf({
    company,
    title: c.title,
    date: dateDots(c.regDate ? parse(c.regDate) : new Date()),
    number: `№ ${c.number ?? '________'}`,
    lines: [`${CONTRACT_KIND[c.kind]}. Талууд: ${company}, ${c.party}.`, ...contractLines(c)],
    signers: [`${company}   ________________   ${head ? short(head) : ''}`, `${c.party}   ________________`],
  })
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

/** A monthly report as the sheet the employee used to hand in, with the manager's score when it has one */
export function reportPdf(r: MonthReport) {
  const s = getState()
  const p = s.people.find(x => x.id === r.person)
  const m = s.people.find(x => x.id === r.manager)
  const e = s.employees.find(x => x.user === r.person && x.company === r.company)
  const position = e && s.positions.find(x => x.id === e.position)?.name
  const lines: PaperLine[] = [
    `${p ? `${p.family} ${p.given}` : ''}${position ? `, ${position}` : ''}`,
    { head: '1. Хийсэн ажил' }, ...r.done.map(l => `• ${l.text}`),
    { head: '2. Асуудал, санал' }, r.issues || 'Бичээгүй.',
    { head: '3. Дараа сарын төлөвлөгөө' }, ...r.plan.map(l => `• ${l.text}`),
  ]
  if (r.scores && r.band) {
    lines.push({ head: 'Үнэлгээ' }, ...r.scores.map(c => `${c.name} (${c.weight}%): ${c.points} оноо`),
      `Нийт ${total(r.scores)} оноо, ${r.band.name.toLowerCase()}. Урамшуулал ${r.band.bonus}%.`, ...(r.comment ? [`Сэтгэгдэл: ${r.comment}`] : []))
  }
  return paperPdf({
    company: companyName(r.company),
    title: `${monthTitle(parse(`${r.month}-01`))}ын тайлан`,
    date: dateDots(r.sent ? new Date(r.sent) : new Date()),
    lines,
    signers: [`Тайлан гаргасан:   ________________   ${p ? short(p) : ''}`, `Хянаж үнэлсэн:   ________________   ${m ? short(m) : ''}`],
  })
}
