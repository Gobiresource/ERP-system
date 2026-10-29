// Бичиг хэрэг, first page: the documents shared with me, the company's rules and decisions, the forms and templates the office puts up,
// and how my requests to the office are going.
import { useMemo, useRef, useState } from 'react'
import { ChevronRight, Download, FilePlus2, Search, Send } from 'lucide-react'
import type { Doc } from '../../lib/types'
import { useApp } from '../../lib/store'
import { open } from '../../lib/ui'
import { usePageEnter } from '../../lib/motion'
import { DOC_KIND, isOpen, seen } from '../../lib/docs'
import { downloadDoc } from '../../lib/paper'
import { dateDots, dueLabel } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Empty } from '../../ui/bits'
import { DocTile, DocsNav, ReqPill, Steps } from '../Docs'

const lower = (s: string) => s.toLocaleLowerCase('mn')

export default function Papers() {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const t = lower(q.trim())
    const mine = s.docs.filter(d => d.company === s.company && seen(d, s.me) && (!t || lower(d.name).includes(t)))
    const blank = (d: Doc) => d.kind === 'form' || d.kind === 'template'
    return {
      personal: mine.filter(d => d.to !== 'all'),
      company: mine.filter(d => d.to === 'all' && !blank(d)),
      forms: mine.filter(d => d.to === 'all' && blank(d)),
    }
  }, [s.docs, s.company, s.me, q])
  const none = !groups.personal.length && !groups.company.length && !groups.forms.length

  return (
    <div ref={ref}>
      <DocsNav at="" />
      <PageHead
        title="Бичиг хэрэг"
        sub="Танд хамаарах бичиг баримт, журам, маягт. Хэрэгтэй бичиг баримтаа бичиг хэргээс хүсэж болно."
        actions={
          <>
            <button type="button" className="btn btn--glass" onClick={() => open({ kind: 'docAdd' })}><FilePlus2 className="ico" />Бичиг баримт нэмэх</button>
            <button type="button" className="btn btn--accent" onClick={() => open({ kind: 'docRequest' })}><Send className="ico" />Бичиг баримт хүсэх</button>
          </>
        }
      />
      <DocSearch q={q} setQ={setQ} />

      <div className="docs-grid">
        <div className="docs-main">
          {none && q ? (
            <section className="card glass" data-enter>
              <Empty icon={<Search className="ico" />} title="Илэрц алга" text="Өөр үгээр хайж үзнэ үү." />
            </section>
          ) : (
            <>
              <Group id="dg-mine" title="Танд хамаарах" sub="Хүний нөөц, бичиг хэргээс зөвхөн танд зориулсан бичиг баримт." docs={groups.personal} fresh empty="Танд хамаарах бичиг баримт алга" />
              <Group id="dg-rules" title="Журам, шийдвэр" sub="Компанийн бүх ажилтанд зориулсан." docs={groups.company} empty="Журам, шийдвэр алга" />
            </>
          )}
        </div>
        <aside className="docs-side">
          <RequestsCard />
          {(!q || groups.forms.length > 0) && (
            <Group id="dg-forms" title="Маягт, загвар" sub="Бичиг хэргээс оруулсан маягт, бичиг баримт боловсруулахад ашиглах загвар." docs={groups.forms} empty="Маягт, загвар алга" />
          )}
        </aside>
      </div>
    </div>
  )
}

function Group({ id, title, sub, docs, fresh, empty }: { id: string; title: string; sub: string; docs: Doc[]; fresh?: boolean; empty: string }) {
  return (
    <section className="card glass dgroup" aria-labelledby={id} data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id={id}>{title}</h2>
          <p className="card__sub">{sub}</p>
        </div>
      </div>
      {docs.length ? (
        <ul className="dlist">{docs.map(d => <DocRow key={d.id} d={d} fresh={fresh} />)}</ul>
      ) : (
        <p className="dlist__none">{empty}</p>
      )}
    </section>
  )
}

/** A week counts as new */
export const isNew = (d: Doc) => Date.now() - new Date(d.added).getTime() < 7 * 864e5

export function DocSearch({ q, setQ }: { q: string; setQ: (q: string) => void }) {
  return (
    <label className="tk-find dsearch" data-enter>
      <Search className="ico" />
      <span className="sr-only">Бичиг баримтын нэрээр хайх</span>
      <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Бичиг баримтын нэрээр хайх" />
    </label>
  )
}

/** My open requests to the office, step by step */
export function RequestsCard() {
  const s = useApp()
  const requests = s.requests.filter(r => r.company === s.company && r.by === s.me && isOpen(r))
  if (!requests.length) return null
  return (
    <section className="card glass docs-req" aria-labelledby="docs-req" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="docs-req">Хүсэлтийн явц</h2>
          <p className="card__sub">Бичиг хэрэгт илгээсэн хүсэлт</p>
        </div>
        <a className="btn btn--ghost btn--sm" href="#docs-requests">Бүгдийг харах<ChevronRight className="ico" /></a>
      </div>
      <ul className="rmini">
        {requests.map(r => {
          const note = r.status === 'ready' ? r.steps[r.steps.length - 1].note : undefined
          return (
            <li key={r.id}>
              <button type="button" className="rmini__row" onClick={() => open({ kind: 'request', id: r.id })}>
                <span className="rmini__top"><b>{r.what}</b><ReqPill r={r} /></span>
                <Steps r={r} />
                <small>{note ? `Ирж авах газар: ${note}` : `${r.purpose}. Хэзээ хэрэгтэй: ${dueLabel(r.need)}`}</small>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function DocRow({ d, fresh }: { d: Doc; fresh?: boolean }) {
  return (
    <li className="drow">
      <button type="button" className="drow__open" onClick={() => open({ kind: 'doc', id: d.id })}>
        <DocTile kind={d.kind} />
        <span className="drow__text">
          <b>{d.name}</b>
          <small>{DOC_KIND[d.kind]}, {dateDots(new Date(d.added))}</small>
        </span>
        {fresh && isNew(d) && <span className="drow__new">Шинэ</span>}
      </button>
      <button type="button" className="ibtn ibtn--sm" aria-label={`${d.name} татах`} title="Татах" onClick={() => downloadDoc(d)}><Download className="ico" /></button>
    </li>
  )
}
