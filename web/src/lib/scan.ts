// Reading scanned papers (Бичиг хэрэг → Скан оруулах). The browser draws a few pages as pictures and sends them to our
// server (server/scan.ts), which holds the OpenRouter key and asks AI what the paper is. Without the server, as on the
// preview page or before the key is set, the office says what a paper is by hand (docs/decisions.md, 2026-10-30).
import type { BoardFile, ContractType, Id, ScanFields, ScanItem, ScanReading } from './types'
import { actions, getState } from './store'
import { getFile, putFile } from './files'
import { drawPage, viewPdf } from './pdf'
import { paperPdf, type PaperLine } from './paper'
import { clausesFor } from './contracts'
import { cid } from './draft'
import { num } from './format'

const API = '/api/scan'
/** Pages AI reads: the first two and the last, where the signatures and stamps are */
const PAGES = 3
/** Pixels on the longer side of a page sent to AI; enough for typed text and stamps */
const SIZE = 1800

export interface AiState { ready: boolean; model?: string }

/** Whether the server can read scans: not without the server (the preview page) or without its key */
export async function aiState(): Promise<AiState> {
  try {
    const r = await fetch(API, { signal: AbortSignal.timeout(4000) })
    const j = r.ok ? await r.json() : null
    return { ready: !!j?.ready, model: j?.model }
  } catch {
    return { ready: false }
  }
}

export const isPdf = (f: { name: string; type?: string }) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

/** Pictures of a paper's pages, `size` pixels on the longer side: the pages AI reads, or the first only */
async function pictures(blob: Blob, name: string, size: number, first = false) {
  if (isPdf({ name, type: blob.type })) {
    const view = await viewPdf(blob)
    try {
      const n = view.numPages
      const pics: HTMLCanvasElement[] = []
      for (const i of first ? [0] : [...new Set([0, 1, n - 1])].filter(i => i < n).slice(0, PAGES)) pics.push(await drawPage({ view }, i, size))
      return { pics, pages: n }
    } finally {
      view.loadingTask.destroy()
    }
  }
  const img = await createImageBitmap(blob)
  const k = Math.min(1, size / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  img.close()
  return { pics: [c], pages: 1 }
}

const jpeg = (c: HTMLCanvasElement, q = 0.8) => new Promise<Blob>((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(new Error('jpeg'))), 'image/jpeg', q))

/** What a paper files as: what AI read, or, before that, the folder it came in through and its file name */
export function fieldsOf(r: ScanReading | undefined, before: ScanFields): ScanFields {
  if (!r) return before
  return {
    company: r.company ?? before.company,
    kind: r.kind,
    title: r.title,
    number: r.number ?? '',
    date: r.date ?? '',
    party: r.parties.join(', '),
    amount: r.amount !== null && (!r.currency || r.currency === 'MNT') ? num(r.amount) : '',
  }
}

/** Puts dropped files into the inbox, each with a small picture; with AI they wait to be read, without it the office fills them in */
export async function addFiles(files: File[], ready: boolean) {
  const s = getState()
  const items: ScanItem[] = []
  for (const f of files) {
    if (!isPdf(f) && !f.type.startsWith('image/')) continue
    const id = `f${cid()}`
    await putFile(id, f)
    const file: BoardFile = { id, name: f.name, type: f.type || 'application/pdf', size: f.size }
    let thumb: Id | undefined
    try {
      const r = await pictures(f, f.name, 360, true)
      file.pages = r.pages
      thumb = `${id}-t`
      await putFile(thumb, await jpeg(r.pics[0], 0.7))
    } catch { /* a file that cannot be drawn still goes in, without its picture */ }
    const to: ScanFields = { company: s.company, kind: 'contract', title: f.name.replace(/\.[^.]+$/, ''), number: '', date: '', party: '', amount: '' }
    items.push({ id: cid(), file, thumb, by: s.me, added: new Date().toISOString(), state: ready ? 'waiting' : 'manual', to })
  }
  actions.addScans(items)
  if (ready) pump()
  return items.length
}

const busy = new Set<Id>()

