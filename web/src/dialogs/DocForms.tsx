// Бичиг хэрэг windows: look at a document, add one (HR and the office), ask the office for one, and one request with what
// the office does with it.
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Download, FileDown, Paperclip, Printer, Sparkles } from 'lucide-react'
import '../styles/screens/docs.css'
import type { BoardFile, Doc, DocKind, DocRequest } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { close, open, toast } from '../lib/ui'
import { DOC_KIND, DOC_KINDS, PURPOSES, REQ_STATUS, WHAT, isOpen, stepsOf } from '../lib/docs'
import { docBlob, requestPdf } from '../lib/paper'
import { drawPage, viewPdf } from '../lib/pdf'
import { putFile, saveBlob } from '../lib/files'
import { cid } from '../lib/draft'
import { addDaysYmd, dateDots, daysFromToday, dueLabel, hm, short, today } from '../lib/format'
import { Sheet } from '../ui/Sheet'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'
import { Avatar } from '../ui/bits'
import { DocTile, ReqPill } from '../screens/Docs'

const MB25 = 25 * 1024 * 1024

export function DocSheet({ id }: { id: string }) {
  const d = useApp().docs.find(x => x.id === id)
  return (
    <Sheet label={d?.name ?? 'Бичиг баримт'} onClose={close} wide>
      {d ? <Viewer d={d} /> : <p className="dview__note">Баримт олдсонгүй.</p>}
    </Sheet>
  )
}

/** The document's pages as pictures; a file that cannot be shown here can still be saved */
function Viewer({ d }: { d: Doc }) {
  const s = useApp()
  const by = s.people.find(p => p.id === d.by)
  const [pages, setPages] = useState<string[] | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const urls: string[] = []
    const show = (list: string[]) => live && setPages([...list])
    ;(async () => {
      try {
        const blob = await docBlob(d)
        if (!blob) return live && setNote('Файл олдсонгүй. Өөр төхөөрөмж эсвэл хөтөч дээр нэмсэн байж магадгүй.')
        if (blob.type.startsWith('image/')) {
          urls.push(URL.createObjectURL(blob))
          return show(urls)
        }
        if (blob.type !== 'application/pdf' && !/\.pdf$/i.test(d.file?.name ?? '')) return live && setNote('Энэ файлыг энд харах боломжгүй. Татаж аваад нээнэ үү.')
        const view = await viewPdf(blob)
        for (let i = 0; i < Math.min(view.numPages, 30) && live; i++) {
          const canvas = await drawPage({ view }, i, 1400)
          const b = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9))
          if (b) urls.push(URL.createObjectURL(b))
          show(urls)
        }
        view.loadingTask.destroy()
      } catch {
        if (live) setNote('Файлыг нээж чадсангүй.')
      }
    })()
    return () => {
      live = false
      urls.forEach(u => URL.revokeObjectURL(u))
    }
    // Drawing a demo document gives it a file; that must not start it again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.id])

  const download = async () => {
    const blob = await docBlob(d)
    if (blob) saveBlob(d.file?.name ?? `${d.name}.pdf`, blob)
  }

  return (
    <div className="dview">
      <header className="dview__head">
        <DocTile kind={d.kind} />
        <div>
          <h2 className="sheet__title">{d.name}</h2>
          <p className="muted">{DOC_KIND[d.kind]}, {dateDots(new Date(d.added))}{by ? `, ${short(by)}` : ''}</p>
        </div>
      </header>
      {note ? <p className="dview__note">{note}</p> : (
        <div className="dview__pages">
          {pages?.length ? pages.map((u, i) => <img key={u} src={u} alt={`${i + 1}-р хуудас`} />) : <span className="dview__wait" role="status">Нээж байна…</span>}
        </div>
      )}
      <div className="dview__actions">
        <button type="button" className="btn btn--accent" onClick={download}><Download className="ico" />Татах</button>
      </div>
    </div>
  )
}

