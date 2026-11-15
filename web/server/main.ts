// The ERP's server on a machine of our own: /api (api.ts) with the shared database, the scan reader (scan.ts) and Ирц
// (timely.ts). Runs on Node 22.5 or newer, with nothing to install:
//   ERP_DB=erp.sqlite OPENROUTER_API_KEY=… TIMELY_API_KEYS=… node server/main.ts
// ERP_DB is the database's file (made when missing): with it people sign in here and share their data, and the files
// they add are kept in the folder beside it (ERP_DB with ".files", or ERP_FILES). Without it the server only reads
// scans and attendance, and each browser keeps its own data, as before. The keys come from the
// environment, never from the code or the repository. PORT is 8787 unless set; Vite's dev and preview servers pass
// /api here (vite.config.ts).
import { createServer } from 'node:http'
import { handleApi } from './api.ts'

const port = Number(process.env.PORT) || 8787
/** Three pages of about 3 MB each, with room; a file may be 25 MiB */
const LIMIT = 13_000_000
const FILE_LIMIT = 26_300_000
const DB = process.env.ERP_DB ? (await import('./sqlite.ts')).openDb(process.env.ERP_DB) : undefined
const FILES = process.env.ERP_DB ? (await import('./disk.ts')).diskFiles(process.env.ERP_FILES ?? `${process.env.ERP_DB}.files`) : undefined

createServer(async (req, res) => {
  // A request that cannot be read (a host or method a URL or Request will not take) is answered, never left to stop the server
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req as AsyncIterable<Buffer>) {
      size += chunk.length
      if (size > (url.pathname.startsWith('/api/files/') ? FILE_LIMIT : LIMIT)) {
        res.writeHead(413).end()
        return
      }
      chunks.push(chunk)
    }
    const headers = Object.fromEntries(Object.entries(req.headers).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])))
    const request = new Request(url, { method: req.method, headers, body: req.method === 'POST' || req.method === 'PUT' ? Buffer.concat(chunks) : undefined })
    const out = await handleApi(request, { ...process.env, DB, FILES })
    if (!out) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(out.status, Object.fromEntries(out.headers))
    res.end(Buffer.from(await out.arrayBuffer()))
  } catch {
    if (!res.headersSent) res.writeHead(400)
    res.end()
  }
}).listen(port, () => console.log(`ERP server: http://localhost:${port}/api${DB ? `, database ${process.env.ERP_DB}` : ''}`))
