import { useMemo, useRef, useState } from 'react'
import { ChevronDown, Columns3, Flag, Folder, List as ListIcon, Plus, Search, X } from 'lucide-react'
import '../styles/screens/tasks.css'
import type { Id, Priority, Task } from '../lib/types'
import { scoped, useApp } from '../lib/store'
import { open } from '../lib/ui'
import { usePageEnter } from '../lib/motion'
import { dayOf, daysFromToday, thisWeekRange } from '../lib/format'
import { PageHead } from '../ui/PageHead'
import { Seg } from '../ui/Seg'
import { Avatar, Empty, PRIO } from '../ui/bits'
import { Menu, MenuItem, usePopover } from '../ui/Popover'
import { Board } from './tasks/Board'
import { List } from './tasks/List'

type View = 'board' | 'list'
type Whose = 'all' | 'given' | 'sent'
/**
 * Ажил is the person's own (docs/decisions.md, 2026-11-16): what they made and what they were given. These pick among
 * them: all, what someone else gave them, what they gave someone else.
 */
const WHOSE: Record<Whose, { label: string; has: (t: Task, me: Id) => boolean }> = {
  all: { label: 'Миний бүх ажил', has: () => true },
  given: { label: 'Надад оноосон', has: (t, me) => t.assignees.includes(me) && !!t.by && t.by !== me },
  sent: { label: 'Миний оноосон', has: (t, me) => t.by === me && t.assignees.some(a => a !== me) },
}
const VIEW_KEY = 'erp:tasks-view'
const readView = (): View => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'board' } catch { return 'board' } }

