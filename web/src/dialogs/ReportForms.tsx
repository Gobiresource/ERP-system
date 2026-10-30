// Сарын тайлан windows: sending a report back, its paper copy, and the ХХК's criteria and bonus grades
import { useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import type { Band, Criterion, Id } from '../lib/types'
import { actions, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { kpiOf, ofMonth } from '../lib/reports'
import { reportPdf } from '../lib/paper'
import { saveBlob } from '../lib/files'
import { cid } from '../lib/draft'
import { short } from '../lib/format'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'
import { useActor } from '../screens/docs/Contracts'
import { Tool, Viewer } from './Viewer'

const useReport = (id: Id) => useApp().reports.find(r => r.id === id)

/** The manager sends a report back to its writer, saying what to fix */
export function ReportReturn({ id }: { id: Id }) {
  const s = useApp()
  const r = useReport(id)
  const who = useActor()
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  if (!r) return null
  const p = s.people.find(x => x.id === r.person)
  const submit = () => {
    if (!text.trim()) {
      setErrors({ 'rr-text': 'Засах зүйлээ бичнэ үү.' })
      return false
    }
    if (!actions.returnReport(r.id, who, text.trim())) {
      setErrors({ 'rr-text': 'Танд энэ тайланг буцаах эрх байхгүй байна.' })
      return false
    }
    toast('Тайлан буцаагдлаа.')
    return true
  }
  return (
    <FormSheet title="Тайлан буцаах" sub={`${p ? short(p) : ''}, ${ofMonth(r.month)} тайлан`} submit="Буцаах" onSubmit={submit} onClose={close} errors={errors}>
      <Field id="rr-text" label="Засах зүйл" hint="Зассаны дараа тайлан танд дахин ирнэ." error={errors['rr-text']} wide>
        <textarea {...fieldAria('rr-text', errors['rr-text'], true)} value={text} onChange={e => { setText(e.target.value); setErrors({}) }} data-autofocus />
      </Field>
    </FormSheet>
  )
}

/** The report's paper copy over the whole screen */
export function ReportPdf({ id }: { id: Id }) {
  const s = useApp()
  const r = useReport(id)
  if (!r) return null
  const p = s.people.find(x => x.id === r.person)
  const file = `${p ? short(p) : ''} ${ofMonth(r.month)} тайлан.pdf`
  return (
    <Viewer name={`${ofMonth(r.month)} тайлан`} sub={p ? short(p) : undefined} load={() => reportPdf(r)}
      tools={<Tool icon={Download} label="Татах" onClick={() => reportPdf(r).then(b => saveBlob(file, b))} />} />
  )
}

/** The ХХК's criteria with their weights, and the grades with their bonus share. Reports scored before keep the old ones. */
export function KpiRules() {
  const s = useApp()
  const company = s.companies.find(c => c.id === s.company)
  const rules = kpiOf(s, s.company)
  const [crit, setCrit] = useState<(Omit<Criterion, 'weight'> & { weight: string })[]>(() => rules.criteria.map(c => ({ ...c, weight: String(c.weight) })))
  const [bands, setBands] = useState<{ min: string; name: string; bonus: string }[]>(() => [...rules.bands].sort((a, b) => b.min - a.min).map(b => ({ min: String(b.min), name: b.name, bonus: String(b.bonus) })))
  const [errors, setErrors] = useState<Errors>({})
  const sum = crit.reduce((n, c) => n + (Number(c.weight) || 0), 0)
  const int = (v: string, lo: number, hi: number) => /^\d+$/.test(v.trim()) && Number(v) >= lo && Number(v) <= hi
  const editC = (i: number, k: 'name' | 'hint' | 'weight', v: string) => setCrit(crit.map((c, j) => (j === i ? { ...c, [k]: v } : c)))
  const editB = (i: number, k: 'min' | 'name' | 'bonus', v: string) => setBands(bands.map((b, j) => (j === i ? { ...b, [k]: v } : b)))

  const submit = () => {
    const e: Errors = {}
    crit.forEach((c, i) => {
      if (!c.name.trim()) e[`kr-c${i}`] = `${i + 1}-р шалгуурын нэрийг бичнэ үү.`
      if (!int(c.weight, 1, 100)) e[`kr-w${i}`] = `${i + 1}-р шалгуурын жинг 1–100 хооронд бичнэ үү.`
    })
    if (!crit.length) e['kr-addc'] = 'Дор хаяж нэг шалгуур нэмнэ үү.'
    else if (!Object.keys(e).length && sum !== 100) e[`kr-w0`] = `Жингийн нийлбэр 100% байх ёстой. Одоо ${sum}% байна.`
    bands.forEach((b, i) => {
      if (!b.name.trim()) e[`kr-n${i}`] = `${i + 1}-р шатлалын нэрийг бичнэ үү.`
      if (!int(b.min, 0, 100)) e[`kr-m${i}`] = `${i + 1}-р шатлалын доод оноог 0–100 хооронд бичнэ үү.`
      if (!int(b.bonus, 0, 1000)) e[`kr-b${i}`] = `${i + 1}-р шатлалын урамшууллыг хувиар бичнэ үү.`
    })
    const mins = bands.map(b => Number(b.min))
    if (bands.length && !Object.keys(e).some(k => k.startsWith('kr-m'))) {
      if (!mins.includes(0)) e[`kr-m${bands.length - 1}`] = 'Аль нэг шатлал 0 оноогоос эхлэх ёстой.'
      else if (new Set(mins).size !== mins.length) e[`kr-m${mins.findIndex((m, i) => mins.indexOf(m) !== i)}`] = 'Хоёр шатлал ижил оноогоос эхэлж болохгүй.'
    }
    if (!bands.length) e['kr-addb'] = 'Дор хаяж нэг шатлал нэмнэ үү.'
    setErrors(e)
    if (Object.keys(e).length) return false
    const out: Band[] = bands.map(b => ({ min: Number(b.min), name: b.name.trim(), bonus: Number(b.bonus) })).sort((a, b) => b.min - a.min)
    actions.setKpi(s.company, { criteria: crit.map(c => ({ id: c.id, name: c.name.trim(), hint: c.hint.trim(), weight: Number(c.weight) })), bands: out })
    toast('Үнэлгээний журам хадгалагдлаа.')
    return true
  }

  return (
    <FormSheet title="Үнэлгээний журам" sub={`${company?.name}. Өмнө нь үнэлсэн тайлан хуучин журмаараа үлдэнэ.`} submit="Хадгалах" onSubmit={submit} onClose={close} errors={errors} wide>
      <fieldset className="field field--wide krules">
        <legend className="field__label">Шалгуур ба жин</legend>
        <div className="krules__rows">
          {crit.map((c, i) => (
            <div key={c.id} className="krules__row krules__row--c">
              <input {...fieldAria(`kr-c${i}`, errors[`kr-c${i}`])} aria-label={`${i + 1}-р шалгуурын нэр`} value={c.name} onChange={e => editC(i, 'name', e.target.value)} placeholder="Шалгуурын нэр" />
              <input aria-label={`${i + 1}-р шалгуурын тайлбар`} value={c.hint} onChange={e => editC(i, 'hint', e.target.value)} placeholder="Тайлбар (заавал биш)" />
              <span className="krules__num">
                <input {...fieldAria(`kr-w${i}`, errors[`kr-w${i}`])} aria-label={`${i + 1}-р шалгуурын жин, хувиар`} inputMode="numeric" value={c.weight} onChange={e => editC(i, 'weight', e.target.value)} />%
              </span>
              <button type="button" className="ibtn ibtn--sm" aria-label={`${i + 1}-р шалгуурыг хасах`} title="Хасах" onClick={() => setCrit(crit.filter((_, j) => j !== i))}><Trash2 className="ico" /></button>
            </div>
          ))}
        </div>
        <div className="krules__foot">
          <button type="button" id="kr-addc" className="btn btn--glass btn--sm" onClick={() => setCrit([...crit, { id: cid(), name: '', hint: '', weight: '' }])}><Plus className="ico" />Шалгуур нэмэх</button>
          <span className={`krules__sum tnum${sum === 100 ? '' : ' is-off'}`}>Нийт жин: {sum}%</span>
        </div>
      </fieldset>
      <fieldset className="field field--wide krules">
        <legend className="field__label">Урамшууллын шатлал</legend>
        <p className="field__hint">Тайлангийн оноо хүрсэн хамгийн дээд шатлалаар урамшууллыг тооцно.</p>
        <div className="krules__rows">
          <div className="krules__row krules__row--b krules__cap" aria-hidden="true"><span>Доод оноо</span><span>Үнэлгээ</span><span>Урамшуулал</span></div>
          {bands.map((b, i) => (
            <div key={i} className="krules__row krules__row--b">
              <input {...fieldAria(`kr-m${i}`, errors[`kr-m${i}`])} aria-label={`${i + 1}-р шатлалын доод оноо`} inputMode="numeric" value={b.min} onChange={e => editB(i, 'min', e.target.value)} />
              <input {...fieldAria(`kr-n${i}`, errors[`kr-n${i}`])} aria-label={`${i + 1}-р шатлалын нэр`} value={b.name} onChange={e => editB(i, 'name', e.target.value)} />
              <span className="krules__num">
                <input {...fieldAria(`kr-b${i}`, errors[`kr-b${i}`])} aria-label={`${i + 1}-р шатлалын урамшуулал, хувиар`} inputMode="numeric" value={b.bonus} onChange={e => editB(i, 'bonus', e.target.value)} />%
              </span>
              <button type="button" className="ibtn ibtn--sm" aria-label={`${i + 1}-р шатлалыг хасах`} title="Хасах" onClick={() => setBands(bands.filter((_, j) => j !== i))}><Trash2 className="ico" /></button>
            </div>
          ))}
        </div>
        <div className="krules__foot">
          <button type="button" id="kr-addb" className="btn btn--glass btn--sm" onClick={() => setBands([...bands, { min: '', name: '', bonus: '' }])}><Plus className="ico" />Шатлал нэмэх</button>
        </div>
      </fieldset>
    </FormSheet>
  )
}
