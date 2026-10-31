// Удирдлага: the ХХК's users, how they sign in, and their rights here (the HR plan, module 1). A ready-made set fills the
// rights in; each can be changed after. Хүний нөөц, Ирц and Бичиг хэрэг reach everyone, or only the people under the
// person by Шууд удирдлага: what a branch director sees (lib/access.ts, docs/decisions.md, 2026-10-31). Only admins open
// this page.
import { useRef, useState } from 'react'
import { ChevronLeft, KeyRound, Power, ShieldCheck, UserPlus, UsersRound } from 'lucide-react'
import '../styles/screens/admin.css'
import type { Access, Person, Scope } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { open, toast } from '../lib/ui'
import { go } from '../lib/router'
import { usePageEnter } from '../lib/motion'
import { DOC_SCOPE, NO_ACCESS, PRESETS, SCOPE, accessOf, presetOf, teamOf } from '../lib/access'
import { dots } from '../lib/hr'
import { collator, short } from '../lib/format'
import { PageHead } from '../ui/PageHead'
import { Seg } from '../ui/Seg'
import { Avatar, Empty } from '../ui/bits'

export default function Admin({ id }: { id?: string }) {
  return id ? <User id={id} /> : <Users />
}

const when = (iso?: string) => (iso ? dots(iso.slice(0, 10)) : 'Нэвтэрч байгаагүй')
const rightsOf = (p: Person, company: string) => p.account?.access[company] ?? NO_ACCESS
const rightsName = (a: Access, sysadmin?: boolean) => (sysadmin ? 'Системийн админ' : presetOf(a)?.name ?? 'Тусгай эрх')

