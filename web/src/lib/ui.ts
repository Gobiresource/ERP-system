// Screen state that is not saved: which window is open, the island message, the focus timer.
import { useSyncExternalStore } from 'react'
import type { BoardFile, HrRequestKind, Id, Task, CalEvent } from './types'
import { actions, getState, takeSaved } from './store'
import { go } from './router'
import { seed } from './seed'

export type Dialog =
  | { kind: 'task'; id: Id }
  | { kind: 'event'; id: Id }
  | { kind: 'person'; id: Id }
  | { kind: 'newTask'; defaults?: Partial<Task> }
  | { kind: 'newEvent'; defaults?: Partial<CalEvent> }
  | { kind: 'newProject' }
  | { kind: 'projectTeam'; id: Id }
  | { kind: 'invite' }
  | { kind: 'dept'; id?: Id }
  | { kind: 'position'; id?: Id; dept?: Id }
  | { kind: 'shortcuts' }
  | { kind: 'doc'; id: Id }
  | { kind: 'docAdd'; company?: Id }
  | { kind: 'docEdit'; id: Id }
  | { kind: 'company'; id?: Id }
  | { kind: 'docRequest' }
  | { kind: 'request'; id: Id; office?: boolean }
  | { kind: 'newRequest' }
  | { kind: 'hrRequestForm'; type: HrRequestKind; id?: Id }
  | { kind: 'hrRequest'; id: Id }
  | { kind: 'newChat' }
  | { kind: 'chatGroup'; id: Id }
  | { kind: 'file'; file: BoardFile; pdf?: string }
  | { kind: 'readers'; id: Id }
  | { kind: 'newContract' }
  | { kind: 'contractReason'; id: Id; step: 'return' | 'cancel' }
  | { kind: 'contractRegister'; id: Id }
  | { kind: 'contractAsk'; id: Id }
  | { kind: 'contractPdf'; id: Id }
  | { kind: 'processRoles' }
  | { kind: 'reportReturn'; id: Id }
  | { kind: 'reportPdf'; id: Id }
  | { kind: 'kpiRules' }
  | { kind: 'scanSplit'; id: Id; ai: boolean }
  | { kind: 'password'; id: Id }
  | null

export interface Note {
  id: number
  kind: 'ok' | 'info' | 'warn'
  text: string
  undo?: () => void
}

export interface Focus {
  status: 'idle' | 'running' | 'paused'
  total: number // seconds
  endsAt: number // ms, while running
  left: number // seconds, while paused
  task?: Id
}

export interface Ui {
  dialog: Dialog
  finder: boolean
  note: Note | null
  islandOpen: boolean
  focus: Focus
  /** Demo only: the person the contract and request pages act as, to try every step of a process (null: me) */
  actAs: Id | null
  /** Who is signed in; null shows the sign-in page */
  session: Id | null
}

// Signed in for 14 days in this browser, or until Гарах; the server will keep sessions once it holds the data
const SESSION = 'erp:session'
const KEEP = 14 * 864e5
function readSession(): Id | null {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION) ?? 'null')
    const p = v && getState().people.find(x => x.id === v.user)
    if (!p?.account?.active || !(v.until > Date.now())) return null
    if (getState().me !== p.id) actions.setMe(p.id)
    if (!p.companies.includes(getState().company)) actions.switchCompany(p.companies[0])
    return p.id
  } catch {
    return null
  }
}

let ui: Ui = { dialog: null, finder: false, note: null, islandOpen: false, focus: { status: 'idle', total: 0, endsAt: 0, left: 0 }, actAs: null, session: readSession() }
const subs = new Set<() => void>()
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f))
const set = (patch: Partial<Ui>) => {
  ui = { ...ui, ...patch }
  subs.forEach(f => f())
}

export const useUi = () => useSyncExternalStore(subscribe, () => ui)
export const getUi = () => ui

export const open = (dialog: Dialog) => set({ dialog })
export const close = () => set({ dialog: null })
export const setFinder = (finder: boolean) => set({ finder })
export const setIslandOpen = (islandOpen: boolean) => set({ islandOpen })
export const setActAs = (actAs: Id | null) => set({ actAs })

