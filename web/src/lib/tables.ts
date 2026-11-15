// What of the app's data everyone shares through the server (docs/decisions.md, 2026-11-15), and how each record is
// told from the others. The rest of the state belongs to the device: who is signed in, which ХХК is open, the look.
import type { State } from './types.ts'

/** Lists of records */
export const LISTS = ['companies', 'people', 'projects', 'tasks', 'events', 'notices', 'focusLog', 'departments', 'positions', 'docTypes', 'employees', 'drafts', 'docs', 'requests', 'hrRequests', 'chats', 'messages', 'contracts', 'reports', 'scans', 'lessons'] as const
/** One record for each ХХК (roles, kpi, timely) or person (toursDone), under their id */
export const MAPS = ['roles', 'kpi', 'timely', 'toursDone'] as const
export type List = (typeof LISTS)[number]
export type Table = List | (typeof MAPS)[number]
export const TABLES: readonly Table[] = [...LISTS, ...MAPS]
export const isList = (c: string): c is List => (LISTS as readonly string[]).includes(c)
export const isTable = (c: string): c is Table => (TABLES as readonly string[]).includes(c)

/** A focus session has no id of its own: whose it was and when */
export const idOf = (c: Table, r: unknown): string => {
  const x = r as { id?: string; who?: string; at?: string }
  return c === 'focusLog' ? `${x.who}|${x.at}` : String(x.id)
}

/** The shared part of a state, each table as id → record; a list's ids in the list's order */
export type Shared = Pick<State, Table>
