// Reading scanned papers (Бичиг хэрэг → Скан оруулах). The browser draws a few pages as pictures and sends them to our
// server (server/scan.ts), which holds the OpenRouter key and asks AI what the paper is. A stack scanned into one file is
// first cut into its papers, with the blank pages left out. Without the server, as on the preview page or before the key
// is set, the office says what a paper is, and where a stack splits, by hand (docs/decisions.md, 2026-10-30).
import type { BoardFile, ContractType, Id, ScanFields, ScanItem, ScanReading } from './types'
import { actions, getState } from './store'
import { getFile, putFile } from './files'
import { drawPage, imagesToPdf, joinPdfs, pickPages, viewPdf } from './pdf'
import { paperPdf, type PaperLine } from './paper'
import { clausesFor } from './contracts'
import { cid } from './draft'
import { num } from './format'
import { toast } from './ui'

const API = '/api/scan'
/** Pages AI reads: the first two and the last, where the signatures and stamps are */
const PAGES = 3
/** Pixels on the longer side of a page sent to AI; enough for typed text and stamps */
const SIZE = 1800
/** Smaller pages to tell where the papers of a stack begin, so many at a time */
const SMALL = 768
const CHUNK = 16

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

/** A small picture of a file's first page, in the file store; undefined when the file cannot be drawn */
async function thumbOf(id: Id, blob: Blob, name: string) {
  try {
    const r = await pictures(blob, name, 360, true)
    await putFile(`${id}-t`, await jpeg(r.pics[0], 0.7))
    return { thumb: `${id}-t`, pages: r.pages }
  } catch {
    return { thumb: undefined, pages: undefined }
  }
}

/**
 * Puts files into the inbox in their names' order (a scanner numbers them as it goes), each as soon as it is ready, with
 * a small picture. With AI they wait to be read, without it the office fills them in. Returns how many went in.
 */
export async function addFiles(files: File[], ready: boolean, progress?: (done: number, all: number) => void) {
  const s = getState()
  const list = files.filter(f => !f.name.startsWith('.') && (isPdf(f) || f.type.startsWith('image/'))).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  for (const [i, f] of list.entries()) {
    progress?.(i, list.length)
    const id = `f${cid()}`
    await putFile(id, f)
    const { thumb, pages } = await thumbOf(id, f, f.name)
    const file: BoardFile = { id, name: f.name, type: f.type || 'application/pdf', size: f.size, pages }
    const to: ScanFields = { company: s.company, kind: 'contract', title: f.name.replace(/\.[^.]+$/, ''), number: '', date: '', party: '', amount: '' }
    actions.addScans([{ id: cid(), file, thumb, by: s.me, added: new Date().toISOString(), state: ready ? 'waiting' : 'manual', mapped: (pages ?? 1) < 2, to }])
    if (ready) pump()
  }
  return list.length
}

/** Files and folders dropped together: the files inside the folders too */
export async function droppedFiles(items: DataTransferItemList, files: FileList) {
  // The entries must be taken while the drop is going on; reading them can wait
  const entries = [...items].map(i => i.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e)
  if (!entries.some(e => e.isDirectory)) return [...files]
  const out: File[] = []
  const walk = async (e: FileSystemEntry): Promise<void> => {
    if (e.isFile) out.push(await new Promise<File>((ok, fail) => (e as FileSystemFileEntry).file(ok, fail)))
    else if (e.isDirectory) {
      const reader = (e as FileSystemDirectoryEntry).createReader()
      for (;;) {
        const some = await new Promise<FileSystemEntry[]>((ok, fail) => reader.readEntries(ok, fail))
        if (!some.length) break
        for (const x of some) await walk(x)
      }
    }
  }
  for (const e of entries) await walk(e)
  return out
}

/** Pages 1…n grouped into papers: each start opens one, blank pages are left out */
export function groupsOf(n: number, starts: number[], blank: number[]) {
  const out: number[][] = []
  for (let p = 1; p <= n; p++) {
    if (p === 1 || starts.includes(p)) out.push([])
    if (!blank.includes(p)) out[out.length - 1].push(p)
  }
  return out.filter(g => g.length)
}

/**
 * Cuts a file into a paper for each group of pages (numbers from 1), in the inbox where the file was. A paper cut from
 * a stack knows the stack's pages it came from. Returns the papers.
 */
