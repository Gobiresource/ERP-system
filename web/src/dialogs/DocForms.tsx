// Бичиг хэрэг windows: look at a document, add or change one (HR and the office), ask the office for one, and one request
// with what the office does with it.
import { useRef, useState, type ChangeEvent } from 'react'
import { Download, FileDown, Paperclip, Printer, Sparkles, SquarePen } from 'lucide-react'
import '../styles/screens/docs.css'
import type { BoardFile, DocKind, DocRequest, Hue } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { close, open, toast } from '../lib/ui'
import { DOC_KIND, DOC_KINDS, FOLDER_COLORS, FOLDER_HUES, PURPOSES, REQ_STATUS, WHAT, isOpen, stepsOf } from '../lib/docs'
import { docBlob, downloadDoc, requestPdf } from '../lib/paper'
import { putFile } from '../lib/files'
import { cid } from '../lib/draft'
import { addDaysYmd, dateDots, daysFromToday, dueLabel, hm, num, short, today } from '../lib/format'
import { dots } from '../lib/hr'
import { Sheet } from '../ui/Sheet'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'
import { Avatar } from '../ui/bits'
import { PeoplePick } from '../ui/PeoplePick'
import { DocTile, ReqPill } from '../screens/Docs'
import { EditPdf, Tool, Viewer, isPdfName } from './Viewer'

const MB25 = 25 * 1024 * 1024

/** A document over the whole screen, with what can be done with it */
export function DocSheet({ id }: { id: string }) {
  const s = useApp()
  const d = s.docs.find(x => x.id === id)
  if (!d) {
    return (
      <Sheet label="Бичиг баримт" onClose={close}>
        <p className="dview__note">Бичиг баримт олдсонгүй.</p>
      </Sheet>
    )
  }
  const by = s.people.find(p => p.id === d.by)
  const p = d.paper
  const sub = [DOC_KIND[d.kind], p?.number && `№ ${p.number}`, p?.date && dots(p.date), p?.party, p?.amount && `${num(p.amount)} ₮`, `Нэмсэн: ${by ? `${short(by)}, ` : ''}${dateDots(new Date(d.added))}`, d.updated && `Зассан: ${dateDots(new Date(d.updated))}`].filter(Boolean).join(' · ')
  return (
    <Viewer name={d.name} sub={sub} load={() => docBlob(d)} tools={
      <>
        {/* A demo document has no file until it is drawn, as a PDF */}
        {(!d.file || isPdfName(d.file)) && <EditPdf from={`doc-${d.id}`} />}
        <Tool icon={SquarePen} label="Мэдээлэл засах" onClick={() => open({ kind: 'docEdit', id: d.id })} />
        <Tool icon={Download} label="Татах" onClick={() => downloadDoc(d)} />
      </>
    } />
  )
}

