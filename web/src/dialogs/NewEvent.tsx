import { useState } from 'react'
import type { CalEvent, EventKind } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { duration, today } from '../lib/format'
import { KIND } from '../ui/bits'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'

const LENGTHS = [15, 30, 45, 60, 90, 120, 180]

export function NewEvent({ defaults = {} }: { defaults?: Partial<CalEvent> }) {
  const s = useApp()
  const sc = scoped(s)
  const [date0, time0 = '10:00'] = (defaults.start ?? `${today()}T10:00`).split('T')
  const [f, setF] = useState({
    title: defaults.title ?? '', date: date0, time: time0, minutes: String(defaults.minutes ?? 30),
    kind: (defaults.kind ?? 'meeting') as EventKind, project: defaults.project ?? '', where: defaults.where ?? '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    if (errors[`ne-${k}`]) setErrors(({ [`ne-${k}`]: _, ...rest }) => rest)
  }

  const submit = () => {
    const e: Errors = {}
    if (!f.title.trim()) e['ne-title'] = 'Үйл явдлын нэрийг бичнэ үү.'
    if (!f.date) e['ne-date'] = 'Огноог сонгоно уу.'
    if (!f.time) e['ne-time'] = 'Эхлэх цагийг сонгоно уу.'
    setErrors(e)
    if (Object.keys(e).length) return false
    actions.addEvent({ title: f.title.trim(), start: `${f.date}T${f.time}`, minutes: Number(f.minutes), kind: f.kind, project: f.project || undefined, where: f.where.trim() || undefined, attendees: [s.me] })
    toast('Үйл явдал нэмэгдлээ.')
    return true
  }

  return (
    <FormSheet title="Шинэ үйл явдал" submit="Нэмэх" onSubmit={submit} onClose={close} errors={errors}>
      <Field id="ne-title" label="Нэр" error={errors['ne-title']} wide>
        <input {...fieldAria('ne-title', errors['ne-title'])} value={f.title} onChange={set('title')} placeholder="Төслийн хэлэлцүүлэг" autoFocus />
      </Field>
      <Field id="ne-date" label="Огноо" error={errors['ne-date']}>
        <input {...fieldAria('ne-date', errors['ne-date'])} type="date" value={f.date} onChange={set('date')} />
      </Field>
      <Field id="ne-time" label="Эхлэх цаг" error={errors['ne-time']}>
        <input {...fieldAria('ne-time', errors['ne-time'])} type="time" step={900} value={f.time} onChange={set('time')} />
      </Field>
      <Field id="ne-minutes" label="Үргэлжлэх хугацаа">
        <select id="ne-minutes" value={f.minutes} onChange={set('minutes')}>
          {LENGTHS.map(m => <option key={m} value={m}>{duration(m)}</option>)}
        </select>
      </Field>
      <Field id="ne-kind" label="Төрөл">
        <select id="ne-kind" value={f.kind} onChange={set('kind')}>
          {(Object.keys(KIND) as EventKind[]).map(k => <option key={k} value={k}>{KIND[k]}</option>)}
        </select>
      </Field>
      <Field id="ne-project" label="Төсөл">
        <select id="ne-project" value={f.project} onChange={set('project')}>
          <option value="">Төсөлгүй</option>
          {sc.projects.filter(p => p.status !== 'done').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field id="ne-where" label="Хаана" optional>
        <input id="ne-where" value={f.where} onChange={set('where')} placeholder="Хурлын өрөө 1" />
      </Field>
    </FormSheet>
  )
}
