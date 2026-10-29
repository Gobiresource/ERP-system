import { useState } from 'react'
import { actions, scoped, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { collator, short } from '../lib/format'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Invite() {
  const s = useApp()
  const teams = [...new Set(scoped(s).people.map(p => p.team))].sort(collator.compare)
  const [f, setF] = useState({ given: '', family: '', email: '', role: '', team: teams[0] ?? '' })
  const [errors, setErrors] = useState<Errors>({})
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    if (errors[`inv-${k}`]) setErrors(({ [`inv-${k}`]: _, ...rest }) => rest)
  }

  const submit = () => {
    const e: Errors = {}
    if (!f.given.trim()) e['inv-given'] = 'Нэрийг бичнэ үү.'
    if (!f.family.trim()) e['inv-family'] = 'Овгийг бичнэ үү.'
    if (!f.email.trim()) e['inv-email'] = 'Имэйл хаягийг бичнэ үү.'
    else if (!EMAIL.test(f.email.trim())) e['inv-email'] = 'Имэйл хаяг буруу байна. Жишээ нь: bold@example.mn'
    setErrors(e)
    if (Object.keys(e).length) return false
    const p = actions.invite({ given: f.given.trim(), family: f.family.trim(), email: f.email.trim(), role: f.role.trim() || 'Ажилтан', team: f.team })
    toast(`${short(p)} багт нэмэгдлээ.`)
    return true
  }

  return (
    <FormSheet title="Хүн нэмэх" sub="Шинэ хүн энэ компанийн багт нэмэгдэнэ." submit="Нэмэх" onSubmit={submit} onClose={close} errors={errors}>
      <Field id="inv-given" label="Нэр" error={errors['inv-given']}>
        <input {...fieldAria('inv-given', errors['inv-given'])} value={f.given} onChange={set('given')} autoComplete="given-name" placeholder="Сараа" autoFocus />
      </Field>
      <Field id="inv-family" label="Овог" error={errors['inv-family']}>
        <input {...fieldAria('inv-family', errors['inv-family'])} value={f.family} onChange={set('family')} autoComplete="family-name" placeholder="Бат" />
      </Field>
      <Field id="inv-email" label="Имэйл" error={errors['inv-email']} wide>
        <input {...fieldAria('inv-email', errors['inv-email'])} type="email" inputMode="email" value={f.email} onChange={set('email')} autoComplete="email" placeholder="saraa@example.mn" />
      </Field>
      <Field id="inv-role" label="Албан тушаал" optional>
        <input id="inv-role" value={f.role} onChange={set('role')} placeholder="Нягтлан бодогч" />
      </Field>
      <Field id="inv-team" label="Хэлтэс">
        <select id="inv-team" value={f.team} onChange={set('team')}>
          {teams.map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
    </FormSheet>
  )
}
