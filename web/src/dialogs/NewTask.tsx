import { useState } from 'react'
import type { Priority, Task, TaskStatus } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { collator, short, today } from '../lib/format'
import { PRIO, STATUS, STATUSES } from '../ui/bits'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'

export function NewTask({ defaults = {} }: { defaults?: Partial<Task> }) {
  const s = useApp()
  const sc = scoped(s)
  const [f, setF] = useState({
    title: defaults.title ?? '',
    project: defaults.project ?? '',
    assignee: defaults.assignee ?? s.me,
    prio: (defaults.prio ?? 'medium') as Priority,
    due: defaults.due ?? today(),
    status: (defaults.status ?? 'todo') as TaskStatus,
    estimate: String(defaults.estimate ?? 2),
  })
  const [errors, setErrors] = useState<Errors>({})
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    if (errors[`nt-${k}`]) setErrors(({ [`nt-${k}`]: _, ...rest }) => rest)
  }
  const people = [...sc.people].sort((a, b) => collator.compare(a.given, b.given))

  const submit = () => {
    const e: Errors = {}
    if (!f.title.trim()) e['nt-title'] = 'Ажлын нэрийг бичнэ үү.'
    if (!f.due) e['nt-due'] = 'Дуусах өдрийг сонгоно уу.'
    const est = Number(f.estimate.replace(',', '.'))
    if (!Number.isFinite(est) || est < 0 || est > 200) e['nt-estimate'] = 'Цагийг 0-ээс 200 хүртэлх тоогоор бичнэ үү.'
    setErrors(e)
    if (Object.keys(e).length) return false
    actions.addTask({ title: f.title.trim(), project: f.project || undefined, assignee: f.assignee, prio: f.prio, due: f.due, status: f.status, estimate: est })
    toast('Ажил нэмэгдлээ.')
    return true
  }

  return (
    <FormSheet title="Шинэ ажил" submit="Нэмэх" onSubmit={submit} onClose={close} errors={errors}>
      <Field id="nt-title" label="Ажлын нэр" error={errors['nt-title']} wide>
        <input {...fieldAria('nt-title', errors['nt-title'])} value={f.title} onChange={set('title')} placeholder="Юу хийх вэ?" autoFocus />
      </Field>
      <Field id="nt-project" label="Төсөл">
        <select id="nt-project" value={f.project} onChange={set('project')}>
          <option value="">Төсөлгүй</option>
          {sc.projects.filter(p => p.status !== 'done' || p.id === f.project).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field id="nt-assignee" label="Хариуцагч">
        <select id="nt-assignee" value={f.assignee} onChange={set('assignee')}>
          {people.map(p => <option key={p.id} value={p.id}>{short(p)}{p.id === s.me ? ' (та)' : ''}</option>)}
        </select>
      </Field>
      <Field id="nt-prio" label="Ач холбогдол">
        <select id="nt-prio" value={f.prio} onChange={set('prio')}>
          {(['low', 'medium', 'high', 'urgent'] as Priority[]).map(p => <option key={p} value={p}>{PRIO[p]}</option>)}
        </select>
      </Field>
      <Field id="nt-due" label="Дуусах өдөр" error={errors['nt-due']}>
        <input {...fieldAria('nt-due', errors['nt-due'])} type="date" value={f.due} onChange={set('due')} />
      </Field>
      <Field id="nt-status" label="Төлөв">
        <select id="nt-status" value={f.status} onChange={set('status')}>
          {STATUSES.map(st => <option key={st} value={st}>{STATUS[st]}</option>)}
        </select>
      </Field>
      <Field id="nt-estimate" label="Төлөвлөсөн цаг" error={errors['nt-estimate']}>
        <input {...fieldAria('nt-estimate', errors['nt-estimate'])} inputMode="decimal" value={f.estimate} onChange={set('estimate')} />
      </Field>
    </FormSheet>
  )
}
