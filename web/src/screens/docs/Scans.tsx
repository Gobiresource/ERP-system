// Скан оруулах: the office drops scanned papers here, as many files, a whole folder, or a stack scanned into one file.
// AI cuts a stack into its papers and reads each one (lib/scan.ts): which ХХК's folder and category it goes in, with its
// title, number, date, other side and sum. What AI is sure of shows as one line, to file all at once; the rest open to
// check and fix. The inbox spans the ХХК: a pile of old papers is mixed, and sorting it is the point (docs/decisions.md, 2026-10-30).
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { CircleAlert, Clock3, FileText, FolderInput, FolderOpen, LoaderCircle, Merge, Pencil, RotateCcw, Scissors, Sparkles, Upload, X } from 'lucide-react'
import '../../styles/screens/scans.css'
import type { Doc, ScanFields, ScanItem, State } from '../../lib/types'
import { actions, useApp } from '../../lib/store'
import { open, toast } from '../../lib/ui'
import { usePageEnter } from '../../lib/motion'
import { addFiles, addSamples, aiState, droppedFiles, focusScan, groupsOf, isPdf, mergeBack, partBefore, pump, resume, splitItem, type AiState } from '../../lib/scan'
import { DOC_KIND, DOC_KINDS } from '../../lib/docs'
import { CONTRACT_KIND } from '../../lib/contracts'
import { useFileUrl } from '../../lib/files'
import { fileSize } from '../../lib/draft'
import { dots } from '../../lib/hr'
import { PageHead } from '../../ui/PageHead'
import { Seg } from '../../ui/Seg'
import { Empty } from '../../ui/bits'
import { DocsNav } from '../Docs'

/** A filed document of the same ХХК with the same number: the paper may be in a folder already */
const twinOf = (s: State, f: ScanFields): Doc | undefined => (f.number.trim() ? s.docs.find(d => d.company === f.company && d.paper?.number === f.number.trim()) : undefined)
/** Read with confidence, nothing to check: these can go into their folders together */
const sure = (s: State, it: ScanItem) => it.state === 'read' && it.reading?.confidence === 'high' && !!it.to.title.trim() && !twinOf(s, it.to)
/** AI's turn: in line, being cut or being read */
const working = (it: ScanItem) => it.state === 'waiting' || it.state === 'splitting' || it.state === 'reading'
/** "4–6" */
const span = (pages: number[]) => (pages.length > 1 ? `${pages[0]}–${pages[pages.length - 1]}` : `${pages[0]}`)

type Filter = 'all' | 'check' | 'ready'

export default function Scans() {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  /** null while asking the server */
  const [ai, setAi] = useState<AiState | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  useEffect(() => {
    aiState().then(a => {
      setAi(a)
      resume(a.ready)
      if (a.ready) pump()
    })
  }, [])
  const ready = s.scans.filter(it => sure(s, it))
  const check = s.scans.filter(it => !sure(s, it) && !working(it))
  // The filter shows only with two papers or more
  const view = s.scans.length > 1 ? filter : 'all'
  const shown = view === 'ready' ? ready : view === 'check' ? check : s.scans
  const fileAll = () => {
    const undo = ready.map(it => actions.fileScan(it.id, s.me)?.undo)
    toast(`${undo.length} баримт хавтаслагдлаа.`, { undo: () => undo.reverse().forEach(u => u?.()) })
  }
  const count = (text: string, n: number) => (n ? <>{text}<span className="seg__count">{n}</span></> : text)

  return (
    <div ref={ref}>
      <DocsNav at="scan" />
      <PageHead
        title="Скан оруулах"
        sub="Цаасан баримтаа скан хийж оруулбал AI уншаад аль ХХК-ийн аль хавтсанд орохыг санал болгоно. Та шалгаад хавтаслана."
        stats={s.scans.length || s.aiSpent ? [
          { label: 'Хавтаслах', value: s.scans.length },
          { label: 'AI таньсан', value: s.scans.filter(it => it.state === 'read' && !it.sample).length },
          { label: 'AI зардал', value: `$${s.aiSpent.toFixed(2)}` },
        ] : undefined}
        actions={ready.length > 1 && <button type="button" className="btn btn--accent" onClick={fileAll}><FolderInput className="ico" />Танигдсаныг хавтаслах ({ready.length})</button>}
      />
      <AiBar ai={ai} samples={s.scans.some(it => it.sample)} work={s.scans.filter(working).length} />
      <Drop ready={!!ai?.ready} />
      {s.scans.length > 1 && (
        <div className="rtabs" data-enter>
          <Seg label="Харах" value={filter} onChange={setFilter} options={[
            { value: 'all', label: count('Бүгд', s.scans.length) },
            { value: 'check', label: count('Шалгах', check.length) },
            { value: 'ready', label: count('Бэлэн', ready.length) },
          ]} />
        </div>
      )}
      {shown.length ? (
        <ul className="scards" aria-label="Хавтаслах баримт">
          {shown.map(it => <ScanCard key={it.id} it={it} ai={!!ai?.ready} sure={sure(s, it)} />)}
        </ul>
      ) : (
        <section className="card glass" data-enter>
          {s.scans.length
            ? <Empty icon={<FileText className="ico" />} title={view === 'ready' ? 'Бэлэн баримт алга' : 'Шалгах баримт алга'} text="Бусад баримтыг «Бүгд» хэсгээс харна уу." />
            : <Empty icon={<FileText className="ico" />} title="Хавтаслах баримт алга" text="Скан файлаа дээрх хэсэгт оруулна уу." />}
        </section>
      )}
    </div>
  )
}

