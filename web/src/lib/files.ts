// Pictures and files of the boards. They are too big for the saved app state, so the browser keeps them in its
// file store (IndexedDB) and a card keeps only the file's id. Nothing leaves the device. Nothing is deleted from it
// either: an undo, another tab or a scan being added can still need a file that no saved record names.
import { useEffect, useState } from 'react'
import { toast } from './ui'

let db: Promise<IDBDatabase> | null = null
function open() {
  db ??= new Promise((ok, fail) => {
    const r = indexedDB.open('erp-files', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('files')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => fail(r.error)
  })
  return db
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await open()
  return new Promise((ok, fail) => {
    const tx = d.transaction('files', mode)
    const r = fn(tx.objectStore('files'))
    tx.oncomplete = () => ok(r.result)
    tx.onerror = tx.onabort = () => fail(tx.error ?? r.error)
  })
}

export const putFile = (id: string, blob: Blob) => run('readwrite', s => s.put(blob, id))
export const getFile = (id: string) => run<Blob | undefined>('readonly', s => s.get(id))

const urls = new Map<string, Promise<string | null>>()
/** A link to show a stored picture; null when the file is gone */
export function fileUrl(id: string) {
  let p = urls.get(id)
  if (!p) {
    p = getFile(id).then(b => (b ? URL.createObjectURL(b) : null)).catch(() => null)
    urls.set(id, p)
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
