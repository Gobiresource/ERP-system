// The files people add, on a server of our own: one folder, each file under its id with a small note beside it (who put
// it there, its kind). Only server/main.ts loads this file; on Cloudflare the files are in Workers KV (server/files.ts).
import { mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { About, FileStore } from './files.ts'

export function diskFiles(dir: string): FileStore {
  mkdirSync(dir, { recursive: true })
  // An id is letters, figures, dot, dash and underscore, beginning with a letter or figure (files.ts): safe as a name
  const at = (id: string) => join(dir, id)
  return {
    async get(id) {
      try {
        const [body, about] = await Promise.all([readFile(at(id)), readFile(`${at(id)}.about`, 'utf8')])
        return { body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer, about: JSON.parse(about) as About }
      } catch {
        return null
      }
    },
    async put(id, body, about) {
      await writeFile(at(id), Buffer.from(body))
      await writeFile(`${at(id)}.about`, JSON.stringify(about))
    },
  }
}