function Users() {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const people = [...scoped(s).people].sort((a, b) => collator.compare(a.given, b.given))
  const company = s.companies.find(c => c.id === s.company)?.name
  return (
    <div ref={ref}>
      <PageHead
        title="Удирдлага"
        sub={`${company}-ийн хэрэглэгч, тэдний эрх. Эрхийг ХХК тус бүрээр өгнө.`}
        stats={[
          { label: 'Хэрэглэгч', value: people.length },
          { label: 'Идэвхгүй', value: people.filter(p => !p.account?.active).length },
          { label: 'Удирдлагын эрхтэй', value: people.filter(p => accessOf(s, p.id, s.company).admin).length },
        ]}
        actions={<button type="button" className="btn btn--accent" onClick={() => open({ kind: 'invite' })}><UserPlus className="ico" />Хэрэглэгч нэмэх</button>}
      />
      <section className="card glass etable-card" aria-labelledby="adm-t" data-enter>
        <div className="card__head">
          <div>
            <h2 className="card__title" id="adm-t">Хэрэглэгчид</h2>
            <p className="card__sub">Мөр дээр дарж эрхийг нь өөрчилнө</p>
          </div>
        </div>
        <div className="etable-wrap">
          <table className="etable adm-table">
            <caption className="sr-only">Энэ ХХК-ийн хэрэглэгчид, эрх</caption>
            <thead>
              <tr>
                <th scope="col">Хэрэглэгч</th>
                <th scope="col" className="hide-sm">Нэвтрэх нэр</th>
                <th scope="col">Эрх</th>
                <th scope="col" className="hide-md">Хүний нөөц</th>
                <th scope="col" className="hide-md">Ирц</th>
                <th scope="col" className="hide-md">Бичиг хэрэг</th>
                <th scope="col" className="hide-sm">Сүүлд нэвтэрсэн</th>
              </tr>
            </thead>
            <tbody>
              {people.map(p => {
                const a = accessOf(s, p.id, s.company)
                return (
                  <tr key={p.id} className={p.account?.active ? undefined : 'is-off'} onClick={ev => { if (!(ev.target as HTMLElement).closest('a')) go('admin', p.id) }}>
                    <th scope="row">
                      <span className="etable__who">
                        <Avatar person={p} size="sm" />
                        <span><a href={`#admin-${p.id}`}>{short(p)}</a><small>{p.role}</small></span>
                      </span>
                    </th>
                    <td className="hide-sm tnum">{p.account?.login ?? '—'}</td>
                    <td>
                      {p.account?.active
                        ? <span className={`adm-pill${a.admin ? ' is-admin' : ''}`}>{a.admin && <ShieldCheck className="ico" />}{rightsName(rightsOf(p, s.company), p.account.sysadmin)}</span>
                        : <span className="adm-pill is-off"><Power className="ico" />Идэвхгүй</span>}
                    </td>
                    <td className="hide-md">{SCOPE[a.hr]}</td>
                    <td className="hide-md">{SCOPE[a.attendance]}</td>
                    <td className="hide-md">{DOC_SCOPE[a.docs]}{a.docsEdit && ', хөтөлнө'}</td>
                    <td className="hide-sm tnum">{when(p.account?.lastLogin)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

const scopes = (names: Record<Scope, string>) => (['none', 'team', 'all'] as const).map(value => ({ value, label: names[value] }))
const SCOPES = scopes(SCOPE)
const DOC_SCOPES = scopes(DOC_SCOPE)

function User({ id }: { id: string }) {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const p = scoped(s).people.find(x => x.id === id)
  const [login, setLogin] = useState(p?.account?.login ?? '')
  const [loginError, setLoginError] = useState<string | null>(null)
  const back = <a className="ibtn ibtn--glass head__back" href="#admin" aria-label="Хэрэглэгчид рүү буцах"><ChevronLeft className="ico" /></a>
  if (!p?.account) {
    return (
      <div ref={ref}>
        <PageHead title="Хэрэглэгч олдсонгүй" lead={back} />
        <section className="card glass"><Empty icon={<UsersRound className="ico" />} title="Энэ ХХК-д уг хэрэглэгч алга" text="Өөр ХХК сонгосон эсвэл хэрэглэгч хасагдсан байж магадгүй." /></section>
      </div>
    )
  }
  const acc = p.account
  const mine = rightsOf(p, s.company)
  const me = id === s.me
  const company = s.companies.find(c => c.id === s.company)?.name
  const save = (next: Access, what: string) => {
    const before = mine
    if (!actions.setAccess(id, s.company, next)) return toast(me ? 'Өөрийн удирдлагын эрхийг хасах боломжгүй.' : 'Танд энэ үйлдлийг хийх эрх алга.', { kind: 'warn' })
    toast(what, { undo: () => actions.setAccess(id, s.company, before) })
  }
  const set = (patch: Partial<Access>) => save({ ...mine, ...patch }, 'Эрх хадгалагдлаа.')
  const rename = () => {
    if (login.trim().toLowerCase() === acc.login) return
    const e = /^[a-z0-9._-]{3,32}$/.test(login.trim().toLowerCase()) ? actions.setAccount(id, { login }) : 'Нэвтрэх нэр латин үсэг, тоотой, 3-аас 32 тэмдэгт байх ёстой.'
    setLoginError(e)
    if (!e) toast(`Нэвтрэх нэр «${login.trim().toLowerCase()}» боллоо.`)
  }
  const toggle = () => {
    const e = actions.setAccount(id, { active: !acc.active })
    if (e) return toast(e, { kind: 'warn' })
    toast(acc.active ? `${short(p)} нэвтрэх боломжгүй боллоо.` : `${short(p)} дахин нэвтэрнэ.`, { undo: () => actions.setAccount(id, { active: acc.active }) })
  }
  const preset = presetOf(mine)
  const team = mine.hr === 'team' || mine.attendance === 'team' || mine.docs === 'team' ? [...teamOf(s, id, s.company)].map(x => s.employees.find(e => e.id === x)!).filter(e => e.user !== id) : null
  const hasRecord = s.employees.some(e => e.company === s.company && e.user === id)

  return (
    <div ref={ref} className="adm-user">
      <PageHead
        title={short(p)}
        sub={[p.role, p.team].filter(Boolean).join(', ')}
        lead={<>{back}<span className="head__icon"><Avatar person={p} size="xl" /></span></>}
        stats={[
          { label: 'Нэвтрэх нэр', value: acc.login },
          { label: 'Төлөв', value: acc.active ? 'Идэвхтэй' : 'Идэвхгүй', alert: !acc.active },
          { label: 'Сүүлд нэвтэрсэн', value: when(acc.lastLogin) },
        ]}
      />
      <div className="adm-grid">
        <section className="card glass adm-rights" aria-labelledby="adr-t" data-enter>
          <div className="card__head">
            <div>
              <h2 className="card__title" id="adr-t">{company} дахь эрх</h2>
              <p className="card__sub">{acc.sysadmin ? 'Системийн админ: бүх ХХК-д бүх эрхтэй.' : 'Өөрчлөлт шууд хадгалагдана.'}</p>
            </div>
          </div>
          <fieldset className="adm-presets" disabled={acc.sysadmin}>
            <legend className="field__label">Бэлэн эрх</legend>
            {PRESETS.map(x => (
              <label key={x.key} className={`adm-preset${preset?.key === x.key ? ' is-on' : ''}`}>
                <input type="radio" name="preset" checked={preset?.key === x.key} onChange={() => save({ ...x.access }, `${x.name} эрх өгөгдлөө.`)} />
                <span><b>{x.name}</b><small>{x.hint}</small></span>
              </label>
            ))}
            {!preset && <p className="adm-custom">Одоо: тусгай эрх. Доор тохируулсан.</p>}
          </fieldset>
          <fieldset className="adm-each" disabled={acc.sysadmin}>
            <legend className="field__label">Эрх тус бүр</legend>
            <div className="adm-row">
              <span><b>Хүний нөөц</b><small>Ажилтны бүртгэл, хувийн хэрэг</small></span>
              <Seg label="Хүний нөөц" small value={mine.hr} onChange={hr => set({ hr, hrEdit: hr === 'none' ? false : mine.hrEdit })} options={SCOPES} />
            </div>
            <label className={`adm-row adm-check${mine.hr === 'none' ? ' is-off' : ''}`}>
              <span><b>Ажилтны бүртгэл засах</b><small>Ажилтан, хэлтэс, албан тушаал нэмэх, засах</small></span>
              <input type="checkbox" checked={mine.hrEdit} disabled={mine.hr === 'none'} onChange={e => set({ hrEdit: e.target.checked })} />
            </label>
            <div className="adm-row">
              <span><b>Ирц</b><small>Timely-ийн ирц, ээлжийн амралт</small></span>
              <Seg label="Ирц" small value={mine.attendance} onChange={attendance => set({ attendance })} options={SCOPES} />
            </div>
            <div className="adm-row">
              <span><b>Бичиг хэрэг</b><small>Бичиг баримт, гэрээ</small></span>
              <Seg label="Бичиг хэрэг" small value={mine.docs} onChange={docs => set({ docs, docsEdit: docs === 'all' ? mine.docsEdit : false })} options={DOC_SCOPES} />
            </div>
            <label className={`adm-row adm-check${mine.docs !== 'all' ? ' is-off' : ''}`}>
              <span><b>Бичиг хэрэг хөтлөх</b><small>Бичиг баримт нэмэх, засах, ирсэн хүсэлтэд хариулах, скан оруулах</small></span>
              <input type="checkbox" checked={mine.docsEdit} disabled={mine.docs !== 'all'} onChange={e => set({ docsEdit: e.target.checked })} />
            </label>
            <label className="adm-row adm-check">
              <span><b>Удирдлага</b><small>Хэрэглэгч нэмэх, эрх өгөх</small></span>
              <input type="checkbox" checked={mine.admin} disabled={me} title={me ? 'Өөрийн удирдлагын эрхийг хасах боломжгүй' : undefined} onChange={e => set({ admin: e.target.checked })} />
            </label>
          </fieldset>
        </section>

        <section className="card glass adm-side" aria-labelledby="adl-t" data-enter>
          <div className="card__head">
            <div>
              <h2 className="card__title" id="adl-t">Нэвтрэх</h2>
              <p className="card__sub">Нэвтрэх нэр, нууц үг</p>
            </div>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="adm-login">Нэвтрэх нэр</label>
            <span className="adm-inline">
              <input id="adm-login" value={login} onChange={e => { setLogin(e.target.value); setLoginError(null) }} autoCapitalize="none" spellCheck={false}
                aria-invalid={loginError ? true : undefined} aria-describedby={loginError ? 'adm-login-error' : undefined} onKeyDown={e => e.key === 'Enter' && rename()} />
              <button type="button" className="btn btn--glass" onClick={rename}>Хадгалах</button>
            </span>
            {loginError && <span className="field__error" id="adm-login-error">{loginError}</span>}
          </div>
          <div className="adm-acts">
            <button type="button" className="btn btn--glass" onClick={() => open({ kind: 'password', id })}><KeyRound className="ico" />Нууц үг шинэчлэх</button>
            {!me && (
              <button type="button" className={`btn ${acc.active ? 'btn--ghost adm-stop' : 'btn--glass'}`} onClick={toggle}>
                <Power className="ico" />{acc.active ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}
              </button>
            )}
          </div>
        </section>

        {team && (
          <section className="card glass adm-team" aria-labelledby="adt-t" data-enter>
            <div className="card__head">
              <div>
                <h2 className="card__title" id="adt-t">Хариуцсан ажилтан</h2>
                <p className="card__sub">Ажилтны бүртгэлийн «Шууд удирдлага» талбараар энэ хүний доор байгаа ажилтнууд.</p>
              </div>
            </div>
            {!hasRecord ? (
              <Empty title="Энэ ХХК-д ажилтны бүртгэлгүй" text="Хэрэглэгчийг ажилтны бүртгэлтэй холбосны дараа хариуцсан ажилтан нь харагдана." />
            ) : team.length === 0 ? (
              <Empty title="Хариуцсан ажилтан алга" text="Энэ хэрэглэгчийг шууд удирдлагаар нь сонгосон ажилтан байхгүй. Хүний нөөц хэсгээс тохируулна уу." />
            ) : (
              <ul className="adm-people">
                {team.sort((a, b) => collator.compare(a.given, b.given)).map(e => (
                  <li key={e.id}><b>{short(e)}</b><small>{s.positions.find(x => x.id === e.position)?.name}</small></li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