/** HR and the office add a document and say who sees it */
export function DocAdd() {
  const s = useApp()
  const sc = scoped(s)
  const [f, setF] = useState({ name: '', kind: 'form' as DocKind, all: true, people: [] as string[] })
  const [file, setFile] = useState<BoardFile | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const drop = (k: string) => setErrors(({ [k]: _, ...rest }) => rest)

  // The file is kept as soon as it is chosen, so saving the form never waits
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const x = e.target.files?.[0]
    drop('da-file')
    if (!x) return
    if (x.size > MB25) return setErrors(v => ({ ...v, 'da-file': 'Файл 25 MB-аас бага байх ёстой.' }))
    setSaving(true)
    const ref = { id: `f${cid()}`, name: x.name, type: x.type, size: x.size }
    try {
      await putFile(ref.id, x)
      setFile(ref)
      setF(v => ({ ...v, name: v.name || x.name.replace(/\.[^.]+$/, '') }))
    } catch {
      setErrors(v => ({ ...v, 'da-file': 'Энэ хөтөч файл хадгалах боломжгүй байна.' }))
    } finally {
      setSaving(false)
    }
  }
  const submit = () => {
    const e: Errors = {}
    if (!file) e['da-file'] = saving ? 'Файл хадгалагдаж дуусахыг хүлээнэ үү.' : 'Файлаа сонгоно уу.'
    if (!f.name.trim()) e['da-name'] = 'Баримтын нэрийг бичнэ үү.'
    if (!f.all && !f.people.length) e['da-to'] = 'Хэнд харагдахыг сонгоно уу.'
    setErrors(e)
    if (Object.keys(e).length) return false
    actions.addDoc({ name: f.name.trim(), kind: f.kind, file: file!, to: f.all ? 'all' : f.people })
    toast('Баримт нэмэгдлээ.')
    return true
  }
  const toggle = (id: string) => {
    setF(v => ({ ...v, people: v.people.includes(id) ? v.people.filter(x => x !== id) : [...v.people, id] }))
    drop('da-to')
  }

  return (
    <FormSheet title="Баримт нэмэх" sub="Хүний нөөц, бичиг хэргийн ажилтан нэмнэ. Сонгосон хүмүүст харагдана." submit="Нэмэх" onSubmit={submit} onClose={close} errors={errors} wide>
      <Field id="da-file" label="Файл" hint="PDF, зураг эсвэл Word, 25 MB хүртэл" error={errors['da-file']} wide>
        <span className="dfilepick">
          <input type="file" {...fieldAria('da-file', errors['da-file'], true)} onChange={pick} />
          <span className="btn btn--glass btn--sm" aria-hidden="true"><Paperclip className="ico" />Файл сонгох</span>
          <span className="dfilepick__name">{saving ? 'Хадгалж байна…' : file?.name ?? 'Файл сонгоогүй'}</span>
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
          <label className="choice"><input type="radio" name="da-to" id="da-to" checked={!f.all} onChange={() => setF({ ...f, all: false })} /><span><b>Сонгосон хүмүүс</b><small>Гэрээ, тушаал, тодорхойлолт</small></span></label>
        </div>
        {!f.all && (
          <ul className="dpeople">
            {sc.people.map(p => (
              <li key={p.id}>
                <label>
                  <input type="checkbox" className="check" checked={f.people.includes(p.id)} onChange={() => toggle(p.id)} />
                  <Avatar person={p} size="sm" />
                  <span><b>{short(p)}</b><small>{p.role}</small></span>
                </label>
              </li>
            ))}
          </ul>
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
    if (f.what === OTHER && !f.other.trim()) e['rq-other'] = 'Баримтын нэрийг бичнэ үү.'
    if (!f.purpose.trim()) e['rq-purpose'] = 'Юунд ашиглахаа бичнэ үү.'
    if (f.paper && !(Number.isInteger(copies) && copies >= 1 && copies <= 10)) e['rq-copies'] = 'Хувийн тоо 1-ээс 10-ын хооронд байх ёстой.'
    if (!f.need || daysFromToday(f.need) < 0) e['rq-need'] = 'Огноо өнөөдөр эсвэл түүнээс хойш байх ёстой.'
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
    <FormSheet title="Бичиг баримт хүсэх" sub="Бичиг хэргийн ажилтан бэлтгээд танд мэдэгдэнэ." submit="Хүсэлт илгээх" onSubmit={submit} onClose={close} errors={errors} wide>
      <Field id="rq-what" label="Ямар баримт">
        <select id="rq-what" value={f.what} onChange={e => { set('what')(e); drop('rq-other') }} data-autofocus>
          {[...WHAT, OTHER].map(w => <option key={w}>{w}</option>)}
        </select>
      </Field>
      {f.what === OTHER ? (
        <Field id="rq-other" label="Баримтын нэр" error={errors['rq-other']}>
          <input {...fieldAria('rq-other', errors['rq-other'])} value={f.other} onChange={set('other')} />
        </Field>
      ) : <span aria-hidden="true" />}
      <Field id="rq-purpose" label="Юунд ашиглах" hint="Жишээ нь: банкны зээл, виз мэдүүлэг" error={errors['rq-purpose']}>
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
      const d = actions.addDoc({ name: r.what, kind: kindOf(r.what), file, to: [r.by] })
      actions.stepRequest(r.id, 'done', { doc: d.id })
      toast('Баримт илгээгдлээ.')
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
    if (x.size > MB25) return setError('Файл 25 MB-аас бага байх ёстой.')
    send(x, x.name)
  }
  const confirm = () => {
    if (!text.trim()) return setError(act === 'decline' ? 'Татгалзах шалтгаанаа бичнэ үү.' : 'Ирж авах газраа бичнэ үү.')
    if (act === 'decline') step('declined', text.trim(), 'Хүсэлтээс татгалзлаа.')
    else step('ready', text.trim(), 'Ажилтанд мэдэгдлээ.')
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
          <span><b>{doc.name}</b><small>Илгээсэн баримтыг нээх</small></span>
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
                <button type="button" className={`btn ${act === 'decline' ? 'btn--danger' : 'btn--accent'}`} onClick={confirm}>{act === 'decline' ? 'Татгалзах' : 'Бэлэн гэж мэдэгдэх'}</button>
                <button type="button" className="btn btn--plain" onClick={() => { setAct(null); setError('') }}>Болих</button>
              </div>
            </div>
          ) : (
            <div className="rq__acts">
              {r.status === 'sent' && <button type="button" className="btn btn--accent" onClick={() => step('working', undefined, 'Хүсэлтийг бэлтгэж эхэллээ.')}>Бэлтгэж эхлэх</button>}
              {r.status === 'working' && r.paper && <button type="button" className="btn btn--accent" onClick={() => { setText('Бичиг хэргийн өрөө'); setAct('ready') }}>Бэлэн боллоо</button>}
              {r.status === 'working' && !r.paper && (
                <>
                  <button type="button" className="btn btn--accent" disabled={busy} onClick={() => attach.current?.click()}><Paperclip className="ico" />Файл хавсаргаж илгээх</button>
                  <button type="button" className="btn btn--glass" disabled={busy} onClick={async () => send(await requestPdf(r), `${r.what}.pdf`)}><Sparkles className="ico" />Жишээ файлаар илгээх</button>
                  <input ref={attach} type="file" hidden onChange={attachFile} />
                </>
              )}
              {r.status === 'ready' && <button type="button" className="btn btn--accent" onClick={() => step('done', undefined, 'Баримт олгогдлоо.')}>Олгосон</button>}
              <button type="button" className="btn btn--plain" onClick={() => { setText(''); setAct('decline') }}>Татгалзах</button>
            </div>
          )}
          {error && <p className="field__error" id="rq-error" role="alert">{error}</p>}
        </section>
      )}
    </div>
  )
}
