// One folder of Бичиг хэрэг: the documents in it I can see, as papers; the office adds to it, renames it, or removes it
// once it is empty.
import { useRef } from 'react'
import { ChevronLeft, Download, Ellipsis, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Doc } from '../../lib/types'
import { actions, useApp } from '../../lib/store'
import { open, toast } from '../../lib/ui'
import { go } from '../../lib/router'
import { usePageEnter } from '../../lib/motion'
import { DOC_KIND, seen } from '../../lib/docs'
import { downloadDoc } from '../../lib/paper'
import { dateDots } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Empty } from '../../ui/bits'
import { Menu, MenuItem, usePopover } from '../../ui/Popover'
import { DocTile, DocsNav } from '../Docs'
import { isNew } from './Papers'

export default function FolderPage({ id }: { id: string }) {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const pop = usePopover()
  const f = s.folders.find(x => x.id === id && x.company === s.company)

  if (!f) {
    return (
      <div ref={ref}>
        <DocsNav at="" />
        <PageHead title="Хавтас олдсонгүй" sub="Устгагдсан эсвэл өөр ХХК-ийн хавтас байж магадгүй." actions={<a className="btn btn--glass" href="#docs">Бичиг хэрэг рүү буцах</a>} />
      </div>
    )
  }

  // Other people's documents count too: a folder is removed only when nobody has anything in it
  const all = s.docs.filter(d => d.folder === f.id)
  const docs = all.filter(d => seen(d, s.me)).sort((a, b) => b.added.localeCompare(a.added))
  const remove = () => {
    pop.close()
    go('docs')
    toast(`${f.name} хавтас устгагдлаа.`, { undo: actions.removeFolder(f.id) })
  }

  return (
    <div ref={ref}>
      <DocsNav at="" />
      <a className="dback" href="#docs" data-enter><ChevronLeft className="ico" />Бүх хавтас</a>
      <PageHead
        title={f.name}
        sub={docs.length ? `${docs.length} бичиг баримт` : 'Хоосон'}
        lead={<span className={`dfolder hue--${f.hue}`} aria-hidden="true"><FolderOpen className="ico" /></span>}
        actions={
          <>
            <button ref={pop.anchor} type="button" className="ibtn ibtn--glass" aria-label={`${f.name}, үйлдэл`} aria-haspopup="menu" aria-expanded={pop.open} onClick={pop.toggle}>
              <Ellipsis className="ico" />
            </button>
            <button type="button" className="btn btn--accent" onClick={() => open({ kind: 'docAdd', folder: f.id })}><Plus className="ico" />Бичиг баримт нэмэх</button>
          </>
        }
      />
      <Menu state={pop} label={f.name}>
        <MenuItem icon={<Pencil className="ico" />} onSelect={() => { pop.close(); open({ kind: 'folder', id: f.id }) }}>Хавтас засах</MenuItem>
        <MenuItem icon={<Trash2 className="ico" />} danger onSelect={remove} disabled={all.length ? 'Хоосон хавтсыг л устгана. Бичиг баримтыг эхлээд өөр хавтас руу зөөнө үү.' : undefined}>
          Хавтас устгах
        </MenuItem>
      </Menu>

      {docs.length ? (
        <ul className="papers" aria-label={f.name} data-enter>
          {docs.map(d => <Paper key={d.id} d={d} />)}
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
