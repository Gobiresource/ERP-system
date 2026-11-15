// What every browser shares (docs/decisions.md, 2026-11-15): a browser asks for what changed since the last change it
// saw and sends its own changes (src/lib/sync.ts). Each record is a row of JSON (server/db.ts); who gets it and who may
// change it is server/rules.ts's to say.
import { all, type Db, type Row, type Stmt } from './db.ts'
import { NO, ORG, cols, ctxOf, may, scopeOf, see, type Ctx, type Org } from './rules.ts'
import { apply, safe, type Op } from '../src/lib/patch.ts'
import { TABLES, idOf, isList, isTable, type Table } from '../src/lib/tables.ts'
import type { Chat, Id, Person } from '../src/lib/types.ts'

type OrgTable = (typeof ORG)[number]
/**
 * The organisation as the rules read it. A running server keeps it between requests and reads only what changed since
 * (a handful of rows, by the index); a fresh one reads these tables whole, not the rest of the data.
 */
interface World { seq: number; recs: Map<string, Map<Id, unknown>>; org: Org; scopes: Map<Id, string> }
const worlds = new WeakMap<Db, World>()
/** Our own table names, so safe to write into a query */
const named = (tables: readonly string[]) => tables.map(c => `'${c}'`).join(',')

export async function worldOf(db: Db): Promise<World> {
  let w = worlds.get(db)
  if (!w) worlds.set(db, (w = { seq: 0, recs: new Map(ORG.map(c => [c, new Map()])), org: orgOf(new Map()), scopes: new Map() }))
  const rows = await all<Row>(db, `SELECT c, id, data, seq FROM rows WHERE c IN (${named(ORG)}) AND seq > ?`, w.seq)
  for (const r of rows) {
    if (r.data === null) w.recs.get(r.c)!.delete(r.id)
    else w.recs.get(r.c)!.set(r.id, JSON.parse(r.data))
    w.seq = Math.max(w.seq, r.seq)
  }
  if (rows.length) [w.org, w.scopes] = [orgOf(w.recs), new Map()]
  return w
}
function orgOf(recs: World['recs']): Org {
  const list = (c: OrgTable) => [...(recs.get(c)?.values() ?? [])]
  const map = (c: OrgTable) => Object.fromEntries(recs.get(c) ?? [])
  return { people: list('people'), companies: list('companies'), employees: list('employees'), departments: list('departments'), chats: list('chats'), roles: map('roles'), timely: map('timely') } as Org
}
/** The person asking, by today's organisation; null when they may not sign in (any more) */
export const ctxFor = (w: World, me: Id) => ctxOf(w.org, me, (c, id) => w.recs.get(c)?.get(id) as never)

/** Tables whose records never change hands: what is not the person's never was, so they need not hear of it */
const QUIET: Table[] = ['messages', 'notices', 'drafts', 'focusLog', 'toursDone']
const reach = (x: Ctx, c: Table, r: Row) => (c === 'messages' ? x.chats.has(r.k) : c === 'toursDone' ? r.id === x.me : r.k === x.me)

/**
 * A row as the browser gets it: [table, id, place in its list, the record or null when it is gone or not theirs]. In an
 * answer with everything (`full`) what is not theirs is left out: the browser drops whatever such an answer does not
 * name, and nobody need learn which records there are beyond their reach.
 */
function line(x: Ctx, r: Row, always = false, full = false): string | null {
  const c = r.c as Table
  let v: string | null = null
  // A record the rules cannot read must not stop everyone's work
  try { v = see(x, c, r) } catch { /* not sent */ }
  if (v === null && !always && (full || QUIET.includes(c)) && !(r.data === null && reach(x, c, r))) return null
  return `[${JSON.stringify(c)},${JSON.stringify(r.id)},${r.pos},${v ?? 'null'}]`
}

/**
 * What changed since change number `since`, as its person may see it; everything, when the browser starts (`since` 0),
 * when what the person may see has changed (`scope`, rules.ts), or when they were added to a chat that already had
 * messages. With `refused`, the changes of theirs that were not taken: those records come whatever their number, so the
 * browser puts them back as they are here.
 */
