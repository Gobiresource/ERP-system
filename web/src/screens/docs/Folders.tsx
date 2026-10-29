// Бичиг хэрэг, first page: the office's folders, documents by kind, how my requests are going, and a search across every
// document I can see (docs/decisions.md, 2026-10-29). The folder is the user's own glass folder from their earlier HR
// system (glass-folder.zip, learned.md §18), redrawn here without Tailwind.
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { Bell, FolderPlus, Search, Send, Settings } from 'lucide-react'
import type { DocKind, Folder, Hue } from '../../lib/types'
import { useApp } from '../../lib/store'
import { open } from '../../lib/ui'
import { usePageEnter } from '../../lib/motion'
import { DOC_KIND, DOC_KINDS, FOLDER_COLORS, seen } from '../../lib/docs'
import { PageHead } from '../../ui/PageHead'
import { Empty } from '../../ui/bits'
import { DocsNav, KIND_ICON } from '../Docs'
import { DocRow, DocSearch, RequestsCard, isNew } from './Parts'

const lower = (s: string) => s.toLocaleLowerCase('mn')

export default function Folders() {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<DocKind | null>(null)
  const folders = s.folders.filter(f => f.company === s.company)
  const mine = useMemo(
    () => s.docs.filter(d => d.company === s.company && seen(d, s.me)).sort((a, b) => b.added.localeCompare(a.added)),
    [s.docs, s.company, s.me],
  )
  const kinds = DOC_KINDS.map(k => [k, mine.filter(d => d.kind === k).length] as const).filter(([, n]) => n > 0)
  const t = lower(q.trim())
  const found = mine.filter(d => (!t || lower(d.name).includes(t)) && (!kind || d.kind === kind))

  return (
    <div ref={ref}>
      <DocsNav at="" />
      <PageHead
        title="Бичиг хэрэг"
        sub="Бичиг хэргийн хавтас: танд хамаарах бичиг баримт, журам, маягт. Хэрэгтэй бичиг баримтаа бичиг хэргээс хүсэж болно."
        actions={<button type="button" className="btn btn--accent" onClick={() => open({ kind: 'docRequest' })}><Send className="ico" />Бичиг баримт хүсэх</button>}
      />
      <DocSearch q={q} setQ={setQ} />
      {/* Documents by kind, from every folder: a filter, so it sits above what it filters */}
      {kinds.length > 0 && (
        <div className="dkinds" role="group" aria-label="Төрөл" data-enter>
          {kinds.map(([k, n]) => {
            const Icon = KIND_ICON[k]
            return (
              <button key={k} type="button" className="kchip" aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}>
                <Icon className="ico" />{DOC_KIND[k]}<span className="kchip__n tnum">{n}</span>
              </button>
            )
          })}
        </div>
      )}

      {t || kind ? (
        <section className="card glass dgroup" aria-labelledby="dg-found" data-enter>
          <div className="card__head">
            <div>
              <h2 className="card__title" id="dg-found">{kind && !t ? DOC_KIND[kind] : 'Илэрц'}</h2>
              <p className="card__sub">Бүх хавтаснаас</p>
            </div>
          </div>
          {found.length ? (
            <ul className="dlist">{found.map(d => <DocRow key={d.id} d={d} fresh />)}</ul>
          ) : (
            <Empty icon={<Search className="ico" />} title="Илэрц алга" text="Өөр үгээр хайж үзнэ үү." />
          )}
        </section>
      ) : (
        <ul className="folders" aria-label="Хавтас" data-enter>
          {folders.map(f => {
            const docs = mine.filter(d => d.folder === f.id)
            return <FolderCard key={f.id} f={f} count={docs.length} fresh={docs.filter(isNew).length} />
          })}
          <li>
            <button type="button" className="folder-add" onClick={() => open({ kind: 'folder' })}>
              <span className="folder-add__plus" aria-hidden="true"><FolderPlus className="ico" /></span>
              <b>Хавтас үүсгэх</b>
              <small>Бичиг баримтаа ангилж хадгална</small>
            </button>
          </li>
        </ul>
      )}
      <RequestsCard />
    </div>
  )
}

