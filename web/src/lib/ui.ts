// Screen state that is not saved: which window is open, the island message, the focus timer.
import { useSyncExternalStore } from 'react'
import type { Id, Task, CalEvent } from './types'
import { actions, getState } from './store'

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
  | { kind: 'company'; id?: Id }
  | { kind: 'docRequest' }
  | { kind: 'request'; id: Id; office?: boolean }
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
}

let ui: Ui = { dialog: null, finder: false, note: null, islandOpen: false, focus: { status: 'idle', total: 0, endsAt: 0, left: 0 } }
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

let noteId = 0
let noteTimer = 0
/** Shows a short message in the island. With undo, it stays a little longer. */
export function toast(text: string, opts: { kind?: Note['kind']; undo?: () => void } = {}) {
  clearTimeout(noteTimer)
  set({ note: { id: ++noteId, kind: opts.kind ?? 'ok', text, undo: opts.undo } })
  noteTimer = window.setTimeout(() => set({ note: null }), opts.undo ? 5000 : 3200)
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