/** Reads the waiting scans, two at a time */
export function pump() {
  for (const it of getState().scans) {
    if (busy.size >= 2) return
    if (it.state !== 'waiting' || busy.has(it.id)) continue
    busy.add(it.id)
    actions.setScan(it.id, { state: 'reading', error: undefined })
    read(it).finally(() => {
      busy.delete(it.id)
      pump()
    })
  }
}

/** Scans left "reading" when the page was closed go back in line */
export function resume() {
  for (const it of getState().scans) if (it.state === 'reading' && !busy.has(it.id)) actions.setScan(it.id, { state: 'waiting' })
}

async function read(it: ScanItem) {
  try {
    const blob = await getFile(it.file.id)
    if (!blob) throw new Error('Файл олдсонгүй.')
    const { pics } = await pictures(blob, it.file.name, SIZE)
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages: pics.map(c => c.toDataURL('image/jpeg', 0.8)), name: it.file.name, companies: getState().companies.map(c => ({ id: c.id, name: c.name })) }),
      signal: AbortSignal.timeout(120_000),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error ?? 'AI хариу өгсөнгүй.')
    const now = getState().scans.find(x => x.id === it.id)
    if (!now) return // taken out meanwhile
    actions.setScan(it.id, { state: 'read', reading: j.reading, model: j.model, cost: j.cost ?? undefined, to: fieldsOf(j.reading, now.to) })
    if (typeof j.cost === 'number') actions.addAiCost(j.cost)
  } catch (e) {
    actions.setScan(it.id, { state: 'failed', error: e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'AI хугацаандаа хариу өгсөнгүй.' })
  }
}

/** A page as a scanner gives it back: grey, a little crooked, on the darker lid; `faint` as from a worn-out copy */
function scanned(page: HTMLCanvasElement, tilt: number, faint: boolean) {
  const c = document.createElement('canvas')
  c.width = page.width + 60
  c.height = page.height + 60
  const x = c.getContext('2d')!
  x.fillStyle = '#cfccc4'
  x.fillRect(0, 0, c.width, c.height)
  x.translate(c.width / 2, c.height / 2)
  x.rotate((tilt * Math.PI) / 180)
  x.filter = faint ? 'grayscale(1) contrast(0.45) brightness(1.15)' : 'grayscale(1) contrast(1.1)'
  x.drawImage(page, -page.width / 2, -page.height / 2)
  return c
}

const reading = (r: Partial<ScanReading> & Pick<ScanReading, 'kind' | 'title' | 'summary'>): ScanReading => ({
  contractType: null, company: null, number: null, date: null, parties: [], amount: null, currency: null, expires: null, confidence: 'high', notes: null, ...r,
})

/**
 * Demo papers, all made up, with what AI would read from them: the inbox can be tried before AI is connected. They say
 * "Жишээ" on the page and in the inbox; once AI reads real scans, real readings take their place.
 */
