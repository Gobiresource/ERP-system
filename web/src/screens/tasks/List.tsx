// The task list: grouped by status, sorted by due date or priority. Rows show at once (no row-by-row animation).
import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Priority, Task, TaskStatus } from '../../lib/types'
import { scoped, useApp } from '../../lib/store'
import { open } from '../../lib/ui'
import { checkPop } from '../../lib/motion'
import { short } from '../../lib/format'
import { Avatar, Prio, ProjectChip, STATUS, STATUSES } from '../../ui/bits'
import { Seg } from '../../ui/Seg'
import { DueTag, moveTask } from './TaskCard'

const RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export function List({ tasks, total }: { tasks: Task[]; total: number }) {
  const s = useApp()
  const sc = scoped(s)
  const [sort, setSort] = useState<'due' | 'prio'>('due')
  const [closed, setClosed] = useState<Partial<Record<TaskStatus, boolean>>>({ done: true })

  const groups = useMemo(() => {
    const cmp = (a: Task, b: Task) => (sort === 'due' ? a.due.localeCompare(b.due) || RANK[a.prio] - RANK[b.prio] : RANK[a.prio] - RANK[b.prio] || a.due.localeCompare(b.due))
    return STATUSES.map(st => ({ st, list: tasks.filter(t => t.status === st).sort(cmp) }))
  }, [tasks, sort])

  return (
    <section className="card glass tk-listcard" aria-labelledby="list-title" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="list-title">Бүх ажил</h2>
          <p className="card__sub">Нийт {total} ажил байна.</p>
        </div>
        <div className="card__tools">
          <Seg small label="Эрэмбэлэх" value={sort} onChange={setSort} options={[{ value: 'due', label: 'Хугацаагаар' }, { value: 'prio', label: 'Ач холбогдлоор' }]} />
        </div>
      </div>
      <div className="tk-groups">
        {groups.map(({ st, list }) => (
          <div key={st}>
            <h3 style={{ font: 'inherit' }}>
              <button type="button" className="tk-group__btn" aria-expanded={!closed[st]} onClick={() => setClosed({ ...closed, [st]: !closed[st] })}>
                <ChevronDown className="ico tk-group__chev" />
                <span className={`tk-dot tk-dot--${st}`} aria-hidden="true" />
                {STATUS[st]}
                <span className="badge tnum">{list.length}</span>
              </button>
            </h3>
            {!closed[st] && (
              <div className="tk-rows">
                {list.map(t => {
                  const p = sc.project(t.project)
                  const who = sc.person(t.assignee)
                  return (
                    <div key={t.id} className={`tk-row${t.status === 'done' ? ' is-done' : ''}`}>
                      <input type="checkbox" className="check" checked={t.status === 'done'} aria-label={`${t.title}: дууссан`}
                        onChange={e => {
                          if (e.target.checked) checkPop(e.target)
                          moveTask(t, e.target.checked ? 'done' : 'todo')
                        }} />
                      <button type="button" className="tk-row__title" onClick={() => open({ kind: 'task', id: t.id })}>{t.title}</button>
                      <div className="tk-row__meta">
                        <span className="tk-row__proj">{p && <ProjectChip project={p} />}</span>
                        <DueTag task={t} className="tk-row__due" />
                        <span className="tk-row__prio"><Prio prio={t.prio} always /></span>
                      </div>
                      <span className="tk-row__who">{who && <><Avatar person={who} size="sm" /><span className="sr-only">Хариуцагч: {short(who)}</span></>}</span>
                    </div>
                  )
                })}
                {list.length === 0 && <p className="tp-none" style={{ padding: '8px 10px' }}>Ажил алга.</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