/** HR and the office add a document to a company's folder and say who sees it; with `id`, change one (its file too) */
export function DocAdd({ company, id }: { company?: string; id?: string }) {
  const s = useApp()
  const was = id ? s.docs.find(d => d.id === id) : undefined
  const into = was?.company ?? company ?? s.company
  const people = s.people.filter(p => p.companies.includes(into))
  const [f, setF] = useState({ name: was?.name ?? '', kind: was?.kind ?? ('form' as DocKind), all: !was || was.to === 'all', people: was && was.to !== 'all' ? was.to : [] })
  const [file, setFile] = useState<BoardFile | null>(was?.file ?? null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const drop = (k: string) => setErrors(({ [k]: _, ...rest }) => rest)

  // The file is kept as soon as it is chosen, so saving the form never waits
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const x = e.target.files?.[0]
    drop('da-file')
    if (!x) return
    if (x.size > MB25) return setErrors(v => ({ ...v, 'da-file': '25 MB хүртэлх файл сонгоно уу.' }))
    setSaving(true)
    const ref = { id: `f${cid()}`, name: x.name, type: x.type, size: x.size }
    try {
      await putFile(ref.id, x)
      setFile(ref)
      setF(v => ({ ...v, name: v.name || x.name.replace(/\.[^.]+$/, '') }))
    } catch {
      setErrors(v => ({ ...v, 'da-file': 'Энэ хөтөч дээр файл хадгалах боломжгүй байна.' }))
    } finally {
      setSaving(false)
    }
  }
  const submit = () => {
    const e: Errors = {}
    if (saving) e['da-file'] = 'Файл хадгалагдаж дуусахыг хүлээнэ үү.'
    else if (!file && !was) e['da-file'] = 'Файлаа сонгоно уу.'
    if (!f.name.trim()) e['da-name'] = 'Бичиг баримтын нэрийг бичнэ үү.'
    if (!f.all && !f.people.length) e['da-to'] = 'Хэнд харагдахыг сонгоно уу.'
    setErrors(e)
    if (Object.keys(e).length) return false
    const doc = { name: f.name.trim(), kind: f.kind, to: f.all ? ('all' as const) : f.people }
    if (was) {
      // A demo document not yet drawn has no file: it keeps none until one is chosen
      actions.updateDoc(was.id, { ...doc, ...(file ? { file } : {}), updated: new Date().toISOString() })
      toast('Өөрчлөлт хадгалагдлаа.')
    } else {
      actions.addDoc({ ...doc, company: into, file: file! })
      toast('Бичиг баримт нэмэгдлээ.')
    }
    return true
  }
  const toggle = (id: string) => {
    setF(v => ({ ...v, people: v.people.includes(id) ? v.people.filter(x => x !== id) : [...v.people, id] }))
    drop('da-to')
  }

  return (
    // Changing a document goes back to it, saved or not
    <FormSheet
      title={was ? 'Мэдээлэл засах' : 'Бичиг баримт нэмэх'}
      sub={was ? `${was.name}. Хүний нөөц, бичиг хэргийн ажилтан засна.` : 'Хүний нөөц, бичиг хэргийн ажилтан нэмнэ. Сонгосон ажилтанд харагдана.'}
      submit={was ? 'Хадгалах' : 'Нэмэх'} onSubmit={submit} onClose={was ? () => open({ kind: 'doc', id: was.id }) : close} errors={errors} wide
    >
      <Field id="da-file" label="Файл" hint={was ? 'Шинэ файл сонговол одоогийнхыг солино. 25 MB хүртэл' : 'PDF, зураг эсвэл Word, 25 MB хүртэл'} error={errors['da-file']} wide>
        <span className="dfilepick">
          <input type="file" {...fieldAria('da-file', errors['da-file'], true)} onChange={pick} />
          <span className="btn btn--glass btn--sm" aria-hidden="true"><Paperclip className="ico" />{was ? 'Файл солих' : 'Файл сонгох'}</span>
          <span className="dfilepick__name">{saving ? 'Хадгалж байна…' : file?.name ?? (was ? `${was.name}.pdf` : 'Файл сонгоогүй')}</span>
        </span>
      </Field>
      <Field id="da-name" label="Нэр" error={errors['da-name']}>
        <input {...fieldAria('da-name', errors['da-name'])} value={f.name} onChange={e => { setF({ ...f, name: e.target.value }); drop('da-name') }} />
      </Field>
      <Field id="da-kind" label="Төрөл">
        <select id="da-kind" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value as DocKind })}>
          {DOC_KINDS.map(k => <option key={k} value={k}>{DOC_KIND[k]}</option>)}
        </select>
      </Field>
      <fieldset className="field field--wide dto" aria-describedby={errors['da-to'] ? 'da-to-error' : undefined}>
        <legend className="field__label">Хэнд харагдах</legend>
        <div className="choices">
          <label className="choice"><input type="radio" name="da-to" checked={f.all} onChange={() => { setF({ ...f, all: true }); drop('da-to') }} /><span><b>Бүх ажилтан</b><small>Журам, маягт зэрэг</small></span></label>
          <label className="choice"><input type="radio" name="da-to" id="da-to" checked={!f.all} onChange={() => setF({ ...f, all: false })} /><span><b>Сонгосон ажилтан</b><small>Гэрээ, тушаал, тодорхойлолт</small></span></label>
        </div>
        {!f.all && (
          <PeoplePick people={people} value={f.people} onToggle={toggle} />
        )}
        {errors['da-to'] && <span className="field__error" id="da-to-error">{errors['da-to']}</span>}
      </fieldset>
    </FormSheet>
  )
}

