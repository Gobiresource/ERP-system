// Scanned papers → what they are. The office uploads scans in Бичиг хэрэг; the browser sends a few pages as pictures,
// and this asks a vision model through OpenRouter which of our ХХК the paper belongs to, what kind it is, its title,
// number, date, other side and sum (docs/decisions.md, 2026-10-30). A stack scanned into one file is split first: small
// pictures of its pages, and AI says where each paper begins and which pages are blank. The key stays here, never in the browser.
// Only endpoints that keep nothing are used (provider.zdr), and none that may collect the data for training.
// Web-standard Request and Response only, so the same code runs on Node (main.ts), Cloudflare Workers or Deno.
import type { ContractType, DocKind, ScanReading } from '../src/lib/types.ts'

export interface ScanEnv {
  OPENROUTER_API_KEY?: string
  /** Comma separated; the first is asked, the next ones only when it fails */
  OPENROUTER_MODELS?: string
}

/** Both read Mongolian well and keep nothing on these routes; the cheapest that does it right goes first (to be measured) */
export const DEFAULT_MODELS = ['google/gemini-3.1-flash-lite', 'anthropic/claude-haiku-5.5']
const KINDS: DocKind[] = ['contract', 'order', 'certificate', 'rule', 'decision', 'letter', 'form', 'template']
const TYPES: ContractType[] = ['work', 'sale', 'service', 'lease', 'employment']
/** Pages read of each paper: the browser picks the first ones and the last (signatures, stamps) */
export const MAX_PAGES = 3
/** Characters of one page's data URL, about 3 MB */
const MAX_PAGE = 4_000_000
/** Small page pictures looked at in one go when splitting a stack, and their size */
export const MAX_SPLIT = 17
const MAX_SMALL = 1_500_000

/**
 * What the browser sends: page pictures as data URLs, the file's name, and our companies to tell which one it is. To
 * split a stack (`task: 'split'`): the pictures are pages `first`, `first + 1`…; with `context`, the first of them is
 * the last page of the part before, shown only to tell whether the next one goes on with it.
 */
export interface ScanRequest { task?: 'read' | 'split'; pages: string[]; name: string; companies: { id: string; name: string }[]; first?: number; context?: boolean }
export interface ScanResponse { reading: ScanReading; model: string; cost: number | null }
export interface SplitResponse { starts: number[]; blank: number[]; model: string; cost: number | null }

const text = (description: string) => ({ type: 'string', description })
const maybe = (description: string) => ({ type: ['string', 'null'], description })
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'contractType', 'company', 'title', 'number', 'date', 'parties', 'amount', 'currency', 'expires', 'summary', 'confidence', 'notes'],
  properties: {
    kind: { type: 'string', enum: KINDS },
    contractType: { type: ['string', 'null'], enum: [...TYPES, null] },
    company: maybe('Id of our company that issued or signed it, from the list; null if none of ours'),
    title: text('The title as written, under 80 characters'),
    number: maybe('The number as written, without the № sign'),
    date: maybe('Signing or issue date, YYYY-MM-DD'),
    parties: { type: 'array', items: { type: 'string' }, description: 'The other parties, not ours, as written' },
    amount: { type: ['number', 'null'], description: 'Total value, digits only' },
    currency: maybe('MNT, USD, CNY…'),
    expires: maybe('End of validity, YYYY-MM-DD'),
    summary: text('One sentence in Mongolian: what it is about'),
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    notes: maybe('A short note in Mongolian for the clerk when something needs checking'),
  },
}

const SPLIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['starts', 'blank'],
  properties: {
    starts: { type: 'array', items: { type: 'integer' }, description: 'Page numbers where a new paper begins' },
    blank: { type: 'array', items: { type: 'integer' }, description: 'Page numbers that are blank' },
  },
}

const SPLIT_PROMPT = `These pictures are pages of a stack of office papers of a Mongolian company, scanned together in order. Tell where each paper begins.
- A page begins a new paper when it has its own heading (ГЭРЭЭ, ТУШААЛ, ШИЙДВЭР, АЛБАН БИЧИГ, a letterhead with a new number and date) or its page numbering starts again at 1.
- A page goes on with the paper before it when its text continues, when it holds the signatures and stamps, or when it is that paper's appendix (хавсралт).
- A page is blank when it shows nothing but scanner noise, often the empty back of a sheet.
Each picture comes after its page number. List the page numbers that begin a paper, and those that are blank.`

