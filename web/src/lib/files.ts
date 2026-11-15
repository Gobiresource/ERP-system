// Pictures and files: a document's PDF, a picture on a board or in a chat, a lesson's material, a scan. They are too
// big for the app's state, so a record keeps only the file's id and the file itself lives in a file store.
//
// Without a server the browser's own store (IndexedDB) is the only place a file is: nothing leaves the device, and
// nothing is deleted from it either (an undo, another tab or a scan being added can still need a file no record names).
//
// With a server behind the app (lib/sync.ts) the files are kept there (server/files.ts), so that everyone who may see a
// record can open its file. A file added here goes up as soon as it can, and waits when the connection is down; a file
// someone else added comes down the first time it is opened. This browser keeps a copy of both, in a store of its own
// that is emptied when the person signs out, and asks the server each time the page is opened whether its copy is
// still the one kept: a file can be replaced under its id (a contract's Word file).
import { useEffect, useState } from 'react'
import { link, tell } from './sync'
import { toast } from './ui'

/** The store of a browser that works alone, and apart from it the copies of a browser that works with a server */
const storeName = () => (link.on ? 'erp-cache' : 'erp-files')
let db: Promise<IDBDatabase> | null = null
function open(again = true): Promise<IDBDatabase> {
  db ??= new Promise((ok, fail) => {
    const r = indexedDB.open(storeName(), 1)
    r.onupgradeneeded = () => r.result.createObjectStore('files')
    r.onsuccess = () => {
      if (r.result.objectStoreNames.contains('files') || !again) return ok(r.result)
      // A store left half made (it has no place for files): made afresh, once
      r.result.close()
      const gone = indexedDB.deleteDatabase(storeName())
      gone.onsuccess = gone.onerror = () => { db = null; open(false).then(ok, fail) }
    }
    r.onerror = () => fail(r.error)
  })
  return db
}

/** What to say of a file that cannot be shown */
export const fileMissing = () => (link.on ? 'Файл хараахан хуулагдаж дуусаагүй байна. Түр хүлээгээд дахин нээнэ үү.' : 'Файл олдсонгүй. Өөр төхөөрөмж эсвэл хөтөч дээр нэмсэн байж магадгүй.')

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await open()
  return new Promise((ok, fail) => {
    const tx = d.transaction('files', mode)
    const r = fn(tx.objectStore('files'))
    tx.oncomplete = () => ok(r.result)
    tx.onerror = tx.onabort = () => fail(tx.error ?? r.error)
  })
}
const local = (id: string) => run<Blob | undefined>('readonly', s => s.get(id))
/** The mark of the server's copy this browser holds (server/files.ts `v`), kept beside the file */
const markOf = (id: string) => `${id}?v`

// Going up to the server

/** Workers KV takes 25 MiB in one value (server/files.ts) */
const LARGEST = 25 * 1024 * 1024
/** The same file is sent again at most this often: a Word file is saved every second or so while someone writes */
const AGAIN = 30_000
const WAITING = 'erp:uploads'
const waiting = (): string[] => {
  try { return JSON.parse(localStorage.getItem(WAITING) ?? '[]') } catch { return [] }
}
const keepWaiting = (ids: string[]) => {
  try { localStorage.setItem(WAITING, JSON.stringify(ids)) } catch { /* private window: they go up while the page is open */ }
}
/**
 * When each file was last looked at with the server: for a minute after, the copy here is taken as the one kept there.
 * Not for longer: a file can be replaced under its id, and whoever opens it again must get the new one.
 */
const checked = new Map<string, number>()
const FRESH = 60_000
const isFresh = (id: string) => Date.now() - (checked.get(id) ?? -FRESH) < FRESH
/** How many times each file was saved here, and when it last went up */
const saves = new Map<string, number>()
const sent = new Map<string, number>()
let sending = false
let later = 0

