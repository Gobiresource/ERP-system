// The database on a server of our own: one SQLite file, through Node's own node:sqlite (Node 22.5 or newer, nothing to
// install), made to answer like Cloudflare's D1 (server/db.ts). Only server/main.ts loads this file.
import { DatabaseSync } from 'node:sqlite'
import type { Db, Stmt } from './db.ts'

export function openDb(file: string): Db {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  const stmt = (sql: string, args: unknown[] = []): Stmt & { now(): { results: unknown[] } } => ({
    bind: (...a) => stmt(sql, a),
    // D1 takes undefined for no value nowhere either; booleans go in as numbers
    now: () => ({ results: db.prepare(sql).all(...(args.map(a => (typeof a === 'boolean' ? Number(a) : a)) as never[])) }),
    all: async () => stmt(sql, args).now() as never,
  })
  return {
    prepare: sql => stmt(sql),
    async batch(stmts) {
      db.exec('BEGIN IMMEDIATE')
      try {
        const out = stmts.map(s => (s as ReturnType<typeof stmt>).now())
        db.exec('COMMIT')
        return out
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  }
}