export async function splitItem(it: ScanItem, groups: number[][], ready: boolean, readings?: ScanReading[]) {
  // Busy while cutting, so its buttons are gone; back as it was if the cut fails
  actions.setScan(it.id, { state: 'splitting' })
  const items: ScanItem[] = []
  try {
    const blob = await getFile(it.file.id)
    if (!blob) throw new Error('Файл олдсонгүй.')
    const parts = await pickPages(blob, groups.map(g => g.map(p => p - 1)))
    const batch = it.from ?? { batch: it.id, name: it.file.name, pages: Array.from({ length: it.file.pages ?? 1 }, (_, i) => i + 1) }
    const base = batch.name.replace(/\.pdf$/i, '')
    for (const [i, part] of parts.entries()) {
      const pages = groups[i].map(p => batch.pages[p - 1])
      const name = `${base} (${pages.length > 1 ? `${pages[0]}–${pages[pages.length - 1]}` : pages[0]}).pdf`
      const id = `f${cid()}`
      await putFile(id, part)
      const { thumb } = await thumbOf(id, part, name)
      const reading = readings?.[i]
      items.push({
        id: cid(), file: { id, name, type: 'application/pdf', size: part.size, pages: pages.length }, thumb, by: it.by, added: it.added, mapped: true,
        from: { batch: batch.batch, name: batch.name, pages }, sample: it.sample, reading,
        state: reading ? 'read' : ready ? 'waiting' : 'manual',
        to: reading ? fieldsOf(reading, it.to) : { ...it.to, title: name.replace(/\.pdf$/, '') },
      })
    }
  } catch (e) {
    actions.setScan(it.id, { state: it.state })
    throw e
  }
  actions.replaceScan(it.id, items)
  if (ready) pump()
  return items
}

/** The part of the same stack just before this one, still in the inbox */
export const partBefore = (scans: ScanItem[], it: ScanItem) =>
  it.from && scans.filter(x => x.from?.batch === it.from!.batch && x.from.pages[x.from.pages.length - 1] < it.from!.pages[0])
    .sort((a, b) => b.from!.pages[0] - a.from!.pages[0])[0]

/** Parts being put together: a second press, or a press on the part before, waits for it */
const joining = new Set<Id>()

/** Puts a paper back together with the part before it, when a stack was cut in the wrong place; it is read again. Returns the joined paper's id. */
export async function mergeBack(it: ScanItem, ready: boolean) {
  const prev = partBefore(getState().scans, it)
  if (!prev?.from || !it.from || joining.has(it.id) || joining.has(prev.id)) return
  joining.add(it.id).add(prev.id)
  try {
    const [a, b] = await Promise.all([getFile(prev.file.id), getFile(it.file.id)])
    if (!a || !b) throw new Error('Файл олдсонгүй.')
    const joined = await joinPdfs([a, b])
    const pages = [...prev.from.pages, ...it.from.pages]
    const id = `f${cid()}`
    await putFile(id, joined)
    const name = `${prev.from.name.replace(/\.pdf$/i, '')} (${pages[0]}–${pages[pages.length - 1]}).pdf`
    actions.setScan(prev.id, {
      file: { id, name, type: 'application/pdf', size: joined.size, pages: pages.length }, from: { ...prev.from, pages },
      state: ready ? 'waiting' : 'manual', reading: ready ? undefined : prev.reading, error: undefined,
    })
    actions.dropScan(it.id)
  } finally {
    joining.delete(it.id)
    joining.delete(prev.id)
  }
  if (ready) pump()
  return prev.id
}

/** Keyboard focus to a paper's card, when the one it was on is gone after a cut or a join; in the middle, clear of the bars */
export const focusScan = (id?: Id) => requestAnimationFrame(() => {
  const el = document.getElementById(`scan-${id}`)?.querySelector<HTMLElement>('.scard__thumb')
  el?.focus({ preventScroll: true })
  el?.scrollIntoView({ block: 'center' })
})

const busy = new Set<Id>()

/** Works through the waiting scans, two at a time: a file of several pages is first cut into its papers, then each is read */
export function pump() {
  for (const it of getState().scans) {
    if (busy.size >= 2) return
    if (it.state !== 'waiting' || busy.has(it.id)) continue
    busy.add(it.id)
    const job = it.mapped || (it.file.pages ?? 1) < 2 ? read(it) : map(it)
    job.catch(e => actions.setScan(it.id, { state: 'failed', error: e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'AI хугацаандаа хариу өгсөнгүй.' }))
      .finally(() => {
        busy.delete(it.id)
        pump()
      })
  }
}

