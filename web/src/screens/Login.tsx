// Нэвтрэх: everyone signs in with their own login and password (the HR plan, module 1). The login ignores case and spaces
// at its ends; Caps Lock and a Mongolian keyboard are pointed out, the usual reasons a right password fails. The example
// accounts are offered while they still have the example password (docs/decisions.md, 2026-10-31).
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Eye, EyeOff, LoaderCircle, LogIn, TriangleAlert } from 'lucide-react'
import '../styles/screens/login.css'
import { useApp } from '../lib/store'
import { DEMO_PASSWORD, NO_ACCESS, isDemo, presetOf } from '../lib/access'
import { login, waitLeft } from '../lib/auth'
import { short } from '../lib/format'
import { Wallpaper } from '../shell/Wallpaper'
import { Avatar } from '../ui/bits'

const CYRILLIC = /[Ѐ-ӿ]/
/** One of each kind of rights, to see what each one sees: Захирал, Хүний нөөц, Бичиг хэрэг, Салбарын захирал, Ажилтан */
const EXAMPLES = ['u1', 'u12', 'u16', 'u10', 'u14']

export default function Login() {
  const s = useApp()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(waitLeft)
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => first.current?.focus(), [])
  useEffect(() => {
    if (!wait) return
    const t = setInterval(() => setWait(waitLeft()), 1000)
    return () => clearInterval(t)
  }, [wait > 0])

  const go = async (n: string, p: string) => {
    if (busy || waitLeft()) return
    if (!n.trim() || !p) {
      setError(!n.trim() ? (p ? 'Нэвтрэх нэрээ бичнэ үү.' : 'Нэвтрэх нэр, нууц үгээ бичнэ үү.') : 'Нууц үгээ бичнэ үү.')
      return
    }
    setBusy(true)
    setError(null)
    const r = await login(n, p)
    if (r === 'ok') return
    setBusy(false)
    setPassword('')
    if (r === 'wait') setWait(waitLeft())
    else setError(r === 'inactive' ? 'Таны бүртгэл идэвхгүй байна. Удирдлагадаа хандана уу.' : 'Нэвтрэх нэр эсвэл нууц үг буруу байна.')
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    go(name, password)
  }
  const keys = (e: KeyboardEvent) => setCaps(e.getModifierState?.('CapsLock') ?? false)
  const examples = EXAMPLES.flatMap(id => s.people.filter(p => p.id === id && p.account?.active && isDemo(p.account)))

  return (
    <div className="login">
      <Wallpaper />
      <main className="login__main">
        <form className="login__card glass glass--thick" onSubmit={submit} noValidate aria-labelledby="login-t">
          <span className="login__icon" aria-hidden="true"><LogIn className="ico" /></span>
          <h1 className="login__title" id="login-t">Нэвтрэх</h1>
          <p className="login__sub">Нэвтрэх нэр, нууц үгээ бичнэ үү.</p>
          {(error || wait > 0) && (
            <p className="login__error" role="alert">
              <TriangleAlert className="ico" />
              {wait > 0 ? `Олон удаа буруу оруулсан тул ${wait} секундын дараа дахин оролдоно уу.` : error}
            </p>
          )}
          <div className="field">
            <label className="field__label" htmlFor="login-name">Нэвтрэх нэр</label>
            <input ref={first} id="login-name" value={name} onChange={e => setName(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false}
              aria-describedby={CYRILLIC.test(name) ? 'login-name-hint' : undefined} />
            {CYRILLIC.test(name) && <span className="field__hint login__warn" id="login-name-hint">Нэвтрэх нэрийг латин үсгээр бичнэ үү. Гарын хэлээ англи болгоно уу.</span>}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="login-pass">Нууц үг</label>
            <span className="login__pass">
              <input id="login-pass" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={keys} onKeyUp={keys}
                autoComplete="current-password" spellCheck={false} aria-describedby={caps || CYRILLIC.test(password) ? 'login-pass-hint' : undefined} />
              <button type="button" className="ibtn ibtn--sm" aria-label={show ? 'Нууц үгийг нуух' : 'Нууц үгийг харуулах'} aria-pressed={show} onClick={() => setShow(!show)}>
                {show ? <EyeOff className="ico" /> : <Eye className="ico" />}
              </button>
            </span>
            {(caps || CYRILLIC.test(password)) && (
              <span className="field__hint login__warn" id="login-pass-hint">
                {caps ? 'Caps Lock асаалттай байна.' : 'Нууц үгэнд кирилл үсэг орсон байна. Гарын хэлээ шалгана уу.'}
              </span>
            )}
          </div>
          <button type="submit" className="btn btn--accent login__go" disabled={busy || wait > 0}>
            {busy ? <><LoaderCircle className="ico spin" />Шалгаж байна…</> : 'Нэвтрэх'}
          </button>
          <p className="login__note">Нууц үгээ мартсан бол удирдлагадаа хандана уу. Нэвтэрсний дараа 14 хоног дахин нэвтрэх шаардлагагүй.</p>
        </form>

        {examples.length > 0 && (
          <section className="login__demo glass" aria-labelledby="login-demo-t">
            <h2 id="login-demo-t">Жишээ эрхүүд</h2>
            <p>Зөвхөн туршилтын хувилбарт харагдана. Бүгдийн нууц үг: <b>{DEMO_PASSWORD}</b></p>
            <ul>
              {examples.map(p => (
                <li key={p.id}>
                  <button type="button" className="login__who" disabled={busy || wait > 0} onClick={() => go(p.account!.login, DEMO_PASSWORD)}>
                    <Avatar person={p} size="md" />
                    <span><b>{short(p)}</b><small>{presetOf(p.account!.access[p.companies[0]] ?? NO_ACCESS)?.name ?? 'Тусгай эрх'}, «{p.account!.login}»</small></span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
