// The ERP's server, for now only /api/scan (scan.ts). Runs on Node 22 or newer, with nothing to install:
//   OPENROUTER_API_KEY=… node server/main.ts
// The key comes from the environment, never from the code or the repository. PORT is 8787 unless set; Vite's dev and
// preview servers pass /api here (vite.config.ts). In production it sits behind the ERP's sign-in.
import { createServer } from 'node:http'
import { handleScan } from './scan.ts'

const port = Number(process.env.PORT) || 8787
/** Three pages of about 3 MB each, with room */
const LIMIT = 13_000_000

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  if (url.pathname !== '/api/scan') {
    res.writeHead(404).end()
    return
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > LIMIT) {
      res.writeHead(413).end()
      return
    }
    chunks.push(chunk)
  }
  const out = await handleScan(new Request(url, { method: req.method, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), process.env)
  res.writeHead(out.status, Object.fromEntries(out.headers))
  res.end(Buffer.from(await out.arrayBuffer()))
}).listen(port, () => console.log(`ERP server: http://localhost:${port}/api/scan`))
