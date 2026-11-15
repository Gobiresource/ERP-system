// Cloudflare's D1 through its web API, made to answer like the database the server speaks to (server/db.ts): for running
// the server's checks against the real thing before a deploy (scripts/server-test.ts --d1=NAME). D1 is SQLite with
// some functions switched off, so a query that passes on Node's SQLite may still fail there. The API key is the cloud
// session's own (its network proxy adds it; "via-proxy" stands in for it); Node goes through that proxy with
// NODE_USE_ENV_PROXY=1.
import type { Db, Stmt } from '../server/db.ts'

const API = 'https://api.cloudflare.com/client/v4'
const HEAD = { Authorization: 'Bearer via-proxy', 'Content-Type': 'application/json' }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let last = 0

/** One call, no more than about three a second (the API allows 1,200 in five minutes), and again when it says to slow down */
async function call(path: string, body?: unknown): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    await sleep(Math.max(0, last + 330 - Date.now()))
    last = Date.now()
    const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: HEAD, body: body ? JSON.stringify(body) : undefined })
    const j = (await r.json().catch(() => null)) as { success: boolean; errors?: { message: string }[]; result: unknown } | null
    if (j?.success) return j.result
    const why = j?.errors?.[0]?.message ?? `Cloudflare ${r.status}`
    if (attempt >= 6 || !(r.status === 429 || /throttl|wait/i.test(why))) throw new Error(why)
    await sleep(20_000)
  }
}

/** The database of this name. Only one made for tests (a name ending in "-test"): the checks write and found a system in it. */
export async function restDb(name: string): Promise<Db> {
  if (!name.endsWith('-test')) throw new Error('Only a test database: its name must end in "-test".')
  const account = ((await call('/accounts')) as { id: string }[])[0].id
  const found = ((await call(`/accounts/${account}/d1/database`)) as { name: string; uuid: string }[]).find(d => d.name === name)
  if (!found) throw new Error(`No D1 database named ${name}.`)
  const query = (body: unknown) => call(`/accounts/${account}/d1/database/${found.uuid}/query`, body) as Promise<{ results: unknown[] }[]>
  const stmt = (sql: string, params: unknown[] = []): Stmt & { q: { sql: string; params: unknown[] } } => ({
    q: { sql, params },
    bind: (...a) => stmt(sql, a),
    all: async () => (await query({ sql, params }))[0] as never,
  })
  // Empty at the start: whatever an earlier run left is dropped (a test database only, by the name)
  await query({ sql: 'DROP TABLE IF EXISTS rows; DROP TABLE IF EXISTS accounts; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS meta' })
  return { prepare: sql => stmt(sql), batch: stmts => query({ batch: stmts.map(s => (s as ReturnType<typeof stmt>).q) }) }
}