const OTHER = 'Бусад'

/** An employee asks the office for a document */
export function RequestForm() {
  const [f, setF] = useState({ what: WHAT[0], other: '', purpose: '', where: '', paper: true, copies: '1', need: addDaysYmd(today(), 3), note: '' })
  const [errors, setErrors] = useState<Errors>({})
  const drop = (k: string) => setErrors(({ [k]: _, ...rest }) => rest)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    drop(`rq-${k}`)
  }
  const submit = () => {
    const e: Errors = {}
    const copies = Number(f.copies)
    if (f.what === OTHER && !f.other.trim()) e['rq-other'] = 'Бичиг баримтын нэрийг бичнэ үү.'
    if (!f.purpose.trim()) e['rq-purpose'] = 'Юунд ашиглахаа бичнэ үү.'
    if (f.paper && !(Number.isInteger(copies) && copies >= 1 && copies <= 10)) e['rq-copies'] = '1-ээс 10 хүртэлх тоо бичнэ үү.'
    if (!f.need || daysFromToday(f.need) < 0) e['rq-need'] = 'Өнөөдөр эсвэл түүнээс хойших огноо сонгоно уу.'
    setErrors(e)
    if (Object.keys(e).length) return false
    actions.addRequest({
      what: f.what === OTHER ? f.other.trim() : f.what, purpose: f.purpose.trim(), where: f.where.trim() || undefined,
      paper: f.paper, copies: f.paper ? copies : 1, need: f.need, note: f.note.trim() || undefined,
    })
    toast('Хүсэлт илгээгдлээ.')
    return true
  }

  return (
    <FormSheet title="Бичиг баримт хүсэх" sub="Бичиг хэргийн ажилтан бэлтгээд танд мэдэгдэнэ." submit="Илгээх" onSubmit={submit} onClose={close} errors={errors} wide>
      <Field id="rq-what" label="Ямар бичиг баримт">
        <select id="rq-what" value={f.what} onChange={e => { set('what')(e); drop('rq-other') }} data-autofocus>
          {[...WHAT, OTHER].map(w => <option key={w}>{w}</option>)}
        </select>
      </Field>
      {f.what === OTHER ? (
        <Field id="rq-other" label="Бичиг баримтын нэр" error={errors['rq-other']}>
          <input {...fieldAria('rq-other', errors['rq-other'])} value={f.other} onChange={set('other')} />
        </Field>
      ) : <span aria-hidden="true" />}
      <Field id="rq-purpose" label="Юунд ашиглах" hint="Жишээ нь: банкны зээл авах, виз мэдүүлэх" error={errors['rq-purpose']}>
        <input {...fieldAria('rq-purpose', errors['rq-purpose'], true)} value={f.purpose} onChange={set('purpose')} list="rq-purposes" autoComplete="off" />
        <datalist id="rq-purposes">{PURPOSES.map(p => <option key={p} value={p} />)}</datalist>
      </Field>
      <Field id="rq-where" label="Хаана өгөх" hint="Байгууллагын нэр" optional>
        <input {...fieldAria('rq-where', undefined, true)} value={f.where} onChange={set('where')} />
      </Field>
      <fieldset className="field field--wide">
        <legend className="field__label">Хэлбэр</legend>
        <div className="choices">
          <label className="choice">
            <input type="radio" name="rq-paper" checked={f.paper} onChange={() => setF({ ...f, paper: true })} />
            <Printer className="ico" aria-hidden="true" />
            <span><b>Цаасаар</b><small>Тамгатай, бичиг хэргээс ирж авна</small></span>
          </label>
          <label className="choice">
            <input type="radio" name="rq-paper" checked={!f.paper} onChange={() => { setF({ ...f, paper: false }); drop('rq-copies') }} />
            <FileDown className="ico" aria-hidden="true" />
            <span><b>Цахимаар</b><small>PDF файлаар энд ирнэ</small></span>
          </label>
        </div>
      </fieldset>
      {f.paper && (
        <Field id="rq-copies" label="Хэдэн хувь" error={errors['rq-copies']}>
          <input {...fieldAria('rq-copies', errors['rq-copies'])} type="number" inputMode="numeric" min={1} max={10} value={f.copies} onChange={set('copies')} style={{ maxWidth: '10ch' }} />
        </Field>
      )}
      <Field id="rq-need" label="Хэзээ хэрэгтэй" error={errors['rq-need']}>
        <input {...fieldAria('rq-need', errors['rq-need'])} type="date" min={today()} value={f.need} onChange={set('need')} />
      </Field>
      <Field id="rq-note" label="Нэмэлт тайлбар" optional wide>
        <textarea id="rq-note" value={f.note} onChange={set('note')} rows={2} />
      </Field>
    </FormSheet>
  )
}

