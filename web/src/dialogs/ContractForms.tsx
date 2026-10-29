// Гэрээ windows: start a contract, send it back or cancel it, number it, ask colleagues' opinion, set a company's people
// for the process, and see its paper copy. Who acts is the person the demo acts as (useActor).
import { useState, type ChangeEvent } from 'react'
import { Download, Paperclip } from 'lucide-react'
import '../styles/screens/docs.css'
import type { BoardFile, Contract, ContractType, Id, ProcessRole } from '../lib/types'
import { actions, getState, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { go } from '../lib/router'
import { CONTRACT_KIND, CONTRACT_KINDS, ROLE, ROLES, nextNumber, rolesOf } from '../lib/contracts'
import { contractPdf } from '../lib/paper'
import { putFile, saveBlob } from '../lib/files'
import { cid } from '../lib/draft'
import { collator, short, today } from '../lib/format'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'
import { PeoplePick } from '../ui/PeoplePick'
import { useActor } from '../screens/docs/Contracts'
import { Tool, Viewer } from './Viewer'

const MB25 = 25 * 1024 * 1024
const useContract = (id: Id) => useApp().contracts.find(c => c.id === id)
const sorted = <T extends { given: string }>(list: T[]) => [...list].sort((a, b) => collator.compare(a.given, b.given))

/** Anyone may start a contract; they write it from its kind's sample text */
export function NewContract() {
  const who = useActor()
  const [f, setF] = useState({ title: '', party: '', kind: 'work' as ContractType, amount: '' })
  const [errors, setErrors] = useState<Errors>({})
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    if (errors[`ctn-${k}`]) setErrors(({ [`ctn-${k}`]: _, ...rest }) => rest)
  }
  const submit = () => {
    const e: Errors = {}
    const amount = Number(f.amount.replace(/[\s,]/g, ''))
    if (!f.title.trim()) e['ctn-title'] = 'Гэрээний нэрийг бичнэ үү.'
    if (!f.party.trim()) e['ctn-party'] = 'Харилцагчийн нэрийг бичнэ үү.'
    if (f.amount.trim() && !(amount > 0)) e['ctn-amount'] = 'Дүнг тоогоор бичнэ үү.'
    setErrors(e)
    if (Object.keys(e).length) return false
    const c = actions.addContract({ title: f.title.trim(), party: f.party.trim(), kind: f.kind, amount: amount || undefined }, who)
    toast('Гэрээний ноорог үүслээ.')
    go('docs', `contract-${c.id}`)
    return true
  }
  return (
    <FormSheet title="Гэрээ үүсгэх" sub="Та хариуцсан ажилтан болно. Загвар текстийг засаад санхүү, хуулиар зэрэг хянуулна." submit="Үүсгэх" onSubmit={submit} onClose={close} errors={errors}>
      <Field id="ctn-title" label="Гэрээний нэр" error={errors['ctn-title']} wide>
        <input {...fieldAria('ctn-title', errors['ctn-title'])} value={f.title} onChange={set('title')} placeholder="Агуулахын тавиур нийлүүлэх гэрээ" data-autofocus />
      </Field>
      <Field id="ctn-party" label="Харилцагч" hint="Гэрээ байгуулах байгууллага эсвэл хүн" error={errors['ctn-party']} wide>
        <input {...fieldAria('ctn-party', errors['ctn-party'], true)} value={f.party} onChange={set('party')} placeholder="Тавиур Трейд ХХК" />
      </Field>
      <Field id="ctn-kind" label="Төрөл" hint="Загвар текст нь төрлөөсөө хамаарна">
        <select id="ctn-kind" aria-describedby="ctn-kind-hint" value={f.kind} onChange={set('kind')}>
          {CONTRACT_KINDS.map(k => <option key={k} value={k}>{CONTRACT_KIND[k]}</option>)}
        </select>
      </Field>
      <Field id="ctn-amount" label="Дүн, ₮" error={errors['ctn-amount']} optional>
        <input {...fieldAria('ctn-amount', errors['ctn-amount'])} inputMode="numeric" value={f.amount} onChange={set('amount')} placeholder="48,500,000" />
      </Field>
    </FormSheet>
  )
}

