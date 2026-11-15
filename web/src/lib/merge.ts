// The heart of sharing data through the server (lib/sync.ts sends and fetches; server/data.ts answers). The app changes
// its one state object at once and never waits for the network. Beside it, a Mirror keeps each shared record as the
// server last sent it. Whatever differs between the two is what this browser has still to send: a record's changed
// places (lib/patch.ts), its removal, or its new place in its list. The server's answer is laid under the changes this
// browser has not sent yet, so a screen never shows a record going back and forth, and two people changing different
// parts of one record both keep their change.
import { apply, diff, type Op } from './patch.ts'
import { TABLES, idOf, isList, type Shared, type Table } from './tables.ts'
import type { Id } from './types.ts'

/** One record's change, as the server takes it */
export interface Change { c: Table; id: Id; ops?: Op[]; gone?: true; pos?: number }
/** One record from the server: [table, id, place in its list, the record, or null when it is gone or not this person's to see] */
export type Row = [c: Table, id: Id, pos: number, v: unknown]
/** `full`: everything the person may see, not only what changed. `refused`: changes of this browser's not taken, with why. */
export interface Answer { seq: number; scope: string; full: boolean; rows: Row[]; refused: [Table, Id, string][] }
/** The records as they were when their changes were sent: what the server has seen of them from this browser */
export type Sent = Map<string, { v: unknown; pos?: number }>

type Recs = Map<Id, unknown>
const recsOf = (c: Table, table: unknown): Recs => (isList(c) ? new Map((table as unknown[]).map(r => [idOf(c, r), r])) : new Map(Object.entries(table as object)))

/**
 * Marks the longest run of places that do not fall: those records stay where they are. Equal places count as in order
 * (two browsers may give two new records the same place; they then sort by id), so that taking the server's records in
 * never makes this browser renumber records, which it might not be allowed to change.
 */
function rising(v: (number | undefined)[]) {
  const tails: number[] = []
  const prev = v.map(() => -1)
  v.forEach((x, i) => {
    if (x === undefined) return
    let [lo, hi] = [0, tails.length]
    while (lo < hi) {
      const m = (lo + hi) >> 1
      if (v[tails[m]]! <= x) lo = m + 1
      else hi = m
    }
    if (lo) prev[i] = tails[lo - 1]
    tails[lo] = i
  })
  const keep = v.map(() => false)
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) keep[i] = true
  return keep
}

/**
 * Gives each record of a list a place (a number that rises down the list) that says where it is among the others. A
 * record that is new or was moved gets a place between its neighbours'; the rest keep theirs, so moving one record
 * changes one record.
 */
function rank(ids: Id[], at: Map<Id, number>) {
  const keep = rising(ids.map(id => at.get(id)))
  for (let i = 0; i < ids.length; ) {
    if (keep[i]) { i++; continue }
    let j = i
    while (j < ids.length && !keep[j]) j++
    const [lo, hi, n] = [i ? at.get(ids[i - 1]) : undefined, j < ids.length ? at.get(ids[j]) : undefined, j - i]
    for (let k = 0; k < n; k++) at.set(ids[i + k], lo === undefined ? (hi === undefined ? k + 1 : hi - (n - k)) : hi === undefined ? lo + k + 1 : lo + ((hi - lo) * (k + 1)) / (n + 1))
    i = j
  }
}

export class Mirror {
  /** The number of the last change heard of, and the word for what this person may see (server/rules.ts scopeOf) */
  since = 0
  scope = ''
  /** Each record as the server last sent it, with its place */
  private kept = new Map<Table, Map<Id, { v: unknown; pos: number }>>(TABLES.map(c => [c, new Map()]))
  /** Each record's place in its list here, sent or not */
  private place = new Map<Table, Map<Id, number>>(TABLES.map(c => [c, new Map()]))
  /** Tables found with nothing to send, as they then were: not gone through again until they change */
  private clean = new Map<Table, unknown>()

