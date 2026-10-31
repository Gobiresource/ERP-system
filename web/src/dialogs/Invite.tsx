// A new person in the ХХК (Баг, Удирдлага): who they are, the login and first password they sign in with, and their
// rights here. Only an admin of the ХХК adds people; the password is kept only as its hash (lib/access.ts).
import { useState } from 'react'
import { actions, getState, scoped, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { PRESETS, loginKey, strongEnough } from '../lib/access'
import { collator, short } from '../lib/format'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Latin letters, figures, dot, dash and underscore: what a login may be */
const LOGIN = /^[a-z0-9._-]{3,32}$/

export function Invite() {
  const s = useApp()
  const teams = [...new Set(scoped(s).people.map(p => p.team))].sort(collator.compare)
  const [f, setF] = useState({ given: '', family: '', email: '', role: '', team: teams[0] ?? '', login: '', password: '', preset: 'staff' })
  // The login follows the e-mail until it is typed in itself
  const [ownLogin, setOwnLogin] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    const v = e.target.value
    setF(x => ({ ...x, [k]: v, ...(k === 'email' && !ownLogin ? { login: v.split('@')[0].toLowerCase() } : {}) }))
    if (k === 'login') setOwnLogin(true)
    if (errors[`inv-${k}`]) setErrors(({ [`inv-${k}`]: _, ...rest }) => rest)
  }

  const submit = () => {
    const e: Errors = {}
    const login = loginKey(f.login)
    if (!f.given.trim()) e['inv-given'] = 'Нэрийг бичнэ үү.'
    if (!f.family.trim()) e['inv-family'] = 'Овгийг бичнэ үү.'
    if (!f.email.trim()) e['inv-email'] = 'Имэйл хаягийг бичнэ үү.'
    else if (!EMAIL.test(f.email.trim())) e['inv-email'] = 'Имэйл хаяг буруу байна. Жишээ нь: bold@example.mn'
    if (!login) e['inv-login'] = 'Нэвтрэх нэрийг бичнэ үү.'
    else if (!LOGIN.test(login)) e['inv-login'] = 'Нэвтрэх нэр латин үсэг, тоотой, 3-аас 32 тэмдэгт байх ёстой.'
    else if (getState().people.some(p => p.account?.login === login)) e['inv-login'] = 'Энэ нэвтрэх нэр өөр хүнд бүртгэлтэй байна.'
    if (!f.password) e['inv-password'] = 'Түр нууц үгийг бичнэ үү.'
    else if (!strongEnough(f.password)) e['inv-password'] = 'Нууц үг 8-аас доошгүй тэмдэгттэй, үсэг, тоо хоёулаа орсон байх ёстой.'
    setErrors(e)
    if (Object.keys(e).length) return false
    const access = PRESETS.find(p => p.key === f.preset)!.access
    actions.invite({ given: f.given.trim(), family: f.family.trim(), email: f.email.trim(), role: f.role.trim() || 'Ажилтан', team: f.team }, login, f.password, { ...access })
      .then(p => (p ? toast(`${short(p)} нэмэгдлээ. «${login}» нэрээр нэвтэрнэ.`) : toast('Танд хэрэглэгч нэмэх эрх алга.', { kind: 'warn' })))
    return true
  }

  return (
    <FormSheet title="Хэрэглэгч нэмэх" sub="Шинэ хэрэглэгч энэ ХХК-д нэмэгдэж, доорх нэр, нууц үгээр нэвтэрнэ." submit="Нэмэх" onSubmit={submit} onClose={close} errors={errors}>
      <Field id="inv-given" label="Нэр" error={errors['inv-given']}>
        <input {...fieldAria('inv-given', errors['inv-given'])} value={f.given} onChange={set('given')} autoComplete="off" placeholder="Сараа" data-autofocus />
      </Field>
      <Field id="inv-family" label="Овог" error={errors['inv-family']}>
        <input {...fieldAria('inv-family', errors['inv-family'])} value={f.family} onChange={set('family')} autoComplete="off" placeholder="Бат" />
      </Field>
      <Field id="inv-email" label="Имэйл" error={errors['inv-email']} wide>
        <input {...fieldAria('inv-email', errors['inv-email'])} type="email" inputMode="email" value={f.email} onChange={set('email')} autoComplete="off" placeholder="saraa@example.mn" />
      </Field>
      <Field id="inv-role" label="Албан тушаал" optional>
        <input id="inv-role" value={f.role} onChange={set('role')} placeholder="Нягтлан бодогч" />
      </Field>
      <Field id="inv-team" label="Хэлтэс">
        <select id="inv-team" value={f.team} onChange={set('team')}>
          {teams.map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field id="inv-login" label="Нэвтрэх нэр" hint="Латин үсэг, тоо. Том, жижиг үсэг ялгахгүй." error={errors['inv-login']}>
        <input {...fieldAria('inv-login', errors['inv-login'], true)} value={f.login} onChange={set('login')} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="saraa" />
      </Field>
      <Field id="inv-password" label="Түр нууц үг" hint="Хэрэглэгч нэвтэрсний дараа Тохиргооноос солино." error={errors['inv-password']}>
        <input {...fieldAria('inv-password', errors['inv-password'], true)} type="text" value={f.password} onChange={set('password')} autoComplete="new-password" spellCheck={false} />
      </Field>
      <Field id="inv-preset" label="Эрх" hint={PRESETS.find(p => p.key === f.preset)?.hint} wide>
        <select {...fieldAria('inv-preset', undefined, true)} value={f.preset} onChange={set('preset')}>
          {PRESETS.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
        </select>
      </Field>
    </FormSheet>
  )
}
