// The files people add: a document's PDF, a picture in a chat, a lesson's material, a scan. The records (server/data.ts)
// carry only a file's id, name and size; the file itself is kept here, on Cloudflare in Workers KV and on a server of
// our own in a folder (server/disk.ts), and a browser fetches it when someone opens it (src/lib/files.ts).
//
// GET /api/files/ID   the file, for anyone signed in who has its id: an id is twelve random characters that reach a
//                     browser only inside a record its person may see. "Not changed" (304) when the browser's copy,
//                     named by `If-None-Match`, is still the one kept.
// PUT /api/files/ID   keeps the file. A file that is there already is replaced only by whoever put it there (a
//                     contract's Word file is saved again under its id).
import type { Id } from '../src/lib/types.ts'

/** What is kept with a file: its kind, who put it there, and a mark that changes each time it is replaced */
export interface About { type: string; by: Id; v: string }
export interface FileStore {
  /** The file, not yet read, and what is kept with it */
  get(id: string): Promise<{ body: ReadableStream | ArrayBuffer; about: About } | null>
  put(id: string, body: ArrayBuffer, about: About): Promise<void>
}

/** As much of a Workers KV namespace as is used here */
interface Kv {
  getWithMetadata(key: string, type: 'stream'): Promise<{ value: ReadableStream | null; metadata: unknown }>
  put(key: string, value: ArrayBuffer, options: { metadata: About }): Promise<void>
}
export const kvFiles = (kv: Kv): FileStore => ({
  async get(id) {
    const r = await kv.getWithMetadata(id, 'stream')
    return r.value ? { body: r.value, about: r.metadata as About } : null
  },
  put: (id, body, about) => kv.put(id, body, { metadata: about }),
})

/** Workers KV takes 25 MiB in one value: the screens let no larger file in but a lesson's video, which stays on its own device */
export const LARGEST = 25 * 1024 * 1024
const NAME = /^[A-Za-z0-9][\w.-]{0,119}$/
const said = (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
/** A body nobody will read is let go, so the store need not keep it open */
const drop = (body: ReadableStream | ArrayBuffer) => void (body instanceof ReadableStream && body.cancel().catch(() => {}))

export async function handleFiles(req: Request, store: FileStore, me: Id, id: string): Promise<Response> {
  if (!NAME.test(id)) return said('Хүсэлт буруу байна.', 400)
  if (req.method === 'GET') {
    const f = await store.get(id)
    if (!f) return said('Файл олдсонгүй.', 404)
    const tag = `"${f.about.v}"`
    // Kept by the browser that asked, and looked at again each time: a file may be replaced under its id
    const head = { ETag: tag, 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' }
    if (req.headers.get('if-none-match') === tag) return drop(f.body), new Response(null, { status: 304, headers: head })
    // As a download whatever it is, never as a page of ours: a file is opened by the app, which reads its bytes
    return new Response(f.body, { headers: { ...head, 'Content-Type': f.about.type || 'application/octet-stream', 'Content-Disposition': 'attachment' } })
  }
  if (req.method !== 'PUT') return said('Хүсэлт буруу байна.', 405)
  if (Number(req.headers.get('content-length')) > LARGEST) return said('Файл 25 MB-аас том байна.', 413)
  const body = await req.arrayBuffer()
  if (!body.byteLength || body.byteLength > LARGEST) return said(body.byteLength ? 'Файл 25 MB-аас том байна.' : 'Хүсэлт буруу байна.', body.byteLength ? 413 : 400)
  const was = await store.get(id)
  if (was) drop(was.body)
  if (was && was.about.by !== me) return said('Энэ файлыг өөр хүн оруулсан.', 409)
  const about: About = { type: (req.headers.get('content-type') ?? '').slice(0, 120), by: me, v: Date.now().toString(36) }
  await store.put(id, body, about)
  return new Response(JSON.stringify({ v: about.v }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
}
