// Data model. Phase 1 keeps everything in the browser (localStorage), like the Pane demo.
// When the server arrives, these shapes become the API's.

export type Id = string
export type Hue = 'blue' | 'purple' | 'pink' | 'orange' | 'green' | 'teal' | 'indigo' | 'yellow'

/** ХХК. Every task, project and event belongs to one. */
export interface Company {
  id: Id
  name: string
  hue: Hue
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
  settings: Settings
}
