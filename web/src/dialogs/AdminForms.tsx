// Удирдлага windows: a new password an admin gives someone who forgot theirs; they change it after signing in
import { useState } from 'react'
import type { Id } from '../lib/types'
import { actions, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { strongEnough } from '../lib/access'
import { short } from '../lib/format'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'

export function PasswordReset({ id }: { id: Id }) {
  const p = useApp().people.find(x => x.id === id)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  if (!p) return null
  const submit = () => {
    if (!strongEnough(password)) {
      setErrors({ 'pw-new': password ? 'Нууц үг 8-аас доошгүй тэмдэгттэй, үсэг, тоо хоёулаа орсон байх ёстой.' : 'Шинэ нууц үгийг бичнэ үү.' })
      return false
    }
    actions.setPassword(id, password).then(ok => toast(ok ? 'Нууц үг шинэчлэгдлээ. Шинэ нууц үгийг хэрэглэгчид дамжуулна уу.' : 'Танд нууц үг шинэчлэх эрх алга.', { kind: ok ? 'ok' : 'warn' }))
    return true
  }
  return (
    <FormSheet title="Нууц үг шинэчлэх" sub={short(p)} submit="Хадгалах" onSubmit={submit} onClose={close} errors={errors}>
      <Field id="pw-new" label="Шинэ нууц үг" hint="Хэрэглэгч нэвтэрсний дараа Тохиргооноос солино." error={errors['pw-new']} wide>
        <input {...fieldAria('pw-new', errors['pw-new'], true)} type="text" value={password} onChange={e => { setPassword(e.target.value); setErrors({}) }} autoComplete="new-password" spellCheck={false} data-autofocus />
      </Field>
    </FormSheet>
  )
}