export async function pull(db: Db, w: World, x: Ctx, since: number, scope: string, refused: Refused[] = []): Promise<string> {
  // Worked out once for each state of the organisation, not at every question. Should the organisation's records ever
  // be such that it cannot be worked out, the person still gets their data: only the "everything afresh" is lost.
  let key = w.scopes.get(x.me)
  if (key === undefined) {
    try { key = scopeOf(x) } catch { key = '?' }
    w.scopes.set(x.me, key)
  }
  // The counter first: a change made while the rows are read comes again next time, never too late
  const [now, again] = await db.batch([db.prepare(`SELECT v FROM meta WHERE k = 'seq'`), db.prepare(`SELECT v FROM meta WHERE k = ?`).bind(`again:${x.me}`)])
  const seq = Number((now.results[0] as { v: number } | undefined)?.v ?? 0)
  const full = !since || scope !== key || Number((again.results[0] as { v: number } | undefined)?.v ?? 0) > since
  const rows = await all<Row>(db, `SELECT c, id, co, k, pos, data, seq FROM rows WHERE c IN (${named(TABLES)}) AND ${full ? 'data IS NOT NULL' : 'seq > ?'}`, ...(full ? [] : [since]))
  const lines = rows.map(r => line(x, r, false, full)).filter(l => l !== null)
  if (refused.length) {
    const back = await all<Row>(db, `SELECT r.c, r.id, r.co, r.k, r.pos, r.data, r.seq FROM json_each(?) AS j JOIN rows AS r ON r.c = j.value->>0 AND r.id = j.value->>1`, JSON.stringify(refused))
    // Last, so that they are what the browser ends with; a refused new record has no row, and goes
    for (const [c, id] of refused) {
      const r = back.find(b => b.c === c && b.id === id)
      lines.push(r ? line(x, r, true)! : `[${JSON.stringify(c)},${JSON.stringify(id)},0,null]`)
    }
  }
  return `{"seq":${seq},"scope":${JSON.stringify(key)},"full":${full},"rows":[${lines.join(',')}],"refused":${JSON.stringify(refused)}}`
}

/** One record's change from a browser: the places that changed (src/lib/patch.ts), its removal, or its new place in the list */
export interface Change { c: Table; id: Id; ops?: Op[]; gone?: true; pos?: number }
export type Refused = [c: Table, id: Id, why: string]

const TOO_MANY = 500
/** A record's JSON in bytes. The database takes 2 MB in one value; a row goes in inside a list of rows, which adds to it. */
const TOO_BIG = 1_200_000
/** As many rows as go into the database in one value */
const LOAD = 1_500_000
const bytes = (text: string) => new TextEncoder().encode(text).length
const BUSY = 'Өөр хүн зэрэг өөрчилсөн тул зарим өөрчлөлт хадгалагдсангүй. Дахин оролдоно уу.'
const BAD = 'Өөрчлөлтийг хадгалж чадсангүй. Дахин оролдоно уу.'

const text = (v: unknown): v is string => typeof v === 'string'
const texts = (v: unknown): v is string[] => Array.isArray(v) && v.every(text)
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
/** The organisation's records are read by every rule, so a misshapen one must never get in */
function shaped(c: Table, id: Id, r: unknown): boolean {
  if (c === 'timely') return Number.isInteger(r)
  if (c === 'toursDone') return texts(r)
  if (!obj(r)) return false
  if (c === 'roles') return Object.values(r).every(text)
  if (c === 'kpi') return Array.isArray(r.criteria) && Array.isArray(r.bands)
  if (idOf(c, r) !== id) return false
  if (c === 'people') return texts(r.companies) && (r.account === undefined || (obj(r.account) && text(r.account.login) && typeof r.account.active === 'boolean' && obj(r.account.access) && Object.values(r.account.access).every(obj) && !('hash' in r.account) && !('salt' in r.account)))
  if (c === 'chats') return texts(r.members) && text(r.by) && obj(r.read)
  if (c === 'employees') return text(r.company) && text(r.status) && text(r.dept) && Array.isArray(r.moves) && Array.isArray(r.files) && obj(r.contract) && !r.card
  if (c === 'departments' || c === 'companies') return text(r.name)
  return true
}