/** Sending a contract back (a reason is a must; the director may send it to the office) or cancelling it */
export function ContractReason({ id, step }: { id: Id; step: 'return' | 'cancel' }) {
  const s = useApp()
  const c = useContract(id)
  const who = useActor()
  const [text, setText] = useState('')
  const [to, setTo] = useState<'draft' | 'clerk'>('draft')
  const [errors, setErrors] = useState<Errors>({})
  if (!c) return null
  const back = step === 'return'
  const person = (pid: Id) => {
    const p = s.people.find(x => x.id === pid)
    return p ? short(p) : ''
  }
  const submit = () => {
    if (back && !text.trim()) {
      setErrors({ 'ctr-text': 'Буцаах шалтгаанаа бичнэ үү.' })
      return false
    }
    if (!actions.contractStep(c.id, who, step, { text: text.trim() || undefined, to })) {
      setErrors({ 'ctr-text': 'Энэ алхмыг хийх эрх танд байхгүй.' })
      return false
    }
    toast(back ? 'Гэрээ буцаагдлаа.' : 'Гэрээ цуцлагдлаа.')
    return true
  }
  return (
    <FormSheet title={back ? 'Гэрээ буцаах' : 'Гэрээ цуцлах'} sub={c.title} submit={back ? 'Буцаах' : 'Цуцлах'} onSubmit={submit} onClose={close} errors={errors}>
      {back && c.stage === 'director' && (
        <fieldset className="field field--wide">
          <legend className="field__label">Хэнд буцаах</legend>
          <div className="choices">
            <label className="choice"><input type="radio" name="ctr-to" checked={to === 'draft'} onChange={() => setTo('draft')} /><span><b>Хариуцсан ажилтанд</b><small>{person(c.owner)}</small></span></label>
            <label className="choice"><input type="radio" name="ctr-to" checked={to === 'clerk'} onChange={() => setTo('clerk')} /><span><b>Бичиг хэрэгт</b><small>{person(rolesOf(s, c.company).clerk)}</small></span></label>
          </div>
        </fieldset>
      )}
      <Field id="ctr-text" label="Шалтгаан" optional={!back} error={errors['ctr-text']} wide
        hint={back ? 'Зассаны дараа гэрээ танд шууд буцаж ирнэ.' : 'Цуцалсан гэрээ дахин сэргэхгүй.'}>
        <textarea {...fieldAria('ctr-text', errors['ctr-text'], true)} value={text} onChange={e => { setText(e.target.value); setErrors({}) }} data-autofocus />
      </Field>
    </FormSheet>
  )
}

/** Puts the registered contract into its company's folder: the signed copy if there is one, else its paper copy */
async function intoFolder(c: Contract, scan?: BoardFile) {
  let file = scan
  if (!file) {
    const blob = await contractPdf(c)
    file = { id: `f${cid()}`, name: `${c.title}.pdf`, type: 'application/pdf', size: blob.size }
    await putFile(file.id, blob)
  }
  const roles = rolesOf(getState(), c.company)
  actions.addDoc({ name: `${c.title} (№ ${c.number})`, kind: 'contract', company: c.company, file, to: [...new Set([c.owner, ...ROLES.map(r => roles[r])])] })
}

/** The office gives the approved contract its number (new in the company), its date and the signed, stamped copy */
export function ContractRegister({ id }: { id: Id }) {
  const s = useApp()
  const c = useContract(id)
  const who = useActor()
  const company = s.companies.find(x => x.id === c?.company)
  const [f, setF] = useState({ number: company ? nextNumber(s.contracts, company) : '', date: today() })
  const [scan, setScan] = useState<BoardFile | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  if (!c) return null
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const x = e.target.files?.[0]
    setErrors(({ 'cg-scan': _, ...rest }) => rest)
    if (!x) return
    if (x.size > MB25) return setErrors(v => ({ ...v, 'cg-scan': '25 MB хүртэлх файл сонгоно уу.' }))
    setSaving(true)
    const ref = { id: `f${cid()}`, name: x.name, type: x.type, size: x.size }
    try {
      await putFile(ref.id, x)
      setScan(ref)
    } catch {
      setErrors(v => ({ ...v, 'cg-scan': 'Энэ хөтөч дээр файл хадгалах боломжгүй байна.' }))
    } finally {
      setSaving(false)
    }
  }
  const submit = () => {
    const e: Errors = {}
    if (!f.number.trim()) e['cg-number'] = 'Гэрээний дугаарыг бичнэ үү.'
    if (!f.date) e['cg-date'] = 'Бүртгэсэн огноог сонгоно уу.'
    if (saving) e['cg-scan'] = 'Файл хадгалагдаж дуусахыг хүлээнэ үү.'
    const wrong = Object.keys(e).length ? null : actions.registerContract(c.id, who, { number: f.number, date: f.date, scan: scan ?? undefined })
    if (wrong) e['cg-number'] = wrong
    setErrors(e)
    if (Object.keys(e).length) return false
    const done = getState().contracts.find(x => x.id === c.id)!
    intoFolder(done, scan ?? undefined).catch(() => toast('Гэрээг хавтсанд хийж чадсангүй.', { kind: 'warn' }))
    toast(`Гэрээ ${done.number} дугаартай бүртгэгдлээ.`)
    return true
  }
  return (
    <FormSheet title="Дугаар олгох" sub={`${c.title}. Захирал баталсан тул дугаар олгож бүртгэнэ.`} submit="Дугаар олгох" onSubmit={submit} onClose={close} errors={errors}>
      <Field id="cg-number" label="Гэрээний дугаар" hint="Компанийн гэрээнүүдэд давхардахгүй" error={errors['cg-number']}>
        <input {...fieldAria('cg-number', errors['cg-number'], true)} value={f.number} onChange={e => { setF({ ...f, number: e.target.value }); setErrors({}) }} data-autofocus />
      </Field>
      <Field id="cg-date" label="Бүртгэсэн огноо" error={errors['cg-date']}>
        <input {...fieldAria('cg-date', errors['cg-date'])} type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
      </Field>
      <Field id="cg-scan" label="Гарын үсэг, тамгатай хувь" hint="Скан эсвэл зураг. Хавсаргаагүй бол гэрээний текстээс PDF үүсгэж хавтсанд хийнэ." error={errors['cg-scan']} optional wide>
        <span className="dfilepick">
          <input type="file" accept="application/pdf,.pdf,image/*" {...fieldAria('cg-scan', errors['cg-scan'], true)} onChange={pick} />
          <span className="btn btn--glass btn--sm" aria-hidden="true"><Paperclip className="ico" />Файл сонгох</span>
          <span className="dfilepick__name">{saving ? 'Хадгалж байна…' : scan?.name ?? 'Файл сонгоогүй'}</span>
        </span>
      </Field>
    </FormSheet>
  )
}

