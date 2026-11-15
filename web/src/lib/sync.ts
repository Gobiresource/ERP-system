// With a server behind the app (server/api.ts; docs/decisions.md, 2026-11-15) the data lives there and everyone shares
// it. This file finds out whether there is one, signs the browser in and out, brings the data here, sends this
// browser's changes and brings the others' back (lib/merge.ts says what to send and how the answer is taken in).
// Without a server (the preview page, a plain file host) nothing here runs: the browser keeps its own data, as before.
import { useSyncExternalStore } from 'react'
import { hashOf, newSalt } from './access'
import { DEMO } from './demo'
import { Mirror, type Answer, type Change } from './merge'
import type { Id, Person, State } from './types'

/** What the server said of itself when the page opened: whether it is there, set up, and wants a code to be set up */
export const link = { on: false, started: false, code: false }

/** The store's side (lib/store.ts hands these over, so that neither file needs the other to load first) */
interface Store { get(): State; adopt(next: State): void; empty(): void }
let store: Store
export const attach = (s: Store) => (store = s)
/**
 * What the rest of the app is told (lib/ui.ts and lib/files.ts set these): a change the server refused, a sign-in that
 * ended, and that someone is signed in with their data here, or has signed out
 */
export const tell = { refused: (_why: string) => {}, lost: () => {}, in: () => {}, out: () => {} }

/** Whether this browser's changes are on the server: saved, on their way, or waiting for the connection */
export type Saving = 'saved' | 'saving' | 'offline'
let saving: Saving = 'saved'
const subs = new Set<() => void>()
const say = (next: Saving) => {
  if (saving === next) return
  saving = next
  subs.forEach(f => f())
}
export const useSaving = () => useSyncExternalStore(f => (subs.add(f), () => void subs.delete(f)), () => saving)

const JSON_TYPE = { 'Content-Type': 'application/json' }
const post = (path: string, body: unknown, keepalive = false) => fetch(`/api/${path}`, { method: 'POST', headers: JSON_TYPE, body: JSON.stringify(body), keepalive, signal: AbortSignal.timeout(30_000) })
const NO_ANSWER = 'Сервертэй холбогдож чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.'
/** A request whose answer is only yes or why not: null, or what to tell the person */
async function ask(path: string, body: unknown): Promise<{ error: string; field?: string; status: number } | null> {
  try {
    const r = await post(path, body)
    if (r.ok) return null
    const j = await r.json().catch(() => null)
    return { error: j?.error ?? NO_ANSWER, field: j?.field, status: r.status }
  } catch {
    return { error: NO_ANSWER, status: 0 }
  }
}

let mirror = new Mirror()
/** Signed in, with the data here: only then is anything sent or fetched */
let live = false
let running: Promise<void> | null = null
let dirty = false
let timer = 0
let lastInput = Date.now()

/** How long until the server is asked again: a moment ago someone worked here, the page is only open, or it is out of sight */
const pace = () => (document.hidden ? 300_000 : Date.now() - lastInput < 60_000 ? 10_000 : 30_000)
function plan(ms = pace()) {
  clearTimeout(timer)
  if (live) timer = window.setTimeout(() => void sync(), ms)
}

/** The store changed: its changes go to the server in a moment, together */
export function changed() {
  if (!live) return
  dirty = true
  if (saving === 'saved') say('saving')
  if (!running) plan(400)
}

/** As many changes as one request should carry */
function some(all: Change[]) {
  let [n, size] = [0, 0]
  while (n < all.length && n < 200 && (size += JSON.stringify(all[n]).length) < 800_000) n++
  return all.slice(0, Math.max(1, n))
}

/**
 * One round with the server: sends what this browser has not sent yet, and takes in what changed there. Rounds never
 * overlap; a change made meanwhile goes in the next one, at once.
 */
export function sync(): Promise<void> {
  if (!live) return Promise.resolve()
  if (running) return running
  running = (async () => {
    try {
      let more = true
      while (more && live) {
        dirty = false
        const s = store.get()
        const all = mirror.pending(s)
        const changes = some(all)
        const sent = mirror.sentOf(s, changes)
        const body = { since: mirror.since, scope: mirror.scope, changes }
        const text = JSON.stringify(body)
        // A small request outlives the page, so the last change before closing it still goes
        const r = changes.length
          ? await fetch('/api/sync', { method: 'POST', headers: JSON_TYPE, body: text, keepalive: text.length < 60_000, signal: AbortSignal.timeout(30_000) })
          : await fetch(`/api/sync?since=${mirror.since}&scope=${encodeURIComponent(mirror.scope)}`, { signal: AbortSignal.timeout(30_000) })
        if (r.status === 401) {
          if (live) tell.lost()
          return
        }
        if (!r.ok) throw new Error(String(r.status))
        const a = (await r.json()) as Answer
        if (!live) return
        store.adopt(mirror.merge(store.get(), a, sent))
        const why = a.refused.find(x => x[2])?.[2]
        if (why) tell.refused(why)
        more = dirty || all.length > changes.length
      }
      say('saved')
      plan()
    } catch {
      // No answer: what is unsent stays unsent, and is tried again soon
      say(mirror.pending(store.get()).length ? 'offline' : 'saved')
      plan(Math.min(pace(), 15_000))
    } finally {
      running = null
    }
  })()
  return running
}

