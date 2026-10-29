// Бичиг хэрэг, first page as folders: the office's folders with the newest papers peeking out of them, how my requests
// are going, and a search across every document I can see (docs/decisions.md, 2026-10-29; the look: learned.md §18).
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { FolderPlus, Plus, Search, Send } from 'lucide-react'
import type { Doc, Folder } from '../../lib/types'
import { useApp } from '../../lib/store'
import { open } from '../../lib/ui'
import { usePageEnter } from '../../lib/motion'
import { DOC_KIND, seen } from '../../lib/docs'
import { dateDots } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Empty } from '../../ui/bits'
import { DocsNav } from '../Docs'
import { DocRow, DocSearch, RequestsCard, isNew } from './Papers'

export type Look = 'art' | 'calm'

const lower = (s: string) => s.toLocaleLowerCase('mn')

export default function Folders({ look }: { look: Look }) {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const [q, setQ] = useState('')
  const folders = s.folders.filter(f => f.company === s.company)
  const mine = useMemo(
    () => s.docs.filter(d => d.company === s.company && seen(d, s.me)).sort((a, b) => b.added.localeCompare(a.added)),
    [s.docs, s.company, s.me],
  )
  const t = lower(q.trim())
  const found = t ? mine.filter(d => lower(d.name).includes(t)) : []

  return (
    <div ref={ref}>
      <DocsNav at="" />
      <PageHead
        title="Бичиг хэрэг"
        sub="Бичиг хэргийн хавтаснууд: танд хамаарах бичиг баримт, журам, маягт. Хэрэгтэй бичиг баримтаа бичиг хэргээс хүсэж болно."
        actions={
          <>
            <button type="button" className="btn btn--glass" onClick={() => open({ kind: 'folder' })}><FolderPlus className="ico" />Шинэ хавтас</button>
            <button type="button" className="btn btn--accent" onClick={() => open({ kind: 'docRequest' })}><Send className="ico" />Бичиг баримт хүсэх</button>
          </>
        }
      />
      <DocSearch q={q} setQ={setQ} />

      <div className="docs-grid">
        <div className="docs-main">
          {t ? (
            <section className="card glass dgroup" aria-labelledby="dg-found" data-enter>
              <div className="card__head">
                <div>
                  <h2 className="card__title" id="dg-found">Илэрц</h2>
                  <p className="card__sub">Бүх хавтаснаас</p>
                </div>
              </div>
              {found.length ? (
                <ul className="dlist">{found.map(d => <DocRow key={d.id} d={d} fresh />)}</ul>
              ) : (
                <Empty icon={<Search className="ico" />} title="Илэрц алга" text="Өөр үгээр хайж үзнэ үү." />
              )}
            </section>
          ) : folders.length ? (
            <ul className={`folders folders--${look}`} aria-label="Хавтас" data-enter>
              {folders.map(f => <FolderCard key={f.id} f={f} docs={mine.filter(d => d.folder === f.id)} />)}
            </ul>
          ) : (
            <section className="card glass" data-enter>
              <Empty icon={<FolderPlus className="ico" />} title="Хавтас алга" text="Бичиг хэргийн ажилтан хавтас үүсгэж, бичиг баримтаа ангилна." />
            </section>
          )}
        </div>
        <aside className="docs-side">
          <RequestsCard />
        </aside>
      </div>
      <FolderShapes />
    </div>
  )
}

/** A number from a folder's id, so each folder's picture differs a little but stays the same */
function seed(id: string) {
  let h = 7
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return h
}

/**
 * A folder: its back with a tab, the three newest papers peeking out, and a frosted front with its own tab. Pointing at
 * it (or focusing it) tips the front forward and fans the papers. The whole folder opens it; "+" adds a document.
 */
function FolderCard({ f, docs }: { f: Folder; docs: Doc[] }) {
  const fresh = docs.some(isNew)
  const count = docs.length ? `${docs.length} бичиг баримт` : 'Хоосон'
  const h = seed(f.id)
  const art = { '--fang': `${100 + (h % 50)}deg`, '--fx': `${15 + (h % 50)}%`, '--fy': `${10 + ((h >> 3) % 40)}%` } as CSSProperties
  return (
    <li className={`folder hue--${f.hue}`} style={art}>
      <span className="folder__back" aria-hidden="true" />
      <span className="folder__papers" aria-hidden="true">
        {docs.slice(0, 3).map(d => (
          <span key={d.id} className="fpaper">
            <b>{d.name}</b>
            <small>{DOC_KIND[d.kind]}, {dateDots(new Date(d.added))}</small>
            <i /><i /><i />
          </span>
        ))}
      </span>
      <span className="folder__front" aria-hidden="true">
        {fresh && <span className="drow__new">Шинэ</span>}
        <b className="folder__name">{f.name}</b>
        <small className="folder__count">{count}</small>
      </span>
      <a className="folder__open" href={`#docs-folder-${f.id}`}>
        <span className="sr-only">{f.name}, {count}{fresh ? ', шинэ бичиг баримттай' : ''}</span>
      </a>
      <button type="button" className="folder__add" aria-label={`${f.name}: бичиг баримт нэмэх`} title="Бичиг баримт нэмэх" onClick={() => open({ kind: 'docAdd', folder: f.id })}>
        <Plus className="ico" />
      </button>
    </li>
  )
}

/**
 * The outlines of a folder's back (tab at the top left) and front (tab at the top right), in fractions of each part's
 * box. They fit the folder's 5:4 shape; the front covers its lower 73%.
 */
export function FolderShapes() {
  return (
    <svg className="folder-shapes" width="0" height="0" aria-hidden="true" focusable="false">
      <clipPath id="fd-back" clipPathUnits="objectBoundingBox">
        <path d="M0 .056Q0 0 .045 0L.4 0C.45 0 .46 .11 .52 .11L.955 .11Q1 .11 1 .166L1 .944Q1 1 .955 1L.045 1Q0 1 0 .944Z" />
      </clipPath>
      <clipPath id="fd-front" clipPathUnits="objectBoundingBox">
        <path d="M0 .241Q0 .164 .045 .164L.48 .164C.54 .164 .55 0 .61 0L.955 0Q1 0 1 .077L1 .923Q1 1 .955 1L.045 1Q0 1 0 .923Z" />
      </clipPath>
    </svg>
  )
}
