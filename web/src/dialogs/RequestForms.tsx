// Хүсэлт windows: what to ask for, the forms for ээлжийн амралт, илүү цаг, шинэ ажилтан авах and худалдан авах (also to fix
// one sent back), and one request with its steps and what the person whose turn it is does (lib/hrRequests.ts, screens/Requests.tsx).
import { useEffect, useState, type ReactNode } from 'react'
import { ChevronRight, FileText, Plus, X } from 'lucide-react'
import '../styles/screens/docs.css'
import type { Employee, HireRequest, HrRequest, HrRequestKind, Id, LeaveRequest, OvertimeRequest, PurchaseItem, PurchaseRequest, TimelyCompany, TimelyEmployee } from '../lib/types'
import { actions, getState, useApp } from '../lib/store'
import { close, open, toast } from '../lib/ui'
import { DID, HR_KIND, STEPS, STEP_WHO, WILL, actorsOf, doOf, doneAt, firstStep, hoursText, involves, mayAct, mayCancel, mayReturn, spanMinutes, stepOf, totalOf, workDays } from '../lib/hrRequests'
import { NO_CAP, linkOf, loadDays, loadMonth, rowOf, sampleFor, timelyState } from '../lib/attendance'
import { empOf, managerOf } from '../lib/reports'
import { rolesOf } from '../lib/contracts'
import { current, dots, hrScoped } from '../lib/hr'
import { addDaysYmd, collator, dateDots, hm, num, parse, short, today, weekday, ymd } from '../lib/format'
import { docView } from '../lib/access'
import { Sheet } from '../ui/Sheet'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'
import { Avatar } from '../ui/bits'
import { DocTile } from '../screens/Docs'
import { HrPill, KIND_HUE, KIND_ICON, whatOf } from '../screens/Requests'
import { useActor } from '../screens/docs/Contracts'

const nameOf = (id?: Id) => {
  const p = id ? getState().people.find(x => x.id === id) : undefined
  return p ? short(p) : ''
}
const when = (iso: string) => `${dateDots(new Date(iso))}, ${hm(new Date(iso))}`
/** Saturday, Sunday or a public holiday: what overtime on it is */
const offDay = (date: string) => !!date && workDays(date, date) === 0

const PICK: { type: HrRequestKind | 'doc'; title: string; text: string }[] = [
  { type: 'leave', title: 'Ээлжийн амралт', text: 'Шууд удирдлага батална. Тушаал гарна.' },
  { type: 'overtime', title: 'Илүү цаг', text: 'Ажиллахаас өмнө хүснэ. Шууд удирдлага батална, санхүү шийднэ.' },
  { type: 'hire', title: 'Шинэ ажилтан авах', text: 'Хүний нөөц, санхүү, захирал батална.' },
  { type: 'purchase', title: 'Худалдан авах', text: 'Захирал батална. Хангамжийн ажилтан худалдан авна.' },
  { type: 'doc', title: 'Бичиг баримт', text: 'Тодорхойлолт гэх мэтийг бичиг хэргээс хүснэ.' },
]

