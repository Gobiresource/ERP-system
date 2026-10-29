import { memo, type Ref } from 'react'
import { Calendar, Check, Ellipsis, MessageSquare } from 'lucide-react'
import type { Person, Project, Task, TaskStatus } from '../../lib/types'
import { actions, getState } from '../../lib/store'
import { open, toast } from '../../lib/ui'
import { daysFromToday, dueLabel, short } from '../../lib/format'
import { Avatar, Prio, ProjectChip, STATUS, STATUSES } from '../../ui/bits'
import { Menu, MenuItem, usePopover } from '../../ui/Popover'

export function DueTag({ task, className = 'tk-due' }: { task: Task; className?: string }) {
  const n = daysFromToday(task.due)
  const done = task.status === 'done'
  const cls = done ? '' : n < 0 ? ' is-late' : n === 0 ? ' is-today' : ''
  return (
    <span className={className + cls}>
      {done ? <Check className="ico" /> : <Calendar className="ico" />}
      {!done && n < 0 && <span className="sr-only">Хоцорсон: </span>}
      {dueLabel(task.due)}
    </span>
  )
}

/** Moves a task (optionally before another one) and offers Undo, like Pane's "Moved to …" message */
export function moveTask(t: Task, status: TaskStatus, before?: string) {
  const list = getState().tasks
  const after = list[list.findIndex(x => x.id === t.id) + 1]?.id
  actions.moveTask(t.id, status, before)
  const undo = () => {
    actions.moveTask(t.id, t.status, after)
    if (t.doneAt) actions.updateTask(t.id, { doneAt: t.doneAt })
  }
  toast(status === 'done' ? `Дууссан: ${t.title}` : `Шилжүүллээ: ${STATUS[status]}`, { undo })
}

/**
 * A task on the board. The menu is the keyboard way to move a card to another column.
 * Memoised with its project and person passed in, so a drag only redraws the cards that change.
 */
export const TaskCard = memo(function TaskCard({ task: t, project: p, person: who, ref, lifted, away, menu = true }: {
  task: Task
  project?: Project
  person?: Person
  ref?: Ref<HTMLElement>
  lifted?: boolean
  away?: boolean
  menu?: boolean
}) {
  const subsDone = t.subtasks.filter(x => x.done).length
  const pop = usePopover()
  const done = t.status === 'done'

  return (
    <article ref={ref} className={`tk-card${done ? ' is-done' : ''}${lifted ? ' is-lifted' : ''}${away ? ' is-away' : ''}`} data-id={t.id}>
      <div className="tk-card__top">
        <ProjectChip project={p} />
        <Prio prio={t.prio} />
        {menu && (
          <>
            <button ref={pop.anchor} type="button" className="tk-card__more" aria-label={`${t.title}: үйлдэл`} aria-haspopup="menu" aria-expanded={pop.open} onClick={pop.toggle}>
              <Ellipsis className="ico" />
            </button>
            <Menu state={pop} label="Ажлын үйлдэл">
              <MenuItem onSelect={() => { pop.close(); open({ kind: 'task', id: t.id }) }}>Нээх</MenuItem>
              <hr />
              <p className="menu__label" aria-hidden="true">Шилжүүлэх</p>
              {STATUSES.map(st => (
                <MenuItem key={st} checked={t.status === st} onSelect={() => { pop.close(); if (st !== t.status) moveTask(t, st) }}>{STATUS[st]}</MenuItem>
              ))}
            </Menu>
          </>
        )}
      </div>
      <button type="button" className="tk-card__open" onClick={() => open({ kind: 'task', id: t.id })}>
        {done && <span className="tk-card__check" aria-hidden="true"><Check className="ico" /></span>}
        <span className="tk-card__text">{t.title}</span>
        {done && <span className="sr-only">, дууссан</span>}
      </button>
      {t.subtasks.length > 0 && (
        <div className={`tk-card__subs hue--${p?.hue ?? 'blue'}`}>
          <span className="tk-meter" aria-hidden="true"><i style={{ transform: `scaleX(${subsDone / t.subtasks.length})` }} /></span>
          <span className="tnum"><span className="sr-only">Дэд ажил </span>{subsDone}/{t.subtasks.length}</span>
        </div>
      )}
      <div className="tk-card__foot">
        <DueTag task={t} />
        {t.comments.length > 0 && (
          <span className="tk-meta"><MessageSquare className="ico" /><span className="tnum">{t.comments.length}</span><span className="sr-only"> сэтгэгдэл</span></span>
        )}
        {who && (
          <span className="tk-card__who">
            <Avatar person={who} size="xs" />
            <span className="sr-only">Хариуцагч: {short(who)}</span>
          </span>
        )}
      </div>
    </article>
  )
})