/** Statements a change to the organisation brings with it, run with it or not at all */
async function sideOf(db: Db, c: Table, id: Id, old: unknown, next: unknown): Promise<{ stmts: Stmt[]; why?: string }> {
  const stmts: Stmt[] = []
  if (c === 'people' && old && next) {
    const [a, b] = [(old as Person).account, (next as Person).account]
    if (a && b && a.login !== b.login) {
      // The login is what the person signs in with (accounts): it changes there with the record, and stays one person's
      if ((await all(db, `SELECT 1 FROM accounts WHERE login = ? AND person != ?`, b.login, id)).length) return { stmts, why: 'Энэ нэвтрэх нэр өөр хүнд бүртгэлтэй байна.' }
      stmts.push(db.prepare(`UPDATE accounts SET login = ? WHERE person = ?`).bind(b.login, id))
    }
    // Stopped from signing in: signed out everywhere at once
    if (a?.active && b && !b.active) stmts.push(db.prepare(`DELETE FROM sessions WHERE person = ?`).bind(id))
  }
  if (c === 'chats' && old && next) {
    // Someone added to a chat that already runs gets its earlier messages: they load everything again (pull)
    const before = (old as Chat).members
    for (const m of (next as Chat).members) {
      if (!before.includes(m)) stmts.push(db.prepare(`INSERT INTO meta (k, v) VALUES (?, (SELECT v FROM meta WHERE k = 'seq')) ON CONFLICT (k) DO UPDATE SET v = excluded.v`).bind(`again:${m}`))
    }
  }
  return { stmts }
}

interface Entry { c: Table; id: Id; co: string; k: string; pos: number; data: string | null; was: number }

/**
 * Takes one round of changes in, all at once. Each is made on the record as it is now, so a change to one part of a
 * record keeps someone else's change to another part; a record that changed between reading and writing is tried again.
 * `x` null takes everything (the system's own steps: its founding, a new person). `more` are statements to run with the
 * changes or not at all; with `whole`, one refusal stops them all. The changes refused go into `refused`, each with why.
 */
