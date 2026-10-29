// Ноорог, first page: my boards (last changed first) and ready-made boards to start from.
import { useEffect, useMemo, useRef } from 'react'
import { Ellipsis, Plus, StickyNote, Trash2 } from 'lucide-react'
import type { Draft, DraftCard } from '../../lib/types'
import { actions, getState, useApp } from '../../lib/store'
import { go } from '../../lib/router'
import { usePageEnter } from '../../lib/motion'
import { TEMPLATES } from '../../lib/draft'
import { sweepFiles } from '../../lib/files'
import { ago } from '../../lib/format'
import { toast } from '../../lib/ui'
import { PageHead } from '../../ui/PageHead'
import { Empty } from '../../ui/bits'
import { Menu, MenuItem, usePopover } from '../../ui/Popover'
import { DraftNav } from '../Draft'

let swept = false
const create = (name: string, cards: DraftCard[] = []) => go('draft', actions.addDraft(name, cards).id)

export default function Boards() {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const mine = s.drafts.filter(d => d.company === s.company && d.owner === s.me).sort((a, b) => b.updated.localeCompare(a.updated))
  const previews = useMemo(() => TEMPLATES.map(t => t.cards()), [])

  // Once per visit, drop stored files that no board uses any more (deleted cards, older copies of a PDF)
  useEffect(() => {
    if (swept) return
    swept = true
    const keep = new Set(getState().drafts.flatMap(d => d.cards.flatMap(c => (c.file ? [c.file.id] : []))))
    sweepFiles(keep).catch(() => {})
  }, [])

  return (
    <div ref={ref}>
      <DraftNav at="" />
      <PageHead
        title="Ноорог"
        sub="Санаа, тэмдэглэл, зураг, файлаа самбарт чөлөөтэй байрлуулна."
        actions={<button type="button" className="btn btn--accent" onClick={() => create('Шинэ самбар')}><Plus className="ico" />Шинэ самбар</button>}
      />
      <section className="boards" aria-labelledby="boards-mine" data-enter>
        <h2 className="boards__h" id="boards-mine">Миний самбар</h2>
        {mine.length ? (
          <ul className="boards__grid">
            {mine.map(d => <BoardTile key={d.id} d={d} />)}
          </ul>
        ) : (
          <Empty icon={<StickyNote className="ico" />} title="Самбар алга" text="Доорх загвараас сонгох эсвэл шинэ самбар нээнэ үү." />
        )}
      </section>
      <section className="boards" aria-labelledby="boards-tpl" data-enter>
        <h2 className="boards__h" id="boards-tpl">Загвараас эхлэх</h2>
        <ul className="boards__grid boards__grid--tpl">
          {TEMPLATES.map((t, i) => (
            <li key={t.id} className="btile">
              <button type="button" className="btile__link glass" onClick={() => create(t.name, t.cards())}>
                <Mini cards={previews[i]} />
                <span className="btile__name">{t.name}</span>
                <span className="btile__meta">{t.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function BoardTile({ d }: { d: Draft }) {
  const pop = usePopover()
  const remove = () => {
    pop.close()
    toast(`${d.name} самбар устгагдлаа.`, { undo: actions.removeDraft(d.id) })
  }
  return (
    <li className="btile">
      <a className="btile__link glass" href={`#draft-${d.id}`}>
        <Mini cards={d.cards} />
        <span className="btile__name">{d.name}</span>
        <span className="btile__meta">{ago(d.updated)} зассан</span>
      </a>
      <button ref={pop.anchor} type="button" className="ibtn ibtn--sm ibtn--glass btile__more" aria-label={`${d.name}, үйлдэл`} aria-haspopup="menu" aria-expanded={pop.open} onClick={pop.toggle}>
        <Ellipsis className="ico" />
      </button>
      <Menu state={pop} label={d.name}>
        <MenuItem icon={<Trash2 className="ico" />} danger onSelect={remove}>Самбар устгах</MenuItem>
      </Menu>
    </li>
  )
}

/** The board in miniature: paper shapes where its cards are */
export function Mini({ cards }: { cards: DraftCard[] }) {
  if (!cards.length) return <span className="mini" aria-hidden="true" />
  const pad = 48
  const x0 = Math.min(...cards.map(c => c.x)) - pad
  const y0 = Math.min(...cards.map(c => c.y)) - pad
  const x1 = Math.max(...cards.map(c => c.x + c.w)) + pad
  const y1 = Math.max(...cards.map(c => c.y + c.h)) + pad
  return (
    <svg className="mini" viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} aria-hidden="true">
      {cards.map(c => c.kind === 'title' ? (
        <rect key={c.id} className="mini__title" x={c.x} y={c.y + c.h * 0.2} width={Math.min(c.w, (c.text?.length ?? 12) * 16)} height={c.h * 0.6} rx={c.h * 0.3} />
      ) : (
        <g key={c.id} transform={`rotate(${c.tilt} ${c.x + c.w / 2} ${c.y + c.h / 2})`}>
          <rect className={`mini__card${c.kind === 'image' ? ' mini__card--image' : ''}${c.hue ? ` hue--${c.hue}` : ''}`} x={c.x} y={c.y} width={c.w} height={c.h} rx="12" />
          {c.kind !== 'image' && <rect className="mini__line" x={c.x + 20} y={c.y + 22} width={c.w * 0.62} height="14" rx="7" />}
          {c.kind !== 'image' && c.h > 90 && <rect className="mini__line" x={c.x + 20} y={c.y + 50} width={c.w * 0.4} height="14" rx="7" />}
        </g>
      ))}
    </svg>
  )
}
