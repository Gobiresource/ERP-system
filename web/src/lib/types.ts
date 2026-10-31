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
  /** How the person signs in, and their rights; none for someone who cannot sign in yet */
  account?: Account
}

/** How far a right reaches in a ХХК: nobody, the people under the person by Шууд удирдлага, or everyone */
export type Scope = 'none' | 'team' | 'all'

/** What a person may see and do in one ХХК besides their own work, which everyone sees */
export interface Access {
  /** Users and their rights (Удирдлага) */
  admin: boolean
  /** Хүний нөөц: the employees' records */
  hr: Scope
  /** Adds and edits employees, departments and positions */
  hrEdit: boolean
  /** Ирц */
  attendance: Scope
}

export interface Account {
  /** Нэвтрэх нэр, lower case */
  login: string
  /** PBKDF2-SHA256 of the password with the salt, both base64; the password itself is never kept */
  hash: string
  salt: string
  active: boolean
  /** Every right in every ХХК: whoever sets the system up */
  sysadmin?: boolean
  /** Rights in each ХХК the person belongs to */
  access: Record<Id, Access>
  lastLogin?: string
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
  /** Хариуцагч: one or more people */
  assignees: Id[]
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
  /** Хэлтсийн дарга (an employee): the department's people give their monthly report to them */
  head?: Id
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
  /** Шууд удирдлага (an employee) when not the head of the department; 'none' for the top, who gives no monthly report */
  manager?: Id | 'none'
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

/**
 * What AI read from a scanned paper (server/scan.ts asks for exactly this). `company` is one of our ХХК, by id; the other
 * fields are null when the page does not show them. Dates are YYYY-MM-DD.
 */
export interface ScanReading {
  kind: DocKind
  contractType: ContractType | null
  company: Id | null
  title: string
  number: string | null
  date: string | null
  parties: string[]
  amount: number | null
  currency: string | null
  expires: string | null
  summary: string
  confidence: 'high' | 'medium' | 'low'
  notes: string | null
}

// Ирц from Timely, as our server passes it on (server/timely.ts): read only, tidied, without salaries

/** A Timely company the server's keys open, with what each key may read */
export interface TimelyCompany { id: number; name: string; register: string | null; scopes: string[] }
/** The current leave year's annual leave, in days, and the leave taken */
export interface TimelyLeave { year: number; earned: number; used: number; left: number; taken: { from: string; to: string; days: number }[] }
export interface TimelyEmployee {
  workerId: number
  family: string
  given: string
  /** Регистрийн дугаар, upper case: what ties the employee to ours */
  register: string
  position: string
  division: string
  leave: TimelyLeave | null
  /** From the month's first day to its last, or to today in the current month */
  supposedDays: number
  supposedHours: number
  workedDays: number
  workedHours: number
}
export interface TimelyMonth { month: string; from: string; to: string; updated: string; employees: TimelyEmployee[] }
/** A day's clock-in and clock-out, HH:MM in Ulaanbaatar time */
export interface TimelyDay { date: string; in: string | null; out: string | null }

/** What the office files a scan as: the reading, with their changes. Text fields as typed; `amount` in figures. */
export interface ScanFields { company: Id; kind: DocKind; title: string; number: string; date: string; party: string; amount: string }

/** A scanned paper in the office's inbox (Бичиг хэрэг → Скан оруулах) until it is filed into a folder */
export interface ScanItem {
  id: Id
  file: BoardFile
  /** A small picture of the first page, in the file store */
  thumb?: Id
  by: Id
  added: string
  /** waiting, splitting and reading: AI's turn; manual: no AI, the office fills it in */
  state: 'waiting' | 'splitting' | 'reading' | 'read' | 'failed' | 'manual'
  /** Looked through for several papers in one file (or one page only, or cut from a stack already) */
  mapped?: boolean
  /** A paper cut from a stack scanned into one file: that file's name and its pages in it */
  from?: { batch: Id; name: string; pages: number[] }
  /** On the demo stack: where AI would split it, the blank pages, and what it would read from each paper */
  suggest?: { starts: number[]; blank: number[]; readings: ScanReading[] }
  /** What AI read. On a demo paper: what it would read, shown as an example. */
  reading?: ScanReading
  sample?: boolean
  model?: string
  /** What the reading cost, in US dollars */
  cost?: number
  error?: string
  to: ScanFields
}

/** A document in its ХХК's folder, in the category of its kind. `to` says who sees it: everyone in the ХХК, or only these users. */
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
  /** Last changed: its details or its file */
  updated?: string // ISO
  /** A filed paper scan: what it says of itself */
  paper?: { number?: string; date?: string; party?: string; amount?: number }
}

// Гэрээ байгуулах: the user's own HR system's contract process (docs/decisions.md, 2026-10-29), except that finance and the
// lawyer look at the contract at the same time, and everyone works in one text instead of passing files around.

