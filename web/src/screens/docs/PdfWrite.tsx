// Writing on a page in the PDF tool (the user's choices, 2026-11-01): text, a yellow note, a highlight over what is there,
// and changing printed text: AI reads the page's lines, a line is clicked, covered in white and written anew. Without AI
// the text to change is framed by hand. Placed on the page as it looks, written into the file by lib/pdf.ts.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { Highlighter, PenLine, Plus, StickyNote, Trash2, Type } from 'lucide-react'
import { drawPage, markBox, markLook, type Mark, type Page, type Source } from '../../lib/pdf'
import { aiState, readLines } from '../../lib/scan'
import { cid } from '../../lib/draft'
import { Sheet, useCloseSheet } from '../../ui/Sheet'
import { Seg } from '../../ui/Seg'

type Tool = Mark['kind']
type Line = Awaited<ReturnType<typeof readLines>>[number]
const TOOLS: { value: Tool; label: string; icon: typeof Type; add: string }[] = [
  { value: 'text', label: 'Текст', icon: Type, add: 'Текст нэмэх' },
  { value: 'note', label: 'Тэмдэглэл', icon: StickyNote, add: 'Тэмдэглэл нэмэх' },
  { value: 'mark', label: 'Тодруулга', icon: Highlighter, add: 'Тодруулга нэмэх' },
  { value: 'edit', label: 'Текст засах', icon: PenLine, add: 'Засах хэсэг нэмэх' },
]
/** Letter sizes as fractions of the page's width: on an A4 page about 10, 12 and 18 points */
const SIZES = { s: 0.017, m: 0.021, l: 0.03 } as const
type Size = keyof typeof SIZES
const sizeOf = (v: number): Size => (Object.keys(SIZES) as Size[]).reduce((a, b) => (Math.abs(SIZES[b] - v) < Math.abs(SIZES[a] - v) ? b : a))
const NAME: Record<Tool, string> = { text: 'Текст', note: 'Тэмдэглэл', mark: 'Тодруулга', edit: 'Засвар' }

