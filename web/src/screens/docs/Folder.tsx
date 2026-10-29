// One company's folder in Бичиг хэрэг: the documents in it I can see, as papers, by category (the kind of document).
// #docs-folder-<company>-<kind> opens it at one category. HR and the office add to it; the gear changes its name and colour.
import { useRef, useState } from 'react'
import { ChevronLeft, Download, FolderOpen, Plus, Settings } from 'lucide-react'
import type { Doc, DocKind } from '../../lib/types'
import { scoped, useApp } from '../../lib/store'
import { open } from '../../lib/ui'
import { usePageEnter } from '../../lib/motion'
import { DOC_KIND, DOC_KINDS, seen } from '../../lib/docs'
import { downloadDoc } from '../../lib/paper'
import { dateDots } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Empty } from '../../ui/bits'
import { DocTile, DocsNav, KIND_ICON } from '../Docs'
import { isNew } from './Parts'
import { FolderArt } from './Folders'

export default function FolderPage({ id }: { id: string }) {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const [company, at] = id.split('-')
  const [kind, setKind] = useState<DocKind | null>(DOC_KINDS.includes(at as DocKind) ? (at as DocKind) : null)
  const c = s.companies.find(x => x.id === company && scoped(s).me.companies.includes(x.id))

  if (!c) {
    return (
      <div ref={ref}>
        <DocsNav at="" />
        <PageHead title="Хавтас олдсонгүй" sub="Та энэ компанид ажилладаггүй байж магадгүй." actions={<a className="btn btn--glass" href="#docs">Бичиг хэрэг рүү буцах</a>} />
      </div>
    )
  }

  const docs = s.docs.filter(d => d.company === c.id && seen(d, s.me)).sort((a, b) => b.added.localeCompare(a.added))
  const kinds = DOC_KINDS.map(k => [k, docs.filter(d => d.kind === k).length] as const).filter(([, n]) => n > 0)
  const shown = kind ? docs.filter(d => d.kind === kind) : docs

  return (
    <div ref={ref}>
      <DocsNav at="" />
      <a className="dback" href="#docs" data-enter><ChevronLeft className="ico" />Бүх хавтас</a>
      <PageHead
        title={c.name}
        sub={docs.length ? `${docs.length} бичиг баримт` : 'Хоосон'}
        lead={<span className="dfolder" aria-hidden="true"><FolderArt id={`fh-${c.id}`} hue={c.hue} /></span>}
        actions={
          <>
            <button type="button" className="ibtn ibtn--glass" aria-label="Хавтас засах" title="Хавтас засах" onClick={() => open({ kind: 'company', id: c.id })}>
              <Settings className="ico" />
            </button>
            <button type="button" className="btn btn--accent" onClick={() => open({ kind: 'docAdd', company: c.id })}><Plus className="ico" />Бичиг баримт нэмэх</button>
          </>
        }
      />
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

      {shown.length ? (
        <ul className="papers" aria-label={kind ? DOC_KIND[kind] : c.name} data-enter>
          {shown.map(d => <Paper key={d.id} d={d} />)}
        </ul>
      ) : (
        <section className="card glass" data-enter>
          <Empty icon={<FolderOpen className="ico" />} title="Бичиг баримт алга" text="Бичиг баримт нэмбэл энд харагдана." />
        </section>
      )}
    </div>
  )
}

/** A document as a sheet of paper: its kind, name and date, a few lines of "text" */
function Paper({ d }: { d: Doc }) {
  return (
    <li className="dpaper">
      <button type="button" className="dpaper__open" onClick={() => open({ kind: 'doc', id: d.id })}>
        <DocTile kind={d.kind} />
        <b>{d.name}</b>
        <small>{DOC_KIND[d.kind]}, {dateDots(new Date(d.added))}</small>
        <span className="dpaper__lines" aria-hidden="true"><i /><i /><i /><i /></span>
        {isNew(d) && <span className="drow__new">Шинэ</span>}
      </button>
      <button type="button" className="ibtn ibtn--sm dpaper__dl" aria-label={`${d.name} татах`} title="Татах" onClick={() => downloadDoc(d)}>
        <Download className="ico" />
      </button>
    </li>
  )
}
