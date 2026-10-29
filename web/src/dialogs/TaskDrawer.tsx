// Task details: status, people and dates, subtasks, comments, done / reopen, delete.
import { useState } from 'react'
import { Calendar, Clock, Folder, RotateCcw, Trash, User } from 'lucide-react'
import '../styles/screens/tasks.css'
import type { TaskStatus } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { close, open, toast } from '../lib/ui'
import { go } from '../lib/router'
import { ago, dateDots, daysFromToday, dueLabel, monthDayDots, parse, short } from '../lib/format'
import { Sheet, useCloseSheet } from '../ui/Sheet'
import { Seg } from '../ui/Seg'
import { Avatar, Prio, ProjectChip, STATUS, STATUSES } from '../ui/bits'
import { moveTask } from '../screens/tasks/TaskCard'

/** "Маргааш (10.30)" near today, otherwise "2026.11.19" */
function dueText(due: string) {
  const label = dueLabel(due)
  return /^\d/.test(label) ? dateDots(parse(due)) : `${label} (${monthDayDots(parse(due))})`
}

export function TaskDrawer({ id }: { id: string }) {
  return (
    <Sheet kind="drawer" label="Ажлын дэлгэрэнгүй" onClose={close}>
      <Body id={id} />
    </Sheet>
  )
}

function Body({ id }: { id: string }) {
  const s = useApp()
  const sc = scoped(s)
  const closeSheet = useCloseSheet()
  const t = s.tasks.find(x => x.id === id)
  const [sub, setSub] = useState('')
  const [comment, setComment] = useState('')
  const [confirm, setConfirm] = useState(false)
  if (!t) return <p className="tp-none">Энэ ажил устсан байна.</p>

  const p = sc.project(t.project)
  const who = sc.person(t.assignee)
  const late = t.status !== 'done' && daysFromToday(t.due) < 0
  const subsDone = t.subtasks.filter(x => x.done).length

  const addSub = () => {
    if (!sub.trim()) return
    actions.addSubtask(t.id, sub.trim())
    setSub('')
  }
  const addComment = () => {
    if (!comment.trim()) return
    actions.addComment(t.id, comment.trim())
    setComment('')
  }
  const remove = () => {
    const undo = actions.removeTask(t.id)
    closeSheet()
    toast(`Устгалаа: ${t.title}`, { undo })
  }

  return (
    <div className="tp">
      <div className="tp__top">
        <ProjectChip project={p} />
        <Prio prio={t.prio} always />
        {late && <span className="prio prio--urgent">Хоцорсон</span>}
      </div>
      <h2 className="tp__title">{t.title}</h2>

      <div className="tp__seg">
        <Seg<TaskStatus> label="Төлөв" value={t.status} onChange={st => moveTask(t, st)} options={STATUSES.map(st => ({ value: st, label: STATUS[st] }))} />
      </div>

      <dl className="meta tp__meta">
        <div>
          <dt>Хариуцагч</dt>
          <dd>
            {who ? (
              <button type="button" className="row" style={{ gap: 8 }} onClick={() => open({ kind: 'person', id: who.id })}>
                <Avatar person={who} size="xs" />
                <span>{short(who)}</span>
              </button>
            ) : <><User className="ico" /><span>Оноогоогүй</span></>}
          </dd>
        </div>
        <div>
          <dt>Дуусах хугацаа</dt>
          <dd className={late ? 'tk-due is-late' : undefined}><Calendar className="ico" /><span className="tnum">{dueText(t.due)}</span></dd>
        </div>
        <div>
          <dt>Төсөл</dt>
          <dd>
            <Folder className="ico" />
            {p ? <button type="button" onClick={() => { close(); go('projects', p.id) }}>{p.name}</button> : <span>Төсөлгүй</span>}
          </dd>
        </div>
        <div>
          <dt>Төлөвлөсөн хугацаа</dt>
          <dd><Clock className="ico" /><span className="tnum">{t.estimate} цаг</span></dd>
        </div>
      </dl>

      <section className="block" aria-labelledby="tp-subs">
        <header><h3 id="tp-subs">Дэд ажил</h3><span className="badge tnum">{subsDone}/{t.subtasks.length}</span></header>
        {t.subtasks.length === 0 && <p className="tp-none">Дэд ажил алга. Доор нэмж болно.</p>}
        <div className="tp__subs">
          {t.subtasks.map(x => (
            <div className="tp-sub" key={x.id}>
              <label>
                <input type="checkbox" className="check" checked={x.done} onChange={() => actions.toggleSubtask(t.id, x.id)} />
                <span>{x.title}</span>
              </label>
            </div>
          ))}
        </div>
        <form className="tp__add" onSubmit={e => { e.preventDefault(); addSub() }}>
          <label className="sr-only" htmlFor="tp-new-sub">Шинэ дэд ажил</label>
          <input id="tp-new-sub" className="input" value={sub} onChange={e => setSub(e.target.value)} placeholder="Дэд ажил нэмэх" />
          <button type="submit" className="btn btn--glass btn--sm">Нэмэх</button>
        </form>
      </section>

      <section className="block" aria-labelledby="tp-comments">
        <header><h3 id="tp-comments">Сэтгэгдэл</h3><span className="badge tnum">{t.comments.length}</span></header>
        <div className="tp__comments">
          {t.comments.length === 0 && <p className="tp-none">Сэтгэгдэл алга.</p>}
          {t.comments.map(c => {
            const a = sc.person(c.author) ?? s.people.find(x => x.id === c.author)
            return (
              <div className="tp-comment" key={c.id}>
                {a && <Avatar person={a} size="sm" />}
                <div>
                  <small><b style={{ color: 'var(--text)' }}>{a ? short(a) : 'Хэн нэгэн'}</b> · {ago(c.at)}</small>
                  <p>{c.text}</p>
                </div>
              </div>
            )
          })}
        </div>
        <form className="tp__add" onSubmit={e => { e.preventDefault(); addComment() }}>
          <label className="sr-only" htmlFor="tp-new-comment">Сэтгэгдэл бичих</label>
          <input id="tp-new-comment" className="input" value={comment} onChange={e => setComment(e.target.value)} placeholder="Сэтгэгдэл бичих" />
          <button type="submit" className="btn btn--glass btn--sm">Илгээх</button>
        </form>
      </section>

      {confirm ? (
        <div className="tp__confirm" role="alertdialog" aria-labelledby="tp-del-q">
          <p id="tp-del-q">Энэ ажлыг устгах уу? Дэд ажил, сэтгэгдэл нь хамт устна.</p>
          <div>
            <button type="button" className="btn btn--glass btn--sm" onClick={() => setConfirm(false)} autoFocus>Болих</button>
            <button type="button" className="btn btn--danger btn--sm" onClick={remove}>Устгах</button>
          </div>
        </div>
      ) : (
        <div className="tp__foot">
          {t.status === 'done' ? (
            <button type="button" className="btn btn--glass" onClick={() => moveTask(t, 'todo')}><RotateCcw className="ico" />Дахин нээх</button>
          ) : (
            <button type="button" className="btn btn--accent" onClick={() => moveTask(t, 'done')}>Дууссан гэж тэмдэглэх</button>
          )}
          <button type="button" className="btn btn--ghost tp__del" style={{ color: 'var(--danger)' }} onClick={() => setConfirm(true)}>
            <Trash className="ico" />
            Устгах
          </button>
        </div>
      )}
    </div>
  )
}