/** Хүсэлт гаргах: the kind, then its form */
export function NewRequest() {
  const s = useApp()
  return (
    <Sheet label="Хүсэлт гаргах" onClose={close}>
      <div className="rnew">
        <div className="rnew__head">
          <h2 className="mform__title">Хүсэлт гаргах</h2>
          <p className="mform__sub">{s.companies.find(c => c.id === s.company)?.name}</p>
        </div>
        <ul className="rnew__list">
          {PICK.map((k, i) => {
            const Icon = k.type === 'doc' ? FileText : KIND_ICON[k.type]
            return (
              <li key={k.type}>
                <button type="button" className="rnew__kind" data-autofocus={i === 0 || undefined}
                  onClick={() => open(k.type === 'doc' ? { kind: 'docRequest' } : { kind: 'hrRequestForm', type: k.type })}>
                  <span className={`rrow__ico rrow__ico--hue hue--${k.type === 'doc' ? 'teal' : KIND_HUE[k.type]}`} aria-hidden="true"><Icon className="ico" /></span>
                  <span className="rnew__text"><b>{k.title}</b><small>{k.text}</small></span>
                  <ChevronRight className="ico rnew__go" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
        <p className="rnew__hint">Өвчний болон бусад чөлөөг Timely-ээр хүснэ.</p>
      </div>
    </Sheet>
  )
}

interface TimelyRow { t: TimelyEmployee | null; sample: boolean; link?: TimelyCompany; failed?: boolean }
const NONE: TimelyRow = { t: null, sample: false }
/** The employee's month in Timely, or an example one while Timely is not connected (`sample`); null while it reads */
function useTimely(e: Employee | undefined, month: string): TimelyRow | null {
  const [v, setV] = useState<TimelyRow | null>(null)
  const id = e?.id
  useEffect(() => {
    if (!e) return
    let live = true
    timelyState().then(async st => {
      const s = getState()
      const link = st.ready ? linkOf(s, e.company, st.companies) : undefined
      const m = link ? await loadMonth(link.id, month).catch(() => null) : null
      if (live) setV(link ? { t: m && rowOf(m, e), sample: false, link, failed: !m } : { t: sampleFor(s, e, month), sample: true })
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, month])
  return e ? v : NONE
}

const clock = (t: string, add: number) => {
  const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + add
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
type Worked = { in: string; out: string; sample: boolean } | 'none' | null
/** What Timely saw on an overtime's day; without Timely, made up from the hours asked (marked Жишээ) */
function useWorked(r: OvertimeRequest | undefined, e?: Employee): Worked {
  const tl = useTimely(e, r?.date.slice(0, 7) ?? '')
  const [day, setDay] = useState<Worked>(null)
  useEffect(() => {
    if (!r || !tl || r.date > today()) return
    if (tl.sample) return setDay({ in: clock(r.start, 5), out: clock(r.end, -10), sample: true })
    if (!tl.t || !tl.link) return setDay('none')
    let live = true
    loadDays(tl.link.id, tl.t.workerId, r.date.slice(0, 7)).then(d => {
      const x = d.days.find(y => y.date === r.date)
      if (live) setDay(x?.in && x.out ? { in: x.in, out: x.out, sample: false } : 'none')
    }, () => live && setDay('none'))
    return () => { live = false }
  }, [tl, r])
  return day
}

/** The steps a new request will go through, with their people */
function Plan({ kind, company, who }: { kind: HrRequestKind; company: Id; who: Id }) {
  const s = useApp()
  const manager = STEPS[kind].includes('manager') ? managerOf(s, company, who) : undefined
  const steps = STEPS[kind].slice(firstStep(kind, manager))
  return (
    <section className="field field--wide" aria-labelledby="rq-plan">
      <h3 className="field__label" id="rq-plan">Батлах явц</h3>
      <ol className="rq__steps rq__steps--plan">
        {steps.map(st => {
          const names = actorsOf(s, { company, manager }, st).map(nameOf).join(', ')
          return <li key={st}><b>{names || STEP_WHO[st]}</b><small>{STEP_WHO[st]} · {WILL[kind][st]}</small></li>
        })}
      </ol>
    </section>
  )
}
/** Who decides first, for the form's subtitle: "Ж.Анударь батална" */
function firstSays(kind: HrRequestKind, company: Id, who: Id) {
  if (kind === 'hire') return 'Хүний нөөц, санхүү, захирал батална'
  const s = getState()
  const manager = STEPS[kind].includes('manager') ? managerOf(s, company, who) : undefined
  const step = STEPS[kind][firstStep(kind, manager)]
  const names = actorsOf(s, { company, manager }, step).map(nameOf).join(', ') || STEP_WHO[step]
  return `${names} ${step === 'director' && kind === 'leave' ? 'гарын үсэг зурна' : step === 'finance' ? 'шийднэ' : 'батална'}`
}

/** A request sent back says why at the top of the form that fixes it */
function Back({ r }: { r?: HrRequest }) {
  const ev = r && r.status === 'returned' ? doneAt(r, STEPS[r.kind][r.step]) : undefined
  return ev?.note ? <div className="field--wide rq__back" role="note"><b>Буцаасан шалтгаан</b><p>{ev.note}</p><small>{nameOf(ev.by)}, {when(ev.at)}</small></div> : null
}

/** Ээлжийн амралт хүсэх, or fixing one sent back */
export function HrRequestForm({ type, id }: { type: HrRequestKind; id?: Id }) {
  const old = useApp().hrRequests.find(r => r.id === id && r.kind === type)
  if (type === 'leave') return <LeaveForm old={old as LeaveRequest | undefined} />
  if (type === 'overtime') return <OvertimeForm old={old as OvertimeRequest | undefined} />
  if (type === 'purchase') return <PurchaseForm old={old as PurchaseRequest | undefined} />
  return <HireForm old={old as HireRequest | undefined} />
}

function useFormState<T extends Record<string, string>>(start: T) {
  const [f, setF] = useState(start)
  const [errors, setErrors] = useState<Errors>({})
  const drop = (...ids: string[]) => setErrors(e => Object.fromEntries(Object.entries(e).filter(([k]) => !ids.includes(k))))
  return { f, setF, errors, setErrors, drop }
}
/** Sends it, or says it could not go; true closes the form */
function send(...args: Parameters<typeof actions.sendHrRequest>) {
  if (!actions.sendHrRequest(...args)) {
    toast('Хүсэлт илгээж чадсангүй. Хуудсыг дахин ачаалаад оролдоно уу.', { kind: 'warn' })
    return false
  }
  toast('Хүсэлт илгээгдлээ.')
  return true
}

function LeaveForm({ old }: { old?: LeaveRequest }) {
  const s = useApp()
  const who = useActor()
  const company = old?.company ?? s.company
  const me = empOf(s, company, who)
  const tl = useTimely(me, today().slice(0, 7))
  const { f, setF, errors, setErrors, drop } = useFormState({ from: old?.from ?? '', to: old?.to ?? '', days: old ? String(old.days) : '', stand: old?.stand ?? '', note: old?.note ?? '' })
  const staff = hrScoped(s).employees.filter(e => current(e) && e.id !== me?.id).sort((a, b) => collator.compare(a.given, b.given))
  const leave = tl?.t?.leave
  const days = Number(f.days)

  const setDate = (k: 'from' | 'to', v: string) => {
    const n = { ...f, [k]: v }
    if (k === 'from' && v && (!n.to || n.to < v)) n.to = v
    n.days = n.from && n.to && n.to >= n.from ? String(workDays(n.from, n.to)) : ''
    setF(n)
    drop('lv-from', 'lv-to', 'lv-days')
  }
  const submit = () => {
    const e: Errors = {}
    if (!f.from) e['lv-from'] = 'Эхлэх өдрөө сонгоно уу.'
    else if (f.from < today()) e['lv-from'] = 'Өнөөдөр эсвэл түүнээс хойших өдөр сонгоно уу.'
    if (!f.to) e['lv-to'] = 'Дуусах өдрөө сонгоно уу.'
    else if (f.from && f.to < f.from) e['lv-to'] = 'Эхлэх өдрөөс хойших өдөр сонгоно уу.'
    if (!(Number.isInteger(days) && days >= 1 && days <= 60)) e['lv-days'] = '1-ээс 60 хүртэлх тоо бичнэ үү.'
    setErrors(e)
    if (Object.keys(e).length) return false
    return send({ kind: 'leave', from: f.from, to: f.to, days, stand: f.stand || undefined, note: f.note.trim() || undefined }, who, old?.id)
  }

  return (
    <FormSheet title="Ээлжийн амралт хүсэх" sub={firstSays('leave', company, who)} submit="Илгээх" onSubmit={submit} onClose={close} errors={errors}>
      <Back r={old} />
      {me && (
        <section className="field--wide rbal" aria-labelledby="lv-bal">
          <div className="rbal__head">
            <h3 id="lv-bal">Ээлжийн амралт</h3>
            <span>{tl?.sample ? <span className="rbal__tag">Жишээ</span> : leave && leave.left !== null ? `${leave.year} оны эрх · Timely` : 'Timely'}</span>
          </div>
          {!tl ? <p className="rbal__none">Timely-ээс уншиж байна…</p> : !leave ? (
            <p className="rbal__none">{tl.failed ? 'Timely-ээс уншиж чадсангүй. Дахин оролдоно уу.' : 'Timely-д бүртгэлгүй'}</p>
          ) : leave.left === null ? <p className="rbal__none">{NO_CAP}</p> : (
            <dl>
              <div><dt>Эрх</dt><dd className="tnum">{leave.earned}<small> хоног</small></dd></div>
              <div><dt>Ашигласан</dt><dd className="tnum">{leave.used}<small> хоног</small></dd></div>
              <div><dt>Үлдсэн</dt><dd className="tnum">{leave.left}<small> хоног</small></dd></div>
            </dl>
          )}
        </section>
      )}
      <Field id="lv-from" label="Эхлэх өдөр" error={errors['lv-from']}>
        <input type="date" {...fieldAria('lv-from', errors['lv-from'])} value={f.from} min={today()} onChange={e => setDate('from', e.target.value)} data-autofocus />
      </Field>
      <Field id="lv-to" label="Дуусах өдөр" error={errors['lv-to']}>
        <input type="date" {...fieldAria('lv-to', errors['lv-to'])} value={f.to} min={f.from || today()} onChange={e => setDate('to', e.target.value)} />
      </Field>
      <Field id="lv-days" label="Ажлын өдөр" hint="Бямба, ням, баярын өдрийг хасаж тооцсон. Зөрвөл засна уу." error={errors['lv-days']}>
        <input type="number" inputMode="numeric" min={1} max={60} {...fieldAria('lv-days', errors['lv-days'], true)} value={f.days} onChange={e => { setF({ ...f, days: e.target.value }); drop('lv-days') }} />
      </Field>
      <div className="field rq__sum" role="status">
        {leave && days >= 1 ? (leave.left === null
          ? <b>Ажлын {days} өдөр</b>
          : leave.left >= days
          ? <><b>Ажлын {days} өдөр</b><small>Амралтын үлдэгдэл {leave.left - days} хоног болно.</small></>
          : <><b>Ажлын {days} өдөр</b><small className="rq__over">Үлдэгдлээс {days - leave.left} өдөр хэтэрсэн байна.</small></>) : null}
      </div>
      <Field id="lv-stand" label="Орлох хүн" hint="Таныг амрах үед ажлыг тань хариуцна." optional wide>
        <select {...fieldAria('lv-stand', undefined, true)} value={f.stand} onChange={e => setF({ ...f, stand: e.target.value })}>
          <option value="">Сонгоогүй</option>
          {staff.map(e => <option key={e.id} value={e.id}>{short(e)}, {hrScoped(s).position(e.position)?.name}</option>)}
        </select>
      </Field>
      <Field id="lv-note" label="Тайлбар" optional wide>
        <textarea {...fieldAria('lv-note')} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
      </Field>
      <Plan kind="leave" company={company} who={who} />
    </FormSheet>
  )
}

function OvertimeForm({ old }: { old?: OvertimeRequest }) {
  const s = useApp()
  const who = useActor()
  const company = old?.company ?? s.company
  const { f, setF, errors, setErrors, drop } = useFormState({ date: old?.date ?? '', start: old?.start ?? '18:00', end: old?.end ?? '20:00', work: old?.work ?? '' })
  const minutes = f.start && f.end ? spanMinutes(f.start, f.end) : 0
  const set = (k: keyof typeof f, id: string) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    drop(id)
  }
  const submit = () => {
    const e: Errors = {}
    if (!f.date) e['ot-date'] = 'Ажиллах өдрөө сонгоно уу.'
    else if (f.date < today()) e['ot-date'] = 'Өнөөдөр эсвэл түүнээс хойших өдөр сонгоно уу. Илүү цагийг ажиллахаас өмнө хүснэ.'
    if (!f.start) e['ot-start'] = 'Эхлэх цагаа сонгоно уу.'
    if (!f.end) e['ot-end'] = 'Дуусах цагаа сонгоно уу.'
    else if (f.start && !minutes) e['ot-end'] = 'Эхлэх цагаас хойших цаг сонгоно уу.'
    if (!f.work.trim()) e['ot-work'] = 'Хийх ажлаа бичнэ үү.'
    setErrors(e)
    if (Object.keys(e).length) return false
    return send({ kind: 'overtime', date: f.date, start: f.start, end: f.end, work: f.work.trim() }, who, old?.id)
  }

  return (
    <FormSheet title="Илүү цаг хүсэх" sub={firstSays('overtime', company, who)} submit="Илгээх" onSubmit={submit} onClose={close} errors={errors}>
      <Back r={old} />
      <p className="field--wide rq__info">Ажиллахаас өмнө хүснэ. Хөлс эсвэл нөхөн амралт олгохыг санхүү шийднэ.</p>
      <Field id="ot-date" label="Өдөр" error={errors['ot-date']} wide>
        <input type="date" {...fieldAria('ot-date', errors['ot-date'])} value={f.date} min={today()} onChange={set('date', 'ot-date')} data-autofocus />
      </Field>
      <Field id="ot-start" label="Эхлэх цаг" error={errors['ot-start']}>
        <input type="time" {...fieldAria('ot-start', errors['ot-start'])} value={f.start} onChange={e => { set('start', 'ot-start')(e); drop('ot-end') }} />
      </Field>
      <Field id="ot-end" label="Дуусах цаг" error={errors['ot-end']}>
        <input type="time" {...fieldAria('ot-end', errors['ot-end'])} value={f.end} onChange={set('end', 'ot-end')} />
      </Field>
      <div className="field field--wide rq__sum" role="status">
        {minutes > 0 && <><b className="tnum">Нийт {hoursText(minutes)}</b>{offDay(f.date) && <span className="rpill rpill--sent">{weekday(parse(f.date))}, амралтын өдөр</span>}</>}
      </div>
      <Field id="ot-work" label="Хийх ажил" error={errors['ot-work']} wide>
        <textarea {...fieldAria('ot-work', errors['ot-work'])} value={f.work} onChange={set('work', 'ot-work')} />
      </Field>
      <Plan kind="overtime" company={company} who={who} />
      <p className="field--wide field__hint">Ажилласан цагийг Timely-ийн ирцээс авна.</p>
    </FormSheet>
  )
}

/** The position's headcount: how many places, held now, vacant */
function Quota({ position }: { position: Id }) {
  const hr = hrScoped(useApp())
  const p = hr.position(position)
  if (!p) return null
  const filled = hr.filled.get(p.id) ?? 0
  const free = p.quota - filled
  return (
    <div className="rquota">
      <span className="rquota__bar" aria-hidden="true"><i style={{ transform: `scaleX(${Math.min(1, filled / Math.max(1, p.quota))})` }} /></span>
      <p>{p.quota} орон тооноос {filled} нь бүрдсэн. <b>{free > 0 ? `${free} сул орон тоо байна.` : 'Сул орон тоо байхгүй.'}</b></p>
    </div>
  )
}

function HireForm({ old }: { old?: HireRequest }) {
  const s = useApp()
  const who = useActor()
  const hr = hrScoped(s)
  const company = old?.company ?? s.company
  const startDept = (old && hr.position(old.position)?.dept) ?? hr.departments[0]?.id ?? ''
  const firstOf = (dept: Id) => hr.positions.find(p => p.dept === dept)?.id ?? ''
  const nextMonth = ymd(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1))
  const { f, setF, errors, setErrors, drop } = useFormState({
    dept: startDept, position: old?.position ?? firstOf(startDept), count: old ? String(old.count) : '1', start: old?.start ?? nextMonth,
    reason: old?.reason ?? 'vacant', duties: old?.duties ?? '', needs: old?.needs ?? '',
  })
  const pos = hr.position(f.position)
  const free = pos ? pos.quota - (hr.filled.get(pos.id) ?? 0) : 0
  const count = Number(f.count)
  const set = (k: keyof typeof f, id: string) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    drop(id)
  }
  const submit = () => {
    const e: Errors = {}
    if (!pos) e['hq-position'] = 'Албан тушаалаа сонгоно уу.'
    if (!(Number.isInteger(count) && count >= 1 && count <= 20)) e['hq-count'] = '1-ээс 20 хүртэлх тоо бичнэ үү.'
    if (!f.start || f.start < today()) e['hq-start'] = 'Өнөөдөр эсвэл түүнээс хойших өдөр сонгоно уу.'
    if (pos && f.reason === 'vacant' && free < count) e['hq-reason'] = 'Сул орон тоо хүрэлцэхгүй байна. Орон тоо нэмж авахаар сонгоно уу.'
    if (!f.duties.trim()) e['hq-duties'] = 'Гүйцэтгэх ажлыг бичнэ үү.'
    setErrors(e)
    if (Object.keys(e).length) return false
    return send({ kind: 'hire', position: f.position, count, start: f.start, reason: f.reason as HireRequest['reason'], duties: f.duties.trim(), needs: f.needs.trim() || undefined }, who, old?.id)
  }

  return (
    <FormSheet title="Шинэ ажилтан авах" sub={firstSays('hire', company, who)} submit="Илгээх" onSubmit={submit} onClose={close} errors={errors}>
      <Back r={old} />
      <Field id="hq-dept" label="Хэлтэс">
        <select {...fieldAria('hq-dept')} value={f.dept} onChange={e => { setF({ ...f, dept: e.target.value, position: firstOf(e.target.value) }); drop('hq-position', 'hq-reason') }} data-autofocus>
          {hr.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field id="hq-position" label="Албан тушаал" error={errors['hq-position']}>
        <select {...fieldAria('hq-position', errors['hq-position'])} value={f.position} onChange={e => { set('position', 'hq-position')(e); drop('hq-reason') }}>
          {hr.positions.filter(p => p.dept === f.dept).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      {pos && <div className="field--wide"><Quota position={pos.id} /></div>}
      <Field id="hq-count" label="Хэдэн хүн" error={errors['hq-count']}>
        <input type="number" inputMode="numeric" min={1} max={20} {...fieldAria('hq-count', errors['hq-count'])} value={f.count} onChange={e => { set('count', 'hq-count')(e); drop('hq-reason') }} />
      </Field>
      <Field id="hq-start" label="Ажилд орох өдөр" error={errors['hq-start']}>
        <input type="date" {...fieldAria('hq-start', errors['hq-start'])} value={f.start} min={today()} onChange={set('start', 'hq-start')} />
      </Field>
      <fieldset className="field field--wide" aria-describedby={errors['hq-reason'] ? 'hq-reason-error' : undefined}>
        <legend className="field__label">Шалтгаан</legend>
        <div className="choices">
          <label className="choice">
            <input type="radio" id="hq-reason" name="hq-reason" checked={f.reason === 'vacant'} onChange={() => { setF({ ...f, reason: 'vacant' }); drop('hq-reason') }} />
            <span><b>Сул орон тоонд авна</b><small>Орон тоо өөрчлөгдөхгүй.</small></span>
          </label>
          <label className="choice">
            <input type="radio" name="hq-reason" checked={f.reason === 'new'} onChange={() => { setF({ ...f, reason: 'new' }); drop('hq-reason') }} />
            <span><b>Орон тоо нэмж авна</b><small>Батлагдвал хүний нөөц орон тоог нэмнэ.</small></span>
          </label>
        </div>
        {errors['hq-reason'] && <span className="field__error" id="hq-reason-error">{errors['hq-reason']}</span>}
      </fieldset>
      <Field id="hq-duties" label="Гүйцэтгэх ажил" error={errors['hq-duties']} wide>
        <textarea {...fieldAria('hq-duties', errors['hq-duties'])} value={f.duties} onChange={set('duties', 'hq-duties')} />
      </Field>
      <Field id="hq-needs" label="Тавигдах шаардлага" optional wide>
        <textarea {...fieldAria('hq-needs')} value={f.needs} onChange={e => setF({ ...f, needs: e.target.value })} />
      </Field>
      <Plan kind="hire" company={company} who={who} />
    </FormSheet>
  )
}

/** "640,000", "640 000" or "640000" typed: the number, or NaN */
const amount = (t: string) => Number(t.replace(/[\s,]/g, ''))
type Line = { name: string; qty: string; unit: string; price: string }
const LINE: Line = { name: '', qty: '1', unit: 'ширхэг', price: '' }
const UNITS = ['ширхэг', 'хайрцаг', 'боодол', 'багц', 'кг', 'литр', 'метр']

/** Худалдан авах: what to buy, line by line, what for and by when; the director approves, the supply officer buys it */
function PurchaseForm({ old }: { old?: PurchaseRequest }) {
  const s = useApp()
  const who = useActor()
  const company = old?.company ?? s.company
  const projects = s.projects.filter(p => p.company === company && p.status !== 'done')
  const [lines, setLines] = useState<Line[]>(() => (old ? old.items.map(x => ({ name: x.name, qty: String(x.qty), unit: x.unit, price: x.price === undefined ? '' : String(x.price) })) : [{ ...LINE }]))
  const { f, setF, errors, setErrors, drop } = useFormState({ purpose: old?.purpose ?? '', need: old?.need ?? addDaysYmd(today(), 7), project: old?.project ?? '' })
  const setLine = (i: number, k: keyof Line, v: string) => {
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
    drop('pq-items')
  }
  // The lines with a name are what is asked; a line left empty is not
  const items: PurchaseItem[] = lines.filter(l => l.name.trim()).map(l => ({ name: l.name.trim(), qty: amount(l.qty), unit: l.unit.trim() || 'ширхэг', price: l.price.trim() ? amount(l.price) : undefined }))
  const sum = items.every(x => x.qty > 0 && (x.price === undefined || x.price >= 0)) ? totalOf(items) : null
  const lineError = () => {
    for (const [i, l] of lines.entries()) {
      const n = i + 1
      if (!l.name.trim() && (l.price.trim() || (l.qty.trim() && l.qty.trim() !== '1'))) return `${n}-р мөр: нэрийг бичнэ үү.`
      if (!l.name.trim()) continue
      if (!(amount(l.qty) > 0)) return `${n}-р мөр: тоо хэмжээг 0-ээс их тоогоор бичнэ үү.`
      if (l.price.trim() && !(amount(l.price) >= 0)) return `${n}-р мөр: үнийг тоогоор бичнэ үү.`
    }
    return items.length ? '' : 'Худалдан авах зүйлээ бичнэ үү.'
  }
  const submit = () => {
    const e: Errors = {}
    const bad = lineError()
    if (bad) e['pq-items'] = bad
    if (!f.purpose.trim()) e['pq-purpose'] = 'Юунд ашиглахаа бичнэ үү.'
    if (!f.need || f.need < today()) e['pq-need'] = 'Өнөөдөр эсвэл түүнээс хойших өдөр сонгоно уу.'
    setErrors(e)
    if (Object.keys(e).length) return false
    return send({ kind: 'purchase', items, purpose: f.purpose.trim(), need: f.need, project: f.project || undefined }, who, old?.id)
  }

  return (
    <FormSheet title="Худалдан авах" sub={firstSays('purchase', company, who)} submit="Илгээх" onSubmit={submit} onClose={close} errors={errors}>
      <Back r={old} />
      <fieldset className="field field--wide pq" aria-describedby={errors['pq-items'] ? 'pq-items-error' : undefined}>
        <legend className="field__label">Худалдан авах зүйлс</legend>
        <div className="pq__head" aria-hidden="true"><span>Нэр</span><span>Тоо хэмжээ</span><span>Нэгж</span><span>Нэгжийн үнэ, ₮</span><span /></div>
        <div className="pq__rows">
          {lines.map((l, i) => (
            <div className="pq__row" key={i}>
              <label className="pq__cell">
                <span className="pq__lab">Нэр</span>
                <input id={i === 0 ? 'pq-items' : undefined} aria-label={`${i + 1}-р мөр: нэр`} value={l.name} onChange={e => setLine(i, 'name', e.target.value)} aria-invalid={errors['pq-items'] ? true : undefined} data-autofocus={i === 0 || undefined} />
              </label>
              <label className="pq__cell">
                <span className="pq__lab">Тоо хэмжээ</span>
                <input inputMode="decimal" aria-label={`${i + 1}-р мөр: тоо хэмжээ`} value={l.qty} onChange={e => setLine(i, 'qty', e.target.value)} />
              </label>
              <label className="pq__cell">
                <span className="pq__lab">Нэгж</span>
                <input list="pq-units" aria-label={`${i + 1}-р мөр: нэгж`} value={l.unit} onChange={e => setLine(i, 'unit', e.target.value)} />
              </label>
              <label className="pq__cell">
                <span className="pq__lab">Нэгжийн үнэ, ₮</span>
                <input inputMode="numeric" aria-label={`${i + 1}-р мөр: нэгжийн үнэ, ₮ (заавал биш)`} value={l.price} onChange={e => setLine(i, 'price', e.target.value)} />
              </label>
              <button type="button" className="ibtn pq__del" aria-label={`${i + 1}-р мөрийг хасах`} disabled={lines.length === 1}
                onClick={() => { setLines(ls => ls.filter((_, j) => j !== i)); drop('pq-items') }}><X className="ico" /></button>
            </div>
          ))}
        </div>
        <datalist id="pq-units">{UNITS.map(u => <option key={u} value={u} />)}</datalist>
        <div className="pq__foot">
          <button type="button" className="btn btn--glass btn--sm" onClick={() => setLines(ls => [...ls, { ...LINE }])}><Plus className="ico" />Мөр нэмэх</button>
          {sum !== null && <span className="pq__sum">Нийт: <b className="tnum">{num(sum)} ₮</b></span>}
        </div>
        <span className="field__hint">Үнийг мэдэхгүй бол хоосон үлдээнэ үү.</span>
        {errors['pq-items'] && <span className="field__error" id="pq-items-error">{errors['pq-items']}</span>}
      </fieldset>
      <Field id="pq-purpose" label="Юунд ашиглах" error={errors['pq-purpose']} wide>
        <textarea {...fieldAria('pq-purpose', errors['pq-purpose'])} value={f.purpose} onChange={e => { setF({ ...f, purpose: e.target.value }); drop('pq-purpose') }} />
      </Field>
      <Field id="pq-need" label="Хэзээ хэрэгтэй" error={errors['pq-need']}>
        <input type="date" {...fieldAria('pq-need', errors['pq-need'])} value={f.need} min={today()} onChange={e => { setF({ ...f, need: e.target.value }); drop('pq-need') }} />
      </Field>
      <Field id="pq-project" label="Төсөл" optional>
        <select {...fieldAria('pq-project')} value={f.project} onChange={e => setF({ ...f, project: e.target.value })}>
          <option value="">Төсөлгүй</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Plan kind="purchase" company={company} who={who} />
    </FormSheet>
  )
}

/** The lines of a purchase with their sums, and what was paid once bought */
function PurchaseItems({ r }: { r: PurchaseRequest }) {
  const sum = totalOf(r.items)
  /** A price not written: a dash, said as such */
  const none = <><span aria-hidden="true">—</span><span className="sr-only">Үнэ бичээгүй</span></>
  return (
    <div className="pq-list">
      <table className="pq-table">
        <caption className="sr-only">Худалдан авах зүйлс</caption>
        <thead><tr><th scope="col">Нэр</th><th scope="col" className="num">Тоо хэмжээ</th><th scope="col" className="num pq-one">Нэгжийн үнэ</th><th scope="col" className="num">Дүн</th></tr></thead>
        <tbody>
          {r.items.map((x, i) => (
            <tr key={i}>
              <td>{x.name}</td>
              <td className="num tnum">{x.qty.toLocaleString('en-US', { maximumFractionDigits: 2 })} {x.unit}</td>
              <td className="num tnum pq-one">{x.price === undefined ? none : `${num(x.price)} ₮`}</td>
              <td className="num tnum">{x.price === undefined ? none : `${num(x.qty * x.price)} ₮`}</td>
            </tr>
          ))}
        </tbody>
        {sum !== null && <tfoot><tr><th scope="row" colSpan={3}>Нийт</th><td className="num tnum">{num(sum)} ₮</td></tr></tfoot>}
      </table>
      {r.paid !== undefined && <p className="pq-paid">Төлсөн: <b className="tnum">{num(r.paid)} ₮</b></p>}
    </div>
  )
}

/** One request: what it asks, its steps so far, and what the person whose turn it is, or who asked, can do */
export function HrRequestSheet({ id }: { id: Id }) {
  return (
    <Sheet kind="drawer" label="Хүсэлт" onClose={close}>
      <HrRequestBody id={id} />
    </Sheet>
  )
}

function Meta({ items }: { items: [string, ReactNode, boolean?][] }) {
  return (
    <dl className="meta rq__meta">
      {items.map(([k, v, wide]) => <div key={k} className={wide ? 'rq__wide' : undefined}><dt>{k}</dt><dd><span>{v}</span></dd></div>)}
    </dl>
  )
}

function HrRequestBody({ id }: { id: Id }) {
  const s = useApp()
  const who = useActor()
  const r = s.hrRequests.find(x => x.id === id && involves(s, x, who))
  if (!r) return <p className="dview__note">Хүсэлт олдсонгүй.</p>
  const p = s.people.find(x => x.id === r.by)
  const e = empOf(s, r.company, r.by)
  const hr = hrScoped(s)
  const sent = r.history.filter(h => h.what === 'sent').at(-1)!
  const order = r.kind === 'leave' && r.order ? s.docs.find(d => d.id === r.order && docView(s).doc(d)) : undefined
  const back = r.status === 'returned' ? doneAt(r, stepOf(r)) : undefined

  return (
    <div className="rq">
      <div className="tp__top"><HrPill r={r} who={who} /></div>
      <h2 className="tp__title">{HR_KIND[r.kind]}</h2>
      {p && <p className="rq__who"><Avatar person={p} size="sm" /><span>{short(p)}, {(e && hr.position(e.position)?.name) ?? p.role}</span></p>}
      {back?.note && <div className="rq__back" role="note"><b>Буцаасан шалтгаан</b><p>{back.note}</p><small>{nameOf(back.by)}, {when(back.at)}</small></div>}

      {r.kind === 'leave' && (
        <Meta items={[
          ['Хугацаа', <span className="tnum">{whatOf(r, s.positions)}</span>],
          ['Ажлын өдөр', `${r.days} өдөр`],
          ['Орлох хүн', r.stand ? (() => { const x = s.employees.find(y => y.id === r.stand); return x ? short(x) : 'Сонгоогүй' })() : 'Сонгоогүй'],
          ['Тайлбар', r.note || 'Бөглөөгүй'],
        ]} />
      )}
      {r.kind === 'overtime' && (
        <Meta items={[
          ['Өдөр', <span className="tnum">{dots(r.date)}, {weekday(parse(r.date))}{offDay(r.date) ? ', амралтын өдөр' : ''}</span>],
          ['Хүссэн цаг', <span className="tnum">{r.start}–{r.end}, {hoursText(spanMinutes(r.start, r.end))}</span>],
          ['Хийх ажил', r.work, true],
        ]} />
      )}
      {r.kind === 'hire' && (
        <>
          <Meta items={[
            ['Албан тушаал', whatOf(r, s.positions)],
            ['Хэлтэс', hr.dept(hr.position(r.position)?.dept ?? '')?.name ?? 'Хэлтэс'],
            ['Хэдэн хүн', `${r.count} хүн`],
            ['Ажилд орох өдөр', <span className="tnum">{dots(r.start)}</span>],
            ['Шалтгаан', r.reason === 'vacant' ? 'Сул орон тоонд авна' : 'Орон тоо нэмж авна', true],
            ['Гүйцэтгэх ажил', r.duties, true],
            ['Тавигдах шаардлага', r.needs || 'Бөглөөгүй', true],
          ]} />
          <Quota position={r.position} />
        </>
      )}
      {r.kind === 'purchase' && (
        <>
          <Meta items={[
            ['Юунд ашиглах', r.purpose, true],
            ['Хэзээ хэрэгтэй', <span className="tnum">{dots(r.need)}</span>],
            ['Төсөл', s.projects.find(x => x.id === r.project)?.name ?? 'Төсөлгүй'],
          ]} />
          <PurchaseItems r={r} />
        </>
      )}
      {r.kind === 'leave' && r.status === 'open' && <LeaveContext r={r} e={e} />}
      {r.kind === 'overtime' && r.date <= today() && <WorkedCard r={r} e={e} />}

      <h3 className="rq__h">Явц</h3>
      <ol className="rq__steps">
        <li className="is-done"><b>Илгээсэн</b><small>{nameOf(sent.by)} · {when(sent.at)}</small></li>
        {STEPS[r.kind].map((st, i) => {
          if (i < firstStep(r.kind, r.manager)) return null
          const ev = doneAt(r, st)
          const done = ev?.what === 'approved' && (r.status === 'done' || i < r.step)
          const returned = ev?.what === 'returned' && r.status === 'returned' && i === r.step
          const now = r.status === 'open' && i === r.step
          const names = done || returned ? nameOf(ev!.by) : actorsOf(s, r, st).map(nameOf).join(', ')
          const did = r.kind === 'overtime' && st === 'finance' && r.pay ? `${r.pay === 'rest' ? 'Нөхөн амралт' : 'Илүү цагийн хөлс'}, ${hoursText(r.minutes ?? 0)}`
            : r.kind === 'purchase' && st === 'supply' && r.paid !== undefined ? `${DID.purchase.supply}, ${num(r.paid)} ₮` : DID[r.kind][st]
          return (
            <li key={st} className={done ? 'is-done' : returned ? 'is-back' : now ? 'is-now' : ''}>
              <b>{STEP_WHO[st]}{names && ` · ${names}`}</b>
              <small>
                {done ? `${did} · ${when(ev!.at)}`
                  : returned ? `Буцаасан · ${when(ev!.at)}`
                  : now ? (r.kind === 'overtime' && st === 'finance' && r.date > today() ? 'Ажилласны дараа шийднэ' : 'Хүлээж буй')
                  : WILL[r.kind][st]}
              </small>
              {done && ev!.note && <span className="rq__say">{ev!.note}</span>}
            </li>
          )
        })}
        {r.status === 'canceled' && <li className="is-back"><b>Цуцалсан</b><small>{nameOf(r.history.at(-1)!.by)} · {when(r.history.at(-1)!.at)}</small></li>}
      </ol>

      {order && (
        <button type="button" className="rq__doc" onClick={() => open({ kind: 'doc', id: order.id })}>
          <DocTile kind="order" />
          <span><b>{order.name}</b><small>Тушаал харах</small></span>
        </button>
      )}
      {mayAct(s, r, who) && <Decide key={`${r.id}${r.step}`} r={r} who={who} e={e} />}
      {r.by === who && (r.status === 'returned' || mayCancel(r, who)) && <Mine r={r} who={who} />}
    </div>
  )
}

/** For the manager: the leave left before and after, and who else of the department is away then */
function LeaveContext({ r, e }: { r: LeaveRequest; e?: Employee }) {
  const s = useApp()
  const tl = useTimely(e, today().slice(0, 7))
  const leave = tl?.t?.leave
  const away = s.hrRequests.filter((x): x is LeaveRequest => x.kind === 'leave' && x.id !== r.id && x.company === r.company
    && (x.status === 'open' || x.status === 'done') && x.from <= r.to && r.from <= x.to && !!e && empOf(s, x.company, x.by)?.dept === e.dept)
  return (
    <>
      {e && (
        <section className="rbal" aria-labelledby="rq-bal">
          <div className="rbal__head"><h3 id="rq-bal">Амралтын үлдэгдэл</h3><span>{tl?.sample ? <span className="rbal__tag">Жишээ</span> : 'Timely'}</span></div>
          {!tl ? <p className="rbal__none">Timely-ээс уншиж байна…</p> : !leave ? (
            <p className="rbal__none">{tl.failed ? 'Timely-ээс уншиж чадсангүй. Дахин оролдоно уу.' : 'Timely-д бүртгэлгүй'}</p>
          ) : leave.left === null ? <p className="rbal__none">{NO_CAP}</p> : (
            <dl>
              <div><dt>Одоо</dt><dd className="tnum">{leave.left}<small> хоног</small></dd></div>
              <div><dt>Батлагдвал</dt><dd className="tnum">{leave.left - r.days}<small> хоног</small></dd></div>
            </dl>
          )}
        </section>
      )}
      <div className={`rq__away${away.length ? ' is-some' : ''}`}>
        <b>{away.length ? `Энэ хугацаанд хэлтсээс ${away.length} хүн амарна` : 'Энэ хугацаанд хэлтсээс өөр хүн амрахгүй'}</b>
        {away.map(x => <small key={x.id}>{nameOf(x.by)} · <span className="tnum">{whatOf(x, s.positions)}</span>{x.status === 'open' ? ', батлагдаагүй' : ''}</small>)}
      </div>
    </>
  )
}

/** The overtime's day as Timely saw it */
function WorkedCard({ r, e }: { r: OvertimeRequest; e?: Employee }) {
  const day = useWorked(r, e)
  return (
    <section className="rbal" aria-labelledby="rq-worked">
      <div className="rbal__head"><h3 id="rq-worked">Ажилласан цаг</h3><span>{day && day !== 'none' && day.sample ? <span className="rbal__tag">Жишээ</span> : 'Timely'}</span></div>
      {!day ? <p className="rbal__none">Timely-ээс уншиж байна…</p> : day === 'none' ? <p className="rbal__none">Тухайн өдөр Timely-д бүртгэл алга.</p> : (
        <dl>
          <div><dt>Ажилласан</dt><dd className="tnum">{hoursText(spanMinutes(day.in, day.out))}</dd></div>
          <div><dt>Ирсэн, явсан</dt><dd className="tnum">{day.in}–{day.out}</dd></div>
        </dl>
      )}
    </section>
  )
}

/** What the person at the step says before they decide */
function hintOf(r: HrRequest) {
  const step = stepOf(r)
  const director = nameOf(rolesOf(getState(), r.company)?.director)
  if (r.kind === 'leave') {
    if (step === 'manager') return `Баталбал тушаал автоматаар үүснэ. Гарын үсэг зурах хүн: ${director || STEP_WHO.director}.`
    if (step === 'director') return 'Гарын үсэг зурмагц тушаал Бичиг хэрэгт хадгалагдаж, ажилтны ажлын түүхэнд орно. Дараа нь хүний нөөц Timely-д бүртгэнэ.'
    return 'Амралтыг Timely-д бүртгээд «Timely-д бүртгэх» товчийг дарна уу.'
  }
  if (r.kind === 'overtime') return step === 'manager' ? 'Баталбал ажилтан тухайн өдөр илүү цаг ажиллана. Ажилласны дараа санхүү шийднэ.' : 'Тооцох цагийг Timely-ийн ирцээр бөглөсөн. Шаардлагатай бол засна уу.'
  if (r.kind === 'purchase') return step === 'director' ? 'Баталбал хүсэлт хангамжийн ажилтны жагсаалтад очно.' : 'Худалдан авсны дараа «Худалдан авсан» товчийг дарна уу.'
  return step === 'director' ? 'Баталбал хүний нөөц сонгон шалгаруулалт эхлүүлнэ.' : step === 'hr' ? 'Баталбал санхүү цалингийн төсвийг шалгана.' : 'Баталбал захирал шийднэ.'
}
const DONE_TOAST = (r: HrRequest, pay: 'pay' | 'rest') => {
  const step = stepOf(r)
  if (r.kind === 'leave' && step === 'director') return 'Гарын үсэг зурлаа. Тушаал үүслээ.'
  if (r.kind === 'leave' && step === 'hr') return 'Timely-д бүртгэснийг тэмдэглэлээ.'
  if (r.kind === 'overtime' && step === 'finance') return pay === 'rest' ? 'Нөхөн амралт олгохоор шийдвэрлэлээ.' : 'Илүү цагийн хөлс олгохоор шийдвэрлэлээ.'
  if (r.kind === 'purchase' && step === 'supply') return 'Худалдан авснаа тэмдэглэлээ.'
  return 'Хүсэлт батлагдлаа.'
}

/** The step's person approves (signs, registers, decides) or sends it back with the reason */
function Decide({ r, who, e }: { r: HrRequest; who: Id; e?: Employee }) {
  const step = stepOf(r)
  const decides = r.kind === 'overtime' && step === 'finance'
  /** The supply officer says a purchase is bought, with what was paid if they like */
  const buys = r.kind === 'purchase' && step === 'supply'
  const [paid, setPaid] = useState('')
  const ot = decides ? (r as OvertimeRequest) : undefined
  const worked = useWorked(ot, ot && e)
  const suggested = ot ? (worked && worked !== 'none' ? spanMinutes(worked.in, worked.out) : spanMinutes(ot.start, ot.end)) : 0
  const [act, setAct] = useState<'return' | null>(null)
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [pay, setPay] = useState<'pay' | 'rest'>('pay')
  const [mins, setMins] = useState<{ h: string; m: string } | null>(null)
  const [error, setError] = useState('')
  const shown = mins ?? { h: String(Math.floor(suggested / 60)), m: String(suggested % 60) }

  const approve = () => {
    const h = Number(shown.h)
    const m = Number(shown.m)
    const minutes = h * 60 + m
    if (decides && !(Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 24 && m >= 0 && m <= 59 && minutes > 0)) return setError('Тооцох цагаа бичнэ үү.')
    if (buys && paid.trim() && !(amount(paid) >= 0)) return setError('Төлсөн дүнг тоогоор бичнэ үү.')
    const more = { note: note.trim(), pay: decides ? pay : undefined, minutes: decides ? minutes : undefined, paid: buys && paid.trim() ? amount(paid) : undefined }
    if (!actions.approveHrRequest(r.id, who, more)) return setError('Хадгалж чадсангүй. Хуудсыг дахин ачаалаад оролдоно уу.')
    toast(DONE_TOAST(r, pay))
    close()
  }
  const sendBack = () => {
    if (!text.trim()) return setError('Буцаах шалтгаанаа бичнэ үү.')
    if (!actions.returnHrRequest(r.id, who, text)) return setError('Хадгалж чадсангүй. Хуудсыг дахин ачаалаад оролдоно уу.')
    toast('Хүсэлт буцаагдлаа.')
    close()
  }

  return (
    <section className="rq__office" aria-labelledby="rq-act">
      <h3 id="rq-act">Таны шийдвэр</h3>
      <p className="rq__hint">{hintOf(r)}</p>
      {act === 'return' ? (
        <div className="field">
          <label className="field__label" htmlFor="rq-why">Буцаах шалтгаан</label>
          <textarea id="rq-why" value={text} onChange={x => { setText(x.target.value); setError('') }} autoFocus aria-invalid={error ? true : undefined} aria-describedby={`rq-why-hint${error ? ' rq-error' : ''}`} />
          <span className="field__hint" id="rq-why-hint">{nameOf(r.by)} засаад дахин илгээж болно.</span>
          <div className="rq__acts">
            <button type="button" className="btn btn--accent" onClick={sendBack}>Буцаах</button>
            <button type="button" className="btn btn--plain" onClick={() => { setAct(null); setError('') }}>Болих</button>
          </div>
        </div>
      ) : (
        <>
          {decides && (
            <>
              <fieldset className="field">
                <legend className="field__label">Юугаар олгох</legend>
                <div className="choices">
                  <label className="choice">
                    <input type="radio" name="rq-pay" checked={pay === 'pay'} onChange={() => setPay('pay')} />
                    <span><b>Илүү цагийн хөлс</b><small>Цалинтай хамт олгоно.</small></span>
                  </label>
                  <label className="choice">
                    <input type="radio" name="rq-pay" checked={pay === 'rest'} onChange={() => setPay('rest')} />
                    <span><b>Нөхөн амралт</b><small>Ажилласан цагтай тэнцэх хугацаагаар амраана.</small></span>
                  </label>
                </div>
              </fieldset>
              <fieldset className="field">
                <legend className="field__label">Тооцох цаг</legend>
                <div className="rq__time">
                  <label><input type="number" inputMode="numeric" min={0} max={24} value={shown.h} onChange={x => { setMins({ ...shown, h: x.target.value }); setError('') }} aria-invalid={error ? true : undefined} /><span>цаг</span></label>
                  <label><input type="number" inputMode="numeric" min={0} max={59} value={shown.m} onChange={x => { setMins({ ...shown, m: x.target.value }); setError('') }} aria-invalid={error ? true : undefined} /><span>мин</span></label>
                </div>
              </fieldset>
            </>
          )}
          {buys && (
            <div className="field">
              <label className="field__label" htmlFor="rq-paid">Төлсөн дүн, ₮ (заавал биш)</label>
              <input id="rq-paid" inputMode="numeric" value={paid} onChange={x => { setPaid(x.target.value); setError('') }} aria-invalid={error ? true : undefined} aria-describedby={error ? 'rq-error' : undefined} />
            </div>
          )}
          {(r.kind === 'hire' || (r.kind === 'purchase' && step === 'director')) && (
            <div className="field">
              <label className="field__label" htmlFor="rq-note">Тайлбар (заавал биш)</label>
              <input id="rq-note" value={note} onChange={x => setNote(x.target.value)} />
            </div>
          )}
          <div className="rq__acts">
            <button type="button" className="btn btn--accent" onClick={approve}>{buys ? DID.purchase.supply : doOf(r)}</button>
            {mayReturn(getState(), r, who) && <button type="button" className="btn btn--plain" onClick={() => { setText(''); setAct('return') }}>Буцаах</button>}
          </div>
        </>
      )}
      {error && <p className="field__error" id="rq-error" role="alert">{error}</p>}
    </section>
  )
}

/** The asker: fix one sent back and send it again, or call it off */
function Mine({ r, who }: { r: HrRequest; who: Id }) {
  const [asking, setAsking] = useState(false)
  const cancel = () => {
    if (!actions.cancelHrRequest(r.id, who)) return toast('Хүсэлтийг цуцалж чадсангүй. Хуудсыг дахин ачаалаад оролдоно уу.', { kind: 'warn' })
    toast('Хүсэлт цуцлагдлаа.')
    close()
  }
  return (
    <section className="rq__office" aria-label="Таны хүсэлт">
      {asking ? (
        <>
          <p className="rq__hint">Цуцалсан хүсэлтийг сэргээх боломжгүй.</p>
          <div className="rq__acts">
            <button type="button" className="btn btn--danger" onClick={cancel}>Цуцлах</button>
            <button type="button" className="btn btn--plain" onClick={() => setAsking(false)}>Болих</button>
          </div>
        </>
      ) : (
        <div className="rq__acts">
          {r.status === 'returned' && <button type="button" className="btn btn--accent" onClick={() => open({ kind: 'hrRequestForm', type: r.kind, id: r.id })}>Засаад илгээх</button>}
          {mayCancel(r, who) && <button type="button" className="btn btn--plain" onClick={() => setAsking(true)}>Цуцлах</button>}
        </div>
      )}
    </section>
  )
}