let resumed = false

/** Scans left half done when the page was closed go back in line, or to the office when AI is off; once a page load */
export function resume(ready: boolean) {
  if (resumed) return
  resumed = true
  for (const it of getState().scans) {
    if (it.state === 'reading' || it.state === 'splitting' || (!ready && it.state === 'waiting')) actions.setScan(it.id, { state: ready ? 'waiting' : 'manual' })
  }
}

/** Asks our server; its words come back as the error */
async function ask(body: object, wait: number) {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(wait) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? 'AI хариу өгсөнгүй.')
  if (typeof j.cost === 'number') actions.addAiCost(j.cost)
  return j
}

async function read(it: ScanItem) {
  actions.setScan(it.id, { state: 'reading', error: undefined })
  const blob = await getFile(it.file.id)
  if (!blob) throw new Error('Файл олдсонгүй.')
  const { pics } = await pictures(blob, it.file.name, SIZE)
  const j = await ask({ pages: pics.map(c => c.toDataURL('image/jpeg', 0.8)), name: it.file.name, companies: getState().companies.map(c => ({ id: c.id, name: c.name })) }, 120_000)
  const now = getState().scans.find(x => x.id === it.id)
  if (now) actions.setScan(it.id, { state: 'read', reading: j.reading, model: j.model, cost: j.cost ?? undefined, to: fieldsOf(j.reading, now.to) })
}

/** Looks through a file's pages, 16 at a time with the page before, for where its papers begin; then cuts it if there are several */
async function map(it: ScanItem) {
  actions.setScan(it.id, { state: 'splitting', error: undefined })
  const blob = await getFile(it.file.id)
  if (!blob) throw new Error('Файл олдсонгүй.')
  const view = await viewPdf(blob)
  const starts: number[] = []
  const blank: number[] = []
  const n = view.numPages
  try {
    for (let first = 1; first <= n; first += CHUNK) {
      const from = Math.max(1, first - 1)
      const pics: string[] = []
      for (let p = from; p < first + CHUNK && p <= n; p++) pics.push((await drawPage({ view }, p - 1, SMALL)).toDataURL('image/jpeg', 0.6))
      const j = await ask({ task: 'split', pages: pics, name: it.file.name, first: from, context: from < first }, 120_000)
      starts.push(...j.starts)
      blank.push(...j.blank)
    }
  } finally {
    view.loadingTask.destroy()
  }
  const groups = groupsOf(n, starts, blank)
  if (!groups.length || (groups.length === 1 && groups[0].length === n)) {
    actions.setScan(it.id, { mapped: true, state: 'waiting' })
    return
  }
  const parts = await splitItem(it, groups, true)
  toast(`${it.file.name} файлаас ${parts.length} баримт ялгалаа.`)
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
    items.push({ id: cid(), file: { id, name: x.name, type: 'image/jpeg', size: blob.size, pages: 1 }, thumb: `${id}-t`, by: s.me, added: new Date().toISOString(), state: 'read', sample: true, mapped: true, reading: x.reading, to })
  }
  items.push(await sampleStack())
  actions.addScans(items)
}

