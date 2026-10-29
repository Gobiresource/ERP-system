import { useState } from 'react'
import type { Hue, ProjectIcon } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { go } from '../lib/router'
import { addDaysYmd, collator, short, today } from '../lib/format'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'

const HUES: [Hue, string][] = [['blue', 'Цэнхэр'], ['indigo', 'Хөх'], ['purple', 'Нил ягаан'], ['pink', 'Ягаан'], ['orange', 'Улбар шар'], ['yellow', 'Шар'], ['green', 'Ногоон'], ['teal', 'Усан цэнхэр']]
const ICONS: [ProjectIcon, string][] = [['rocket', 'Шинэ эхлэл'], ['building', 'Барилга'], ['file', 'Баримт бичиг'], ['clipboard', 'Жагсаалт'], ['monitor', 'Компьютер'], ['graduation', 'Сургалт'], ['truck', 'Тээвэр'], ['boxes', 'Агуулах'], ['handshake', 'Гэрээ'], ['receipt', 'Төлбөр']]

export function NewProject() {
  const s = useApp()
  const sc = scoped(s)
  const [f, setF] = useState({ name: '', goal: '', lead: s.me, hue: 'indigo' as Hue, due: addDaysYmd(today(), 30), icon: 'rocket' as ProjectIcon })
  const [errors, setErrors] = useState<Errors>({})
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    if (errors[`np-${k}`]) setErrors(({ [`np-${k}`]: _, ...rest }) => rest)
  }

  const submit = () => {
    const e: Errors = {}
    if (!f.name.trim()) e['np-name'] = 'Төслийн нэрийг бичнэ үү.'
    if (!f.due) e['np-due'] = 'Дуусах өдрийг сонгоно уу.'
    else if (f.due < today()) e['np-due'] = 'Дуусах өдөр өнөөдрөөс хойш байх ёстой.'
    setErrors(e)
    if (Object.keys(e).length) return false
    const p = actions.addProject({ name: f.name.trim(), goal: f.goal.trim(), lead: f.lead, hue: f.hue, icon: f.icon, status: 'active', start: today(), due: f.due })
    toast('Төсөл үүсгэгдлээ.')
    go('projects', p.id)
    return true
  }

  return (
    <FormSheet title="Шинэ төсөл" submit="Үүсгэх" onSubmit={submit} onClose={close} errors={errors}>
      <Field id="np-name" label="Нэр" error={errors['np-name']} wide>
        <input {...fieldAria('np-name', errors['np-name'])} value={f.name} onChange={set('name')} placeholder="Хаврын борлуулалтын аян" autoFocus />
      </Field>
      <Field id="np-goal" label="Зорилго" hint="Багийнхан бүгд санахуйц нэг хоёр өгүүлбэр." wide optional>
        <textarea id="np-goal" aria-describedby="np-goal-hint" value={f.goal} onChange={set('goal')} />
      </Field>
      <Field id="np-lead" label="Удирдагч">
        <select id="np-lead" value={f.lead} onChange={set('lead')}>
          {[...sc.people].sort((a, b) => collator.compare(a.given, b.given)).map(p => <option key={p.id} value={p.id}>{short(p)}</option>)}
        </select>
      </Field>
      <Field id="np-hue" label="Өнгө">
        <select id="np-hue" value={f.hue} onChange={set('hue')}>
          {HUES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field id="np-due" label="Дуусах өдөр" error={errors['np-due']}>
        <input {...fieldAria('np-due', errors['np-due'])} type="date" value={f.due} onChange={set('due')} />
      </Field>
      <Field id="np-icon" label="Дүрс">
        <select id="np-icon" value={f.icon} onChange={set('icon')}>
          {ICONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
    </FormSheet>
  )
}