/** While drafting, the writer asks colleagues of the company what they think */
export function ContractAsk({ id }: { id: Id }) {
  const s = useApp()
  const c = useContract(id)
  const who = useActor()
  const [people, setPeople] = useState<Id[]>([])
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  if (!c) return null
  const list = sorted(s.people.filter(p => p.id !== who && p.companies.includes(c.company)))
  const submit = () => {
    if (!people.length) {
      setErrors({ 'ca-people': 'Санал хүсэх хүнээ сонгоно уу.' })
      return false
    }
    actions.askOpinion(c.id, who, people, text.trim())
    toast('Санал хүслээ.')
    return true
  }
  return (
    <FormSheet title="Санал хүсэх" sub={`${c.title}. Хүсэлт тухайн хүний «Миний хийх» жагсаалтад орно.`} submit="Санал хүсэх" onSubmit={submit} onClose={close} errors={errors} wide>
      <fieldset className="field field--wide" id="ca-people" tabIndex={-1} aria-describedby={errors['ca-people'] ? 'ca-people-error' : undefined}>
        <legend className="field__label">Хэнээс</legend>
        <PeoplePick people={list} value={people} onToggle={pid => { setPeople(v => (v.includes(pid) ? v.filter(x => x !== pid) : [...v, pid])); setErrors({}) }} />
        {errors['ca-people'] && <span className="field__error" id="ca-people-error">{errors['ca-people']}</span>}
      </fieldset>
      <Field id="ca-text" label="Юуны талаар" optional wide>
        <textarea id="ca-text" value={text} onChange={e => setText(e.target.value)} />
      </Field>
    </FormSheet>
  )
}

/** Each company's people for the process. In the user's system only an admin sets them (Тохиргоо → Процессын үүрэг). */
export function ProcessRoles() {
  const s = useApp()
  const company = s.companies.find(c => c.id === s.company)
  const [f, setF] = useState<Record<ProcessRole, Id>>(rolesOf(s, s.company))
  const people = sorted(s.people.filter(p => p.companies.includes(s.company)))
  const submit = () => {
    actions.setRoles(s.company, f)
    toast('Процессын үүрэг хадгалагдлаа.')
    return true
  }
  return (
    <FormSheet title="Процессын үүрэг" sub={`${company?.name}. Гэрээг хэн хянаж, хэн батлахыг тохируулна. Жинхэнэ системд зөвхөн админ өөрчилнө.`} submit="Хадгалах" onSubmit={submit} onClose={close} errors={{}}>
      {ROLES.map(r => (
        <Field key={r} id={`pr-${r}`} label={ROLE[r]}>
          <select id={`pr-${r}`} value={f[r]} onChange={e => setF({ ...f, [r]: e.target.value })}>
            {people.map(p => <option key={p.id} value={p.id}>{short(p)}, {p.role}</option>)}
          </select>
        </Field>
      ))}
    </FormSheet>
  )
}

/** The contract's paper copy as it reads now, over the whole screen */
export function ContractPdf({ id }: { id: Id }) {
  const c = useContract(id)
  if (!c) return null
  return (
    <Viewer name={c.title} sub={c.number ? `№ ${c.number}` : 'Ноорог, дугааргүй'} load={() => contractPdf(c)}
      tools={<Tool icon={Download} label="Татах" onClick={() => contractPdf(c).then(b => saveBlob(`${c.title}.pdf`, b))} />} />
  )
}