const prompt = (companies: ScanRequest['companies']) => `You read scanned office papers of a Mongolian group of companies. They are mostly in Cyrillic Mongolian, sometimes English, Russian or Chinese. From the page pictures, fill in the JSON.

Our companies (id: name):
${companies.map(c => `${c.id}: ${c.name}`).join('\n') || '(none given)'}

- kind: contract (гэрээ of any sort, also нэмэлт гэрээ and санамж бичиг), order (тушаал), certificate (тодорхойлолт, гэрчилгээ, акт), rule (журам, дүрэм, заавар), decision (шийдвэр, тогтоол), letter (албан бичиг), form (маягт, анкет, хүсэлт), template (blank sample).
- contractType, for contracts only: work (ажил гүйцэтгэх), sale (худалдах, худалдан авах, нийлүүлэх), service (үйлчилгээ), lease (түрээс), employment (хөдөлмөрийн гэрээ); null when none fits or it is not a contract.
- company: the id of OUR company that issued or signed it. Match the name even when written differently (Говь Ресурс ХХК, "ГОВЬ РЕСУРС" ХХК, Gobi Resource LLC). null when none of ours appears.
- title: the paper's own title; when it has none, "<kind> — <other party>".
- number: exactly as written (e.g. ГР-2024/015, 24/07), without "№"; null if none.
- date: when it was signed or issued. "2024 оны 3 дугаар сарын 12" and "2024.03.12" are 2024-03-12. null if unreadable.
- parties: the other sides only, as written.
- amount: the total sum in figures, without separators; null if none. currency: MNT for төгрөг.
- expires: the end of validity when stated; null otherwise.
- summary: one plain Mongolian sentence.
- confidence: high when the text is clear and the key fields are there; medium when some are guessed; low when unreadable or not an office paper.
- notes: Mongolian, short, only when the clerk should check something (no signature or stamp, pages seem missing, two papers in one file); else null.
Never invent a value: what the pages do not show is null.`

/** OpenRouter's refusals in the office's words; any other passes on as OpenRouter puts it */
const REFUSED: Record<number, string> = {
  401: 'AI түлхүүр буруу байна. Серверийн тохиргоог шалгана уу.',
  402: 'AI үйлчилгээний үлдэгдэл дууссан байна. Цэнэглэх хүртэл гараар бөглөнө үү.',
  429: 'AI ачаалалтай байна. Түр хүлээгээд дахин оролдоно уу.',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

export async function handleScan(req: Request, env: ScanEnv): Promise<Response> {
  const models = (env.OPENROUTER_MODELS || DEFAULT_MODELS.join(',')).split(',').map(m => m.trim()).filter(Boolean)
  if (req.method === 'GET') return json({ ready: !!env.OPENROUTER_API_KEY, model: models[0] })
  if (req.method !== 'POST') return json({ error: 'Зөвхөн POST.' }, 405)
  if (!env.OPENROUTER_API_KEY) return json({ error: 'AI түлхүүр тохируулаагүй байна.' }, 503)
  let body: Partial<ScanRequest>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Хүсэлт буруу байна.' }, 400)
  }
  const split = body.task === 'split'
  const pages = Array.isArray(body.pages) ? body.pages.slice(0, split ? MAX_SPLIT : MAX_PAGES) : []
  if (!pages.length || pages.some(p => typeof p !== 'string' || p.length > (split ? MAX_SMALL : MAX_PAGE) || !/^data:image\/(jpeg|png|webp);base64,/.test(p))) {
    return json({ error: 'Хуудасны зургийг уншиж чадсангүй.' }, 400)
  }
  const companies = (Array.isArray(body.companies) ? body.companies : []).filter(c => typeof c?.id === 'string' && typeof c?.name === 'string').slice(0, 50)
  try {
    if (split) return json(await splitStack(env.OPENROUTER_API_KEY, models, pages, Math.max(1, Math.floor(Number(body.first) || 1)), body.context === true))
    return json(await read(env.OPENROUTER_API_KEY, models, pages, companies, String(body.name ?? '').slice(0, 200)))
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'AI хариу өгсөнгүй.' }, 502)
  }
}

