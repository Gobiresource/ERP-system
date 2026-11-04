// The ERP's server, for now /api/scan (scan.ts) and /api/attendance (timely.ts). Runs on Node 22 or newer, with nothing
// to install:
//   OPENROUTER_API_KEY=… TIMELY_API_KEYS=… node server/main.ts
// The keys come from the environment, never from the code or the repository. PORT is 8787 unless set; Vite's dev and
// preview servers pass /api here (vite.config.ts). In production it sits behind the ERP's sign-in.
import { createServer } from 'node:http'
import { handleScan } from './scan.ts'
import { handleAttendance } from './timely.ts'

const port = Number(process.env.PORT) || 8787
/** Three pages of about 3 MB each, with room */
const LIMIT = 13_000_000

createServer(async (req, res) => {
  // A request that cannot be read (a host or method a URL or Request will not take) is answered, never left to stop the server
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const send = async (out: Response) => {
      res.writeHead(out.status, Object.fromEntries(out.headers))
      res.end(Buffer.from(await out.arrayBuffer()))
    }
    const attendance = url.pathname === '/api/attendance' || url.pathname.startsWith('/api/attendance/')
    if (!attendance && url.pathname !== '/api/scan') {
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
    // The cookie carries Ирц's door (timely.ts)
    const request = new Request(url, { method: req.method, headers: { cookie: req.headers.cookie ?? '' }, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined })
    await send(await (attendance ? handleAttendance(request, process.env) : handleScan(request, process.env)))
  } catch {
    if (!res.headersSent) res.writeHead(400)
    res.end()
  }
}).listen(port, () => console.log(`ERP server: http://localhost:${port}/api`))