export function RequestSheet({ id, office }: { id: string; office?: boolean }) {
  return (
    <Sheet kind="drawer" label="Хүсэлт" onClose={close}>
      <RequestBody id={id} office={office} />
    </Sheet>
  )
}

/** Which kind of document a request ends up as */
const kindOf = (what: string): DocKind => (/тодорхойлолт/i.test(what) ? 'certificate' : /гэрээ/i.test(what) ? 'contract' : /тушаал/i.test(what) ? 'order' : 'letter')

function RequestBody({ id, office }: { id: string; office?: boolean }) {
  const s = useApp()
  const sc = scoped(s)
  const r = s.requests.find(x => x.id === id)
  const [act, setAct] = useState<'ready' | 'decline' | null>(null)
  const [text, setText] = useState('Бичиг хэргийн өрөө')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const attach = useRef<HTMLInputElement>(null)
  if (!r) return <p className="dview__note">Хүсэлт олдсонгүй.</p>
  const who = sc.person(r.by)
  const doc = r.doc ? s.docs.find(d => d.id === r.doc) : undefined
  const last = r.steps[r.steps.length - 1]
  const late = isOpen(r) && daysFromToday(r.need) < 0

  const step = (status: DocRequest['status'], note?: string, done?: string) => {
    actions.stepRequest(r.id, status, { note })
    setAct(null)
    if (done) toast(done)
  }
  // The file goes to the person who asked: it shows among their documents
  const send = async (blob: Blob, name: string) => {
    setBusy(true)
    try {
      const file = { id: `f${cid()}`, name, type: blob.type || 'application/pdf', size: blob.size }
      await putFile(file.id, blob)
      const d = actions.addDoc({ name: r.what, kind: kindOf(r.what), company: r.company, file, to: [r.by] })
      actions.stepRequest(r.id, 'done', { doc: d.id })
      toast('Бичиг баримт илгээгдлээ.')
    } catch {
      setError('Файл хадгалж чадсангүй. Дахин оролдоно уу.')
    } finally {
      setBusy(false)
    }
  }
  const attachFile = (e: ChangeEvent<HTMLInputElement>) => {
    const x = e.target.files?.[0]
    e.target.value = ''
    if (!x) return
    if (x.size > MB25) return setError('25 MB хүртэлх файл сонгоно уу.')
    send(x, x.name)
  }
  const confirm = () => {
    if (!text.trim()) return setError(act === 'decline' ? 'Татгалзах шалтгаанаа бичнэ үү.' : 'Ирж авах газраа бичнэ үү.')
    if (act === 'decline') step('declined', text.trim(), 'Хүсэлтээс татгалзлаа.')
    else step('ready', text.trim(), 'Мэдэгдэл илгээгдлээ.')
  }

  return (
    <div className="rq">
      <div className="tp__top"><ReqPill r={r} />{late && <span className="rq__late">Хугацаа хэтэрсэн</span>}</div>
      <h2 className="tp__title">{r.what}</h2>
      {who && (
        <p className="rq__who"><Avatar person={who} size="sm" /><span>{short(who)}, {who.role}</span></p>
      )}

      <ol className="rq__steps">
        {stepsOf(r).concat(r.status === 'declined' ? ['declined'] : []).map(st => {
          const done = r.steps.find(x => x.status === st)
          if (r.status === 'declined' && !done) return null
          return (
            <li key={st} className={done ? 'is-done' : ''}>
              <b>{REQ_STATUS[st]}</b>
              {done && <small>{dateDots(new Date(done.at))}, {hm(new Date(done.at))}{done.note ? `. ${done.note}` : ''}</small>}
            </li>
          )
        })}
      </ol>

      <dl className="meta">
        <div><dt>Юунд ашиглах</dt><dd><span>{r.purpose}</span></dd></div>
        <div><dt>Хаана өгөх</dt><dd><span>{r.where || 'Бичээгүй'}</span></dd></div>
        <div><dt>Хэлбэр</dt><dd><span>{r.paper ? `Цаасаар, ${r.copies} хувь` : 'Цахимаар, PDF'}</span></dd></div>
        <div><dt>Хэзээ хэрэгтэй</dt><dd><span className="tnum">{dateDots(new Date(`${r.need}T00:00`))}, {dueLabel(r.need)}</span></dd></div>
      </dl>
      {r.note && <p className="rq__note">{r.note}</p>}

      {doc && (
        <button type="button" className="rq__doc" onClick={() => open({ kind: 'doc', id: doc.id })}>
          <DocTile kind={doc.kind} />
          <span><b>{doc.name}</b><small>Бичиг баримт нээх</small></span>
        </button>
      )}
      {r.status === 'ready' && !office && <p className="rq__ready">Бэлэн боллоо. Ирж авах газар: {last.note}.</p>}

      {office && isOpen(r) && (
        <section className="rq__office" aria-labelledby="rq-office">
          <h3 id="rq-office">Бичиг хэргийн үйлдэл</h3>
          {act ? (
            <div className="field">
              <label className="field__label" htmlFor="rq-text">{act === 'decline' ? 'Татгалзах шалтгаан' : 'Ирж авах газар'}</label>
              <input id="rq-text" value={text} onChange={e => { setText(e.target.value); setError('') }} autoFocus aria-invalid={error ? true : undefined} aria-describedby={error ? 'rq-error' : undefined} />
              <div className="rq__acts">
                <button type="button" className={`btn ${act === 'decline' ? 'btn--danger' : 'btn--accent'}`} onClick={confirm}>{act === 'decline' ? 'Татгалзах' : 'Мэдэгдэх'}</button>
                <button type="button" className="btn btn--plain" onClick={() => { setAct(null); setError('') }}>Болих</button>
              </div>
            </div>
          ) : (
            <div className="rq__acts">
              {r.status === 'sent' && <button type="button" className="btn btn--accent" onClick={() => step('working', undefined, 'Хүсэлт хүлээн авагдлаа.')}>Хүлээн авах</button>}
              {r.status === 'working' && r.paper && <button type="button" className="btn btn--accent" onClick={() => { setText('Бичиг хэргийн өрөө'); setAct('ready') }}>Бэлэн болгох</button>}
              {r.status === 'working' && !r.paper && (
                <>
                  <button type="button" className="btn btn--accent" disabled={busy} onClick={() => attach.current?.click()}><Paperclip className="ico" />Файл хавсаргаж илгээх</button>
                  <button type="button" className="btn btn--glass" disabled={busy} onClick={async () => send(await requestPdf(r), `${r.what}.pdf`)}><Sparkles className="ico" />Жишээ файлаар илгээх</button>
                  <input ref={attach} type="file" hidden onChange={attachFile} />
                </>
              )}
              {r.status === 'ready' && <button type="button" className="btn btn--accent" onClick={() => step('done', undefined, 'Бичиг баримт олгогдлоо.')}>Олгох</button>}
              <button type="button" className="btn btn--plain" onClick={() => { setText(''); setAct('decline') }}>Татгалзах</button>
            </div>
          )}
          {error && <p className="field__error" id="rq-error" role="alert">{error}</p>}
        </section>
      )}
    </div>
  )
}

