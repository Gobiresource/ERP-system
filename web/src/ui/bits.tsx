// Small shared pieces: labels, avatars, chips, priority, project icons, empty state.
import type { ReactNode } from 'react'
import { Boxes, Building, ClipboardList, FileText, Flag, GraduationCap, Handshake, Hourglass, MonitorSmartphone, Moon, PartyPopper, Receipt, Rocket, Sparkles, Truck, Users, Warehouse } from 'lucide-react'
import type { CalEvent, EventKind, Hue, Person, Presence, Priority, Project, ProjectIcon, ProjectStatus, TaskStatus } from '../lib/types'
import type { Scoped } from '../lib/store'
import { initials, short } from '../lib/format'
import { avatarOf } from './avatars'

export const PRIO: Record<Priority, string> = { low: 'Бага', medium: 'Дунд', high: 'Өндөр', urgent: 'Яаралтай' }
export const STATUS: Record<TaskStatus, string> = { todo: 'Хийх', doing: 'Хийж буй', review: 'Хянаж буй', done: 'Дууссан' }
export const STATUSES: TaskStatus[] = ['todo', 'doing', 'review', 'done']
export const PRESENCE: Record<Presence, string> = { online: 'Идэвхтэй', focus: 'Төвлөрсөн', meeting: 'Уулзалттай', away: 'Түр эзгүй' }
export const KIND: Record<EventKind, string> = { meeting: 'Уулзалт', focus: 'Төвлөрөх цаг', review: 'Хяналт', deadline: 'Эцсийн хугацаа', social: 'Багийн арга хэмжээ' }
export const KIND_HUE: Record<EventKind, Hue> = { meeting: 'indigo', focus: 'purple', review: 'purple', deadline: 'pink', social: 'orange' }
export const PSTATUS: Record<ProjectStatus, string> = { active: 'Хэрэгжиж буй', planning: 'Төлөвлөж буй', done: 'Дууссан' }
export const KIND_ICON: Record<EventKind, typeof Users> = { meeting: Users, focus: Moon, review: Sparkles, deadline: Hourglass, social: PartyPopper }
/** An event takes its project's colour, otherwise its type's */
export const eventHue = (e: CalEvent, sc: Scoped): Hue => sc.project(e.project)?.hue ?? KIND_HUE[e.kind]

const ICONS: Record<ProjectIcon, typeof Rocket> = {
  building: Warehouse, file: FileText, clipboard: ClipboardList, monitor: MonitorSmartphone, graduation: GraduationCap,
  truck: Truck, boxes: Boxes, handshake: Handshake, receipt: Receipt, rocket: Rocket,
}
export const PROJECT_ICONS = Object.keys(ICONS) as ProjectIcon[]
export const CompanyIcon = Building

export function ProjectGlyph({ project, size = 'sm' }: { project: Pick<Project, 'icon' | 'hue'>; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = ICONS[project.icon] ?? Rocket
  return (
    <span className={`picon picon--${size} hue--${project.hue}`} aria-hidden="true">
      <Icon className="ico" />
    </span>
  )
}

export function ProjectChip({ project }: { project?: Pick<Project, 'name' | 'hue'> }) {
  if (!project) return null
  return (
    <span className={`pchip hue--${project.hue}`}>
      <i aria-hidden="true" />
      <span>{project.name}</span>
    </span>
  )
}

export function Prio({ prio, always }: { prio: Priority; always?: boolean }) {
  // Cards only flag high and urgent work, like Pane
  if ((prio === 'low' || prio === 'medium') && !always) return null
  return (
    <span className={`prio prio--${prio}`}>
      {prio === 'urgent' && <Flag className="ico" />}
      {PRIO[prio]}
    </span>
  )
}

export function Avatar({ person, size = 'sm', presence }: { person: Pick<Person, 'id' | 'given' | 'family' | 'hue' | 'presence' | 'avatar'>; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; presence?: boolean }) {
  const emoji = avatarOf(person)
  const av = (
    <span className={`av av--${size} hue--${person.hue}${emoji ? ' av--emoji' : ''}`} title={short(person)} aria-hidden="true">
      {emoji ? <img src={emoji} alt="" draggable={false} /> : initials(person)}
    </span>
  )
  if (!presence) return av
  return (
    <span className={`av-wrap av-wrap--${size}`}>
      {av}
      <span className={`presence presence--${person.presence}`} aria-hidden="true" />
    </span>
  )
}

/** Overlapping avatars, with "+3" when there are more. Screen readers get the names. */
export function AvatarStack({ people, max = 4, size = 'sm' }: { people: Person[]; max?: number; size?: 'xs' | 'sm' | 'md' }) {
  const shown = people.slice(0, max)
  const more = people.length - shown.length
  return (
    <span className="av-stack">
      <span className="sr-only">{people.map(short).join(', ')}</span>
      {shown.map(p => <Avatar key={p.id} person={p} size={size} />)}
      {more > 0 && <span className={`av av--${size} av--more`} aria-hidden="true">+{more}</span>}
    </span>
  )
}

export function PresenceLabel({ presence }: { presence: Presence }) {
  return (
    <span className="presence-label">
      <span className={`presence presence--${presence}`} aria-hidden="true" />
      {PRESENCE[presence]}
    </span>
  )
}

export function Empty({ icon, title, text, children }: { icon?: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <p className="empty__title">{title}</p>
      {text && <p className="empty__text">{text}</p>}
      {children}
    </div>
  )
}