/** A folder: the picture, its name and count in white on the glass, a red mark for new documents, a gear to edit it */
function FolderCard({ f, count, fresh }: { f: Folder; count: number; fresh: number }) {
  const meta = count ? `${count} бичиг баримт` : 'Хоосон'
  return (
    <li className="folder" style={{ '--to': FOLDER_COLORS[f.hue][1] } as CSSProperties}>
      <span className="folder__card">
        <FolderArt id={`fa-${f.id}`} hue={f.hue} />
        {fresh > 0 && <span className="fchip" aria-hidden="true"><Bell className="ico" />{fresh}</span>}
        <span className="folder__label" aria-hidden="true">
          <b className="folder__name">{f.name}</b>
          <small className="folder__meta">{meta}</small>
        </span>
      </span>
      <a className="folder__open" href={`#docs-folder-${f.id}`}>
        <span className="sr-only">{f.name}, {meta}{fresh ? `, ${fresh} нь шинэ` : ''}</span>
      </a>
      <button type="button" className="folder__edit" aria-label={`${f.name}: хавтас засах`} title="Хавтас засах" onClick={() => open({ kind: 'folder', id: f.id })}>
        <Settings className="ico" />
      </button>
    </li>
  )
}

// The glass front: a tab at its top left (viewBox 400×376)
const FRONT = 'M0 176Q0 146 30 146H140C154 146 162 150 170 158L188 176C196 184 204 188 218 188H380Q400 188 400 208V376H0Z'

/** Three papers peeking out; each lifts a little more when the folder is pointed at */
function Papers({ id }: { id: string }) {
  const shadow = `url(#${id}-ps)`
  return (
    <>
      <g className="fsheet fsheet--1">
        <g transform="rotate(9 272 160)" filter={shadow}>
          <rect x="200" y="62" width="146" height="196" rx="16" fill="#eceef3" />
          <rect x="222" y="86" width="82" height="11" rx="5.5" fill="#dcdfe6" />
        </g>
      </g>
      <g className="fsheet fsheet--2">
        <g transform="rotate(2 212 150)" filter={shadow}>
          <rect x="130" y="42" width="164" height="214" rx="17" fill="#f6f7f9" />
          <rect x="152" y="66" width="104" height="12" rx="6" fill="#e1e4e9" />
          <rect x="152" y="88" width="70" height="10" rx="5" fill="#eceef2" />
        </g>
      </g>
      <g className="fsheet fsheet--3">
        <g transform="rotate(-11 150 178)" filter={shadow}>
          <rect x="66" y="74" width="168" height="208" rx="18" fill="#ffffff" />
          <rect x="90" y="100" width="116" height="16" rx="8" fill="#d8dbe2" />
          <rect x="90" y="128" width="120" height="66" rx="10" fill="#eff1f4" />
        </g>
      </g>
    </>
  )
}

/**
 * The folder picture: a coloured back, the papers, and a glass front. The glass is a blurred copy of everything behind
 * it, cut to the front's shape, under a white veil. `id` must differ for each folder on a page (the SVG's ids).
 */
export function FolderArt({ id, hue }: { id: string; hue: Hue }) {
  const [from, to, deep] = FOLDER_COLORS[hue]
  return (
    <svg className="folder__art" viewBox="0 0 400 376" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".6" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".28" />
          <stop offset="1" stopColor="#fff" stopOpacity=".1" />
        </linearGradient>
        {/* The glass deepens into the folder's colour under the name, so white text reads on every colour */}
        <linearGradient id={`${id}-shade`} x1="0" y1="146" x2="0" y2="376" gradientUnits="userSpaceOnUse">
          <stop offset=".08" stopColor={deep} stopOpacity="0" />
          <stop offset=".34" stopColor={deep} stopOpacity=".9" />
          <stop offset="1" stopColor={deep} stopOpacity=".94" />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx=".2" cy="0" r="1"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <clipPath id={`${id}-card`}><rect width="400" height="376" rx="38" /></clipPath>
        <clipPath id={`${id}-front`}><path d={FRONT} /></clipPath>
        <filter id={`${id}-blur`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="20" /></filter>
        <filter id={`${id}-ps`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#1b1340" floodOpacity=".16" /></filter>
      </defs>
      <g clipPath={`url(#${id}-card)`}>
        <rect width="400" height="376" fill={`url(#${id}-bg)`} />
        <rect width="400" height="376" fill={`url(#${id}-shine)`} />
        <Papers id={id} />
        <g clipPath={`url(#${id}-front)`}>
          <g filter={`url(#${id}-blur)`}>
            <rect width="400" height="376" fill={`url(#${id}-bg)`} />
            <g opacity=".62"><Papers id={id} /></g>
          </g>
          <path d={FRONT} fill={`url(#${id}-glass)`} />
          <path d={FRONT} fill={`url(#${id}-shade)`} />
        </g>
        <path d={FRONT} fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="2" />
      </g>
    </svg>
  )
}