/** A new ХХК, which gets its folder in Бичиг хэрэг; or a company's name and folder colour, from the gear on its folder */
export function CompanyForm({ id }: { id?: string }) {
  const s = useApp()
  const old = id ? s.companies.find(x => x.id === id) : undefined
  const others = s.companies.filter(x => x.id !== id)
  const [f, setF] = useState<{ name: string; hue: Hue }>({ name: old?.name ?? '', hue: old?.hue ?? FOLDER_HUES[others.length % FOLDER_HUES.length] })
  const [errors, setErrors] = useState<Errors>({})
  const submit = () => {
    const name = f.name.trim()
    const e: Errors = {}
    if (!name) e['co-name'] = 'Компанийн нэрийг бичнэ үү.'
    else if (others.some(x => x.name.toLocaleLowerCase('mn') === name.toLocaleLowerCase('mn'))) e['co-name'] = 'Ийм нэртэй компани бүртгэлтэй байна. Өөр нэр бичнэ үү.'
    setErrors(e)
    if (Object.keys(e).length) return false
    if (old) {
      actions.updateCompany(old.id, { name, hue: f.hue })
      toast('Хавтас хадгалагдлаа.')
    } else {
      actions.addCompany({ name, hue: f.hue })
      toast('Компани нэмэгдэж, хавтас үүслээ.')
    }
    return true
  }
  return (
    <FormSheet
      title={old ? 'Хавтас засах' : 'Компани нэмэх'}
      sub={old ? 'Компанийн нэр бүх хэсэгт өөрчлөгдөнө.' : 'Компанийн хавтас автоматаар үүснэ.'}
      submit={old ? 'Хадгалах' : 'Нэмэх'}
      onSubmit={submit}
      onClose={close}
      errors={errors}
    >
      <Field id="co-name" label="Компанийн нэр" error={errors['co-name']} wide>
        <input {...fieldAria('co-name', errors['co-name'])} value={f.name} onChange={e => { setF({ ...f, name: e.target.value }); setErrors({}) }} placeholder="Жишээ нь: Говь Майнинг ХХК" data-autofocus />
      </Field>
      <fieldset className="field field--wide">
        <legend className="field__label">Хавтасны өнгө</legend>
        <div className="swatches">
          {FOLDER_HUES.map(h => (
            <label key={h} className="swatch" style={{ background: `linear-gradient(160deg, ${FOLDER_COLORS[h][0]}, ${FOLDER_COLORS[h][1]})` }}>
              <input type="radio" name="co-hue" checked={f.hue === h} onChange={() => setF({ ...f, hue: h })} />
              <span className="sr-only">{HUE_NAME[h]}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </FormSheet>
  )
}

const HUE_NAME: Record<Hue, string> = { blue: 'Цэнхэр', green: 'Ногоон', pink: 'Ягаан', teal: 'Оюу', purple: 'Нил ягаан', orange: 'Улбар шар', indigo: 'Хөх', yellow: 'Шар' }