export async function addSamples() {
  const s = getState()
  const co = (id: Id) => s.companies.find(c => c.id === id)?.name ?? ''
  const contract = (company: Id, kind: ContractType, title: string, number: string, date: string, party: string, amount: number) => () =>
    paperPdf({
      company: co(company), title, number: `№ ${number}`, date,
      lines: [`Талууд: ${co(company)}, ${party}.`, ...clausesFor(kind, party, amount).flatMap((c, i): PaperLine[] => [{ head: `${i + 1}. ${c.title}` }, c.body])],
      signers: [`${co(company)}   ________________   Б.Болд`, `${party}   ________________`],
    })
  const list: { name: string; tilt: number; faint?: boolean; pdf: () => Promise<Blob>; reading: ScanReading }[] = [
    {
      name: 'scan_0412.jpg', tilt: -0.6,
      pdf: contract('c1', 'sale', 'Агуулахын тавиур нийлүүлэх гэрээ', 'ГР-2023/041', '2023.05.17', 'Тавиур Трейд ХХК', 36_400_000),
      reading: reading({ kind: 'contract', contractType: 'sale', company: 'c1', title: 'Агуулахын тавиур нийлүүлэх гэрээ', number: 'ГР-2023/041', date: '2023-05-17', parties: ['Тавиур Трейд ХХК'], amount: 36_400_000, currency: 'MNT', summary: 'Тавиур Трейд ХХК агуулахын тавиур нийлүүлэх гэрээ.' }),
    },
    {
      name: 'scan_0413.jpg', tilt: 0.8,
      pdf: contract('c2', 'lease', 'Оффисын байрны түрээсийн гэрээ', 'ГЛ-2022/009', '2022.01.10', 'Хан-Уул Плаза ХХК', 57_600_000),
      reading: reading({
        kind: 'contract', contractType: 'lease', company: 'c2', title: 'Оффисын байрны түрээсийн гэрээ', number: 'ГЛ-2022/009', date: '2022-01-10', parties: ['Хан-Уул Плаза ХХК'], amount: 57_600_000, currency: 'MNT', expires: '2024-12-31',
        summary: 'Хан-Уул Плаза ХХК-аас оффисын байр түрээслэх гэрээ.', confidence: 'medium', notes: 'Гэрээний хугацаа 2024.12.31-нд дууссан байна. Сунгасан эсэхийг шалгана уу.',
      }),
    },
    {
      name: 'scan_0414.jpg', tilt: -0.3,
      pdf: () => paperPdf({
        company: co('c1'), title: 'Тушаал', number: '№ Б/112', date: '2024.07.01', signer: 'Гүйцэтгэх захирал   ________________   Б.Болд',
        lines: [{ head: 'Ээлжийн амралт олгох тухай' }, 'Хөдөлмөрийн тухай хууль, хөдөлмөрийн дотоод журмыг үндэслэн ТУШААХ нь:', '1. Санхүүгийн хэлтсийн нягтлан бодогч О.Мөнхзулд 2024 оны 7 дугаар сарын 8-ны өдрөөс эхлэн 15 хоногийн ээлжийн амралт олгосугай.', '2. Тушаалын биелэлтэд хяналт тавьж ажиллахыг Хүний нөөцийн менежер Х.Ариунаад даалгасугай.'],
      }),
      reading: reading({ kind: 'order', company: 'c1', title: 'Ээлжийн амралт олгох тухай', number: 'Б/112', date: '2024-07-01', summary: 'Нягтлан бодогч О.Мөнхзулд ээлжийн амралт олгох тушаал.' }),
    },
    {
      name: 'scan_0415.jpg', tilt: 1.4, faint: true,
      pdf: contract('c1', 'service', 'Цэвэрлэгээний үйлчилгээний гэрээ', 'ГР-2021/118', '2021.09.01', 'Цэвэр Орчин ХХК', 14_400_000),
      reading: reading({
        kind: 'contract', contractType: 'service', company: 'c1', title: 'Цэвэрлэгээний үйлчилгээний гэрээ', parties: ['Цэвэр Орчин ХХК'],
        summary: 'Цэвэр Орчин ХХК-тай байгуулсан цэвэрлэгээний үйлчилгээний гэрээ.', confidence: 'low', notes: 'Скан бүдэг тул дугаар, огноо уншигдсангүй. Дахин скан хийнэ үү.',
      }),
    },
  ]
  const items: ScanItem[] = []
  for (const x of list) {
    const view = await viewPdf(await x.pdf())
    let page: HTMLCanvasElement
    try {
      page = scanned(await drawPage({ view }, 0, SIZE), x.tilt, !!x.faint)
    } finally {
      view.loadingTask.destroy()
    }
    const id = `f${cid()}`
    const blob = await jpeg(page, 0.72)
    await putFile(id, blob)
    const small = document.createElement('canvas')
    small.width = Math.round((page.width * 360) / page.height)
    small.height = 360
    small.getContext('2d')!.drawImage(page, 0, 0, small.width, small.height)
    await putFile(`${id}-t`, await jpeg(small, 0.7))
    const to = fieldsOf(x.reading, { company: s.company, kind: 'contract', title: '', number: '', date: '', party: '', amount: '' })
    items.push({ id: cid(), file: { id, name: x.name, type: 'image/jpeg', size: blob.size, pages: 1 }, thumb: `${id}-t`, by: s.me, added: new Date().toISOString(), state: 'read', sample: true, reading: x.reading, to })
  }
  actions.addScans(items)
}