/** Whether AI reads the scans, and how many wait; without it, the papers are filled in by hand, and demo papers show the way */
function AiBar({ ai, samples, work }: { ai: AiState | null; samples: boolean; work: number }) {
  const [adding, setAdding] = useState(false)
  if (!ai) return <p className="saibar" role="status"><LoaderCircle className="ico spin" />AI холболтыг шалгаж байна…</p>
  if (ai.ready) {
    return (
      <p className="saibar is-on" role="status">
        {work ? <LoaderCircle className="ico spin" /> : <Sparkles className="ico" />}
        <span><b>AI холбогдсон</b> ({ai.model}). Баримтыг хадгалахгүй, сургалтад ашиглахгүй.{work > 0 && ` Уншиж байна: ${work} баримт үлдлээ.`}</span>
      </p>
    )
  }
  const add = () => {
    setAdding(true)
    addSamples().then(() => setAdding(false), () => setAdding(false))
  }
  return (
    <div className="saibar" role="status">
      <CircleAlert className="ico" />
      <span><b>AI холбогдоогүй байна.</b> Серверт түлхүүр тохируулсны дараа скан автоматаар танигдана. Одоогоор мэдээллийг гараар бөглөнө үү.</span>
      {!samples && <button type="button" className="btn btn--glass btn--sm" disabled={adding} onClick={add}>{adding ? 'Бэлтгэж байна…' : 'Жишээ скан нэмэх'}</button>}
    </div>
  )
}

