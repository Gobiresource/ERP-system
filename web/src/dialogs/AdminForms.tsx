// Удирдлага windows: a new password an admin gives someone who forgot theirs, and they change after signing in; with a
// server, the sign-in link instead, with which a person makes their own (server/api.ts)
import { useRef, useState } from 'react'
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

/** A sign-in link to send: copied in one press; or, where the browser will not copy, chosen for the person to copy */
export function SigninLink({ id, url }: { id: Id; url: string }) {
  const p = useApp().people.find(x => x.id === id)
  const field = useRef<HTMLInputElement>(null)
  const copy = () => {
    // No clipboard at all (an address without https): chosen, as when copying is refused
    ;(navigator.clipboard?.writeText(url) ?? Promise.reject()).then(
      () => { toast('Холбоос хуулагдлаа.'); close() },
      () => { field.current?.select(); toast('Хуулж чадсангүй. Холбоосыг сонгосон тул Ctrl+C дарж хуулна уу.', { kind: 'warn' }) },
    )
    return false
  }
  return (
    <FormSheet title="Нэвтрэх холбоос" sub={p ? short(p) : undefined} submit="Хуулах" onSubmit={copy} onClose={close} errors={{}}>
      <Field id="sl-url" label="Холбоос" wide
        hint={`Холбоосыг тухайн хүнд Messenger, имэйл зэргээр илгээнэ үү. Хэрэглэгч холбоосоор орж нууц үгээ өөрөө үүсгээд «${p?.account?.login ?? ''}» нэвтрэх нэрээр нэвтэрнэ. Холбоос 7 хоногийн дотор нэг удаа ажиллана. Шинэ холбоос үүсгэвэл өмнөх нь хүчингүй болно.`}>
        <input id="sl-url" ref={field} value={url} readOnly onFocus={e => e.target.select()} spellCheck={false} data-autofocus />
      </Field>
    </FormSheet>
  )
}