  /** What this browser has still to send */
  pending(s: Shared): Change[] {
    const out: Change[] = []
    for (const c of TABLES) {
      const table = s[c]
      if (this.clean.get(c) === table) continue
      const [n, known, now, at] = [out.length, this.kept.get(c)!, recsOf(c, table), this.place.get(c)!]
      if (isList(c)) rank([...now.keys()], at)
      for (const [id, v] of now) {
        const k = known.get(id)
        const ops = k && k.v === v ? [] : diff(k?.v, v)
        const pos = isList(c) ? at.get(id) : undefined
        const moved = pos !== undefined && pos !== k?.pos
        if (ops.length || moved) out.push({ c, id, ...(ops.length ? { ops } : {}), ...(moved ? { pos } : {}) })
      }
      for (const id of known.keys()) if (!now.has(id)) out.push({ c, id, gone: true })
      if (out.length === n) this.clean.set(c, table)
    }
    return out
  }

  /** The records behind some changes as they are now, to tell later what changed after they were sent */
  sentOf(s: Shared, changes: Change[]): Sent {
    const tables = new Map<Table, Recs>()
    return new Map(changes.map(ch => {
      if (!tables.has(ch.c)) tables.set(ch.c, recsOf(ch.c, s[ch.c]))
      return [`${ch.c} ${ch.id}`, { v: tables.get(ch.c)!.get(ch.id), pos: this.place.get(ch.c)!.get(ch.id) }]
    }))
  }

  /**
   * The state with the server's answer taken in. A record comes as the server has it, with this browser's changes the
   * server has not seen yet made on it again: those made since `sent` when the record was among the changes sent, else
   * those made since the server last sent it here. A refused change is dropped: the record is as the server has it.
   */
  merge<S extends Shared>(s: S, a: Answer, sent: Sent = new Map()): S {
    const forced = new Set(a.refused.map(([c, id]) => `${c} ${id}`))
    const rows = new Map<Table, Map<Id, { v: unknown; pos: number }>>()
    for (const [c, id, pos, v] of a.rows) (rows.get(c) ?? rows.set(c, new Map()).get(c)!).set(id, { v, pos })
    const next = { ...s }
    for (const c of TABLES) {
      const [inc, known] = [rows.get(c), this.kept.get(c)!]
      if (!inc && !(a.full && known.size)) continue
      this.clean.delete(c)
      const [now, at] = [recsOf(c, s[c]), this.place.get(c)!]
      if (isList(c)) rank([...now.keys()], at)
      const out = new Map(now)
      // Everything afresh: what the server no longer sends is gone, or no longer this person's to see
      for (const id of new Set([...(inc?.keys() ?? []), ...(a.full ? known.keys() : [])])) {
        const key = `${c} ${id}`
        const r = inc?.get(id)
        const remote = r && r.v !== null ? r : undefined
        const [k, local, was] = [known.get(id), now.get(id), sent.get(key)]
        // What the server has seen of the record from this browser
        const [base, basePos] = was ? [was.v, was.pos] : [k?.v, k?.pos]
        if (remote) known.set(id, remote)
        else known.delete(id)
        let v: unknown
        if (forced.has(key)) v = remote?.v
        else if (base === undefined) v = local ?? remote?.v // made here and not sent yet, or new from the server
        else if (local !== undefined && remote) {
          const mine = local === base ? [] : diff(base, local)
          v = mine.length ? apply(remote.v, mine) : remote.v
          if (mine.length && !diff(remote.v, v).length) v = remote.v
        } // else removed here or there: gone
        const moved = !forced.has(key) && at.get(id) !== undefined && basePos !== undefined && at.get(id) !== basePos
        if (remote && !moved) at.set(id, remote.pos)
        if (v === undefined) out.delete(id)
        else out.set(id, v)
      }
      ;(next as Record<Table, unknown>)[c] = tableOf(c, out, at, s[c])
    }
    this.since = a.seq
    this.scope = a.scope
    return next
  }
}

/** The records as the state keeps them: a list in the order of their places, or a map. The old one when nothing changed. */
function tableOf(c: Table, recs: Recs, at: Map<Id, number>, old: unknown) {
  if (!isList(c)) {
    const prev = old as Record<Id, unknown>
    return recs.size === Object.keys(prev).length && [...recs].every(([id, v]) => prev[id] === v) ? old : Object.fromEntries(recs)
  }
  const list = [...recs].sort(([a], [b]) => at.get(a)! - at.get(b)! || (a < b ? -1 : 1)).map(([, v]) => v)
  const prev = old as unknown[]
  return list.length === prev.length && list.every((v, i) => v === prev[i]) ? old : list
}
