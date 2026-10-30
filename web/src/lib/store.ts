// App state: one object, saved in the browser. Components read it with useApp() and change it with the actions below.
import { useSyncExternalStore } from 'react'
import type { BoardFile, CalEvent, Chat, Clause, Company, Contract, ContractEvent, ContractStage, Department, Doc, DocRequest, Draft, DraftCard, Employee, FileItem, Id, KpiRules, Message, MonthReport, Person, ScanItem, Position, Presence, ProcessRole, Project, ReqStatus, Settings, State, Task, TaskStatus } from './types'
import { seed } from './seed'
import { seedDrafts } from './draft'
import { seedDocs } from './docs'
import { seedChats } from './chat'
import { REVIEW, STAGE, canEdit, clausesFor, deciders, reviewsOf, rolesOf, seedContracts } from './contracts'
import { bandOf, dueOf, findReport, kpiOf, managerOf, nextMonth, seedReports, total } from './reports'
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
    // Saved when a task had one person in charge
    if (s.tasks.some((t: Partial<Task>) => !t.assignees)) {
      s = { ...s, tasks: s.tasks.map(({ assignee, ...t }: Task & { assignee?: Id }) => ({ ...t, assignees: t.assignees ?? (assignee ? [assignee] : []) })) }
    }
    // Saved before Чат existed
    if (!s.chats) s = { ...s, ...seedChats(new Date(), s) }
    // Saved before Гэрээ existed: the lawyer and the office clerk join, with the demo contracts
    if (!s.contracts) {
      const add = seed().people.filter(p => ['u15', 'u16'].includes(p.id) && !s.people.some((x: Person) => x.id === p.id))
      s = { ...s, people: [...s.people, ...add], ...seedContracts(new Date()) }
    }
    // Saved before Сарын тайлан existed: department heads, the general director above the reports, and the demo reports
    if (!s.reports) {
      const fresh = seed()
      s = {
        ...s,
        departments: s.departments.map((d: Department) => ({ ...d, head: d.head ?? fresh.departments.find(f => f.id === d.id)?.head })),
        employees: s.employees.map((e: Employee) => ({ ...e, manager: e.manager ?? fresh.employees.find(f => f.id === e.id)?.manager })),
      }
      s = { ...s, ...seedReports(new Date(), s) }
    }
    // Saved before Скан оруулах existed
    if (!s.scans) s = { ...s, scans: [], aiSpent: 0 }
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
const patchContract = (id: Id, fn: (c: Contract, s: State) => Contract) => set(s => ({ ...s, contracts: s.contracts.map(c => (c.id === id ? fn(c, s) : c)) }))

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

  // Чат
  /** My chat with this person, made the first time */
  directChat(person: Id) {
    const found = state.chats.find(c => c.kind === 'direct' && c.members.includes(person) && c.members.includes(state.me))
    if (found) return found
    const at = new Date().toISOString()
    const chat: Chat = { id: uid('ch'), kind: 'direct', members: [state.me, person], by: state.me, created: at, read: { [state.me]: at } }
    set(s => ({ ...s, chats: [...s.chats, chat] }))
    return chat
  },
  addGroup(g: Pick<Chat, 'name' | 'hue' | 'members'>) {
    const at = new Date().toISOString()
    const chat: Chat = { ...g, id: uid('ch'), kind: 'group', by: state.me, created: at, read: { [state.me]: at } }
    set(s => ({ ...s, chats: [...s.chats, chat] }))
    return chat
  },
  updateChat: (id: Id, patch: Pick<Chat, 'name' | 'members'>) => set(s => ({ ...s, chats: s.chats.map(c => (c.id === id ? { ...c, ...patch } : c)) })),
  /** Sending also marks the chat read up to now. Demo: the people who are on (Идэвхтэй) read it 3 seconds later. */
  sendMessage(chat: Id, m: Pick<Message, 'text' | 'refs' | 'files'>) {
    const at = new Date().toISOString()
    const msg: Message = { ...m, id: uid('cm'), chat, by: state.me, at }
    set(s => ({ ...s, messages: [...s.messages, msg], chats: s.chats.map(c => (c.id === chat ? { ...c, read: { ...c.read, [s.me]: at } } : c)) }))
    const on = state.chats.find(c => c.id === chat)?.members.filter(id => id !== state.me && state.people.find(p => p.id === id)?.presence === 'online') ?? []
    if (on.length) setTimeout(() => on.forEach(id => actions.readChat(chat, id)), 3000)
    return msg
  },
  readChat: (chat: Id, who = state.me) => set(s => ({ ...s, chats: s.chats.map(c => (c.id === chat ? { ...c, read: { ...c.read, [who]: new Date().toISOString() } } : c)) })),
  /** My reaction to a message; the same emoji again takes it off */
  react: (id: Id, emoji: string) => set(s => ({
    ...s,
    messages: s.messages.map(m => {
      if (m.id !== id) return m
      const { [s.me]: mine, ...rest } = m.reactions ?? {}
      return { ...m, reactions: mine === emoji ? rest : { ...rest, [s.me]: emoji } }
    }),
  })),
  /** Takes my message back from everyone. Returns it as it was, for undo. */
  recallMessage(id: Id) {
    const was = state.messages.find(m => m.id === id && m.by === state.me)
    if (was) set(s => ({ ...s, messages: s.messages.map(m => (m.id === id ? { ...m, text: '', refs: [], files: [], reactions: undefined, recalled: true } : m)) }))
    return was
  },
  restoreMessage: (was: Message) => set(s => ({ ...s, messages: s.messages.map(m => (m.id === was.id ? was : m)) })),

  // Гэрээ. Who may do a step is checked here, as a server would: a hidden button is not enough (the user's HR system does
  // the same). `who` is the person acting, which the demo lets one change.
  /** Starts a contract from its kind's text; whoever starts it writes it (Хариуцсан ажилтан) */
  addContract(c: Pick<Contract, 'title' | 'party' | 'kind' | 'amount'>, who: Id) {
    const at = new Date().toISOString()
    const clauses = clausesFor(c.kind, c.party, c.amount)
    const contract: Contract = {
      ...c, id: uid('ct'), company: state.company, owner: who, stage: 'draft', agreed: [], asked: [], clauses,
      versions: [{ id: uid('cv'), by: who, at, clauses }], events: [{ id: uid('ce'), by: who, at, kind: 'start' }], created: at, updated: at,
    }
    set(s => ({ ...s, contracts: [contract, ...s.contracts] }))
    return contract
  },
  /** The text as it is typed. One person's edits stay one version until the next step of the process. */
  editContract(id: Id, who: Id, clauses: Clause[]) {
    patchContract(id, (c, s) => {
      if (!canEdit(c, rolesOf(s, c.company), who)) return c
      const at = new Date().toISOString()
      const last = c.versions.at(-1)
      const step = c.events.filter(e => e.kind !== 'note' && e.kind !== 'opinion' && e.kind !== 'ask').at(-1)
      const same = last && last.by === who && (!step || step.at < last.at)
      return { ...c, clauses, updated: at, versions: same ? [...c.versions.slice(0, -1), { ...last, at, clauses }] : [...c.versions, { id: uid('cv'), by: who, at, clauses }] }
    })
  },
  /**
   * A step of the process; true when it was allowed. Sending and approving go back to where the contract was sent back
   * from, if it was, else to the next stage. Sending back goes to the writer (the director may choose the office) and
   * remembers where from, so that those who already agreed are not asked again.
   */
  contractStep(id: Id, who: Id, step: 'send' | 'approve' | 'return' | 'deliver' | 'cancel', o: { text?: string; to?: ContractStage } = {}) {
    let done = false
    patchContract(id, (c, s) => {
      const roles = rolesOf(s, c.company)
      const may = deciders(c, roles).includes(who)
      const at = new Date().toISOString()
      const ev = (e: Omit<ContractEvent, 'id' | 'by' | 'at'>): ContractEvent => ({ id: uid('ce'), by: who, at, ...e })
      const to = (stage: ContractStage, events: ContractEvent[], more: Partial<Contract> = {}) => {
        done = true
        return { ...c, stage, ...more, events: [...c.events, ...events], updated: at }
      }
      if (step === 'send' && c.stage === 'draft' && may) {
        const next = c.resume ?? 'review'
        return to(next, [ev({ kind: 'send', to: next })], { resume: undefined })
      }
      if (step === 'approve' && may && c.stage === 'review') {
        // Finance and the lawyer agree each on their own; the contract moves on once both have
        const mine = reviewsOf(c, roles, who)
        const agreed = [...c.agreed, ...mine]
        return to(REVIEW.every(r => agreed.includes(r)) ? STAGE.review.next! : 'review', mine.map(role => ev({ kind: 'approve', role, text: o.text })), { agreed })
      }
      if (step === 'approve' && may && (c.stage === 'clerk' || c.stage === 'director')) {
        const role: ProcessRole = c.stage
        return to(c.resume ?? STAGE[c.stage].next!, [ev({ kind: 'approve', role, text: o.text })], { resume: undefined })
      }
      if (step === 'return' && may && (c.stage === 'review' || c.stage === 'clerk' || c.stage === 'director')) {
        const back = c.stage === 'director' && o.to === 'clerk' ? 'clerk' : 'draft'
        return to(back, [ev({ kind: 'return', to: back, text: o.text })], { resume: c.resume ?? c.stage })
      }
      if (step === 'deliver' && may && c.stage === 'deliver') return to('done', [ev({ kind: 'deliver' })])
      if (step === 'cancel' && c.stage === 'draft' && c.owner === who) return to('canceled', [ev({ kind: 'cancel', text: o.text })])
      return c
    })
    return done
  },
  /** The office numbers the approved contract; the number must be new in its company. Returns what is wrong, or null. */
  registerContract(id: Id, who: Id, r: { number: string; date: string; scan?: BoardFile }) {
    const c = state.contracts.find(x => x.id === id)
    if (!c || c.stage !== 'register' || rolesOf(state, c.company).clerk !== who) return 'Энэ алхмыг хийх эрх танд байхгүй.'
    const number = r.number.trim()
    if (state.contracts.some(x => x.company === c.company && x.id !== id && x.number === number)) return 'Энэ дугаарыг өөр гэрээнд олгосон байна. Өөр дугаар бичнэ үү.'
    const at = new Date().toISOString()
    patchContract(id, x => ({ ...x, number, regDate: r.date, scan: r.scan ?? x.scan, stage: 'deliver', events: [...x.events, { id: uid('ce'), by: who, at, kind: 'register', text: number }], updated: at }))
    return null
  },
  /** While drafting, the writer asks colleagues what they think */
  askOpinion(id: Id, who: Id, people: Id[], text: string) {
    patchContract(id, c => {
      if (c.stage !== 'draft' || c.owner !== who || !people.length) return c
      const at = new Date().toISOString()
      return { ...c, asked: [...c.asked.filter(a => !people.includes(a.to)), ...people.map(to => ({ to }))], events: [...c.events, { id: uid('ce'), by: who, at, kind: 'ask', people, text: text || undefined }], updated: at }
    })
  },
  /** Anyone may write a note; from someone who was asked, it is their opinion */
  contractNote(id: Id, who: Id, text: string) {
    patchContract(id, c => {
      const at = new Date().toISOString()
      const opinion = c.asked.some(a => a.to === who && !a.done)
      return { ...c, asked: c.asked.map(a => (a.to === who ? { ...a, done: true } : a)), events: [...c.events, { id: uid('ce'), by: who, at, kind: opinion ? 'opinion' : 'note', text }], updated: at }
    })
  },
  /** Only one's own note or opinion comes off; the steps of the process stay */
  dropContractNote: (id: Id, who: Id, event: Id) =>
    patchContract(id, c => ({ ...c, events: c.events.filter(e => !(e.id === event && e.by === who && (e.kind === 'note' || e.kind === 'opinion'))) })),
  /** A company's people for the process (an admin's job in the real system) */
  setRoles: (company: Id, roles: Record<ProcessRole, Id>) => set(s => ({ ...s, roles: { ...s.roles, [company]: roles } })),

  // Сарын тайлан
  /** Saves what a person writes in their report while it is theirs to write (a draft, or one sent back); the first save makes it */
  saveReport(company: Id, person: Id, month: string, text: Pick<MonthReport, 'done' | 'issues' | 'plan'>) {
    set(s => {
      const r = findReport(s, company, person, month)
      const updated = new Date().toISOString()
      if (!r) return { ...s, reports: [{ id: uid('mr'), company, person, month, ...text, status: 'draft', updated }, ...s.reports] }
      if (r.status !== 'draft' && r.status !== 'returned') return s
      return { ...s, reports: s.reports.map(x => (x.id === r.id ? { ...x, ...text, updated } : x)) }
    })
  },
  /** The writer sends their report to their manager; false when it cannot go */
  sendReport(company: Id, person: Id, month: string, who: Id) {
    const r = findReport(state, company, person, month)
    const manager = managerOf(state, company, person)
    if (who !== person || !r || !manager || (r.status !== 'draft' && r.status !== 'returned')) return false
    const at = new Date().toISOString()
    set(s => ({ ...s, reports: s.reports.map(x => (x.id === r.id ? { ...x, status: 'sent', manager, sent: at, updated: at } : x)) }))
    return true
  },
  /**
   * The manager scores a sent report, or changes the score: points 1–5 for each criterion. A report keeps the criteria it
   * was first scored on. With `tasks`, each plan line becomes the writer's task, due at the end of next month.
   */
  scoreReport(id: Id, who: Id, points: Record<Id, number>, comment: string, tasks: boolean) {
    const r = state.reports.find(x => x.id === id)
    if (!r || r.manager !== who || (r.status !== 'sent' && r.status !== 'scored')) return false
    const scores = (r.scores ?? kpiOf(state, r.company).criteria).map(c => ({ ...c, points: points[c.id] }))
    if (scores.some(c => !(c.points >= 1 && c.points <= 5))) return false
    const at = new Date().toISOString()
    const plan = r.plan.map(l => (tasks && !l.task && l.text.trim() ? { ...l, task: uid('t') } : l))
    const made: Task[] = plan.filter((l, i) => l.task && !r.plan[i].task).map(l => ({
      id: l.task!, company: r.company, title: l.text.trim(), status: 'todo', prio: 'medium', assignees: [r.person],
      due: dueOf(nextMonth(r.month)), estimate: 4, subtasks: [], comments: [], createdAt: at,
    }))
    const scored: MonthReport = { ...r, plan, status: 'scored', scores, band: bandOf(kpiOf(state, r.company).bands, total(scores)), comment: comment || undefined, scored: at, updated: at }
    set(s => ({ ...s, tasks: [...made, ...s.tasks], reports: s.reports.map(x => (x.id === id ? scored : x)) }))
    return true
  },
  /** The manager sends a report back to its writer with the reason */
  returnReport(id: Id, who: Id, reason: string) {
    const r = state.reports.find(x => x.id === id)
    if (!r || r.manager !== who || r.status !== 'sent' || !reason) return false
    const at = new Date().toISOString()
    set(s => ({ ...s, reports: s.reports.map(x => (x.id === id ? { ...x, status: 'returned', reason, updated: at } : x)) }))
    return true
  },
  setKpi: (company: Id, rules: KpiRules) => set(s => ({ ...s, kpi: { ...s.kpi, [company]: rules } })),

  // Скан оруулах
  addScans: (items: ScanItem[]) => set(s => ({ ...s, scans: [...items, ...s.scans] })),
  setScan: (id: Id, patch: Partial<ScanItem>) => set(s => ({ ...s, scans: s.scans.map(x => (x.id === id ? { ...x, ...patch } : x)) })),
  addAiCost: (usd: number) => set(s => ({ ...s, aiSpent: s.aiSpent + usd })),
  /** Takes a scan out of the inbox; returns undo */
  dropScan(id: Id) {
    const i = state.scans.findIndex(x => x.id === id)
    const it = state.scans[i]
    set(s => ({ ...s, scans: s.scans.filter(x => x.id !== id) }))
    return () => set(s => ({ ...s, scans: [...s.scans.slice(0, i), it, ...s.scans.slice(i)] }))
  },
  /** Files a scan into its ХХК's folder, in the category of its kind, for everyone there to see; returns the document and undo */
  fileScan(id: Id, who: Id) {
    const i = state.scans.findIndex(x => x.id === id)
    const it = state.scans[i]
    if (!it) return null
    const f = it.to
    const amount = Number(f.amount.replace(/[\s,]/g, ''))
    const doc: Doc = {
      id: uid('d'), company: f.company, name: f.title.trim(), kind: f.kind, file: it.file, to: 'all', by: who, added: new Date().toISOString(),
      paper: { number: f.number.trim() || undefined, date: f.date || undefined, party: f.party.trim() || undefined, amount: amount > 0 ? amount : undefined },
    }
    set(s => ({ ...s, docs: [doc, ...s.docs], scans: s.scans.filter(x => x.id !== id) }))
    return { doc, undo: () => set(s => ({ ...s, docs: s.docs.filter(d => d.id !== doc.id), scans: [...s.scans.slice(0, i), it, ...s.scans.slice(i)] })) }
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