export type ContractStage = 'draft' | 'review' | 'clerk' | 'director' | 'register' | 'deliver' | 'done' | 'canceled'
/** Who decides at a stage, set for each company */
export type ProcessRole = 'finance' | 'legal' | 'clerk' | 'director'
export type ContractType = 'work' | 'sale' | 'service' | 'lease' | 'employment'

/** A numbered part of the contract: its heading and what it says */
export interface Clause {
  id: Id
  title: string
  body: string
}

/** The text as one person left it */
export interface ContractVersion {
  id: Id
  by: Id
  at: string // ISO
  clauses: Clause[]
}

/** What happened to a contract. Steps of the process stay; a note or an opinion can be taken off by its writer. */
export interface ContractEvent {
  id: Id
  by: Id
  at: string // ISO
  kind: 'start' | 'send' | 'approve' | 'return' | 'register' | 'deliver' | 'cancel' | 'ask' | 'opinion' | 'note'
  /** Approve: the part of the review, or the stage that was passed */
  role?: ProcessRole
  /** Send, return: where it went */
  to?: ContractStage
  /** Ask: whose opinion */
  people?: Id[]
  text?: string
}

export interface Contract {
  id: Id
  company: Id
  title: string
  /** Харилцагч: the other side */
  party: string
  kind: ContractType
  /** ₮ */
  amount?: number
  /** Хариуцсан ажилтан: who started it; writes the draft and sends it */
  owner: Id
  stage: ContractStage
  /** Sent back: where it goes once fixed, so that those who already agreed are not asked again */
  resume?: ContractStage
  /** Finance and the lawyer agree each on their own, at the same time */
  agreed: ProcessRole[]
  /** Whose opinion the writer asked for, and whether it came */
  asked: { to: Id; done?: boolean }[]
  clauses: Clause[]
  versions: ContractVersion[]
  events: ContractEvent[]
  /** Given by the office once the director approved */
  number?: string
  regDate?: string // YYYY-MM-DD
  /** The signed and stamped copy */
  scan?: BoardFile
  created: string // ISO
  updated: string // ISO
}

// Чат: two people (direct) or a named group. One list for the whole group of companies, not for one ХХК.

export interface Chat {
  id: Id
  kind: 'direct' | 'group'
  /** Groups only */
  name?: string
  hue?: Hue
  members: Id[]
  by: Id
  created: string // ISO
  /** When each member last read it (ISO): later messages by others are unread */
  read: Record<Id, string>
}

/** What a message points to. A person is named in the text as @name; the others show as cards under it. */
export interface ChatRef {
  kind: 'person' | 'task' | 'event' | 'doc'
  id: Id
  label: string
}

export interface Message {
  id: Id
  chat: Id
  by: Id
  at: string // ISO
  text: string
  refs: ChatRef[]
  /** Files and pictures sent with it, in the browser's file store */
  files: BoardFile[]
  /** Each person's reaction: one emoji */
  reactions?: Record<Id, string>
  /** Taken back by its writer: what it said is gone for everyone */
  recalled?: boolean
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

// Сарын тайлан: by the last day of each month an employee writes what they did, their problems and ideas, and next month's
// plan; their direct manager scores it on the ХХК's criteria, and the score sets the bonus (docs/decisions.md, 2026-10-30).

/** A line of a report. A line of work done may come from a task or a contract; a plan line may become a task. */
export interface ReportLine { id: Id; text: string; task?: Id; contract?: Id }
export type ReportStatus = 'draft' | 'sent' | 'returned' | 'scored'
/** A KPI criterion; `weight` is its share of the score, the weights adding up to 100 */
export interface Criterion { id: Id; name: string; hint: string; weight: number }
/** From `min` points up (out of 100) a report gets this grade and this share of the bonus, in % */
export interface Band { min: number; name: string; bonus: number }
export interface KpiRules { criteria: Criterion[]; bands: Band[] }

export interface MonthReport {
  id: Id
  company: Id
  /** Who writes it */
  person: Id
  /** YYYY-MM */
  month: string
  done: ReportLine[]
  issues: string
  plan: ReportLine[]
  status: ReportStatus
  /** Who scores it, set when it is sent */
  manager?: Id
  sent?: string
  /** Why the manager sent it back */
  reason?: string
  /** The criteria as they were when it was scored, each with its points from 1 to 5 */
  scores?: (Criterion & { points: number })[]
  /** The grade the score fell in when scored */
  band?: Band
  comment?: string
  scored?: string
  updated: string
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
  chats: Chat[]
  messages: Message[]
  contracts: Contract[]
  /** Each company's people for the contract process */
  roles: Record<Id, Record<ProcessRole, Id>>
  reports: MonthReport[]
  /** Each company's monthly report criteria and bonus grades */
  kpi: Record<Id, KpiRules>
  scans: ScanItem[]
  /** All AI readings of scans so far, in US dollars */
  aiSpent: number
  /** The Timely company each ХХК's attendance comes from, when picked by hand (names that differ) */
  timely: Record<Id, number>
  settings: Settings
}
