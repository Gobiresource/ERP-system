// Add or edit an employee. A long form, so it is a page with sections and a bar at the bottom.
// Checks follow our rules: empty fields on save, formats when leaving a field, and again on every change once wrong.
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { ContractKind, EmpStatus, Employee } from '../../lib/types'
import { actions, useApp } from '../../lib/store'
import { go } from '../../lib/router'
import { toast } from '../../lib/ui'
import { usePageEnter } from '../../lib/motion'
import { CONTRACT, EMP_STATUS, EMP_STATUSES, ageOn, current, dots, nextCode, readRegNo } from '../../lib/hr'
import { hrView } from '../../lib/access'
import { bossOf } from '../../lib/reports'
import { collator, short, today, ymd } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Field, fieldAria, type Errors } from '../../ui/FormSheet'

interface Form {
  clan: string; family: string; given: string; regNo: string; phone: string; email: string; address: string; education: string; profession: string
  cName: string; cRelation: string; cPhone: string
  code: string; dept: string; position: string; manager: string; hired: string; probationEnd: string; status: EmpStatus
  kind: ContractKind; cNo: string; cStart: string; cEnd: string
}
type Key = keyof Form

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** 8 digits after dropping spaces, dashes and +976 */
const phoneDigits = (v: string) => v.replace(/[\s-]/g, '').replace(/^\+?976/, '')
const REQUIRED: Partial<Record<Key, string>> = {
  family: 'Эцэг/эхийн нэрийг бичнэ үү.', given: 'Нэрийг бичнэ үү.', regNo: 'Регистрийн дугаарыг бичнэ үү.', phone: 'Утасны дугаарыг бичнэ үү.',
  code: 'Ажилтны кодыг бичнэ үү.', dept: 'Хэлтсийг сонгоно уу.', position: 'Албан тушаалыг сонгоно уу.', hired: 'Ажилд орсон огноог сонгоно уу.',
  cNo: 'Гэрээний дугаарыг бичнэ үү.', cStart: 'Гэрээ эхэлсэн огноог сонгоно уу.', cEnd: 'Гэрээ дуусах огноог сонгоно уу.',
}

