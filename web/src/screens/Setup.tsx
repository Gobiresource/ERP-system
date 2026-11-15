// Системийг эхлүүлэх: shown instead of Нэвтрэх while nobody can sign in. The first person names the ХХК and makes
// their own account, which holds every right; they are signed in at once and welcomed like anyone at a first sign-in.
// The system starts with nothing made up (the user's decision, docs/decisions.md, 2026-11-15). With a server behind the
// app (lib/sync.ts) the system is founded there, for everyone: on a public address only with the code its owner put in
// the server's settings, so that no stranger takes every right first.
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { LoaderCircle, Rocket } from 'lucide-react'
import '../styles/screens/login.css'
import { actions } from '../lib/store'
import { loginKey, strongEnough } from '../lib/access'
import { enter } from '../lib/auth'
import { link } from '../lib/sync'
import { Wallpaper } from '../shell/Wallpaper'
import { Field, fieldAria, type Errors } from '../ui/FormSheet'

/** Latin letters, figures, dot, dash and underscore: what a login may be (as in dialogs/Invite.tsx) */
const LOGIN = /^[a-z0-9._-]{3,32}$/

export default function Setup() {
  const [f, setF] = useState({ company: '', family: '', given: '', role: '', login: '', password: '', again: '', code: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const summary = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(0) // bumps on a failed submit; fixing a field must not move focus
  useLayoutEffect(() => {
    if (shown) summary.current?.focus()
  }, [shown])

  const put = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF(x => ({ ...x, [k]: e.target.value }))
    if (errors[`su-${k}`]) setErrors(({ [`su-${k}`]: _, ...rest }) => rest)
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const err: Errors = {}
    const name = loginKey(f.login)
    if (!f.company.trim()) err['su-company'] = 'ХХК-ийн нэрийг бичнэ үү.'
    if (!f.family.trim()) err['su-family'] = 'Эцэг/эхийн нэрийг бичнэ үү.'
    if (!f.given.trim()) err['su-given'] = 'Нэрийг бичнэ үү.'
    if (!name) err['su-login'] = 'Нэвтрэх нэрийг бичнэ үү.'
    else if (!LOGIN.test(name)) err['su-login'] = 'Нэвтрэх нэр латин үсэг, тоотой, 3-аас 32 тэмдэгт байх ёстой.'
    if (!f.password) err['su-password'] = 'Нууц үгээ бичнэ үү.'
    else if (!strongEnough(f.password)) err['su-password'] = 'Нууц үг 8-аас доошгүй тэмдэгттэй, үсэг, тоо хоёулаа орсон байх ёстой.'
    else if (f.again !== f.password) err['su-again'] = 'Нууц үг таарахгүй байна.'
    if (link.code && !f.code.trim()) err['su-code'] = 'Ирцийн кодоо бичнэ үү.'
    setErrors(err)
    if (Object.keys(err).length) return setShown(n => n + 1)
    setBusy(true)
    const me = await actions.setUp(f.company.trim(), { given: f.given.trim(), family: f.family.trim(), role: f.role.trim() || 'Захирал' }, name, f.password, f.code)
    if (me && 'error' in me) {
      // The server said no: a wrong code is the code field's to fix, anything else the form's
      setBusy(false)
      setErrors({ [me.field === 'code' ? 'su-code' : 'su-company']: me.error })
      return setShown(n => n + 1)
    }
    // In at once, the way everyone comes in: the first sign-in is noted and the welcome page opens
    if (me) enter(me.id)
    // Someone else set the system up meanwhile: the sign-in page is next
    else location.reload()
  }

  return (
    <div className="login">
      <Wallpaper />
      <main className="login__main">
        <form className="login__card login__card--wide glass glass--thick" onSubmit={submit} noValidate aria-labelledby="setup-t">
          <span className="login__icon" aria-hidden="true"><Rocket className="ico" /></span>
          <h1 className="login__title" id="setup-t">Системийг эхлүүлэх</h1>
          <p className="login__sub">Байгууллага болон өөрийн бүртгэлээ үүсгэнэ үү. Энэ бүртгэл системийн бүх эрхтэй байна.</p>
          {Object.keys(errors).length > 0 && (
            <div className="mform__errors login__errors" role="alert" tabIndex={-1} ref={summary}>
              <b>Дараах зүйлийг засна уу:</b>
              <ul>
                {Object.entries(errors).map(([id, msg]) => (
                  <li key={id}><a href={`#${id}`} onClick={e => { e.preventDefault(); document.getElementById(id)?.focus() }}>{msg}</a></li>
                ))}
              </ul>
            </div>
          )}
          <div className="login__grid">
            <Field id="su-company" label="ХХК-ийн нэр" hint="Бусад ХХК-ийг дараа нь нэмж болно." error={errors['su-company']} wide>
              <input {...fieldAria('su-company', errors['su-company'], true)} value={f.company} onChange={put('company')} autoComplete="organization" data-autofocus autoFocus />
            </Field>
            <Field id="su-family" label="Эцэг/эхийн нэр" error={errors['su-family']}>
              <input {...fieldAria('su-family', errors['su-family'])} value={f.family} onChange={put('family')} autoComplete="family-name" />
            </Field>
            <Field id="su-given" label="Нэр" error={errors['su-given']}>
              <input {...fieldAria('su-given', errors['su-given'])} value={f.given} onChange={put('given')} autoComplete="given-name" />
            </Field>
            <Field id="su-role" label="Албан тушаал" optional wide>
              <input id="su-role" value={f.role} onChange={put('role')} autoComplete="organization-title" />
            </Field>
            <Field id="su-login" label="Нэвтрэх нэр" hint="Латин үсэг, тоо. Том, жижиг үсэг ялгахгүй." error={errors['su-login']} wide>
              <input {...fieldAria('su-login', errors['su-login'], true)} value={f.login} onChange={put('login')} autoComplete="username" autoCapitalize="none" spellCheck={false} />
            </Field>
            <Field id="su-password" label="Нууц үг" hint="8-аас доошгүй тэмдэгт, үсэг, тоо хоёулаа орно." error={errors['su-password']}>
              <input {...fieldAria('su-password', errors['su-password'], true)} type="password" value={f.password} onChange={put('password')} autoComplete="new-password" spellCheck={false} />
            </Field>
            <Field id="su-again" label="Нууц үгээ давтах" error={errors['su-again']}>
              <input {...fieldAria('su-again', errors['su-again'])} type="password" value={f.again} onChange={put('again')} autoComplete="new-password" spellCheck={false} />
            </Field>
            {link.code && (
              <Field id="su-code" label="Ирцийн код" hint="Өмнө нь ирцийг нээхэд хэрэглэж байсан код. Системийг танихгүй хүн эхлүүлэхээс хамгаална." error={errors['su-code']} wide>
                <input {...fieldAria('su-code', errors['su-code'], true)} value={f.code} onChange={put('code')} autoComplete="off" autoCapitalize="none" spellCheck={false} />
              </Field>
            )}
          </div>
          {/* aria-disabled, not disabled: a disabled button would drop the keyboard focus while the account is made */}
          <button type="submit" className="btn btn--accent login__go" aria-disabled={busy || undefined}>
            {busy ? <><LoaderCircle className="ico spin" />Үүсгэж байна…</> : 'Эхлүүлэх'}
          </button>
          <p className="login__note">
            {link.on
              ? 'Өгөгдөл сервер дээр хадгалагдана. Таны нэмсэн хүн бүр өөрийн нэвтрэх нэр, нууц үгээр аль ч компьютер, утаснаас нэвтэрнэ.'
              : 'Туршилтын хувилбарт өгөгдөл зөвхөн энэ хөтөч дээр хадгалагдана. Өөр компьютер, утсан дээр харагдахгүй.'}
          </p>
        </form>
      </main>
    </div>
  )
}
