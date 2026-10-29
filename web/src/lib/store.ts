// App state: one object, saved in the browser. Components read it with useApp() and change it with the actions below.
import { useSyncExternalStore } from 'react'
import type { CalEvent, Company, Department, Doc, DocRequest, Draft, DraftCard, Employee, FileItem, Id, Person, Position, Presence, Project, ReqStatus, Settings, State, Task, TaskStatus } from './types'
import { seed } from './seed'
import { seedDrafts } from './draft'
import { seedDocs } from './docs'
import { companyMark } from './format'

const KEY = 'erp:v1'

function load(): State | null {
  try {
    let s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (s?.version !== 1) return null
    // Saved before the HR section existed: add its demo data and keep everything else
    if (!s.employees) {
      const fresh = seed()
      const code = (c: Company) => fresh.companies.find(f => f.id === c.id)?.code ?? c.name.slice(0, 2).toUpperCase()
      s = { ...s, companies: s.companies.map((c: Company) => ({ ...c, code: code(c) })), departments: fresh.departments, positions: fresh.positions, docTypes: fresh.docTypes, employees: fresh.employees }
    }
    // Saved before Ноорог existed
    if (!s.drafts) s = { ...s, drafts: seedDrafts(new Date(), s.me) }
    // Saved before Бичиг хэрэг existed
    if (!s.docs) s = { ...s, ...seedDocs(new Date()) }
    return s
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
  /** A new ХХК, with its folder in Бичиг хэрэг. I work in it from the start, so it is in my company menu. */
  addCompany(c: Pick<Company, 'name' | 'hue'>) {
    const company: Company = { ...c, id: uid('c'), code: companyMark(c.name) }
    set(s => ({ ...s, companies: [...s.companies, company], people: s.people.map(p => (p.id === s.me ? { ...p, companies: [...p.companies, company.id] } : p)) }))
    return company
  },
  updateCompany: (id: Id, patch: Pick<Company, 'name' | 'hue'>) => set(s => ({ ...s, companies: s.companies.map(c => (c.id === id ? { ...c, ...patch } : c)) })),

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
  setProfile: (patch: Partial<Pick<Person, 'given' | 'family' | 'email' | 'role' | 'avatar'>>) =>
    set(s => {
      // The HR records of this user keep the same name and e-mail
      const { given, family, email } = patch
      const hr = Object.fromEntries(Object.entries({ given, family, email }).filter(([, v]) => v !== undefined))
      return {
        ...s,
        people: s.people.map(p => (p.id === s.me ? { ...p, ...patch } : p)),
        employees: Object.keys(hr).length ? s.employees.map(e => (e.user === s.me ? { ...e, ...hr } : e)) : s.employees,
      }
    }),
  logFocus: (minutes: number) => set(s => ({ ...s, focusLog: [...s.focusLog, { at: new Date().toISOString(), minutes }] })),

  // Human resources
  addEmployee(e: Omit<Employee, 'id' | 'company' | 'moves' | 'files' | 'hue'>) {
    const hues = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'indigo'] as const
    const note = state.positions.find(p => p.id === e.position)?.name
    const emp: Employee = { ...e, id: uid('e'), company: state.company, moves: [{ id: uid('m'), date: e.hired, kind: 'hired', note }], files: [], hue: hues[state.employees.length % hues.length] }
    set(s => ({ ...s, employees: [...s.employees, emp] }))
    return emp
  },
  /** Saves an employee. For an ERP user, the name and e-mail also change on their account and their other HR records. */
  updateEmployee: (id: Id, patch: Partial<Employee>) =>
    set(s => {
      const user = s.employees.find(e => e.id === id)?.user
      const same = user ? { given: patch.given, family: patch.family, email: patch.email } : {}
      const keep = Object.fromEntries(Object.entries(same).filter(([, v]) => v !== undefined))
      return {
        ...s,
        employees: s.employees.map(e => (e.id === id ? { ...e, ...patch } : user && e.user === user ? { ...e, ...keep } : e)),
        people: user ? s.people.map(p => (p.id === user ? { ...p, ...keep } : p)) : s.people,
      }
    }),
  /** Adds or replaces one document of the personal file */
  setFile: (id: Id, item: FileItem) =>
    set(s => ({ ...s, employees: s.employees.map(e => (e.id === id ? { ...e, files: [...e.files.filter(f => f.type !== item.type), item] } : e)) })),
  removeFile(id: Id, type: Id) {
    const item = state.employees.find(e => e.id === id)?.files.find(f => f.type === type)
    set(s => ({ ...s, employees: s.employees.map(e => (e.id === id ? { ...e, files: e.files.filter(f => f.type !== type) } : e)) }))
    return () => item && actions.setFile(id, item)
  },
  addDept(d: Pick<Department, 'name' | 'code'>) {
    const dept: Department = { ...d, id: uid('d'), company: state.company }
    set(s => ({ ...s, departments: [...s.departments, dept] }))
    return dept
  },
  updateDept: (id: Id, patch: Partial<Department>) =>
    set(s => ({ ...s, departments: s.departments.map(d => (d.id === id ? { ...d, ...patch } : d)) })),
  /** Removes an empty department with its positions; returns undo */
  removeDept(id: Id) {
    const before = { departments: state.departments, positions: state.positions }
    set(s => ({ ...s, departments: s.departments.filter(d => d.id !== id), positions: s.positions.filter(p => p.dept !== id) }))
    return () => set(s => ({ ...s, ...before }))
  },
  addPosition(p: Pick<Position, 'dept' | 'name' | 'quota'>) {
    const pos: Position = { ...p, id: uid('o'), company: state.company }
    set(s => ({ ...s, positions: [...s.positions, pos] }))
    return pos
  },
  updatePosition: (id: Id, patch: Partial<Position>) =>
    set(s => ({ ...s, positions: s.positions.map(p => (p.id === id ? { ...p, ...patch } : p)) })),
  removePosition(id: Id) {
    const before = state.positions
    set(s => ({ ...s, positions: s.positions.filter(p => p.id !== id) }))
    return () => set(s => ({ ...s, positions: before }))
  },

  // Ноорог
  addDraft(name: string, cards: DraftCard[] = []) {
    const d: Draft = { id: uid('b'), company: state.company, owner: state.me, name, cards, view: { x: 40, y: 40, z: 1 }, updated: new Date().toISOString() }
    set(s => ({ ...s, drafts: [d, ...s.drafts] }))
    return d
  },
  /** Saves a board. Looking around (the view) does not count as a change. */
  updateDraft: (id: Id, patch: Partial<Pick<Draft, 'name' | 'cards' | 'view'>>) =>
    set(s => ({ ...s, drafts: s.drafts.map(d => (d.id === id ? { ...d, ...patch, updated: patch.name !== undefined || patch.cards ? new Date().toISOString() : d.updated } : d)) })),
  removeDraft(id: Id) {
    const i = state.drafts.findIndex(d => d.id === id)
    const d = state.drafts[i]
    set(s => ({ ...s, drafts: s.drafts.filter(x => x.id !== id) }))
    return () => set(s => ({ ...s, drafts: [...s.drafts.slice(0, i), d, ...s.drafts.slice(i)] }))
  },

  // Бичиг хэрэг
  /** Into a company's folder: the current one unless another is given */
  addDoc({ company, ...d }: Pick<Doc, 'name' | 'kind' | 'file' | 'to'> & { company?: Id }) {
    const doc: Doc = { ...d, id: uid('dc'), company: company ?? state.company, by: state.me, added: new Date().toISOString() }
    set(s => ({ ...s, docs: [doc, ...s.docs] }))
    return doc
  },
  updateDoc: (id: Id, patch: Partial<Doc>) => set(s => ({ ...s, docs: s.docs.map(d => (d.id === id ? { ...d, ...patch } : d)) })),
  addRequest(r: Pick<DocRequest, 'what' | 'purpose' | 'where' | 'paper' | 'copies' | 'need' | 'note'>) {
    const at = new Date().toISOString()
    const req: DocRequest = { ...r, id: uid('rq'), company: state.company, by: state.me, status: 'sent', steps: [{ status: 'sent', at, by: state.me }] }
    set(s => ({ ...s, requests: [req, ...s.requests] }))
    return req
  },
  /** Moves a request to its next step; `doc` is the file sent back */
  stepRequest: (id: Id, status: ReqStatus, more: { note?: string; doc?: Id } = {}) =>
    set(s => ({
      ...s,
      requests: s.requests.map(r => (r.id === id
        ? { ...r, status, doc: more.doc ?? r.doc, steps: [...r.steps, { status, at: new Date().toISOString(), by: s.me, note: more.note }] }
        : r)),
    })),

  /** Puts back fresh demo data and returns a function that undoes it */
  reset() {
    const before = state
    set(() => ({ ...seed(), settings: state.settings }))
    return () => set(() => before)
  },
}