export default function EmployeeForm({ id }: { id?: string }) {
  const s = useApp()
  const hr = hrView(s)
  const ref = useRef<HTMLDivElement>(null)
  const summary = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const editing = id ? hr.employee(id) : undefined
  const company = s.companies.find(c => c.id === s.company)!

  const [f, setF] = useState<Form>(() => {
    const e = editing
    const dept = e?.dept ?? hr.departments[0]?.id ?? ''
    const free = hr.positions.find(p => p.dept === dept && (hr.filled.get(p.id) ?? 0) < p.quota) ?? hr.positions.find(p => p.dept === dept)
    return {
      // In the order of the page, so the error list follows it too
      clan: e?.clan ?? '', family: e?.family ?? '', given: e?.given ?? '', regNo: e?.regNo ?? '', phone: e?.phone ?? '', email: e?.email ?? '',
      education: e?.education ?? '', profession: e?.profession ?? '', address: e?.address ?? '',
      cName: e?.contact?.name ?? '', cRelation: e?.contact?.relation ?? '', cPhone: e?.contact?.phone ?? '',
      dept, position: e?.position ?? free?.id ?? '', manager: e?.manager ?? '', code: e?.code ?? nextCode(company.code, s.employees.filter(x => x.company === s.company)),
      status: e?.status ?? 'active', hired: e?.hired ?? today(), probationEnd: e?.probationEnd ?? '',
      kind: e?.contract.kind ?? 'open', cNo: e?.contract.no ?? '', cStart: e?.contract.start ?? today(), cEnd: e?.contract.end ?? '',
    }
  })
  const [errors, setErrors] = useState<Errors>({})
  const [shown, setShown] = useState(0) // bumps when the summary should take focus

  useLayoutEffect(() => {
    if (shown) summary.current?.focus()
  }, [shown])

  if (id && !editing) {
    return (
      <div ref={ref}>
        <PageHead title="Ажилтан олдсонгүй" />
        <a className="btn btn--glass" href="#hr-employees">Бүх ажилтан</a>
      </div>
    )
  }

  /** The problem with one field, or '' */
  const check = (k: Key, v: Form, empty: boolean): string => {
    const val = v[k].trim()
    if (!val) return empty && REQUIRED[k] && (k !== 'cEnd' || v.kind !== 'open') ? REQUIRED[k]! : ''
    switch (k) {
      case 'regNo': {
        const r = readRegNo(val)
        if (!r) return 'Регистрийн дугаарыг зөв бичнэ үү, жишээ нь УБ90010112.'
        if (hr.all.some(e => e.id !== id && e.regNo === r.value)) return 'Энэ регистрийн дугаартай ажилтан бүртгэлтэй байна.'
        return ''
      }
      case 'phone':
      case 'cPhone':
        return /^\d{8}$/.test(phoneDigits(val)) ? '' : 'Утасны дугаарыг 8 оронтой тоогоор бичнэ үү, жишээ нь 99112233.'
      case 'email':
        return EMAIL.test(val) ? '' : 'Имэйл хаяг буруу байна. Жишээ нь: bold@example.mn'
      case 'code':
        return hr.all.some(e => e.id !== id && e.code === val) ? 'Энэ кодтой ажилтан бүртгэлтэй байна.' : ''
      case 'probationEnd':
        return v.hired && val <= v.hired ? 'Туршилтын хугацаа дуусах огноо ажилд орсон огнооноос хойш байх ёстой.' : ''
      case 'cEnd':
        return v.kind !== 'open' && v.cStart && val <= v.cStart ? 'Гэрээ дуусах огноо эхэлсэн огнооноос хойш байх ёстой.' : ''
    }
    return ''
  }
  const setError = (k: Key, msg: string) => setErrors(prev => {
    const { [`ef-${k}`]: _, ...rest } = prev
    return msg ? { ...prev, [`ef-${k}`]: msg } : rest
  })

  const set = (k: Key) => (ev: { target: { value: string } }) => {
    const next = { ...f, [k]: ev.target.value }
    if (k === 'dept') {
      const free = hr.positions.find(p => p.dept === next.dept && (hr.filled.get(p.id) ?? 0) < p.quota) ?? hr.positions.find(p => p.dept === next.dept)
      next.position = free?.id ?? ''
    }
    setF(next)
    if (errors[`ef-${k}`]) setError(k, check(k, next, true))
    // An open-ended contract has no end date to fix
    if (k === 'kind' && errors['ef-cEnd']) setError('cEnd', check('cEnd', next, true))
  }
  const blur = (k: Key) => () => setError(k, check(k, f, false))
  const err = (k: Key) => errors[`ef-${k}`]
  const aria = (k: Key, hint?: boolean) => ({ ...fieldAria(`ef-${k}`, err(k), hint), onBlur: blur(k) })

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    const e: Errors = {}
    for (const k of Object.keys(f) as Key[]) {
      const msg = check(k, f, true)
      if (msg) e[`ef-${k}`] = msg
    }
    setErrors(e)
    if (Object.keys(e).length) { setShown(n => n + 1); return }

    const opt = (v: string) => v.trim() || undefined
    const data: Omit<Employee, 'id' | 'company' | 'moves' | 'files' | 'hue'> = {
      user: editing?.user, code: f.code.trim(), clan: opt(f.clan), family: f.family.trim(), given: f.given.trim(),
      regNo: readRegNo(f.regNo)!.value, phone: phoneDigits(f.phone.trim()), email: opt(f.email), address: opt(f.address),
      education: opt(f.education), profession: opt(f.profession),
      contact: f.cName.trim() ? { name: f.cName.trim(), relation: f.cRelation.trim(), phone: phoneDigits(f.cPhone.trim()) } : undefined,
      dept: f.dept, position: f.position, manager: f.manager || undefined, hired: f.hired, probationEnd: opt(f.probationEnd),
      contract: { kind: f.kind, no: f.cNo.trim(), start: f.cStart, end: f.kind === 'open' ? undefined : f.cEnd },
      status: editing ? f.status : f.probationEnd && f.probationEnd >= today() ? 'probation' : 'active',
    }
    if (editing) {
      actions.updateEmployee(editing.id, data)
      toast('Өөрчлөлт хадгалагдлаа.')
      go('hr', editing.id)
    } else {
      const emp = actions.addEmployee(data)
      if (!emp) return toast('Танд ажилтан нэмэх эрх алга.', { kind: 'warn' })
      toast('Ажилтан нэмэгдлээ.')
      go('hr', emp.id)
    }
  }

  const reg = readRegNo(f.regNo)
  // Who scores the monthly report when nobody is set: the head of the chosen department, else the director
  const found = bossOf(s, { ...(editing ?? { id: '', company: s.company }), dept: f.dept, manager: undefined } as Employee)
  const auto = found === 'none' ? undefined : found
  const bosses = hr.all.filter(x => current(x) && x.id !== editing?.id && x.id !== auto?.id).sort((a, b) => collator.compare(a.given, b.given))
  const pos = hr.positions.find(p => p.id === f.position)
  const free = pos ? pos.quota - (hr.filled.get(pos.id) ?? 0) + (editing?.position === pos.id && editing.status !== 'left' ? 1 : 0) : 0
  const back = editing ? `#hr-${editing.id}` : '#hr-employees'

  return (
    <div ref={ref}>
      <PageHead
        title={editing ? 'Ажилтны мэдээлэл засах' : 'Ажилтан нэмэх'}
        sub={editing ? `${short(editing)}, ${editing.code}` : 'Хадгалсны дараа хувийн хэргийн баримтыг ажилтны хуудсанд хавсаргана.'}
        lead={<a className="ibtn ibtn--glass head__back" href={back} aria-label="Буцах"><ChevronLeft className="ico" /></a>}
      />
      <form className="eform" onSubmit={submit} noValidate>
        {Object.keys(errors).length > 0 && (
          <div className="mform__errors card" role="alert" tabIndex={-1} ref={summary}>
            <b>Дараах зүйлийг засна уу:</b>
            <ul>
              {Object.entries(errors).map(([fid, msg]) => (
                <li key={fid}><a href={`#${fid}`} onClick={e => { e.preventDefault(); document.getElementById(fid)?.focus() }}>{msg}</a></li>
              ))}
            </ul>
          </div>
        )}

        <fieldset className="card glass eform__sec" data-enter>
          <legend className="card__title">Хувийн мэдээлэл</legend>
          <div className="eform__grid eform__grid--3">
            <Field id="ef-clan" label="Ургийн овог" optional>
              <input {...aria('clan')} value={f.clan} onChange={set('clan')} spellCheck={false} />
            </Field>
            <Field id="ef-family" label="Эцэг/эхийн нэр" error={err('family')}>
              <input {...aria('family')} value={f.family} onChange={set('family')} autoComplete="off" spellCheck={false} />
            </Field>
            <Field id="ef-given" label="Нэр" error={err('given')}>
              <input {...aria('given')} value={f.given} onChange={set('given')} autoComplete="off" spellCheck={false} />
            </Field>
          </div>
          <div className="eform__grid eform__grid--3">
            <Field id="ef-regNo" label="Регистрийн дугаар" error={err('regNo')}
              hint={reg ? `Төрсөн огноо ${dots(ymd(reg.birth))}, ${ageOn(reg.birth)} настай, ${reg.male ? 'эрэгтэй' : 'эмэгтэй'}` : 'Жишээ нь: УБ90010112'}>
              <input {...aria('regNo', true)} className="eform__w10" value={f.regNo} onChange={set('regNo')} autoComplete="off" spellCheck={false} />
            </Field>
            <Field id="ef-phone" label="Утас" error={err('phone')}>
              <input {...aria('phone')} className="eform__w10" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="off" />
            </Field>
            <Field id="ef-email" label="Имэйл" error={err('email')} optional>
              <input {...aria('email')} type="email" inputMode="email" value={f.email} onChange={set('email')} autoComplete="off" />
            </Field>
          </div>
          <div className="eform__grid">
            <Field id="ef-education" label="Боловсрол" optional>
              <input {...aria('education')} value={f.education} onChange={set('education')} />
            </Field>
            <Field id="ef-profession" label="Мэргэжил" optional>
              <input {...aria('profession')} value={f.profession} onChange={set('profession')} />
            </Field>
            <Field id="ef-address" label="Хаяг" optional wide>
              <input {...aria('address')} value={f.address} onChange={set('address')} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card glass eform__sec" data-enter>
          <legend className="card__title">Яаралтай үед холбоо барих хүн <span className="muted">(заавал биш)</span></legend>
          <div className="eform__grid eform__grid--3">
            <Field id="ef-cName" label="Нэр">
              <input {...aria('cName')} value={f.cName} onChange={set('cName')} />
            </Field>
            <Field id="ef-cRelation" label="Хамаарал">
              <input {...aria('cRelation')} value={f.cRelation} onChange={set('cRelation')} />
            </Field>
            <Field id="ef-cPhone" label="Утас" error={err('cPhone')}>
              <input {...aria('cPhone')} type="tel" inputMode="tel" value={f.cPhone} onChange={set('cPhone')} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card glass eform__sec" data-enter>
          <legend className="card__title">Ажлын мэдээлэл</legend>
          <div className="eform__grid">
            <Field id="ef-dept" label="Хэлтэс" error={err('dept')}>
              <select {...aria('dept')} value={f.dept} onChange={set('dept')}>
                {hr.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field id="ef-position" label="Албан тушаал" error={err('position')}
              hint={pos ? (free > 0 ? `${free} сул орон тоо байна` : 'Сул орон тоо байхгүй. Орон тоо хэтэрнэ.') : undefined}>
              <select {...aria('position', !!pos)} value={f.position} onChange={set('position')}>
                {hr.positions.filter(p => p.dept === f.dept).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field id="ef-manager" label="Шууд удирдлага" hint="Сарын тайланг хүлээн авч үнэлнэ.">
              <select id="ef-manager" aria-describedby="ef-manager-hint" value={f.manager} onChange={set('manager')}>
                <option value="">{auto ? `${short(auto)}, ${f.dept && hr.dept(f.dept)?.head === auto.id ? 'хэлтсийн дарга' : 'захирал'}` : 'Сонгоогүй'}</option>
                {bosses.map(x => <option key={x.id} value={x.id}>{short(x)}, {hr.position(x.position)?.name}</option>)}
                <option value="none">Байхгүй, сарын тайлан өгөхгүй</option>
              </select>
            </Field>
            <Field id="ef-code" label="Ажилтны код" error={err('code')}>
              <input {...aria('code')} className="eform__w10" value={f.code} onChange={set('code')} spellCheck={false} />
            </Field>
            {editing && (
              <Field id="ef-status" label="Төлөв">
                <select {...aria('status')} value={f.status} onChange={set('status')}>
                  {EMP_STATUSES.map(st => <option key={st} value={st}>{EMP_STATUS[st]}</option>)}
                </select>
              </Field>
            )}
            <Field id="ef-hired" label="Ажилд орсон огноо" error={err('hired')}>
              <input {...aria('hired')} type="date" value={f.hired} onChange={set('hired')} />
            </Field>
            <Field id="ef-probationEnd" label="Туршилтын хугацаа дуусах огноо" error={err('probationEnd')} optional>
              <input {...aria('probationEnd')} type="date" value={f.probationEnd} onChange={set('probationEnd')} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card glass eform__sec" data-enter>
          <legend className="card__title">Хөдөлмөрийн гэрээ</legend>
          <fieldset className="eform__radios">
            <legend className="field__label">Гэрээний төрөл</legend>
            {(Object.keys(CONTRACT) as ContractKind[]).map(k => (
              <label key={k} className="eform__radio">
                <input type="radio" name="ef-kind" value={k} checked={f.kind === k} onChange={set('kind')} />
                {CONTRACT[k]}
              </label>
            ))}
          </fieldset>
          <div className="eform__grid eform__grid--3">
            <Field id="ef-cNo" label="Гэрээний дугаар" error={err('cNo')}>
              <input {...aria('cNo')} value={f.cNo} onChange={set('cNo')} spellCheck={false} />
            </Field>
            <Field id="ef-cStart" label="Эхэлсэн огноо" error={err('cStart')}>
              <input {...aria('cStart')} type="date" value={f.cStart} onChange={set('cStart')} />
            </Field>
            {f.kind !== 'open' && (
              <Field id="ef-cEnd" label="Дуусах огноо" error={err('cEnd')}>
                <input {...aria('cEnd')} type="date" value={f.cEnd} onChange={set('cEnd')} />
              </Field>
            )}
          </div>
        </fieldset>

        <div className="eform__bar glass">
          <button type="submit" className="btn btn--accent">Хадгалах</button>
          <a className="btn btn--ghost" href={back}>Болих</a>
        </div>
      </form>
    </div>
  )
}
