// Human resources (Хүний нөөц): overview, employees, one employee, the employee form, attendance from Timely, and
// structure with headcount.
// Built from the HR plan the user brought (docs/decisions.md, 2026-10-29). One ХХК at a time, like the rest of the app.
import '../styles/screens/hr.css'
import type { EmpStatus, Employee } from '../lib/types'
import { useApp } from '../lib/store'
import { EMP_STATUS } from '../lib/hr'
import { Avatar } from '../ui/bits'
import { SubNav } from '../ui/SubNav'
import Overview from './hr/Overview'
import Employees from './hr/Employees'
import EmployeePage from './hr/EmployeePage'
import EmployeeForm from './hr/EmployeeForm'
import Structure from './hr/Structure'
import Attendance, { AttendanceOne } from './hr/Attendance'

export default function Hr({ id }: { id?: string }) {
  if (!id) return <Overview />
  if (id === 'employees') return <Employees />
  if (id === 'structure') return <Structure />
  if (id === 'attendance') return <Attendance />
  if (id.startsWith('attendance-')) return <AttendanceOne key={id} id={id.slice(11)} />
  if (id === 'new') return <EmployeeForm />
  if (id.endsWith('-edit')) return <EmployeeForm id={id.slice(0, -5)} />
  return <EmployeePage id={id} />
}

const TABS = [['', 'Тойм'], ['employees', 'Ажилтан'], ['attendance', 'Ирц'], ['structure', 'Бүтэц, орон тоо']] as const

/** The HR pages, above each page title */
export const HrNav = ({ at }: { at: (typeof TABS)[number][0] }) => <SubNav label="Хүний нөөц" base="hr" tabs={TABS} at={at} />

/** The user's own avatar when the employee uses the ERP, otherwise initials */
export function EmpAvatar({ e, size = 'sm' }: { e: Employee; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) {
  const user = useApp().people.find(p => p.id === e.user)
  return <Avatar person={user ?? { id: e.id, given: e.given, family: e.family, hue: e.hue, presence: 'online', avatar: 'letters' }} size={size} />
}

export function EmpStatusPill({ status }: { status: EmpStatus }) {
  return <span className={`pstatus estatus--${status}`}><i aria-hidden="true" />{EMP_STATUS[status]}</span>
}
