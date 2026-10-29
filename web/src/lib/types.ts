// Data model. Phase 1 keeps everything in the browser (localStorage), like the Pane demo.
// When the server arrives, these shapes become the API's.

export type Id = string
export type Hue = 'blue' | 'purple' | 'pink' | 'orange' | 'green' | 'teal' | 'indigo' | 'yellow'

/** ХХК. Every task, project and event belongs to one. */
export interface Company {
  id: Id
  name: string
  hue: Hue
  /** Short code, the start of employee codes, e.g. "ГР" */
  code: string
}

export type Presence = 'online' | 'focus' | 'meeting' | 'away'

export interface Person {
  id: Id
  given: string // нэр
  family: string // овог (эцэг/эхийн нэр)
  role: string // албан тушаал
  team: string // хэлтэс
  email: string
  companies: Id[]
  presence: Presence
  hue: Hue
  /** Hours available per week */
  capacity: number
  /** Only for people outside Ulaanbaatar time */
  tz?: { city: string; offset: number }
  /** Emoji key from ui/avatars.ts, or 'letters' for initials. Unset: an emoji picked from the id */
  avatar?: string
}

export type TaskStatus = 'todo' | 'doing' | 'review' | 'done'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Subtask {
  id: Id
  title: string
  done: boolean
}

export interface Comment {
  id: Id
  author: Id
  text: string
  at: string // ISO
}

export interface Task {
  id: Id
  company: Id
  project?: Id
  title: string
  status: TaskStatus
  prio: Priority
  assignee: Id
  due: string // YYYY-MM-DD
  estimate: number // hours
  subtasks: Subtask[]
  comments: Comment[]
  createdAt: string
  doneAt?: string
}

export type ProjectStatus = 'active' | 'planning' | 'done'

export interface Milestone {
  id: Id
  name: string
  date: string // YYYY-MM-DD
  done: boolean
}

export interface Project {
  id: Id
  company: Id
  name: string
  goal: string
  status: ProjectStatus
  hue: Hue
  icon: ProjectIcon
  lead: Id
  members: Id[]
  start: string
  due: string
  milestones: Milestone[]
  pinned: boolean
}

export type ProjectIcon = 'building' | 'file' | 'clipboard' | 'monitor' | 'graduation' | 'truck' | 'boxes' | 'handshake' | 'receipt' | 'rocket'

export type EventKind = 'meeting' | 'focus' | 'review' | 'deadline' | 'social'

export interface CalEvent {
  id: Id
  company: Id
  title: string
  kind: EventKind
  start: string // ISO local date-time "YYYY-MM-DDTHH:mm"
  minutes: number
  project?: Id
  where?: string
  attendees: Id[]
}

export type NoteKind = 'mention' | 'review' | 'moved' | 'approval' | 'done' | 'invite'

export interface Notice {
  id: Id
  company: Id
  kind: NoteKind
  text: string
  at: string
  read: boolean
  task?: Id
  project?: Id
}

export interface FocusLog {
  at: string
  minutes: number
}

export type ThemeSetting = 'light' | 'dark' | 'system'
export type Wall = 'ash' | 'sand' | 'sage' | 'aurora' | 'smoke' | 'tide' | 'bloom' | 'ember' | 'grove' | 'dusk'
export type Accent = 'blue' | 'purple' | 'pink' | 'orange' | 'green' | 'graphite'

export interface Settings {
  theme: ThemeSetting
  wall: Wall
  accent: Accent
  glass: 'clear' | 'tinted'
  solid: boolean
  notify: { mentions: boolean; due: boolean; meetings: boolean; digest: boolean; focusEnd: boolean }
  focus: { work: number; rest: number; autoStart: boolean }
}

// Human resources (Хүний нөөц). Each ХХК keeps its own departments, positions and employee records:
// someone who works for two ХХК has two records, one per labour contract.

/** Хэлтэс */
export interface Department {
  id: Id
  company: Id
  name: string
  /** Short code for lists and reports, e.g. "САН" */
  code: string
}

/** Албан тушаал, with its headcount (орон тоо) */
export interface Position {
  id: Id
  company: Id
  dept: Id
  name: string
  quota: number
}

export type EmpStatus = 'active' | 'probation' | 'leave' | 'childcare' | 'left'
export type ContractKind = 'open' | 'fixed' | 'service'
export type MoveKind = 'hired' | 'moved' | 'promoted' | 'confirmed' | 'pay' | 'vacation' | 'leave' | 'childcare' | 'back' | 'award' | 'penalty' | 'left'