export function signIn(user: Id) {
  try { localStorage.setItem(SESSION, JSON.stringify({ user, until: Date.now() + KEEP })) } catch { /* private window: signed in until the tab closes */ }
  set({ session: user })
}
/**
 * Ends a running focus timer (its minutes count for the person), drops the message and its undo, and opens Нүүр for
 * whoever signs in next
 */
export function signOut() {
  focus.end()
  try { localStorage.removeItem(SESSION) } catch { /* nothing kept */ }
  set({ session: null, dialog: null, actAs: null, finder: false, note: null })
  go('home')
}

// Another tab saved or signed out. This tab takes in the data, and signs out too when the other tab signed out or its
// change left this person out of the data or unable to sign in (demo data put back, made inactive).
addEventListener('storage', e => {
  takeSaved(e)
  if (ui.session && (e.key === SESSION ? !e.newValue : !getState().people.find(p => p.id === ui.session)?.account?.active)) signOut()
})

/** Puts back the demo data. Someone who is not in it (added later) is signed out. */
export function resetDemo() {
  // Someone added later is not in it: it would leave them out, signed out and with no way back, so it is not done
  if (!seed().people.some(p => p.id === ui.session)) return toast('Таны бүртгэл жишээ өгөгдөлд байхгүй тул сэргээх боломжгүй.', { kind: 'warn' })
  toast('Жишээ өгөгдөл сэргээгдлээ.', { undo: actions.reset() })
}

let noteId = 0
let noteTimer = 0
/**
 * Shows a short message in the island. With undo, it stays 10 s (our rule), and as long as a mouse points at its Буцаах
 * or focus is on it. A tap leaves :hover behind on touch screens, so there it does not count.
 */
export function toast(text: string, opts: { kind?: Note['kind']; undo?: () => void } = {}) {
  clearTimeout(noteTimer)
  set({ note: { id: ++noteId, kind: opts.kind ?? 'ok', text, undo: opts.undo } })
  const hide = () => {
    if (document.querySelector(matchMedia('(hover: hover)').matches ? '.island:hover, .island:focus-within' : '.island:focus-within')) noteTimer = window.setTimeout(hide, 1000)
    else set({ note: null })
  }
  noteTimer = window.setTimeout(hide, opts.undo ? 10000 : 3200)
}
export const clearNote = () => {
  clearTimeout(noteTimer)
  set({ note: null })
}

/** Seconds left on the focus timer */
export const focusLeft = (f: Focus) => (f.status === 'running' ? Math.max(0, Math.round((f.endsAt - Date.now()) / 1000)) : f.status === 'paused' ? f.left : 0)

export const focus = {
  start(minutes: number, task?: Id) {
    set({ focus: { status: 'running', total: minutes * 60, endsAt: Date.now() + minutes * 6e4, left: 0, task } })
    toast('Төвлөрөл эхэллээ. Мэдэгдлүүдийг түр хүлээлгэнэ.', { kind: 'info' })
  },
  pause() {
    if (ui.focus.status === 'running') set({ focus: { ...ui.focus, status: 'paused', left: focusLeft(ui.focus) } })
  },
  resume() {
    if (ui.focus.status === 'paused') set({ focus: { ...ui.focus, status: 'running', endsAt: Date.now() + ui.focus.left * 1000 } })
  },
  addFive() {
    const f = ui.focus
    if (f.status === 'running') set({ focus: { ...f, total: f.total + 300, endsAt: f.endsAt + 3e5 } })
    if (f.status === 'paused') set({ focus: { ...f, total: f.total + 300, left: f.left + 300 } })
  },
  /** Stops the timer and records the minutes actually spent */
  end() {
    const f = ui.focus
    if (f.status === 'idle') return
    const spent = Math.round((f.total - focusLeft(f)) / 60)
    if (spent > 0) actions.logFocus(spent)
    set({ focus: { status: 'idle', total: 0, endsAt: 0, left: 0 }, islandOpen: false })
    return spent
  },
}

/** The island checks this every second while the timer runs */
export function tickFocus() {
  const f = ui.focus
  if (f.status === 'running' && f.endsAt <= Date.now()) {
    const minutes = Math.round(f.total / 60)
    focus.end()
    if (getState().settings.notify.focusEnd) toast(`Төвлөрөл дууслаа. ${minutes} минут ажиллалаа.`, { kind: 'info' })
  }
}
