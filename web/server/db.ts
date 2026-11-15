// The shared database (docs/decisions.md, 2026-11-15). On the test address it is Cloudflare D1; on a server of our own,
// a SQLite file (server/sqlite.ts). Both are SQLite and are spoken to the same way, D1's, so one code runs on either.
//
// rows      every shared record of the app's state (src/lib/tables.ts), as JSON. `seq` is the number of the change that
//           last touched it: a browser asks for what changed after the last number it saw. A removed record stays as an
//           empty row, so that browsers hear of the removal. `co` (its ХХК) and `k` (whose it is, or which chat's) are
//           what the rules read without opening the record; `pos` is its place in its list.
// accounts  how each person signs in. The browser stretches the password (PBKDF2, 600,000 rounds) and the server keeps
//           SHA-256 of that, so neither the password nor what the browser sends can be read out of the database.
// sessions  who is signed in: SHA-256 of the cookie's random value, for 14 days.
// meta      the change counter, and small notes (who founded the system, who must load everything again).

/** As much of Cloudflare's D1 as is used here */
export interface Stmt {
  bind(...args: unknown[]): Stmt
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
}
export interface Db {
  prepare(sql: string): Stmt
  /** All or nothing, and nothing else in between */
  batch(stmts: Stmt[]): Promise<{ results: unknown[] }[]>
}

export interface Row { c: string; id: string; co: string; k: string; pos: number; data: string | null; seq: number }

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS rows (c TEXT NOT NULL, id TEXT NOT NULL, co TEXT NOT NULL DEFAULT '', k TEXT NOT NULL DEFAULT '', pos REAL NOT NULL DEFAULT 0, data TEXT, seq INTEGER NOT NULL, PRIMARY KEY (c, id)) WITHOUT ROWID`,
  // By table, then by change: "what changed in these tables since" reads only the rows that did
  `CREATE INDEX IF NOT EXISTS rows_seq ON rows (c, seq)`,
  `CREATE TABLE IF NOT EXISTS accounts (person TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL, tries INTEGER NOT NULL DEFAULT 0, until INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, person TEXT NOT NULL, until INTEGER NOT NULL) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v) WITHOUT ROWID`,
  `INSERT OR IGNORE INTO meta (k, v) VALUES ('seq', 0)`,
  // Mixed into the salt shown for a login nobody has, so that asking does not tell which logins exist
  `INSERT OR IGNORE INTO meta (k, v) VALUES ('pepper', hex(randomblob(16)))`,
]

/** Makes the tables; asked for only when a query finds none (server/api.ts), so a working system pays nothing for it */
export const prepare = (db: Db) => db.batch(SCHEMA.map(sql => db.prepare(sql)))

export const all = async <T = Record<string, unknown>>(db: Db, sql: string, ...args: unknown[]) => (await db.prepare(sql).bind(...args).all<T>()).results
export const one = async <T = Record<string, unknown>>(db: Db, sql: string, ...args: unknown[]) => (await all<T>(db, sql, ...args))[0] as T | undefined