/** Where scans go in: files or whole folders dropped on it, or picked with the buttons */
function Drop({ ready }: { ready: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const folder = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const take = async (files: File[]) => {
    if (!files.length) return
    setBusy('Нэмж байна…')
    try {
      const n = await addFiles(files, ready, (done, all) => setBusy(`Нэмж байна… ${done + 1}/${all}`))
      toast(n ? `${n} файл нэмэгдлээ.` : 'PDF эсвэл зургийн файл сонгоно уу.', { kind: n ? 'ok' : 'warn' })
    } finally {
      setBusy(null)
    }
  }
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    droppedFiles(e.dataTransfer.items, e.dataTransfer.files).then(take)
  }
  const picked = (e: { target: HTMLInputElement }) => {
    take([...(e.target.files ?? [])])
    e.target.value = ''
  }
  return (
    <div className={`sdrop${over ? ' is-over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={drop} data-enter>
      <Upload className="ico sdrop__ico" />
      <p className="sdrop__text">
        <b className="sdrop__drag">Скан хийсэн файл эсвэл хавтсаа энд чирж оруулна уу</b>
        <b className="sdrop__tap">Скан хийсэн файл эсвэл зургаа сонгоно уу</b>
        <small>PDF, JPG, PNG. Олон файлыг зэрэг, эсвэл олон баримтыг нэг файлд багцаар оруулж болно. AI баримт бүрийг ялгана.</small>
        {busy && <small className="sdrop__busy" role="status">{busy}</small>}
      </p>
      <span className="sdrop__btns">
        <button type="button" className="btn btn--glass" disabled={!!busy} onClick={() => input.current?.click()}>Файл сонгох</button>
        <button type="button" className="btn btn--glass sdrop__folder" disabled={!!busy} onClick={() => folder.current?.click()}><FolderOpen className="ico" />Хавтас сонгох</button>
      </span>
      <input ref={input} type="file" multiple accept="application/pdf,image/*" hidden onChange={picked} />
      <input ref={folder} type="file" multiple hidden {...{ webkitdirectory: '' }} onChange={picked} />
    </div>
  )
}

const CONFIDENCE = { high: 'Танигдсан', medium: 'Шалгах шаардлагатай', low: 'Дутуу танигдсан' } as const

/** Where a scan stands, in a word */
function StateChip({ it }: { it: ScanItem }) {
  const [cls, Icon, text] =
    it.state === 'waiting' ? ['', Clock3, 'Дараалалд'] as const
      : it.state === 'splitting' ? ['is-busy', LoaderCircle, 'Баримтуудыг ялгаж байна…'] as const
        : it.state === 'reading' ? ['is-busy', LoaderCircle, 'AI уншиж байна…'] as const
          : it.state === 'failed' ? ['is-bad', CircleAlert, 'Уншиж чадсангүй'] as const
            : it.state === 'manual' ? ['', FileText, 'Гараар бөглөнө'] as const
              : [`is-${it.reading?.confidence ?? 'low'}`, Sparkles, CONFIDENCE[it.reading?.confidence ?? 'low']] as const
  return <span className={`schip ${cls}`}><Icon className={`ico${it.state === 'reading' || it.state === 'splitting' ? ' spin' : ''}`} />{text}</span>
}

function ScanCard({ it, ai, sure: done }: { it: ScanItem; ai: boolean; sure: boolean }) {
  const s = useApp()
  const url = useFileUrl(it.thumb ?? '')
  const [errors, setErrors] = useState<{ title?: string; amount?: string }>({})
  const [more, setMore] = useState(false)
  const f = it.to
  const busy = working(it)
  const twin = twinOf(s, f)
  const id = (k: string) => `sc-${it.id}-${k}`
  const co = s.companies.find(c => c.id === f.company)?.name
  const set = (patch: Partial<ScanFields>) => {
    actions.setScan(it.id, { to: { ...f, ...patch } })
    if (('title' in patch && errors.title) || ('amount' in patch && errors.amount)) setErrors({})
  }
  const file = () => {
    const e = {
      title: f.title.trim() ? undefined : 'Баримтын нэрийг бичнэ үү.',
      amount: f.amount.trim() && !(Number(f.amount.replace(/[\s,]/g, '')) > 0) ? 'Дүнг тоогоор бичнэ үү.' : undefined,
    }
    if (e.title || e.amount) {
      setErrors(e)
      setMore(true)
      requestAnimationFrame(() => document.getElementById(id(e.title ? 'title' : 'amount'))?.focus())
      return
    }
    const r = actions.fileScan(it.id, s.me)
    if (r) toast(`«${r.doc.name}» ${co}-ийн ${DOC_KIND[f.kind]} хавтсанд орлоо.`, { undo: r.undo })
  }
  const remove = () => toast(`${it.file.name} хасагдлаа.`, { undo: actions.dropScan(it.id) })
  const again = () => {
    actions.setScan(it.id, { state: 'waiting' })
    pump()
  }
  const failed = (e: unknown) => toast(e instanceof Error ? e.message : 'Файлыг өөрчилж чадсангүй.', { kind: 'warn' })
  const applySuggest = () => {
    const g = it.suggest!
    splitItem(it, groupsOf(it.file.pages ?? 1, g.starts, g.blank), ai, g.readings).then(parts => {
      toast(`${parts.length} баримт болгон хуваалаа.`)
      focusScan(parts[0]?.id)
    }, failed)
  }
  const prev = partBefore(s.scans, it)
  const r = it.reading
  const name = (
    <span className="scard__name">
      <b>{done && !more ? f.title : it.file.name}</b>
      <small>
        {done && !more
          ? [`${co} › ${DOC_KIND[f.kind]}`, f.number && `№ ${f.number}`, f.date && dots(f.date), f.party].filter(Boolean).join(' · ')
          : it.from ? `Багц: ${it.from.name}, ${span(it.from.pages)}-р хуудас` : `${it.file.pages ? `${it.file.pages} хуудас, ` : ''}${fileSize(it.file.size)}`}
      </small>
    </span>
  )
  const chips = (
    <>
      {it.sample && <span className="schip is-sample">Жишээ</span>}
      <StateChip it={it} />
      <button type="button" className="ibtn ibtn--sm" aria-label={`${it.file.name} хасах`} title="Хасах" onClick={remove}><X className="ico" /></button>
    </>
  )
  const thumb = (
    <button type="button" className="scard__thumb" aria-label={`${it.file.name} харах`} onClick={() => open({ kind: 'file', file: it.file })}>
      {url ? <img src={url} alt="" /> : <FileText className="ico" />}
    </button>
  )

  // Sure of it: one line, filed with one press or opened to check
  if (done && !more) {
    return (
      <li id={`scan-${it.id}`} className="card glass scard is-short" data-enter>
        {thumb}
        <div className="scard__main">
          <div className="scard__top">{name}{chips}</div>
          <div className="scard__acts">
            <button type="button" className="btn btn--accent btn--sm" onClick={file}><FolderInput className="ico" />Хавтаслах</button>
            <button type="button" className="btn btn--glass btn--sm" onClick={() => setMore(true)}><Pencil className="ico" />Засах</button>
          </div>
        </div>
      </li>
    )
  }
  return (
    <li id={`scan-${it.id}`} className="card glass scard" data-enter>
      {thumb}
      <div className="scard__main">
        <div className="scard__top">{name}{chips}</div>
        {it.suggest && (
          <p className="scard__split">
            <Scissors className="ico" />
            <span><b>Жишээ:</b> AI энэ файлаас {groupsOf(it.file.pages ?? 1, it.suggest.starts, it.suggest.blank).length} баримт ялгаж, {it.suggest.blank.length} хоосон хуудсыг хасна.</span>
            <button type="button" className="btn btn--accent btn--sm" onClick={applySuggest}>Хуваах</button>
          </p>
        )}
        {r && (
          <p className="scard__ai">
            <Sparkles className="ico" />
            <span>
              {it.sample && <b>AI холбогдсоны дараа ингэж бөглөгдөнө. </b>}
              {r.contractType && `${CONTRACT_KIND[r.contractType]}. `}{r.summary}
            </span>
          </p>
        )}
        {r?.notes && <p className="scard__warn"><CircleAlert className="ico" />{r.notes}</p>}
        {it.state === 'failed' && (
          <p className="scard__warn">
            <CircleAlert className="ico" />{it.error}
            {ai && <button type="button" className="btn btn--ghost btn--sm" onClick={again}><RotateCcw className="ico" />Дахин уншуулах</button>}
          </p>
        )}
        <fieldset className="scard__grid" disabled={busy}>
          <legend className="sr-only">{it.file.name}: хаана, юу болж хавтаслах</legend>
          <div className="field">
            <label className="field__label" htmlFor={id('company')}>ХХК</label>
            <select id={id('company')} value={f.company} onChange={e => set({ company: e.target.value })}>
              {s.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor={id('kind')}>Хавтас</label>
            <select id={id('kind')} value={f.kind} onChange={e => set({ kind: e.target.value as ScanFields['kind'] })}>
              {DOC_KINDS.map(k => <option key={k} value={k}>{DOC_KIND[k]}</option>)}
            </select>
          </div>
          <div className="field field--wide">
            <label className="field__label" htmlFor={id('title')}>Баримтын нэр</label>
            <input id={id('title')} aria-invalid={errors.title ? true : undefined} aria-describedby={errors.title ? id('title-error') : undefined} value={f.title} onChange={e => set({ title: e.target.value })} />
            {errors.title && <span className="field__error" id={id('title-error')}>{errors.title}</span>}
          </div>
          <div className="field">
            <label className="field__label" htmlFor={id('number')}>Дугаар (заавал биш)</label>
            <input id={id('number')} value={f.number} onChange={e => set({ number: e.target.value })} spellCheck={false} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor={id('date')}>Огноо (заавал биш)</label>
            <input id={id('date')} type="date" value={f.date} onChange={e => set({ date: e.target.value })} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor={id('party')}>Харилцагч (заавал биш)</label>
            <input id={id('party')} value={f.party} onChange={e => set({ party: e.target.value })} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor={id('amount')}>Дүн, ₮ (заавал биш)</label>
            <input id={id('amount')} inputMode="numeric" aria-invalid={errors.amount ? true : undefined} aria-describedby={errors.amount ? id('amount-error') : undefined} value={f.amount} onChange={e => set({ amount: e.target.value })} />
            {errors.amount && <span className="field__error" id={id('amount-error')}>{errors.amount}</span>}
          </div>
        </fieldset>
        {twin && <p className="scard__warn"><CircleAlert className="ico" />Энэ дугаартай баримт хавтсанд бүртгэлтэй байна: «{twin.name}». Давхардлыг шалгана уу.</p>}
        <div className="scard__acts">
          <button type="button" className="btn btn--accent" disabled={busy} title={busy ? 'AI уншиж дуусахыг хүлээнэ үү' : undefined} onClick={file}><FolderInput className="ico" />Хавтаслах</button>
          {it.state === 'manual' && ai && <button type="button" className="btn btn--glass" onClick={again}><Sparkles className="ico" />AI-аар уншуулах</button>}
          {!busy && (it.file.pages ?? 1) > 1 && isPdf(it.file) && (
            <button type="button" className="btn btn--glass" onClick={() => open({ kind: 'scanSplit', id: it.id, ai })}><Scissors className="ico" />Хуудас хуваах</button>
          )}
          {!busy && prev && !working(prev) && (
            <button type="button" className="btn btn--glass" onClick={() => mergeBack(it, ai).then(id => {
              toast('Өмнөх хэсэгтэй нь нийлүүллээ.')
              focusScan(id)
            }, failed)}><Merge className="ico" />Өмнөхтэй нийлүүлэх</button>
          )}
          {done && <button type="button" className="btn btn--ghost" onClick={() => setMore(false)}>Хураах</button>}
          {it.model && <small className="scard__cost">{it.model}{it.cost !== undefined ? `, $${it.cost.toFixed(4)}` : ''}</small>}
        </div>
      </div>
    </li>
  )
}