async function round(db: Db, x: Ctx | null, changes: Change[], refused: Refused[], more: Stmt[], whole: boolean) {
  let todo = changes
  for (let attempt = 0; todo.length && attempt < 3; attempt++) {
    const keys = JSON.stringify(todo.map(ch => [ch.c, ch.id]))
    const found = await all<Row>(db, `SELECT r.c, r.id, r.co, r.k, r.pos, r.data, r.seq FROM json_each(?) AS j JOIN rows AS r ON r.c = j.value->>0 AND r.id = j.value->>1`, keys)
    const rows = new Map(found.map(r => [`${r.c} ${r.id}`, r]))
    const entries: Entry[] = []
    const stmts: Stmt[] = attempt ? [] : [...more]
    const before = refused.length
    for (const ch of todo) {
      const row = rows.get(`${ch.c} ${ch.id}`)
      const old: unknown = row?.data ? JSON.parse(row.data) : undefined
      const ops = ch.gone ? [] : (ch.ops ?? [])
      const next = ch.gone ? undefined : apply(old, ops)
      if (next === undefined && !old) {
        // Removing or moving what is not there: nothing to do, and the browser hears that it is not there
        refused.push([ch.c, ch.id, ''])
        continue
      }
      let why: string | null = next !== undefined && !shaped(ch.c, ch.id, next) ? BAD : null
      try {
        // Nobody changes what they may not see; then the table's own rule
        why ??= x && ((row?.data && see(x, ch.c, row) === null ? NO : null) ?? may(x, ch.c, ch.id, old, next, ops))
      } catch {
        why = BAD
      }
      const data = next === undefined ? null : JSON.stringify(next)
      if (!why && data && data.length > TOO_BIG / 4 && bytes(data) > TOO_BIG) why = 'Оруулсан мэдээлэл хэт том тул хадгалагдсангүй.'
      const side = why ? null : await sideOf(db, ch.c, ch.id, old, next)
      if (why ?? side?.why) {
        refused.push([ch.c, ch.id, (why ?? side?.why)!])
        continue
      }
      stmts.push(...side!.stmts)
      // A removed record keeps its columns, so that whoever could see it hears it is gone
      const { co, k } = next === undefined ? row! : cols(ch.c, ch.id, next)
      entries.push({ c: ch.c, id: ch.id, co, k, pos: isList(ch.c) ? (ch.pos ?? row?.pos ?? 0) : 0, data, was: row?.seq ?? 0 })
    }
    if (!entries.length || (whole && refused.slice(before).some(r => r[2]))) return
    // The rows go in as JSON lists, each small enough for the database to take as one value
    const loads: string[] = []
    for (let i = 0, from = 0, size = 0; i < entries.length; i++) {
      size += (entries[i].data?.length ?? 0) * 2 + 200
      if (i + 1 === entries.length || size + (entries[i + 1].data?.length ?? 0) * 2 > LOAD) {
        loads.push(JSON.stringify(entries.slice(from, i + 1)))
        ;[from, size] = [i + 1, 0]
      }
    }
    const seq = `(SELECT v FROM meta WHERE k = 'seq')`
    const each = `SELECT value->>'c' AS c, value->>'id' AS id, value->>'co' AS co, value->>'k' AS k, value->>'pos' AS pos, value->>'data' AS data, value->>'was' AS was FROM json_each(?)`
    let out
    try {
      out = await db.batch([
        db.prepare(`UPDATE meta SET v = v + 1 WHERE k = 'seq' RETURNING v`),
        ...loads.flatMap(json => [
          // Only a row still as it was read is written: `was` is the change that last touched it
          db.prepare(`UPDATE rows SET co = j.co, k = j.k, pos = j.pos, data = j.data, seq = ${seq} FROM (${each}) AS j WHERE rows.c = j.c AND rows.id = j.id AND rows.seq = j.was`).bind(json),
          db.prepare(`INSERT INTO rows (c, id, co, k, pos, data, seq) SELECT j.c, j.id, j.co, j.k, j.pos, j.data, ${seq} FROM (${each}) AS j WHERE j.was = 0 AND j.data IS NOT NULL ON CONFLICT (c, id) DO NOTHING`).bind(json),
        ]),
        ...stmts,
        db.prepare(`SELECT r.c, r.id, r.seq FROM json_each(?) AS j JOIN rows AS r ON r.c = j.value->>0 AND r.id = j.value->>1`).bind(keys),
      ])
    } catch {
      // A statement that came with the changes failed (a login taken at the same moment, a system founded twice): none is made
      for (const e of entries) refused.push([e.c, e.id, BUSY])
      return
    }
    const mine = Number((out[0].results[0] as { v: number }).v)
    const done = new Set((out[out.length - 1].results as Row[]).filter(r => r.seq === mine).map(r => `${r.c} ${r.id}`))
    todo = todo.filter(ch => entries.some(e => e.c === ch.c && e.id === ch.id) && !done.has(`${ch.c} ${ch.id}`))
  }
  for (const ch of todo) refused.push([ch.c, ch.id, BUSY])
}

/** Whether what a browser sent reads as changes at all */
export function changesOf(v: unknown): Change[] | null {
  if (!Array.isArray(v) || v.length > TOO_MANY) return null
  const ok = v.every(ch => obj(ch) && text(ch.c) && isTable(ch.c) && text(ch.id) && !!ch.id && ch.id.length <= 200
    && (ch.ops === undefined || (Array.isArray(ch.ops) && ch.ops.every(op => Array.isArray(op) && op.length >= 1 && op.length <= 2) && safe(ch.ops as Op[])))
    && (ch.pos === undefined || (typeof ch.pos === 'number' && Number.isFinite(ch.pos))) && (ch.gone === undefined || ch.gone === true))
  return ok ? (v as Change[]) : null
}

/**
 * Takes changes in: first those to the organisation, then, by the organisation as it then is, the rest. So a new chat
 * and its first message, or a new ХХК and its first records, may come together. `me` null is the system itself, which
 * the rules do not bind; its changes are made whole or not at all, together with the statements in `more`. Returns
 * what was refused.
 */
export async function push(db: Db, me: Id | null, changes: Change[], more: Stmt[] = []): Promise<Refused[]> {
  const refused: Refused[] = []
  const org = (ch: Change) => (ORG as readonly string[]).includes(ch.c)
  for (const part of [changes.filter(org), changes.filter(ch => !org(ch))]) {
    if (!part.length) continue
    const x = me === null ? null : ctxFor(await worldOf(db), me)
    if (me !== null && !x) return changes.map(ch => [ch.c, ch.id, 'Таны бүртгэл идэвхгүй байна.'] as Refused)
    await round(db, x, part, refused, more, me === null)
    if (me === null && refused.length) break
    more = []
  }
  return refused
}
