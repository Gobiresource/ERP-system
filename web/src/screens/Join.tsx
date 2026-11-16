// Нууц үг үүсгэх: a sign-in link (server/api.ts) brings someone here, newly added or locked out. They make their own
// password and are in at once; whoever comes in for the first time is welcomed, as at any first sign-in. Nobody else
// learns the password, not even whoever sent the link (docs/decisions.md, 2026-11-16).
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { KeyRound, LoaderCircle, TriangleAlert } from 'lucide-react'
import '../styles/screens/login.css'
import { strongEnough } from '../lib/access'
import { enter } from '../lib/auth'
import { joinRemote, linkWho, type Refusal } from '../lib/sync'
import { short } from '../lib/format'
import { Wallpaper } from '../shell/Wallpaper'
import { Field, fieldAria, type Errors } from '../ui/FormSheet'

type Who = { given: string; family: string; login: string }

export default function Join({ token }: { token: string }) {
  const [who, setWho] = useState<Who | Refusal | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setWho(null)
    linkWho(token).then(setWho)
  }, [token, attempt])

  const [f, setF] = useState({ password: '', again: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const summary = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(0) // bumps on a failed submit; fixing a field must not move focus
  useLayoutEffect(() => {
    if (shown) summary.current?.focus()
  }, [shown])

  const put = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF(x => ({ ...x, [k]: e.target.value }))
    if (errors[`jn-${k}`]) setErrors(({ [`jn-${k}`]: _, ...rest }) => rest)
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const err: Errors = {}
    if (!f.password) err['jn-password'] = 'Нууц үгээ бичнэ үү.'
    else if (!strongEnough(f.password)) err['jn-password'] = 'Нууц үг 8-аас доошгүй тэмдэгттэй, үсэг, тоо хоёулаа орсон байх ёстой.'
    else if (f.again !== f.password) err['jn-again'] = 'Нууц үг таарахгүй байна.'
    setErrors(err)
    if (Object.keys(err).length) return setShown(n => n + 1)
    setBusy(true)
    const r = await joinRemote(token, f.password)
    if ('error' in r) {
      setBusy(false)
      // Spent or gone meanwhile: the page says so as it would have on opening
      if (r.status === 404) return setWho(r)
      setErrors({ 'jn-password': r.error })
      return setShown(n => n + 1)
    }
    // The link is spent: it leaves the address, and the app opens as after any sign-in
    history.replaceState(null, '', location.pathname + location.search)
    enter(r.me)
  }

  const card = (body: ReactNode) => (
    <div className="login">
      <Wallpaper />
      <main className="login__main">{body}</main>
    </div>
  )

  if (!who) {
    return card(
      <div className="login__card glass glass--thick" role="status">
        <span className="login__icon" aria-hidden="true"><KeyRound className="ico" /></span>
        <p className="login__sub"><LoaderCircle className="ico spin" /> Холбоосыг шалгаж байна…</p>
      </div>,
    )
  }
  if ('error' in who) {
    const gone = who.status === 404
    return card(
      <div className="login__card glass glass--thick" aria-labelledby="join-t">
        <span className="login__icon" aria-hidden="true"><TriangleAlert className="ico" /></span>
        <h1 className="login__title" id="join-t">{gone ? 'Холбоос хүчингүй байна' : 'Сервертэй холбогдож чадсангүй'}</h1>
        <p className="login__sub">{gone ? who.error : 'Интернэтээ шалгаад дахин оролдоно уу.'}</p>
        {gone
          ? <button type="button" className="btn btn--accent login__go" onClick={() => (location.hash = '')}>Нэвтрэх хуудас руу</button>
          : <button type="button" className="btn btn--accent login__go" onClick={() => setAttempt(n => n + 1)}>Дахин оролдох</button>}
      </div>,
    )
  }

  return card(
    <form className="login__card glass glass--thick" onSubmit={submit} noValidate aria-labelledby="join-t">
      <span className="login__icon" aria-hidden="true"><KeyRound className="ico" /></span>
      <h1 className="login__title" id="join-t">Нууц үг үүсгэх</h1>
      <p className="login__sub">{short(who)}, нууц үгээ үүсгээд системд нэвтэрнэ үү.</p>
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
      <div className="field">
        <span className="field__label">Нэвтрэх нэр</span>
        <b className="join__login">{who.login}</b>
      </div>
      {/* The login, for the browser to keep with the password */}
      <input type="text" name="username" value={who.login} autoComplete="username" readOnly hidden />
      <Field id="jn-password" label="Нууц үг" hint="8-аас доошгүй тэмдэгт, үсэг, тоо хоёулаа орно." error={errors['jn-password']}>
        <input {...fieldAria('jn-password', errors['jn-password'], true)} type="password" value={f.password} onChange={put('password')} autoComplete="new-password" spellCheck={false} autoFocus />
      </Field>
      <Field id="jn-again" label="Нууц үгээ давтах" error={errors['jn-again']}>
        <input {...fieldAria('jn-again', errors['jn-again'])} type="password" value={f.again} onChange={put('again')} autoComplete="new-password" spellCheck={false} />
      </Field>
      {/* aria-disabled, not disabled: a disabled button would drop the keyboard focus while the password is set */}
      <button type="submit" className="btn btn--accent login__go" aria-disabled={busy || undefined}>
        {busy ? <><LoaderCircle className="ico spin" />Нэвтэрч байна…</> : 'Нэвтрэх'}
      </button>
      <p className="login__note">Энэ холбоос нэг удаа ажиллана. Дараа нь «{who.login}» нэвтрэх нэр, энэ нууц үгээрээ нэвтэрнэ.</p>
    </form>,
  )
}
