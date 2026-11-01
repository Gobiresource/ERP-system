// A contract's Word file on a page of its own (#docs-word-<contract>), a trial (docs/decisions.md, 2026-11-01). Not a
// window: the editor puts its menus on the page itself, where a window would cover them. The editor loads only here.
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useApp } from '../../lib/store'
import { usePageEnter } from '../../lib/motion'
import { canEdit, rolesOf } from '../../lib/contracts'
import { accessOf, docView } from '../../lib/access'
import { PageHead } from '../../ui/PageHead'
import { NoAccess } from '../../ui/bits'
import { DocsNav } from '../Docs'
import { ActAs, useActor } from './Contracts'
import type WordEditor from './WordEditor'

export default function WordPage({ id }: { id: string }) {
  const s = useApp()
  const who = useActor()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const [Editor, setEditor] = useState<typeof WordEditor | 'failed'>()
  useEffect(() => { import('./WordEditor').then(m => setEditor(() => m.default), () => setEditor('failed')) }, [])
  const c = s.contracts.find(x => x.id === id)
  if (!c) {
    return (
      <div ref={ref}>
        <DocsNav at="contracts" />
        <PageHead title="Гэрээ олдсонгүй" sub="Устгагдсан байж магадгүй." actions={<a className="btn btn--glass" href="#docs-contracts">Бүх гэрээ</a>} />
      </div>
    )
  }
  if (!docView(s).contract(c)) {
    return (
      <div ref={ref}>
        <DocsNav at="contracts" />
        <NoAccess text="Та зөвхөн өөрийн оролцсон гэрээг харах эрхтэй." />
      </div>
    )
  }
  // Those who may edit the text now edit the file; in review their changes are marked as suggestions, as in Word
  const mode = !canEdit(c, rolesOf(s, c.company), who) ? 'viewing' : c.stage === 'review' ? 'suggesting' : 'editing'
  return (
    <div ref={ref}>
      <DocsNav at="contracts" />
      <a className="dback" href={`#docs-contract-${c.id}`} data-enter><ChevronLeft className="ico" />Гэрээ</a>
      <PageHead title={c.title} sub="Word файл. Туршилт: гэрээний текстээс тусдаа хадгалагдана." />
      {accessOf(s, s.me, c.company).admin && <ActAs />}
      {Editor === 'failed' ? <p className="wdoc__wait" role="alert">Word засварлагчийг ачаалж чадсангүй. Интернэтээ шалгаад хуудсыг дахин ачаална уу.</p>
        : Editor ? <Editor key={who} c={c} who={who} mode={mode} />
          : <p className="wdoc__wait" role="status">Word засварлагчийг ачаалж байна…</p>}
    </div>
  )
}
