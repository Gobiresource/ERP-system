// Human resources (Хүний нөөц): overview, employees, one employee, the employee form, and structure with headcount.
// Built from the HR plan the user brought (docs/decisions.md, 2026-10-29). One ХХК at a time, like the rest of the app.
import { useRef } from 'react'
import '../styles/screens/hr.css'
import type { EmpStatus, Employee } from '../lib/types'
import { useApp } from '../lib/store'
import { useLens } from '../lib/motion'
import { EMP_STATUS } from '../lib/hr'
import { Avatar } from '../ui/bits'
import Overview from './hr/OverviewPick'
import Employees from './hr/Employees'
import EmployeePage from './hr/EmployeePage'
import EmployeeForm from './hr/EmployeeForm'
import Structure from './hr/Structure'

export default function Hr({ id }: { id?: string }) {
  if (!id) return <Overview />
  if (id === 'employees') return <Employees />
  if (id === 'structure') return <Structure />
  if (id === 'new') return <EmployeeForm />
  if (id.endsWith('-edit')) return <EmployeeForm id={id.slice(0, -5)} />
  return <EmployeePage id={id} />
}

const TABS = [['', 'Тойм'], ['employees', 'Ажилтан'], ['structure', 'Бүтэц, орон тоо']] as const

/** The HR pages, above each page title */
export function HrNav({ at }: { at: (typeof TABS)[number][0] }) {
  const track = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLSpanElement>(null)
  useLens(track, lens, '[aria-current="page"]', at)
  return (
    <nav className="hrnav" aria-label="Хүний нөөц" data-enter>
      <div className="seg" ref={track}>
        <span className="seg__pill" ref={lens} aria-hidden="true" />
        {TABS.map(([id, label]) => (
          <a key={id} className="seg__btn" href={id ? `#hr-${id}` : '#hr'} aria-current={at === id ? 'page' : undefined}>{label}</a>
        ))}
      </div>
    </nav>
  )
}

/** The user's own avatar when the employee uses the ERP, otherwise initials */
export function EmpAvatar({ e, size = 'sm' }: { e: Employee; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) {
  const user = useApp().people.find(p => p.id === e.user)
  return <Avatar person={user ?? { id: e.id, given: e.given, family: e.family, hue: e.hue, presence: 'online', avatar: 'letters' }} size={size} />
}

export function EmpStatusPill({ status }: { status: EmpStatus }) {
  return <span className={`pstatus estatus--${status}`}><i aria-hidden="true" />{EMP_STATUS[status]}</span>
}