/** Brings everything the person may see, afresh; false when the server gave no answer */
async function load() {
  mirror = new Mirror()
  live = true
  await sync()
  const here = mirror.since > 0 || mirror.scope !== ''
  if (here) tell.in()
  return here
}

/**
 * Asked once, before the first screen. 'server': one is behind the app, and `me` is whoever is signed in in this
 * browser, their data already here. 'local': there is none. 'down': there should be one, but it does not answer. The
 * page says there should be by a mark the server puts on it (worker/site.js); the example data never looks for one.
 */
export async function boot(): Promise<{ mode: 'server' | 'local' | 'down'; me: Id | null }> {
  if (DEMO) return { mode: 'local', me: null }
  const marked = 'server' in document.documentElement.dataset
  const j = await fetch('/api/state', { signal: AbortSignal.timeout(10_000) }).then(r => (r.ok ? r.json() : null)).catch(() => null)
  if (!j?.server) return { mode: marked ? 'down' : 'local', me: null }
  Object.assign(link, { on: true, started: !!j.started, code: !!j.code })
  store.empty()
  if (j.me && !(await load())) return { mode: 'down', me: null }
  addEventListener('pointerdown', () => (lastInput = Date.now()), { passive: true, capture: true })
  addEventListener('keydown', () => (lastInput = Date.now()), { passive: true, capture: true })
  // Back in sight or back on the net: what the others did meanwhile comes at once. Going out of sight: unsent changes go.
  addEventListener('visibilitychange', () => (!document.hidden || dirty) && void sync())
  addEventListener('online', () => void sync())
  addEventListener('pagehide', () => dirty && void sync())
  // Closing the page while changes wait for the connection would lose them: the browser asks first
  addEventListener('beforeunload', e => saving === 'offline' && e.preventDefault())
  return { mode: 'server', me: j.me ?? null }
}

/** Signs in on the server and brings the data. The password never leaves the browser: only what it is stretched into. */
export async function signInRemote(login: string, password: string): Promise<{ me: Id } | 'wrong' | 'inactive' | 'down' | { wait: number }> {
  try {
    const s = await post('login/salt', { login })
    if (!s.ok) return 'down'
    const r = await post('login', { login, hash: await hashOf(password, (await s.json()).salt) })
    const j = await r.json().catch(() => null)
    if (r.status === 429 || (r.status === 401 && j?.wait)) return { wait: j.wait }
    if (r.status === 401) return 'wrong'
    if (r.status === 403) return 'inactive'
    if (!r.ok || !j?.me || !(await load())) return 'down'
    return { me: j.me }
  } catch {
    return 'down'
  }
}

/** Signs out here and on the server: nothing of the data stays in this browser */
export function signOutRemote() {
  if (!link.on) return
  const was = live
  live = false
  clearTimeout(timer)
  mirror = new Mirror()
  say('saved')
  store.empty()
  tell.out()
  if (was) void post('logout', {}).catch(() => {})
}

/**
 * Founds the system on the server (screens/Setup.tsx): the first ХХК and its records as `first` holds them, and the
 * person who signs in with every right. Null when done, with the data here; else what to tell the person.
 */
export async function found(first: State, login: string, password: string, code: string) {
  const salt = newSalt()
  const bad = await ask('setup', { code, login, salt, hash: await hashOf(password, salt), changes: new Mirror().pending(first) })
  if (bad) return bad
  link.started = true
  return (await load()) ? null : { error: NO_ANSWER, status: 0 }
}

/** A new person, with what signs them in (dialogs/Invite.tsx); null when done, and the person is in the data here */
export async function inviteRemote(person: Person, password: string) {
  const salt = newSalt()
  const bad = await ask('invite', { person, salt, hash: await hashOf(password, salt), pos: store.get().people.length + 1 })
  if (!bad) await sync()
  return bad
}

/** A new password: one's own with the present one (`now`), or someone's by whoever manages their account */
export async function passwordRemote(who: Id, login: string, password: string, now?: string) {
  const salt = newSalt()
  let old: string | undefined
  if (now !== undefined) {
    const s = await post('login/salt', { login }).then(r => r.json()).catch(() => null)
    if (!s?.salt) return { error: NO_ANSWER, status: 0 }
    old = await hashOf(now, s.salt)
  }
  return ask('password', { who, salt, hash: await hashOf(password, salt), old })
}