/** The page's width over its height when turned by t on top of its own rotation */
const ratioAt = (p: Page, t: number) => ((p.rot + t) % 180 ? p.h / p.w : p.w / p.h)
/** Where a mark sits: percentages of its page; letters sized to the page's width (the layer is a container) */
const place = (m: Mark) => ({ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%`, '--s': m.size ?? SIZES.m }) as CSSProperties
const label = (m: Mark) => (m.kind === 'mark' ? NAME.mark : `${NAME[m.kind]}: ${m.text || 'хоосон'}`)

/** A page's lines read by AI, kept while the page is open on this visit (each reading costs) */
const read = new Map<string, Promise<Line[]>>()
let ai: Promise<boolean> | null = null

/** What was written on a page, over its picture in a tile; turned with the page since it was written */
export function MarksLayer({ p }: { p: Page }) {
  if (!p.marks?.list.length) return null
  const t = (p.turn - p.marks.turn + 360) % 360
  return (
    <div className={`player pmarks${t % 180 ? ' is-side' : ''}`} style={{ rotate: `${t}deg` }} aria-hidden="true">
      {p.marks.list.map(m => <span key={m.id} className={`pmark pmark--${m.kind}`} style={place(m)}>{m.kind !== 'mark' && m.text}</span>)}
    </div>
  )
}

export function WriteSheet({ page, src, n, onSave, onClose }: { page: Page; src: Source; n: number; onSave: (m: Page['marks']) => void; onClose: () => void }) {
  return (
    <Sheet label={`${n}-р хуудсанд бичих`} onClose={onClose} wide>
      <h2 className="sheet__title">Хуудсан дээр бичих</h2>
      <Writer page={page} src={src} n={n} onSave={onSave} />
    </Sheet>
  )
}

function Writer({ page, src, n, onSave }: { page: Page; src: Source; n: number; onSave: (m: Page['marks']) => void }) {
  const close = useCloseSheet()
  // Written on the page as it looked then; new ones join them in that position
  const turn = page.marks?.turn ?? page.turn
  const ar = ratioAt(page, turn)
  const [list, setList] = useState<Mark[]>(page.marks?.list ?? [])
  const [tool, setTool] = useState<Tool>('text')
  const [size, setSize] = useState<Size>('m')
  const [sel, setSel] = useState<string | null>(null)
  const [typing, setTyping] = useState<string | null>(null)
  const [img, setImg] = useState<string | null>(null)
  /** The page's lines as AI read them, or how the reading goes */
  const [lines, setLines] = useState<Line[] | 'checking' | 'reading' | 'off' | { error: string } | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const chosen = list.find(m => m.id === sel)
  /** A text being typed in gets the cursor, at its end, once (not again at every letter) */
  const focusEnd = useCallback((el: HTMLTextAreaElement | null) => { if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) } }, [])

  useEffect(() => {
    let url = ''
    let live = true
    drawPage(src, page.index, 1400, turn)
      .then(c => c.toBlob(b => { if (b && live) setImg((url = URL.createObjectURL(b))) }, 'image/jpeg', 0.9))
      .catch(() => {})
    return () => { live = false; if (url) URL.revokeObjectURL(url) }
  }, [src, page.index, turn])

  // Changing text: AI reads the page's lines once, when that tool is first chosen; the answer is kept if the tool changes
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const asked = useRef(false)
  useEffect(() => {
    if (tool !== 'edit' || asked.current) return
    asked.current = true
    const key = `${page.src}:${page.index}:${(page.rot + turn) % 360}`
    setLines('checking')
    ;(async () => {
      const ready = await (ai ??= aiState().then(a => a.ready))
      if (!ready) ai = null
      if (!mounted.current) return
      if (!ready) return setLines('off')
      setLines('reading')
      let p = read.get(key)
      if (!p) {
        p = drawPage(src, page.index, 1600, turn).then(c => readLines(c.toDataURL('image/jpeg', 0.85)))
        read.set(key, p)
        p.catch(() => read.delete(key))
      }
      try {
        const got = await p
        if (mounted.current) setLines(got)
      } catch (e) {
        if (mounted.current) setLines({ error: e instanceof Error ? e.message : 'AI хариу өгсөнгүй.' })
      }
    })()
  }, [tool, page.src, page.index, page.rot, src, turn])

  /** Kept on the page */
  const inside = (m: Mark): Mark => {
    const w = Math.min(m.w, 1)
    const h = Math.min(m.h, 1)
    return { ...m, w, h, x: Math.min(Math.max(0, m.x), 1 - w), y: Math.min(Math.max(0, m.y), 1 - h) }
  }
  /** A text, a note or a change sized to its lines; a change still covers all of what it covers */
  const fitText = (m: Mark, text = m.text ?? '', s = m.size ?? SIZES[size]): Mark => {
    const b = markBox(text, s, ar, m.kind)
    return inside({ ...m, text, size: s, w: Math.max(b.w, m.min?.w ?? 0), h: Math.max(b.h, m.min?.h ?? 0) })
  }
  const update = (id: string, fn: (m: Mark) => Mark) => setList(xs => xs.map(m => (m.id === id ? fn(m) : m)))
  const remove = (id: string) => { setList(xs => xs.filter(m => m.id !== id)); setSel(s => (s === id ? null : s)) }
  const at = (e: { clientX: number; clientY: number }) => {
    const r = frame.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  const start = (m: Mark, type = m.kind !== 'mark') => {
    setList(xs => [...xs, m])
    setSel(m.id)
    if (type) setTyping(m.id)
    else requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-mark="${m.id}"]`)?.focus())
  }
  /** A change over a box of the page, its letters as tall as the box's first line */
  const cover = (box: { x: number; y: number; w: number; h: number }, text: string, rows = 1) => {
    const { line, pad } = markLook('edit')
    const s = Math.max(0.008, box.h / ar / (rows * line + 2 * pad))
    return fitText({ id: cid(), kind: 'edit', x: box.x, y: box.y, w: 0, h: 0, min: { w: box.w, h: box.h } }, text, s)
  }

  /** A new mark at a spot: text and notes ready to type in, a highlight or a change a fifth of the page wide */
  const add = (x: number, y: number) => {
    if (tool === 'mark') return start(inside({ id: cid(), kind: 'mark', x: x - 0.1, y: y - 0.015, w: 0.2, h: 0.03 * ar }))
    if (tool === 'edit') return start(inside(cover({ x: x - 0.1, y: y - 0.0125 * ar, w: 0.2, h: 0.025 * ar }, '')))
    start(fitText({ id: cid(), kind: tool, x, y: y - SIZES[size] * ar, w: 0, h: 0 }, '', SIZES[size]))
  }
  /** A line AI read, covered and ready to change, a little larger than its letters */
  const pick = (l: Line) => {
    const p = 0.004
    start(cover({ x: l.x - p, y: l.y - p * ar, w: l.w + 2 * p, h: l.h + 2 * p * ar }, l.text))
  }
  /** Typing ends: an empty text or note goes; an emptied change stays, white over what it covers */
  const stopTyping = (id: string) => {
    setTyping(null)
    setList(xs => xs.filter(m => m.id !== id || m.kind === 'mark' || m.kind === 'edit' || m.text?.trim()))
  }

  // Pressing the page itself: a text or a note there; a highlight, or a frame round text to change, by dragging across
  const press = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || (e.target as Element).closest('.wmark, .wline')) return
    const p = at(e)
    e.preventDefault()
    if (tool === 'text' || tool === 'note') return add(p.x, p.y)
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const id = cid()
    setList(xs => [...xs, { id, kind: 'mark', x: p.x, y: p.y, w: 0, h: 0 }])
    setSel(id)
    let box = { x: p.x, y: p.y, w: 0, h: 0 }
    const move = (ev: PointerEvent) => {
      const q = at(ev)
      const c = { x: Math.min(Math.max(q.x, 0), 1), y: Math.min(Math.max(q.y, 0), 1) }
      box = { x: Math.min(p.x, c.x), y: Math.min(p.y, c.y), w: Math.abs(c.x - p.x), h: Math.abs(c.y - p.y) }
      update(id, m => ({ ...m, ...box }))
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      const tiny = box.w < 0.01 || box.h < 0.005
      if (tool === 'mark') {
        // A click without a drag paints the usual size there
        if (tiny) update(id, m => inside({ ...m, x: p.x - 0.1, y: p.y - 0.015, w: 0.2, h: 0.03 * ar }))
        return
      }
      // A frame round text to change becomes a change over it, ready to type in
      setList(xs => xs.filter(m => m.id !== id))
      if (tiny) return add(p.x, p.y)
      start(cover(box, ''))
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  /** Drag a mark to move it; a highlight's or a change's corner to size it */
  const drag = (e: RPointerEvent<HTMLElement>, m: Mark, corner = false) => {
    if (typing === m.id || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.stopPropagation()
    e.preventDefault()
    setSel(m.id)
    ;(e.currentTarget.closest('.wmark') as HTMLElement | null)?.focus()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const r = frame.current!.getBoundingClientRect()
    const from = { x: e.clientX, y: e.clientY }
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - from.x) / r.width
      const dy = (ev.clientY - from.y) / r.height
      update(m.id, () => (corner ? grow(m, dx, dy) : inside({ ...m, x: m.x + dx, y: m.y + dy })))
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  /** A highlight, or what a change covers, made larger or smaller */
  const grow = (m: Mark, dx: number, dy: number): Mark => {
    const w = Math.max(0.02, (m.kind === 'edit' ? m.min?.w ?? m.w : m.w) + dx)
    const h = Math.max(0.01, (m.kind === 'edit' ? m.min?.h ?? m.h : m.h) + dy)
    return m.kind === 'edit' ? fitText({ ...m, min: { w, h } }) : inside({ ...m, w, h })
  }

  // On a chosen mark: arrows move it (Shift: further; a highlight's or a change's size), Enter types in it, Delete removes it
  const keys = (e: KeyboardEvent<HTMLElement>, m: Mark) => {
    if (typing === m.id) return
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return remove(m.id) }
    if (e.key === 'Enter' && m.kind !== 'mark') { e.preventDefault(); return setTyping(m.id) }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!d) return
    e.preventDefault()
    if (e.shiftKey && (m.kind === 'mark' || m.kind === 'edit')) return update(m.id, x => grow(x, d[0] * 0.01, d[1] * 0.01))
    const k = e.shiftKey ? 0.05 : 0.01
    update(m.id, x => inside({ ...x, x: x.x + d[0] * k, y: x.y + d[1] * k }))
  }

  const resize = (s: Size) => {
    setSize(s)
    if (chosen && (chosen.kind === 'text' || chosen.kind === 'note')) update(chosen.id, m => fitText(m, m.text, SIZES[s]))
  }
  const save = () => {
    const kept = list.filter(m => (m.kind === 'mark' ? m.w > 0 && m.h > 0 : m.kind === 'edit' || m.text?.trim()))
    onSave(kept.length ? { turn, list: kept } : undefined)
    close()
  }
  const now = TOOLS.find(t => t.value === tool)!
  const sized = chosen ? chosen.kind === 'text' || chosen.kind === 'note' : tool === 'text' || tool === 'note'
  // Lines not covered by a change yet
  const open = Array.isArray(lines) ? lines.filter(l => !list.some(m => m.kind === 'edit' && l.x + l.w / 2 > m.x && l.x + l.w / 2 < m.x + m.w && l.y + l.h / 2 > m.y && l.y + l.h / 2 < m.y + m.h)) : []
  const by = 'Засах текстээ хулганаар хүрээлээд шинээр бичнэ үү.'
  const hint = tool !== 'edit' ? 'Хуудсан дээр товшиж бичнэ. Тодруулахдаа хулганаар чирж тодруулна. Бичсэн зүйлийг чирж эсвэл сумаар зөөнө.'
    : lines === 'checking' || lines === null ? 'AI холболтыг шалгаж байна…'
      : lines === 'reading' ? 'AI хуудсыг уншиж байна…'
        : lines === 'off' ? `AI холбогдоогүй байна. ${by}`
          : !Array.isArray(lines) ? `${lines.error} ${by}`
            : lines.length ? `AI ${lines.length} мөр уншлаа. Засах мөрөө товшино уу, эсвэл ${by.charAt(0).toLowerCase()}${by.slice(1)}`
              : `AI энэ хуудаснаас текст олсонгүй. ${by}`

  return (
    <div className="pwrite">
      <div className="pwrite__head">
      <div className="pwrite__bar">
        <Seg label="Хэрэгсэл" className="pwrite__tools" value={tool} onChange={t => { setTool(t); setSel(null) }}
          options={TOOLS.map(t => ({ value: t.value, label: t.label, icon: <t.icon className="ico" /> }))} />
        {sized && (
          <Seg small label="Үсгийн хэмжээ" value={chosen?.size ? sizeOf(chosen.size) : size} onChange={resize}
            options={[{ value: 's', label: 'Жижиг' }, { value: 'm', label: 'Дунд' }, { value: 'l', label: 'Том' }]} />
        )}
        <button type="button" className="btn btn--glass btn--sm" onClick={() => add(0.4, 0.45)}><Plus className="ico" />{now.add}</button>
        <button type="button" className="btn btn--glass btn--sm" disabled={!chosen} onClick={() => chosen && remove(chosen.id)}><Trash2 className="ico" />Устгах</button>
      </div>
      <p className="muted pwrite__hint" role="status">{hint}</p>
      </div>
      {/* A press on the page must not take the cursor away from the text it has just opened (inside a text it places it) */}
      <div ref={frame} className={`wpage is-${tool}`} style={{ '--ar': ar } as CSSProperties} onPointerDown={press}
        onMouseDown={e => { if (!(e.target as Element).closest('textarea')) e.preventDefault() }} role="group" aria-label={`${n}-р хуудас`}>
        {img ? <img className="wpage__img" src={img} alt="" draggable={false} /> : <span className="player__wait" />}
        {tool === 'edit' && open.map((l, i) => (
          <button key={i} type="button" className="wline" aria-label={`Мөр засах: ${l.text}`} title={l.text} onClick={() => pick(l)}
            style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.w * 100}%`, height: `${l.h * 100}%` }} />
        ))}
        {list.map(m => (
          <div key={m.id} data-mark={m.id} className={`pmark pmark--${m.kind} wmark${sel === m.id ? ' is-sel' : ''}`} style={place(m)}
            role="button" tabIndex={0} aria-label={label(m)} aria-pressed={sel === m.id}
            onPointerDown={e => drag(e, m)} onDoubleClick={() => m.kind !== 'mark' && setTyping(m.id)} onKeyDown={e => keys(e, m)}
            onFocus={() => setSel(m.id)}>
            {typing === m.id ? (
              <textarea className="wmark__input" ref={focusEnd} value={m.text} wrap="off" spellCheck={false}
                aria-label={m.kind === 'edit' ? 'Шинэ текст' : m.kind === 'note' ? 'Тэмдэглэлийн текст' : 'Текст'}
                onChange={e => update(m.id, x => fitText(x, e.target.value))}
                onBlur={() => stopTyping(m.id)} onPointerDown={e => e.stopPropagation()}
                onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.currentTarget.blur() } }} />
            ) : m.kind !== 'mark' && m.text}
            {(m.kind === 'mark' || m.kind === 'edit') && sel === m.id && typing !== m.id && <span className="wmark__grip" aria-hidden="true" onPointerDown={e => drag(e, m, true)} />}
          </div>
        ))}
      </div>
      <div className="spad__actions">
        <button type="button" className="btn btn--accent" onClick={save}>Хадгалах</button>
        <button type="button" className="btn btn--plain" onClick={close}>Болих</button>
        {list.length > 0 && <button type="button" className="btn btn--ghost" onClick={() => { setList([]); setSel(null) }}>Бүгдийг арилгах</button>}
      </div>
    </div>
  )
}
