import { CalendarDays, ChartColumn, Files, Folder, House, IdCard, MessagesSquare, NotebookPen, Settings, SquareCheck, Users } from 'lucide-react'
import type { Page } from '../lib/router'

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
  { page: 'preferences', label: 'Тохиргоо', icon: Settings, key: 'S' },
]

export const pageLabel = (page: Page) => NAV.find(n => n.page === page)!.label
