// Small HR windows: a department, and a position with its headcount
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { actions, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { hrScoped } from '../lib/hr'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'

export function DeptForm({ id }: { id?: string }) {
  const hr = hrScoped(useApp())
  const d = id ? hr.dept(id) : undefined
  const [f, setF] = useState({ name: d?.name ?? '', code: d?.code ?? '' })
  const [errors, setErrors] = useState<Errors>({})
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    if (errors[`df-${k}`]) setErrors(({ [`df-${k}`]: _, ...rest }) => rest)
  }

  const submit = () => {
    const e: Errors = {}
    const name = f.name.trim()
    const code = f.code.trim().toUpperCase()
    if (!name) e['df-name'] = 'Хэлтсийн нэрийг бичнэ үү.'
    else if (hr.departments.some(x => x.id !== id && x.name === name)) e['df-name'] = 'Ийм нэртэй хэлтэс бүртгэлтэй байна.'
    if (!code) e['df-code'] = 'Товч кодыг бичнэ үү.'
    setErrors(e)
    if (Object.keys(e).length) return false
    if (d) actions.updateDept(d.id, { name, code })
    else actions.addDept({ name, code })
    toast(d ? 'Өөрчлөлт хадгалагдлаа.' : 'Хэлтэс нэмэгдлээ.')
    return true
  }

  return (
    <FormSheet title={d ? 'Хэлтэс засах' : 'Хэлтэс нэмэх'} submit={d ? 'Хадгалах' : 'Нэмэх'} onSubmit={submit} onClose={close} errors={errors}>
      <Field id="df-name" label="Нэр" error={errors['df-name']} wide>
        <input {...fieldAria('df-name', errors['df-name'])} value={f.name} onChange={set('name')} autoFocus />
      </Field>
      <Field id="df-code" label="Товч код" hint="Жагсаалт, тайланд харагдана. Жишээ нь: САН" error={errors['df-code']}>
        <input {...fieldAria('df-code', errors['df-code'], true)} value={f.code} onChange={set('code')} spellCheck={false} style={{ maxWidth: '10ch' }} />
      </Field>
    </FormSheet>
  )
}

export function PositionForm({ id, dept }: { id?: string; dept?: string }) {
  const hr = hrScoped(useApp())
  const p = id ? hr.position(id) : undefined
  const taken = p ? hr.filled.get(p.id) ?? 0 : 0
  const [f, setF] = useState({ name: p?.name ?? '', quota: String(p?.quota ?? 1), dept: p?.dept ?? dept ?? hr.departments[0]?.id ?? '' })
  const [errors, setErrors] = useState<Errors>({})
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    if (errors[`pf-${k}`]) setErrors(({ [`pf-${k}`]: _, ...rest }) => rest)
  }

  const submit = () => {
    const e: Errors = {}
    const name = f.name.trim()
    const quota = f.quota.trim()
    if (!name) e['pf-name'] = 'Албан тушаалын нэрийг бичнэ үү.'
    if (!quota) e['pf-quota'] = 'Орон тоог бичнэ үү.'
    else if (!/^\d{1,3}$/.test(quota)) e['pf-quota'] = 'Орон тоог бүхэл тоогоор бичнэ үү, жишээ нь 2.'
    setErrors(e)
    if (Object.keys(e).length) return false
    if (p) actions.updatePosition(p.id, { name, quota: Number(quota), dept: f.dept })
    else actions.addPosition({ name, quota: Number(quota), dept: f.dept })
    toast(p ? 'Өөрчлөлт хадгалагдлаа.' : 'Албан тушаал нэмэгдлээ.')
    return true
  }

  const remove = () => {
    close()
    toast(`${p!.name} албан тушаал устгагдлаа.`, { undo: actions.removePosition(p!.id) })
  }

  return (
    <FormSheet title={p ? 'Албан тушаал засах' : 'Албан тушаал нэмэх'} submit={p ? 'Хадгалах' : 'Нэмэх'} onSubmit={submit} onClose={close} errors={errors}>
      <Field id="pf-name" label="Нэр" error={errors['pf-name']} wide>
        <input {...fieldAria('pf-name', errors['pf-name'])} value={f.name} onChange={set('name')} autoFocus />
      </Field>
      <Field id="pf-dept" label="Хэлтэс">
        <select id="pf-dept" value={f.dept} onChange={set('dept')}>
          {hr.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field id="pf-quota" label="Орон тоо" error={errors['pf-quota']} hint={p ? `Одоо ${taken} хүн ажиллаж байна` : undefined}>
        <input {...fieldAria('pf-quota', errors['pf-quota'], !!p)} inputMode="numeric" value={f.quota} onChange={set('quota')} style={{ maxWidth: '8ch' }} />
      </Field>
      {p && (
        <div className="field field--wide">
          {taken === 0
            ? <button type="button" className="btn btn--glass btn--sm hf-del" onClick={remove}><Trash2 className="ico" />Албан тушаал устгах</button>
            : <p className="field__hint">Энэ албан тушаалд ажилтан байгаа тул устгах боломжгүй.</p>}
        </div>
      )}
    </FormSheet>
  )
}