async function read(key: string, models: string[], pages: string[], companies: ScanRequest['companies'], name: string): Promise<ScanResponse> {
  const user = [{ type: 'text', text: `File: ${name || 'unnamed'}. Pages shown: ${pages.length}.` }, ...pages.map(url => ({ type: 'image_url', image_url: { url } }))]
  const r = await ask(key, models, prompt(companies), user, 'scan_reading', SCHEMA)
  return { reading: tidy(r.raw, companies), model: r.model, cost: r.cost }
}

async function splitStack(key: string, models: string[], pages: string[], first: number, context: boolean): Promise<SplitResponse> {
  const user = pages.flatMap((url, i) => [
    { type: 'text', text: context && i === 0 ? `Page ${first} (the end of the part before; only to tell whether page ${first + 1} goes on with it)` : `Page ${first + i}` },
    { type: 'image_url', image_url: { url } },
  ])
  const r = await ask(key, models, SPLIT_PROMPT, user, 'stack_split', SPLIT_SCHEMA)
  return { ...tidySplit(r.raw, context ? first + 1 : first, first + pages.length - 1), model: r.model, cost: r.cost }
}

/** Page numbers from `lo` to `hi` only, once each, in order */
export function tidySplit(raw: Record<string, unknown>, lo: number, hi: number) {
  const pick = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).filter((n): n is number => Number.isInteger(n) && n >= lo && n <= hi))].sort((a, b) => a - b)
  return { starts: pick(raw.starts), blank: pick(raw.blank) }
}

/** One question to a vision model, answered in the shape of `schema` */
async function ask(key: string, models: string[], system: string, user: unknown[], name: string, schema: object) {
  const body = JSON.stringify({
    models,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
    provider: { zdr: true, data_collection: 'deny', require_parameters: true },
    reasoning: { effort: 'low' },
    max_tokens: 2000,
  })
  // Once more after a short wait when OpenRouter is busy or a provider fails
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Pane ERP' },
      body,
      signal: AbortSignal.timeout(90_000),
    })
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await new Promise(r => setTimeout(r, 2000))
      continue
    }
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(REFUSED[res.status] ?? data?.error?.message ?? `OpenRouter: ${res.status}`)
    const content: unknown = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new Error('AI хариу өгсөнгүй.')
    // Some models wrap the JSON in a code fence even when asked not to
    const raw: Record<string, unknown> = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''))
    return { raw, model: String(data.model ?? models[0]), cost: typeof data.usage?.cost === 'number' ? (data.usage.cost as number) : null }
  }
}

/** Keeps what fits the shape and drops the rest, so a model's slip cannot put nonsense into a folder */
export function tidy(raw: Record<string, unknown>, companies: ScanRequest['companies']): ScanReading {
  const str = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null)
  const kind = KINDS.includes(raw.kind as DocKind) ? (raw.kind as DocKind) : 'letter'
  const amount = typeof raw.amount === 'number' && Number.isFinite(raw.amount) && raw.amount >= 0 ? raw.amount : null
  return {
    kind,
    contractType: kind === 'contract' && TYPES.includes(raw.contractType as ContractType) ? (raw.contractType as ContractType) : null,
    company: companies.some(c => c.id === raw.company) ? (raw.company as string) : null,
    title: str(raw.title, 120) ?? 'Нэргүй баримт',
    number: str(raw.number, 60)?.replace(/^№\s*/, '') ?? null,
    date: day(raw.date),
    parties: Array.isArray(raw.parties) ? raw.parties.map(p => str(p, 120)).filter((p): p is string => !!p).slice(0, 5) : [],
    amount,
    currency: amount === null ? null : str(raw.currency, 8),
    expires: day(raw.expires),
    summary: str(raw.summary, 300) ?? '',
    confidence: raw.confidence === 'high' || raw.confidence === 'medium' ? raw.confidence : 'low',
    notes: str(raw.notes, 300),
  }
}