/** A demo stack scanned into one file: a contract, an order, an empty back of a sheet and a letter, with where AI would cut it */
async function sampleStack(): Promise<ScanItem> {
  const s = getState()
  const co = (id: Id) => s.companies.find(c => c.id === id)?.name ?? ''
  const papers: { pdf: () => Promise<Blob>; reading: ScanReading }[] = [
    {
      pdf: () => paperPdf({
        company: co('c2'), title: 'Тээвэр зуучлалын үйлчилгээний гэрээ', number: '№ ГЛ-2023/027', date: '2023.03.02',
        lines: [
          'Талууд: Говь Логистик ХХК, Хурд Карго ХХК.', ...clausesFor('service', 'Хурд Карго ХХК', 24_000_000).flatMap((c, i): PaperLine[] => [{ head: `${i + 1}. ${c.title}` }, c.body]),
          { head: 'Хавсралт 1. Тээврийн үнийн жагсаалт' }, ...['Дархан', 'Эрдэнэт', 'Сайншанд', 'Замын-Үүд', 'Чойр', 'Баганаар', 'Зуунмод', 'Налайх'].map((to, k) => `Улаанбаатар – ${to}: 1 тонн тутамд ${num(70_000 + k * 15_000)} төгрөг.`),
        ],
        signers: [`${co('c2')}   ________________   Б.Болд`, 'Хурд Карго ХХК   ________________'],
      }),
      reading: reading({ kind: 'contract', contractType: 'service', company: 'c2', title: 'Тээвэр зуучлалын үйлчилгээний гэрээ', number: 'ГЛ-2023/027', date: '2023-03-02', parties: ['Хурд Карго ХХК'], amount: 24_000_000, currency: 'MNT', summary: 'Хурд Карго ХХК-тай байгуулсан тээвэр зуучлалын үйлчилгээний гэрээ.' }),
    },
    {
      pdf: () => paperPdf({
        company: co('c1'), title: 'Тушаал', number: '№ Б/087', date: '2024.04.15', signer: 'Гүйцэтгэх захирал   ________________   Б.Болд',
        lines: [{ head: 'Ажилтан томилох тухай' }, 'Хөдөлмөрийн тухай хууль, хөдөлмөрийн дотоод журмыг үндэслэн ТУШААХ нь:', '1. Э.Билгүүнийг 2024 оны 4 дүгээр сарын 16-ны өдрөөс эхлэн Борлуулалтын хэлтсийн борлуулалтын ажилтнаар томилсугай.', '2. Тушаалын биелэлтэд хяналт тавьж ажиллахыг Хүний нөөцийн менежер Х.Ариунаад даалгасугай.'],
      }),
      reading: reading({ kind: 'order', company: 'c1', title: 'Ажилтан томилох тухай', number: 'Б/087', date: '2024-04-15', summary: 'Э.Билгүүнийг борлуулалтын ажилтнаар томилох тушаал.' }),
    },
    {
      pdf: () => paperPdf({
        company: co('c1'), title: 'Тайлан хүргүүлэх тухай', number: '№ 01/245', date: '2024.02.14', signer: 'Гүйцэтгэх захирал   ________________   Б.Болд',
        lines: ['Татварын ерөнхий газарт', 'Говь Ресурс ХХК-ийн 2023 оны санхүүгийн тайланг хавсралтаар хүргүүлж байна.', 'Хавсралт: 12 хуудас.'],
      }),
      reading: reading({ kind: 'letter', company: 'c1', title: 'Тайлан хүргүүлэх тухай', number: '01/245', date: '2024-02-14', parties: ['Татварын ерөнхий газар'], summary: 'Татварын ерөнхий газарт санхүүгийн тайлан хүргүүлсэн албан бичиг.' }),
    },
  ]
  const pics: Blob[] = []
  const starts: number[] = []
  const blank: number[] = []
  for (const [i, x] of papers.entries()) {
    const view = await viewPdf(await x.pdf())
    try {
      starts.push(pics.length + 1)
      for (let p = 0; p < view.numPages; p++) pics.push(await jpeg(scanned(await drawPage({ view }, p, SIZE), (p % 2 ? 0.5 : -0.4) + i * 0.3, false), 0.72))
    } finally {
      view.loadingTask.destroy()
    }
    // The order was printed on one side: its sheet's empty back comes through the scanner too
    if (i === 1) {
      const empty = document.createElement('canvas')
      empty.width = 1273
      empty.height = SIZE
      const x2 = empty.getContext('2d')!
      x2.fillStyle = '#fff'
      x2.fillRect(0, 0, empty.width, empty.height)
      blank.push(pics.length + 1)
      pics.push(await jpeg(scanned(empty, 0.2, false), 0.72))
    }
  }
  const file = await imagesToPdf(pics)
  const id = `f${cid()}`
  await putFile(id, file)
  const name = 'scan_batch_0420.pdf'
  const { thumb } = await thumbOf(id, file, name)
  return {
    id: cid(), file: { id, name, type: 'application/pdf', size: file.size, pages: pics.length }, thumb, by: s.me, added: new Date().toISOString(),
    state: 'manual', sample: true, mapped: true, suggest: { starts, blank, readings: papers.map(x => x.reading) },
    to: { company: s.company, kind: 'contract', title: 'scan_batch_0420', number: '', date: '', party: '', amount: '' },
  }
}
