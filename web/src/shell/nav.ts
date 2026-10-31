import { CalendarDays, ChartColumn, Files, Folder, House, IdCard, MessagesSquare, NotebookPen, Settings, ShieldCheck, SquareCheck, Users } from 'lucide-react'
import type { Page } from '../lib/router'
import type { State } from '../lib/types'
import { accessOf } from '../lib/access'

export const NAV: { page: Page; label: string; icon: typeof House; key: string }[] = [
  { page: 'home', label: 'Нүүр', icon: House, key: 'H' },
  { page: 'tasks', label: 'Ажил', icon: SquareCheck, key: 'T' },
  { page: 'chat', label: 'Зурвас', icon: MessagesSquare, key: 'J' },
  { page: 'calendar', label: 'Календарь', icon: CalendarDays, key: 'C' },
  { page: 'projects', label: 'Төсөл', icon: Folder, key: 'P' },
  { page: 'draft', label: 'Ноорог', icon: NotebookPen, key: 'D' },
  { page: 'insights', label: 'Тайлан', icon: ChartColumn, key: 'I' },
  { page: 'team', label: 'Баг', icon: Users, key: 'M' },
  { page: 'hr', label: 'Хүний нөөц', icon: IdCard, key: 'R' },
  { page: 'docs', label: 'Бичиг хэрэг', icon: Files, key: 'B' },
  { page: 'admin', label: 'Удирдлага', icon: ShieldCheck, key: 'U' },
  { page: 'preferences', label: 'Тохиргоо', icon: Settings, key: 'S' },
]

export const pageLabel = (page: Page) => NAV.find(n => n.page === page)!.label

/** The pages the signed-in person may open in the current ХХК: Хүний нөөц with a right to records or attendance, Удирдлага for admins */
export function navFor(s: State) {
  const a = accessOf(s, s.me, s.company)
  return NAV.filter(n => (n.page === 'hr' ? a.hr !== 'none' || a.attendance !== 'none' : n.page === 'admin' ? a.admin : true))
}