export default function Tasks() {
  const s = useApp()
  const sc = scoped(s)
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const [view, setView] = useState<View>(readView)
  const [project, setProject] = useState('all')
  const [whose, setWhose] = useState<Whose>('all')
  const [prio, setPrio] = useState<'all' | Priority>('all')
  const [q, setQ] = useState('')
  const projPop = usePopover()
  const prioPop = usePopover()
  const whoPop = usePopover()

  const changeView = (v: View) => {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* not saved */ }
  }

  // Others' tasks the person may see (their project's, or given to their people) are found in Төсөл and Баг, not here
  const ours = useMemo(() => sc.tasks.filter(t => t.by === s.me || t.assignees.includes(s.me)), [sc, s.me])
  const shown = useMemo(() => {
    const t = q.trim().toLocaleLowerCase('mn')
    return ours.filter(x =>
      (project === 'all' || (project === 'none' ? !x.project : x.project === project)) &&
      WHOSE[whose].has(x, s.me) &&
      (prio === 'all' || x.prio === prio) &&
      (!t || [x.title, sc.project(x.project)?.name, ...x.assignees.flatMap(id => [sc.person(id)?.given, sc.person(id)?.family])].some(v => v?.toLocaleLowerCase('mn').includes(t))))
  }, [sc, ours, project, whose, prio, q, s.me])

  const open_ = ours.filter(t => t.status !== 'done')
  const [from, to] = thisWeekRange()
  const stats = {
    open: open_.length,
    week: open_.filter(t => t.due >= from && t.due <= to).length,
    late: open_.filter(t => daysFromToday(t.due) < 0).length,
    done: ours.filter(t => t.doneAt && dayOf(t.doneAt) >= from).length,
  }
  const filtered = project !== 'all' || whose !== 'all' || prio !== 'all' || q.trim() !== ''
  const current = sc.project(project === 'all' || project === 'none' ? undefined : project)
  const me = sc.me

  return (
    <div ref={ref} className="tk">
      <PageHead
        title="Ажил"
        sub={`${stats.open} дуусаагүй ажил байна.`}
        stats={[
          { label: 'Дуусаагүй', value: stats.open },
          { label: 'Энэ долоо хоногт дуусах', value: stats.week },
          { label: 'Хоцорсон', value: stats.late, alert: stats.late > 0 },
          { label: 'Энэ долоо хоногт дууссан', value: stats.done },
        ]}
        actions={
          <>
            <Seg label="Харагдац" className="tk-viewseg" value={view} onChange={changeView}
              options={[{ value: 'board', label: 'Самбар', icon: <Columns3 className="ico" /> }, { value: 'list', label: 'Жагсаалт', icon: <ListIcon className="ico" /> }]} />
            <button type="button" className="btn btn--accent" onClick={() => open({ kind: 'newTask' })}>
              <Plus className="ico" />
              Шинэ ажил
            </button>
          </>
        }
      />

      <div className="tk-bar glass" role="search" aria-label="Ажил шүүх" data-enter>
        <div className="tk-bar__chips">
          <button ref={projPop.anchor} type="button" className={`tk-chip${project !== 'all' ? ' is-on' : ''}`} aria-haspopup="menu" aria-expanded={projPop.open} onClick={projPop.toggle}>
            {current ? <span className={`tk-hue hue--${current.hue}`} aria-hidden="true" /> : <Folder className="ico" />}
            <span className="tk-chip__label">{current ? current.name : project === 'none' ? 'Төсөлгүй' : 'Бүх төсөл'}</span>
            <ChevronDown className="ico caret" />
          </button>
          <button ref={whoPop.anchor} type="button" className={`tk-chip tk-whose${whose !== 'all' ? ' is-on' : ''}`} aria-haspopup="menu" aria-expanded={whoPop.open} onClick={whoPop.toggle}>
            <Avatar person={me} size="xs" />
            {WHOSE[whose].label}
            <ChevronDown className="ico caret" />
          </button>
          <button ref={prioPop.anchor} type="button" className={`tk-chip${prio !== 'all' ? ' is-on' : ''}`} aria-haspopup="menu" aria-expanded={prioPop.open} onClick={prioPop.toggle}>
            <Flag className="ico" />
            {prio === 'all' ? 'Бүх ач холбогдол' : PRIO[prio]}
            <ChevronDown className="ico caret" />
          </button>
        </div>
        <label className="tk-find">
          <Search className="ico" />
          <span className="sr-only">Нэр, төсөл, хүнээр шүүх</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Нэр, төсөл, хүнээр шүүх" />
        </label>
        {filtered && (
          <button type="button" className="btn btn--glass btn--sm" onClick={() => { setProject('all'); setWhose('all'); setPrio('all'); setQ('') }}>
            <X className="ico" />
            Шүүлтүүр арилгах
          </button>
        )}
      </div>

      <Menu state={projPop} label="Төслөөр шүүх" placement="bottom-start">
        {[{ id: 'all', name: 'Бүх төсөл', hue: undefined }, ...sc.projects.filter(p => p.status !== 'done'), { id: 'none', name: 'Төсөлгүй', hue: undefined }].map(p => {
          const n = ours.filter(t => t.status !== 'done' && (p.id === 'all' || (p.id === 'none' ? !t.project : t.project === p.id))).length
          return (
            <MenuItem key={p.id} checked={project === p.id} onSelect={() => { projPop.close(); setProject(p.id) }}>
              <span className="row" style={{ gap: 10 }}>
                <span className={`tk-hue${p.hue ? ` hue--${p.hue}` : p.id === 'all' ? ' tk-hue--all' : ' hue--blue'}`} aria-hidden="true" />
                {p.name}
                <small className="muted tnum" style={{ marginLeft: 6 }}>{n} дуусаагүй</small>
              </span>
            </MenuItem>
          )
        })}
      </Menu>
      <Menu state={whoPop} label="Ажлын хамаарлаар шүүх" placement="bottom-start">
        {(Object.keys(WHOSE) as Whose[]).map(k => (
          <MenuItem key={k} checked={whose === k} onSelect={() => { whoPop.close(); setWhose(k) }}>{WHOSE[k].label}</MenuItem>
        ))}
      </Menu>
      <Menu state={prioPop} label="Ач холбогдлоор шүүх" placement="bottom-start">
        <MenuItem checked={prio === 'all'} onSelect={() => { prioPop.close(); setPrio('all') }}>Бүх ач холбогдол</MenuItem>
        {(['urgent', 'high', 'medium', 'low'] as Priority[]).map(p => (
          <MenuItem key={p} checked={prio === p} onSelect={() => { prioPop.close(); setPrio(p) }}>{PRIO[p]}</MenuItem>
        ))}
      </Menu>

      {shown.length === 0 && filtered ? (
        <div className="card glass">
          <Empty icon={<Search className="ico" />} title="Тохирох ажил олдсонгүй" text="Өөр шүүлтүүр сонгох эсвэл бүгдийг арилгаж үзнэ үү." />
        </div>
      ) : view === 'board' ? (
        <Board tasks={shown} />
      ) : (
        <List tasks={shown} total={shown.length} />
      )}
    </div>
  )
}
