// App state: one object, saved in the browser. Components read it with useApp() and change it with the actions below.
import { useSyncExternalStore } from 'react'
import type { CalEvent, Id, Person, Presence, Project, Settings, State, Task, TaskStatus } from './types'
import { seed } from './seed'

const KEY = 'erp:v1'

function load(): State | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return s?.version === 1 ? s : null
  } catch {
    return null
  }
}

let state: State = load() ?? seed()
const subs = new Set<() => void>()
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f))
let saveTimer = 0

function set(fn: (s: State) => State) {
  state = fn(state)
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private window: keep working without saving */ }
  }, 150)
  subs.forEach(f => f())
}

export const getState = () => state
/** The whole state. Re-renders on every change, which is fine at this size. */
export const useApp = () => useSyncExternalStore(subscribe, () => state)

/** Data of the current ХХК, plus lookups. Cached per state object. */
export interface Scoped {
  tasks: Task[]
  projects: Project[]
  events: CalEvent[]
  notices: State['notices']
  people: Person[]
  person: (id: Id) => Person | undefined
  project: (id?: Id) => Project | undefined
  me: Person
}
const cache = new WeakMap<State, Scoped>()
export function scoped(s: State): Scoped {
  let v = cache.get(s)
  if (!v) {
    const c = s.company
    const people = new Map(s.people.map(p => [p.id, p]))
    const projects = new Map(s.projects.map(p => [p.id, p]))
    v = {
      tasks: s.tasks.filter(t => t.company === c),
      projects: s.projects.filter(p => p.company === c),
      events: s.events.filter(e => e.company === c).sort((a, b) => a.start.localeCompare(b.start)),
      notices: s.notices.filter(x => x.company === c),
      people: s.people.filter(p => p.companies.includes(c)),
      person: id => people.get(id),
      project: id => (id ? projects.get(id) : undefined),
      me: people.get(s.me)!,
    }
    cache.set(s, v)
  }
  return v
}

const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const patchTask = (id: Id, fn: (t: Task) => Task) => set(s => ({ ...s, tasks: s.tasks.map(t => (t.id === id ? fn(t) : t)) }))

export const actions = {
  switchCompany: (company: Id) => set(s => ({ ...s, company })),

  addTask(t: Omit<Task, 'id' | 'company' | 'subtasks' | 'comments' | 'createdAt'>) {
    const task: Task = { ...t, id: uid('t'), company: state.company, subtasks: [], comments: [], createdAt: new Date().toISOString() }
    if (task.status === 'done') task.doneAt = task.createdAt
    set(s => ({ ...s, tasks: [task, ...s.tasks] }))
    return task
  },
  updateTask: (id: Id, patch: Partial<Task>) => patchTask(id, t => ({ ...t, ...patch })),
  setStatus: (id: Id, status: TaskStatus) =>
    patchTask(id, t => ({ ...t, status, doneAt: status === 'done' ? (t.doneAt ?? new Date().toISOString()) : undefined })),
  /** Moves a task to another column, before the task `before` (or to the end) */
  moveTask(id: Id, status: TaskStatus, before?: Id) {
    set(s => {
      const t = s.tasks.find(x => x.id === id)!
      const moved = { ...t, status, doneAt: status === 'done' ? (t.doneAt ?? new Date().toISOString()) : undefined }
      const rest = s.tasks.filter(x => x.id !== id)
      const i = before ? rest.findIndex(x => x.id === before) : -1
      if (i < 0) rest.push(moved)
      else rest.splice(i, 0, moved)
      return { ...s, tasks: rest }
    })
  },
  removeTask(id: Id) {
    const i = state.tasks.findIndex(t => t.id === id)
    const t = state.tasks[i]
    set(s => ({ ...s, tasks: s.tasks.filter(x => x.id !== id) }))
    return () => set(s => ({ ...s, tasks: [...s.tasks.slice(0, i), t, ...s.tasks.slice(i)] }))
  },
  toggleSubtask: (id: Id, sub: Id) =>
    patchTask(id, t => ({ ...t, subtasks: t.subtasks.map(x => (x.id === sub ? { ...x, done: !x.done } : x)) })),
  addSubtask: (id: Id, title: string) =>
    patchTask(id, t => ({ ...t, subtasks: [...t.subtasks, { id: uid('s'), title, done: false }] })),
  addComment: (id: Id, text: string) =>
    patchTask(id, t => ({ ...t, comments: [...t.comments, { id: uid('k'), author: state.me, text, at: new Date().toISOString() }] })),

  addEvent(e: Omit<CalEvent, 'id' | 'company'>) {
    const ev = { ...e, id: uid('e'), company: state.company }
    set(s => ({ ...s, events: [...s.events, ev] }))
    return ev
  },
  removeEvent(id: Id) {
    const e = state.events.find(x => x.id === id)!
    set(s => ({ ...s, events: s.events.filter(x => x.id !== id) }))
    return () => set(s => ({ ...s, events: [...s.events, e] }))
  },

  addProject(p: Omit<Project, 'id' | 'company' | 'pinned' | 'milestones' | 'members'> & { members?: Id[] }) {
    const project: Project = { ...p, id: uid('p'), company: state.company, pinned: false, milestones: [], members: p.members ?? [p.lead] }
    set(s => ({ ...s, projects: [...s.projects, project] }))
    return project
  },
  updateProject: (id: Id, patch: Partial<Project>) =>
    set(s => ({ ...s, projects: s.projects.map(p => (p.id === id ? { ...p, ...patch } : p)) })),
  togglePin: (id: Id) => set(s => ({ ...s, projects: s.projects.map(p => (p.id === id ? { ...p, pinned: !p.pinned } : p)) })),
  toggleMilestone: (id: Id, m: Id) =>
    set(s => ({ ...s, projects: s.projects.map(p => (p.id === id ? { ...p, milestones: p.milestones.map(x => (x.id === m ? { ...x, done: !x.done } : x)) } : p)) })),

  setPresence: (id: Id, presence: Presence) => set(s => ({ ...s, people: s.people.map(p => (p.id === id ? { ...p, presence } : p)) })),
  invite(p: Pick<Person, 'given' | 'family' | 'email' | 'role' | 'team'>) {
    const hues = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'indigo'] as const
    const person: Person = { ...p, id: uid('u'), companies: [state.company], presence: 'away', hue: hues[state.people.length % hues.length], capacity: 40 }
    set(s => ({ ...s, people: [...s.people, person] }))
    return person
  },

  markRead: (id: Id) => set(s => ({ ...s, notices: s.notices.map(n => (n.id === id ? { ...n, read: true } : n)) })),
  markAllRead: () => set(s => ({ ...s, notices: s.notices.map(n => (n.company === s.company ? { ...n, read: true } : n)) })),

  setSettings: (patch: Partial<Settings>) => set(s => ({ ...s, settings: { ...s.settings, ...patch } })),
  setProfile: (patch: Pick<Person, 'given' | 'family' | 'email' | 'role'>) =>
    set(s => ({ ...s, people: s.people.map(p => (p.id === s.me ? { ...p, ...patch } : p)) })),
  logFocus: (minutes: number) => set(s => ({ ...s, focusLog: [...s.focusLog, { at: new Date().toISOString(), minutes }] })),

  /** Puts back fresh demo data and returns a function that undoes it */
  reset() {
    const before = state
    set(() => ({ ...seed(), settings: state.settings }))
    return () => set(() => before)
  },
}
