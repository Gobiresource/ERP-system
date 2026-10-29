import { CalendarDays, ChartColumn, Folder, House, Settings, SquareCheck, Users } from 'lucide-react'
import type { Page } from '../lib/router'

export const NAV: { page: Page; label: string; icon: typeof House; key: string }[] = [
  { page: 'home', label: 'Нүүр', icon: House, key: 'H' },
  { page: 'tasks', label: 'Ажил', icon: SquareCheck, key: 'T' },
  { page: 'calendar', label: 'Хуанли', icon: CalendarDays, key: 'C' },
  { page: 'projects', label: 'Төсөл', icon: Folder, key: 'P' },
  { page: 'insights', label: 'Тайлан', icon: ChartColumn, key: 'I' },
  { page: 'team', label: 'Баг', icon: Users, key: 'M' },
  { page: 'preferences', label: 'Тохиргоо', icon: Settings, key: 'S' },
]

export const pageLabel = (page: Page) => NAV.find(n => n.page === page)!.label