/** One line of the employment history. `order` is the order's number, e.g. "Б/12" */
export interface Move {
  id: Id
  date: string // YYYY-MM-DD
  kind: MoveKind
  order?: string
  note?: string
}

/** A document the personal file (хувийн хэрэг) should hold. Each ХХК has its own list. */
export interface DocType {
  id: Id
  company: Id
  name: string
  required: boolean
  /** Has a validity date, e.g. an ID card or a health certificate */
  expires: boolean
}

/** A document in an employee's personal file. The demo keeps only the file name. */
export interface FileItem {
  type: Id
  file: string
  added: string // YYYY-MM-DD
  expires?: string
}

export interface Employee {
  id: Id
  company: Id
  /** The ERP user, when the employee has one */
  user?: Id
  code: string
  clan?: string // ургийн овог
  family: string // овог
  given: string // нэр
  regNo: string // регистрийн дугаар, e.g. "УБ90010112"
  phone: string
  email?: string
  address?: string
  education?: string
  profession?: string
  contact?: { name: string; relation: string; phone: string }
  dept: Id
  position: Id
  hired: string
  probationEnd?: string
  contract: { kind: ContractKind; no: string; start: string; end?: string }
  status: EmpStatus
  moves: Move[]
  files: FileItem[]
  hue: Hue
}

// Drafts (Ноорог): free boards where an employee pins notes, checklists, pictures, links and files.
// Each employee has their own boards in each ХХК. Pictures and files live in the browser's file store (lib/files.ts).

export type CardKind = 'note' | 'todo' | 'title' | 'image' | 'link' | 'file'

/** A file on a board. `id` is its key in the file store. */
export interface BoardFile {
  id: Id
  name: string
  type: string
  size: number
  pages?: number
}

/** One thing on a board. x, y, w, h are board pixels; h is the least height, text can make a card taller. */
export interface DraftCard {
  id: Id
  kind: CardKind
  x: number
  y: number
  w: number
  h: number
  /** Slight turn in degrees, like paper on a desk */
  tilt: number
  /** Paper colour; none is plain white */
  hue?: Hue
  text?: string
  items?: Subtask[]
  url?: string
  file?: BoardFile
}

export interface Draft {
  id: Id
  company: Id
  owner: Id
  name: string
  cards: DraftCard[]
  /** Where the board was last looked at: offset in screen pixels and zoom */
  view: { x: number; y: number; z: number }
  updated: string // ISO
}

// Бичиг хэрэг: documents that HR and the office share with employees (their contract, orders, certificates, rules, forms),
// and requests to the office for a document.

export type DocKind = 'contract' | 'order' | 'certificate' | 'rule' | 'decision' | 'letter' | 'form' | 'template'

/** A document in the office's keeping. `to` says who sees it: everyone in the ХХК, or only these users. */
export interface Doc {
  id: Id
  company: Id
  name: string
  kind: DocKind
  /** In the browser's file store. A demo document has none until first opened: it is drawn from `text`. */
  file?: BoardFile
  /** Demo documents only: the lines its page is drawn from */
  text?: string[]
  to: 'all' | Id[]
  by: Id
  added: string // ISO
}

export type ReqStatus = 'sent' | 'working' | 'ready' | 'done' | 'declined'

/** A request to the office for a document */
export interface DocRequest {
  id: Id
  company: Id
  by: Id
  what: string
  purpose: string
  where?: string
  /** On paper with the stamp, to collect from the office; otherwise as a file */
  paper: boolean
  copies: number
  need: string // YYYY-MM-DD
  note?: string
  status: ReqStatus
  steps: { status: ReqStatus; at: string; by: Id; note?: string }[]
  /** The document sent back, for a request by file */
  doc?: Id
}

export interface State {
  version: 1
  me: Id
  company: Id
  companies: Company[]
  people: Person[]
  projects: Project[]
  tasks: Task[]
  events: CalEvent[]
  notices: Notice[]
  focusLog: FocusLog[]
  departments: Department[]
  positions: Position[]
  docTypes: DocType[]
  employees: Employee[]
  drafts: Draft[]
  docs: Doc[]
  requests: DocRequest[]
  settings: Settings
}