/** Sends the files that wait, one after another. One that cannot go now is tried again; one that never can is let be. */
async function sendWaiting() {
  if (sending || !link.on) return
  sending = true
  clearTimeout(later)
  let retry = 0
  const tried = new Set<string>()
  try {
    for (const id of waiting()) {
      tried.add(id)
      const wait = (sent.get(id) ?? 0) + AGAIN - Date.now()
      if (wait > 0) { retry = Math.max(retry, wait); continue }
      const [blob, save] = [await local(id).catch(() => undefined), saves.get(id)]
      let done = !blob
      if (blob && blob.size > LARGEST) {
        done = true
        toast('25 MB-аас том файл бусдад харагдахгүй. Зөвхөн энэ төхөөрөмж дээр нээгдэнэ.', { kind: 'warn' })
      } else if (blob) {
        const r = await fetch(`/api/files/${id}`, { method: 'PUT', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob, signal: AbortSignal.timeout(300_000) }).catch(() => null)
        if (r?.ok) {
          const v = (await r.json().catch(() => null))?.v
          if (v) await run('readwrite', s => s.put(`"${v}"`, markOf(id))).catch(() => {})
          sent.set(id, Date.now())
          checked.set(id, Date.now())
          // Saved again while it went up: it goes once more, a little later
          done = saves.get(id) === save
          if (!done) retry = Math.max(retry, AGAIN)
        } else if (r?.status === 401) break // signed out: they wait for whoever signs in next
        // Refused for good (too large, someone else's, no file store): it stays on this device only
        else if (r && [400, 404, 409, 413].includes(r.status)) done = true
        else retry = Math.max(retry, 20_000)
      }
      if (done) keepWaiting(waiting().filter(x => x !== id))
    }
  } finally {
    sending = false
  }
  // A file added while these went up has not had its turn: it goes at once
  if (waiting().some(id => !tried.has(id))) later = window.setTimeout(() => void sendWaiting(), 0)
  else if (retry) later = window.setTimeout(() => void sendWaiting(), retry)
}
// What waited when the page was closed, or while nobody was signed in, goes up once someone is; and when the
// connection comes back
tell.in = () => void sendWaiting()
addEventListener('online', () => void sendWaiting())

export async function putFile(id: string, blob: Blob) {
  await run('readwrite', s => s.put(blob, id))
  if (!link.on) return
  saves.set(id, (saves.get(id) ?? 0) + 1)
  if (!waiting().includes(id)) keepWaiting([...waiting(), id])
  void sendWaiting()
}

// Coming down from the server

const fetching = new Map<string, Promise<Blob | undefined>>()
/** The server's copy, when this browser has none or an older one; else the copy here */
async function fresh(id: string): Promise<Blob | undefined> {
  const had = await local(id).catch(() => undefined)
  try {
    const mark = had && (await run<string | undefined>('readonly', s => s.get(markOf(id))))
    const r = await fetch(`/api/files/${id}`, { headers: mark ? { 'If-None-Match': mark } : {}, signal: AbortSignal.timeout(300_000) })
    if (r.status === 304) return checked.set(id, Date.now()), had
    if (!r.ok) return had // not there (yet), or no answer: what is here, if anything
    const blob = await r.blob()
    await run('readwrite', s => s.put(blob, id))
    await run('readwrite', s => s.put(r.headers.get('etag') ?? '', markOf(id)))
    checked.set(id, Date.now())
    return blob
  } catch {
    return had
  }
}

export function getFile(id: string): Promise<Blob | undefined> {
  // This browser's own copy is the file: without a server, just looked at with the server, or while it waits to go up
  if (!link.on || isFresh(id) || waiting().includes(id)) return local(id)
  let p = fetching.get(id)
  if (!p) {
    p = fresh(id).finally(() => fetching.delete(id))
    fetching.set(id, p)
  }
  return p
}

const urls = new Map<string, Promise<string | null>>()
/** A link to show a stored picture; null when the file is gone */
export function fileUrl(id: string) {
  let p = urls.get(id)
  if (!p) {
    p = getFile(id).then(b => (b ? URL.createObjectURL(b) : null)).catch(() => null)
    urls.set(id, p)
    // With a server a file not there yet may still come (its owner's browser is sending it): asked for again next time
    if (link.on) void p.then(u => u === null && urls.delete(id))
  }
  return p
}
/** undefined while loading */
export function useFileUrl(id: string) {
  const [url, setUrl] = useState<{ id: string; url: string | null }>()
  useEffect(() => {
    let live = true
    fileUrl(id).then(u => live && setUrl({ id, url: u }))
    return () => { live = false }
  }, [id])
  return url?.id === id ? url.url : undefined
}

// Signed out (lib/sync.ts): the copies leave this browser with the data. Files still waiting to go up stay until they have.
tell.out = () => {
  urls.clear()
  checked.clear()
  if (waiting().length) return
  const was = db
  db = null
  void Promise.resolve(was).then(d => d?.close(), () => {}).then(() => indexedDB.deleteDatabase('erp-cache'))
}

/** Saves a file to the device. A preview frame blocks downloads, so it says so instead of doing nothing. */
export function saveBlob(name: string, blob: Blob) {
  if (window.self !== window.top) return toast('Энэ туршилтын хуудаснаас файл татах боломжгүй. Үндсэн систем дээр ажиллана.', { kind: 'info' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
