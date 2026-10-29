// Pieces of Бичиг хэрэг used on more than one page: the search field, my requests' progress, a document as a row.
import { ChevronRight, Download, Search } from 'lucide-react'
import type { Doc } from '../../lib/types'
import { useApp } from '../../lib/store'
import { open } from '../../lib/ui'
import { DOC_KIND, isOpen } from '../../lib/docs'
import { downloadDoc } from '../../lib/paper'
import { dateDots, dueLabel } from '../../lib/format'
import { DocTile, ReqPill, Steps } from '../Docs'

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
