// Human resources (Хүний нөөц): overview, employees, one employee, the employee form, attendance from Timely, and
// structure with headcount.
// Built from the HR plan the user brought (docs/decisions.md, 2026-10-29). One ХХК at a time, like the rest of the app.
import '../styles/screens/hr.css'
import type { EmpStatus, Employee } from '../lib/types'
import { useApp } from '../lib/store'
import { EMP_STATUS } from '../lib/hr'
import { accessOf } from '../lib/access'
import { Avatar, NoAccess } from '../ui/bits'
import { SubNav } from '../ui/SubNav'
import Overview from './hr/Overview'
import Employees from './hr/Employees'
import EmployeePage from './hr/EmployeePage'
import EmployeeForm from './hr/EmployeeForm'
import Structure from './hr/Structure'
import Attendance, { AttendanceOne } from './hr/Attendance'

export default function Hr({ id }: { id?: string }) {
  const s = useApp()
  const a = accessOf(s, s.me, s.company)
  // Each page within the person's right: records, all of them for the structure, editing, and attendance apart
  const att = a.attendance !== 'none'
  if (id === 'attendance' || (!id && a.hr === 'none' && att)) return att ? <Attendance /> : <NoAccess />
  if (id?.startsWith('attendance-')) return att ? <AttendanceOne key={id} id={id.slice(11)} /> : <NoAccess />
  if (a.hr === 'none') return <NoAccess />
  if (!id) return <Overview />
  if (id === 'employees') return <Employees />
  if (id === 'structure') return a.hr === 'all' ? <Structure /> : <NoAccess />
  if (id === 'new') return a.hrEdit ? <EmployeeForm /> : <NoAccess />
  if (id.endsWith('-edit')) return a.hrEdit ? <EmployeeForm id={id.slice(0, -5)} /> : <NoAccess />
  return <EmployeePage id={id} />
}

const TABS = [['', 'Тойм'], ['employees', 'Ажилтан'], ['attendance', 'Ирц'], ['structure', 'Бүтэц, орон тоо']] as const

/** The HR pages within the person's rights, above each page title */
export function HrNav({ at }: { at: (typeof TABS)[number][0] }) {
  const s = useApp()
  const a = accessOf(s, s.me, s.company)
  const tabs = TABS.filter(([k]) => (k === 'attendance' ? a.attendance !== 'none' : k === 'structure' ? a.hr === 'all' : a.hr !== 'none'))
  return tabs.length > 1 ? <SubNav label="Хүний нөөц" base="hr" tabs={tabs} at={at} /> : null
}

/** The user's own avatar when the employee uses the ERP, otherwise initials */
export function EmpAvatar({ e, size = 'sm' }: { e: Employee; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) {
  const user = useApp().people.find(p => p.id === e.user)
  return <Avatar person={user ?? { id: e.id, given: e.given, family: e.family, hue: e.hue, presence: 'online', avatar: 'letters' }} size={size} />
}

export function EmpStatusPill({ status }: { status: EmpStatus }) {
  return <span className={`pstatus estatus--${status}`}><i aria-hidden="true" />{EMP_STATUS[status]}</span>
}
