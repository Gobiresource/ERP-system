// The ERP's server on a machine of our own: /api (api.ts) with the shared database, the scan reader (scan.ts) and Ирц
// (timely.ts). Runs on Node 22.5 or newer, with nothing to install:
//   ERP_DB=erp.sqlite OPENROUTER_API_KEY=… TIMELY_API_KEYS=… node server/main.ts
// ERP_DB is the database's file (made when missing): with it people sign in here and share their data, and the files
// they add are kept in the folder beside it (ERP_DB with ".files", or ERP_FILES). Without it the server only reads
// scans and attendance, and each browser keeps its own data, as before. The keys come from the
// environment, never from the code or the repository. PORT is 8787 unless set; Vite's dev and preview servers pass
// /api here (vite.config.ts).
// On a server of our own (a VPS) it stands alone. ERP_DIST names the built app (dist), served the way worker/site.js
// serves it on Cloudflare. With ERP_PROXY=1 it listens only on this machine, to the proxy in front that adds HTTPS
// and says so (X-Forwarded-Proto): a sign-in cookie made over HTTPS is then marked Secure (api.ts).
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, sep } from 'node:path'
import { handleApi } from './api.ts'

const port = Number(process.env.PORT) || 8787
/** Three pages of about 3 MB each, with room; a file may be 25 MiB */
const LIMIT = 13_000_000
const FILE_LIMIT = 26_300_000
const DB = process.env.ERP_DB ? (await import('./sqlite.ts')).openDb(process.env.ERP_DB) : undefined
const FILES = process.env.ERP_DB ? (await import('./disk.ts')).diskFiles(process.env.ERP_FILES ?? `${process.env.ERP_DB}.files`) : undefined
const DIST = process.env.ERP_DIST ? resolve(process.env.ERP_DIST) : undefined
const PROXY = process.env.ERP_PROXY === '1'
const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json',
  webp: 'image/webp', png: 'image/png', svg: 'image/svg+xml', ico: 'image/x-icon', woff2: 'font/woff2',
}

/** A file of the built app, as worker/site.js answers it. The app keeps its pages in the address hash, so any other
 *  path, and any path that would lead out of the folder, is the page itself. */
async function page(dist: string, pathname: string) {
  const asked = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html'
  let name = resolve(dist, asked).startsWith(dist + sep) ? asked : 'index.html'
  let file = await readFile(resolve(dist, name)).catch(() => null)
  if (!file && name !== 'index.html') file = await readFile(resolve(dist, (name = 'index.html'))).catch(() => null)
  if (!file) return null
  // The page is told that a server stands behind it, so it never falls back to keeping data in the browser alone
  const body = name === 'index.html' && DB ? file.toString('utf8').replace('<html', '<html data-server') : file
  const headers = {
    'content-type': TYPES[name.split('.').pop() ?? ''] ?? 'application/octet-stream',
    // Built files carry their hash in the name and never change; the page itself is asked for again each time
    'cache-control': name.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  }
  return { body, headers }
}

createServer(async (req, res) => {
  // A request that cannot be read (a host or method a URL or Request will not take) is answered, never left to stop the server
  try {
    const proto = PROXY && req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
    const url = new URL(req.url ?? '/', `${proto}://${req.headers.host ?? 'localhost'}`)
    if (DIST && !url.pathname.startsWith('/api/')) {
      const p = await page(DIST, url.pathname)
      if (!p) res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Олдсонгүй.')
      else res.writeHead(200, p.headers).end(p.body)
      return
    }
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
}).listen(port, PROXY ? '127.0.0.1' : undefined, () =>
  console.log(`ERP server: http://localhost:${port}/api${DB ? `, database ${process.env.ERP_DB}` : ''}${DIST ? `, app ${DIST}` : ''}`),
)
