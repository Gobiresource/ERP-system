// One board: an endless desk with paper cards (Mochiboard's idea, our own code; docs/decisions.md, 2026-10-29).
// Look around: drag empty space, scroll, or one finger on a phone. Zoom: Ctrl + wheel, the buttons, or two fingers.
// A card: click to select, drag to move, double-click or Enter to edit, Delete to remove, arrows to nudge, Ctrl+Z to step back.
// Pictures and files go to the browser's file store (lib/files.ts); a card keeps only the file's id.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { ArrowLeft, Copy, Download, ExternalLink, Eye, File as FileIcon, Heading1, Image as ImageIcon, Link2, ListChecks, Maximize, Minus, Paperclip, Pencil, Plus, Redo2, StickyNote, Trash2, Undo2, X } from 'lucide-react'
import type { CardKind, Draft, DraftCard } from '../../lib/types'
import { actions, getState, useApp } from '../../lib/store'
import { go } from '../../lib/router'
import { enter, popIn, settle, usePageEnter } from '../../lib/motion'
import { COLOURED, KIND, PAPER, SIZE, cardSummary, cid, fileSize, host, newCard, safeUrl } from '../../lib/draft'
import { getFile, putFile, saveBlob, useFileUrl } from '../../lib/files'
import { open, toast } from '../../lib/ui'
import { PageHead } from '../../ui/PageHead'

type View = Draft['view']
type Edit = () => Partial<DraftCard>

const ZMIN = 0.25
const ZMAX = 2
const clampZ = (z: number) => Math.min(ZMAX, Math.max(ZMIN, z))
const MIN: Record<CardKind, [number, number]> = { note: [120, 80], todo: [160, 80], title: [120, 40], image: [120, 60], link: [180, 64], file: [180, 64] }
const EDITABLE: CardKind[] = ['note', 'todo', 'title', 'link', 'image']
const isPdf = (c?: DraftCard) => c?.kind === 'file' && (c.file?.type === 'application/pdf' || /\.pdf$/i.test(c.file?.name ?? ''))
const typing = (el: Element | null) => !!el?.closest('input, textarea, select, [contenteditable="true"]')

// Undo history, per board, for this visit
const history = new Map<string, { past: DraftCard[][]; future: DraftCard[][] }>()
const hist = (id: string) => {
  let h = history.get(id)
  if (!h) history.set(id, (h = { past: [], future: [] }))
  return h
}
const cardsOf = (id: string) => getState().drafts.find(d => d.id === id)?.cards ?? []
/** The board was changed from elsewhere (the PDF tool): its undo steps no longer fit */
export const forget = (id: string) => history.delete(id)

/** Saves a change to the cards; Ctrl+Z steps back */
function commit(id: string, fn: (cs: DraftCard[]) => DraftCard[]) {
  const before = cardsOf(id)
  const next = fn(before)
  if (next === before) return
  const h = hist(id)
  h.past.push(before)
  if (h.past.length > 80) h.past.shift()
  h.future = []
  actions.updateDraft(id, { cards: next })
}
const patchCard = (id: string, card: string, p: Partial<DraftCard>) => commit(id, cs => cs.map(c => (c.id === card ? { ...c, ...p } : c)))

function travel(id: string, back: boolean) {
  const h = hist(id)
  const to = (back ? h.past : h.future).pop()
  if (!to) return
  ;(back ? h.future : h.past).push(cardsOf(id))
  actions.updateDraft(id, { cards: to })
}

const empty = (c: DraftCard) =>
  c.kind === 'todo' ? !c.text?.trim() && !c.items?.length : c.kind === 'link' ? !c.url : c.kind === 'note' || c.kind === 'title' ? !c.text?.trim() : false

/** Height over width of a picture, or null when the browser cannot show it */
async function pictureRatio(f: Blob) {
  try {
    const b = await createImageBitmap(f)
    const r = b.height / b.width
    b.close()
    return r
  } catch {
    return null
  }
}

export default function Board({ id }: { id: string }) {
  const s = useApp()
  const d = s.drafts.find(x => x.id === id && x.company === s.company && x.owner === s.me)
  return d ? <Desk d={d} /> : <Missing />
}

function Missing() {
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  return (
    <div ref={ref}>
      <PageHead title="Самбар олдсонгүй" sub="Устгагдсан эсвэл өөр ХХК-ийн самбар байж магадгүй." actions={<a className="btn btn--glass" href="#draft">Ноорог руу буцах</a>} />
    </div>
  )
}

const ADD: [CardKind, typeof StickyNote, string][] = [
  ['note', StickyNote, 'Тэмдэглэл'], ['todo', ListChecks, 'Жагсаалт'], ['title', Heading1, 'Гарчиг'],
  ['image', ImageIcon, 'Зураг'], ['link', Link2, 'Холбоос'], ['file', Paperclip, 'Файл'],
]

function Desk({ d }: { d: Draft }) {
  const page = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLElement>(null)
  const origin = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const pickImage = useRef<HTMLInputElement>(null)
  const pickFile = useRef<HTMLInputElement>(null)
  const view = useRef<View>(d.view)
  const [zoom, setZoom] = useState(d.view.z)
  const [sel, setSel] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState(d.name)
  /** A problem the user should read: it stays until closed */
  const [problem, setProblem] = useState<string | null>(null)
  const edit = useRef<Edit | null>(null)
  /** A card just added: if it is left empty, it goes away again */
  const fresh = useRef<string | null>(null)
  const added = useRef<string | null>(null)
  usePageEnter(page)

  const cards = d.cards
  const selected = cards.find(c => c.id === sel)
  const h = hist(d.id)

  // The view is drawn straight onto the page while it moves, and saved a moment after it stops
  const saveTimer = useRef(0)
  const paint = useCallback(() => {
    const v = view.current
    world.current!.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`
    world.current!.style.setProperty('--z', String(v.z))
    // Dots keep their size: zooming out skips every other one instead of crowding them
    let g = 26 * v.z
    while (g < 20) g *= 2
    while (g > 40) g /= 2
    const st = stage.current!.style
    st.setProperty('--vx', `${v.x}px`)
    st.setProperty('--vy', `${v.y}px`)
    st.setProperty('--grid', `${g}px`)
  }, [])
  const setView = useCallback((v: View) => {
    view.current = v
    paint()
    setZoom(v.z)
    clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { saveTimer.current = 0; actions.updateDraft(d.id, { view: v }) }, 400)
  }, [d.id, paint])
  useEffect(() => () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); actions.updateDraft(d.id, { view: view.current }) }
  }, [d.id])

  const rect = () => origin.current!.getBoundingClientRect()
  const toWorld = (cx: number, cy: number) => {
    const o = rect()
    const v = view.current
    return { x: (cx - o.left - v.x) / v.z, y: (cy - o.top - v.y) / v.z }
  }
  const zoomAt = useCallback((cx: number, cy: number, z: number) => {
    const o = origin.current!.getBoundingClientRect()
    const v = view.current
    const nz = clampZ(z)
    const wx = (cx - o.left - v.x) / v.z
    const wy = (cy - o.top - v.y) / v.z
    setView({ x: cx - o.left - wx * nz, y: cy - o.top - wy * nz, z: nz })
  }, [setView])
  /** The part of the screen the board can use: from the board's corner to the tools at the bottom */
  const area = () => {
    const o = rect()
    const bottom = (dock.current?.getBoundingClientRect().top ?? innerHeight) - 16
    return { left: o.left, top: o.top, w: Math.max(120, innerWidth - 24 - o.left), h: Math.max(120, bottom - o.top) }
  }
  const zoomBy = (k: number) => {
    const a = area()
    zoomAt(a.left + a.w / 2, a.top + a.h / 2, view.current.z * k)
  }
  const height = (c: DraftCard) => world.current?.querySelector<HTMLElement>(`[data-card="${c.id}"]`)?.offsetHeight ?? c.h
  const bounds = (cs: DraftCard[]) => ({
    x0: Math.min(...cs.map(c => c.x)), y0: Math.min(...cs.map(c => c.y)),
    x1: Math.max(...cs.map(c => c.x + c.w)), y1: Math.max(...cs.map(c => c.y + height(c))),
  })
  /** Zooms so that all cards are in view, from the top. `least` keeps text readable: then the left edge comes first. */
  const fit = (most = 1, least = ZMIN) => {
    if (!cards.length) return setView({ x: 40, y: 40, z: 1 })
    const b = bounds(cards)
    const a = area()
    const z = clampZ(Math.max(least, Math.min(most, (a.w - 48) / (b.x1 - b.x0), (a.h - 48) / (b.y1 - b.y0))))
    const wide = (b.x1 - b.x0) * z > a.w - 48
    setView({ x: wide ? 24 - b.x0 * z : (a.w - (b.x1 - b.x0) * z) / 2 - b.x0 * z, y: 24 - b.y0 * z, z })
  }

  // First paint. A board never looked around in opens with all its cards in view.
  useLayoutEffect(() => {
    paint()
    const v = view.current
    if (cards.length && v.x === 40 && v.y === 40 && v.z === 1) {
      const b = bounds(cards)
      const a = area()
      if (b.x1 * v.z + v.x > a.w || b.y1 * v.z + v.y > a.h) fit(1, 0.6)
    }
    enter(world.current!.querySelectorAll('.bcard'), { opacity: 0, transform: 'translateY(10px) scale(.97)' }, { duration: 0.5, ease: 'power3.out', delay: 0.1, stagger: 0.02 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A new card pops onto the desk
  useLayoutEffect(() => {
    const id = added.current
    if (!id) return
    added.current = null
    const el = world.current?.querySelector(`[data-card="${id}"]`)
    if (el) popIn([el], 0)
  })

  const focusCard = (id: string) => requestAnimationFrame(() => world.current?.querySelector<HTMLElement>(`[data-card="${id}"]`)?.focus({ preventScroll: true }))

  /** A free place for a new card: the middle of the screen, or the nearest spot around it where it covers nothing */
  const spot = (w: number, h: number) => {
    const a = area()
    const v = view.current
    const cx = (a.w / 2 - v.x) / v.z - w / 2
    const cy = (a.h / 2 - v.y) / v.z - h / 2
    const seen = { x0: -v.x / v.z, y0: -v.y / v.z, x1: (a.w - v.x) / v.z - w, y1: (a.h - v.y) / v.z - h }
    const taken = cardsOf(d.id).map(c => ({ x: c.x, y: c.y, w: c.w, h: height(c) }))
    const free = (x: number, y: number) => taken.every(b => x + w + 16 < b.x || x > b.x + b.w + 16 || y + h + 16 < b.y || y > b.y + b.h + 16)
    for (let r = 0; r < 900; r += 40) {
      const n = r ? Math.ceil((2 * Math.PI * r) / 50) : 1
      for (let i = 0; i < n; i++) {
        const x = cx + r * Math.cos((i / n) * 2 * Math.PI)
        const y = cy + r * Math.sin((i / n) * 2 * Math.PI) * 0.7
        if (x >= seen.x0 && y >= seen.y0 && x <= seen.x1 && y <= seen.y1 && free(x, y)) return { x: Math.round(x), y: Math.round(y) }
      }
    }
    const j = () => Math.round(Math.random() * 40 - 20)
    return { x: Math.round(cx + j()), y: Math.round(cy + j()) }
  }

  const add = (kind: CardKind, more: Partial<DraftCard> = {}, at?: { x: number; y: number }) => {
    const w = more.w ?? SIZE[kind][0]
    const h = more.h ?? SIZE[kind][1]
    const p = at ? { x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2) } : spot(w, h)
    const c = newCard(kind, p.x, p.y, { ...(kind === 'note' ? { hue: 'yellow' } : kind === 'todo' ? { items: [] } : {}), ...more })
    commit(d.id, cs => [...cs, c])
    added.current = c.id
    setSel(c.id)
    if (EDITABLE.includes(kind) && kind !== 'image' && empty(c)) {
      fresh.current = c.id
      setEditing(c.id)
    } else focusCard(c.id)
    return c
  }

  const addFiles = async (files: File[], at?: { x: number; y: number }) => {
    let i = 0
    setProblem(null)
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) { setProblem(`${f.name} нэмэгдсэнгүй. Файл 25 MB-аас бага байх ёстой.`); continue }
      const file = { id: `f${cid()}`, name: f.name, type: f.type, size: f.size }
      try {
        await putFile(file.id, f)
      } catch {
        return setProblem('Энэ хөтөч файл хадгалах боломжгүй байна.')
      }
      const ratio = f.type.startsWith('image/') ? await pictureRatio(f) : null
      const shift = at ? { x: at.x + i * 28, y: at.y + i * 28 } : undefined
      i++
      if (ratio) add('image', { file, w: 280, h: Math.round(264 * ratio) + 16 }, shift)
      else add('file', { file }, shift)
    }
  }

  const finish = (refocus: boolean) => {
    const c = cardsOf(d.id).find(x => x.id === editing)
    const read = edit.current
    edit.current = null
    setEditing(null)
    if (!c) return
    const next = { ...c, ...read?.() }
    if (fresh.current === c.id) {
      fresh.current = null
      // Left empty right after adding: take it back off the board, with no undo step
      if (empty(next)) {
        actions.updateDraft(d.id, { cards: cardsOf(d.id).filter(x => x.id !== c.id) })
        h.past.pop()
        setSel(null)
        stage.current?.focus()
        return
      }
      actions.updateDraft(d.id, { cards: cardsOf(d.id).map(x => (x.id === c.id ? next : x)) })
    } else if (read && JSON.stringify(next) !== JSON.stringify(c)) commit(d.id, cs => cs.map(x => (x.id === c.id ? next : x)))
    if (refocus) focusCard(c.id)
  }

  const remove = (id: string) => {
    const all = cardsOf(d.id)
    const i = all.findIndex(c => c.id === id)
    const c = all[i]
    if (!c) return
    commit(d.id, cs => cs.filter(x => x.id !== id))
    setSel(null)
    setEditing(null)
    edit.current = null
    stage.current?.focus()
    toast(`${KIND[c.kind]} устгагдлаа.`, { undo: () => commit(d.id, cs => (cs.some(x => x.id === id) ? cs : [...cs.slice(0, i), c, ...cs.slice(i)])) })
  }

  const duplicate = (c: DraftCard) => {
    const copy = { ...c, id: cid(), x: c.x + 28, y: c.y + 28, items: c.items?.map(it => ({ ...it, id: cid() })) }
    commit(d.id, cs => [...cs, copy])
    added.current = copy.id
    setSel(copy.id)
    focusCard(copy.id)
  }

  const download = async (c: DraftCard) => {
    const blob = c.file && (await getFile(c.file.id).catch(() => undefined))
    if (!blob) return setProblem('Файл олдсонгүй. Өөр төхөөрөмж эсвэл хөтөч дээр нэмсэн байж магадгүй.')
    saveBlob(c.file!.name, blob)
  }
  const openCard = (c: DraftCard) => {
    if (isPdf(c)) go('docs', `pdf-${d.id}-${c.id}`)
    else if (c.kind === 'file') download(c)
    else if (EDITABLE.includes(c.kind)) { setSel(c.id); setEditing(c.id) }
  }

  // Pointer: drag a card, resize it, look around, pinch to zoom. The card moves on the page and is saved on release.
  const g = useRef<null | {
    kind: 'pan' | 'card' | 'resize' | 'pinch'
    id?: string; el?: HTMLElement; sx: number; sy: number; moved: boolean; v0: View; c0?: DraftCard; d0?: number; m0?: { x: number; y: number }
  }>(null)
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const lastTap = useRef({ t: 0, x: 0, y: 0, id: '' })
  const swallowClick = useRef(false)
  const lastType = useRef('mouse')

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    lastType.current = e.pointerType
    swallowClick.current = false
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return
    const t = e.target as HTMLElement
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size === 2) {
      // Second finger: zoom with both, and put back a card that was on its way
      const cur = g.current
      if (cur?.el) { cur.el.style.translate = ''; cur.el.classList.remove('is-lifted') }
      g.current = { kind: 'pinch', sx: 0, sy: 0, moved: true, v0: view.current }
      return
    }
    if (pts.current.size > 2) return
    const cardEl = t.closest<HTMLElement>('[data-card]')
    const base = { sx: e.clientX, sy: e.clientY, moved: false, v0: view.current }
    if (t.closest('[data-resize]') && cardEl) {
      const c = cards.find(x => x.id === cardEl.dataset.card)
      if (c) g.current = { ...base, kind: 'resize', id: c.id, el: cardEl, c0: c }
    } else if (cardEl) {
      const c = cards.find(x => x.id === cardEl.dataset.card)
      if (!c || editing === c.id || t.closest('input, textarea, button, a, select')) { g.current = null; return }
      g.current = { ...base, kind: 'card', id: c.id, el: cardEl, c0: c }
    } else {
      g.current = { ...base, kind: 'pan' }
    }
    // A finger must not also send the mouse press that follows a tap: it would take the focus from a note just opened
    if (e.pointerType !== 'mouse') e.preventDefault()
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!pts.current.has(e.pointerId)) return
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const cur = g.current
    if (!cur) return
    if (cur.kind === 'pinch') {
      if (pts.current.size < 2) return
      const [a, b] = [...pts.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (!cur.d0) { cur.d0 = dist; cur.m0 = mid; cur.v0 = view.current; return }
      const o = rect()
      const z = clampZ(cur.v0.z * dist / cur.d0)
      const wx = (cur.m0!.x - o.left - cur.v0.x) / cur.v0.z
      const wy = (cur.m0!.y - o.top - cur.v0.y) / cur.v0.z
      setView({ x: mid.x - o.left - wx * z, y: mid.y - o.top - wy * z, z })
      return
    }
    const dx = e.clientX - cur.sx
    const dy = e.clientY - cur.sy
    if (!cur.moved) {
      if (Math.hypot(dx, dy) < (e.pointerType === 'mouse' ? 3 : 8)) return
      cur.moved = true
      stage.current!.setPointerCapture(e.pointerId)
      if (cur.kind === 'card') {
        if (editing) finish(false)
        setSel(cur.id!)
        cur.el!.classList.add('is-lifted')
      }
      if (cur.kind === 'pan') stage.current!.classList.add('is-panning')
    }
    const z = view.current.z
    if (cur.kind === 'pan') setView({ ...cur.v0, x: cur.v0.x + dx, y: cur.v0.y + dy })
    else if (cur.kind === 'card') cur.el!.style.translate = `${dx / z}px ${dy / z}px`
    else if (cur.kind === 'resize') {
      const c = cur.c0!
      const [mw, mh] = MIN[c.kind]
      const w = Math.max(mw, c.w + dx / z)
      cur.el!.style.width = `${w}px`
      if (c.kind !== 'image') cur.el!.style.minHeight = `${Math.max(mh, c.h + dy / z)}px`
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const had = pts.current.delete(e.pointerId)
    const cur = g.current
    if (!had || !cur) return
    if (cur.kind === 'pinch') {
      if (pts.current.size === 0) g.current = null
      return
    }
    g.current = null
    stage.current!.classList.remove('is-panning')
    const z = view.current.z
    const dx = (e.clientX - cur.sx) / z
    const dy = (e.clientY - cur.sy) / z
    if (cur.moved) {
      // The click that follows a drag must not tick a box or open a link
      swallowClick.current = true
      setTimeout(() => { swallowClick.current = false }, 60)
      if (cur.kind === 'card') {
        const el = cur.el!
        el.style.translate = ''
        el.classList.remove('is-lifted')
        // The moved card comes to the top of the pile
        commit(d.id, cs => [...cs.filter(c => c.id !== cur.id), { ...cur.c0!, ...cs.find(c => c.id === cur.id), x: Math.round(cur.c0!.x + dx), y: Math.round(cur.c0!.y + dy) }])
        requestAnimationFrame(() => settle(el))
      } else if (cur.kind === 'resize') {
        const c = cur.c0!
        const [mw, mh] = MIN[c.kind]
        const w = Math.round(Math.max(mw, c.w + dx))
        cur.el!.style.width = ''
        cur.el!.style.minHeight = ''
        patchCard(d.id, c.id, c.kind === 'image' ? { w, h: Math.round((c.h - 16) * (w - 16) / (c.w - 16)) + 16 } : { w, h: Math.round(Math.max(mh, c.h + dy)) })
      }
      return
    }
    // A tap or a click
    const now = Date.now()
    const tap = lastTap.current
    const double = e.pointerType !== 'mouse' && now - tap.t < 320 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 24 && tap.id === (cur.id ?? '')
    lastTap.current = { t: double ? 0 : now, x: e.clientX, y: e.clientY, id: cur.id ?? '' }
    if (cur.kind === 'pan') {
      if (editing) finish(false)
      setSel(null)
      if (double) add('note', {}, toWorld(e.clientX, e.clientY))
    } else if (cur.kind === 'card') {
      setSel(cur.id!)
      if (double) openCard(cur.c0!)
    }
  }
  const onPointerCancel = (e: PointerEvent<HTMLElement>) => {
    pts.current.delete(e.pointerId)
    const cur = g.current
    if (cur?.el) { cur.el.style.translate = ''; cur.el.style.width = ''; cur.el.style.minHeight = ''; cur.el.classList.remove('is-lifted') }
    stage.current?.classList.remove('is-panning')
    if (pts.current.size === 0) g.current = null
  }

  // Wheel: look around; Ctrl + wheel (or a trackpad pinch) zooms where the pointer is
  useEffect(() => {
    const el = stage.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const k = e.deltaMode === 1 ? 16 : 1
      if (e.ctrlKey || e.metaKey) return zoomAt(e.clientX, e.clientY, view.current.z * Math.exp(-e.deltaY * k * 0.01))
      const v = view.current
      const sideways = e.shiftKey && !e.deltaX
      setView({ ...v, x: v.x - (sideways ? e.deltaY : e.deltaX) * k, y: v.y - (sideways ? 0 : e.deltaY) * k })
    }
    // Safari sends its trackpad pinch as gesture events
    let z0 = 1
    const onGesture = (e: Event) => {
      e.preventDefault()
      const ge = e as Event & { scale: number; clientX: number; clientY: number }
      if (e.type === 'gesturestart') z0 = view.current.z
      else zoomAt(ge.clientX, ge.clientY, z0 * ge.scale)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', onGesture)
    el.addEventListener('gesturechange', onGesture)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', onGesture)
      el.removeEventListener('gesturechange', onGesture)
    }
  }, [zoomAt, setView])

  // Paste a picture, a file, a web address or text straight onto the board
  const addFilesRef = useRef(addFiles)
  const addRef = useRef(add)
  addFilesRef.current = addFiles
  addRef.current = add
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (typing(document.activeElement) || document.querySelector('dialog[open]')) return
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length) { e.preventDefault(); addFilesRef.current(files); return }
      const text = e.clipboardData?.getData('text/plain').trim()
      if (!text) return
      e.preventDefault()
      const url = /^https?:\/\/\S+$/i.test(text) ? safeUrl(text) : null
      if (url) addRef.current('link', { url })
      else addRef.current('note', { text: text.slice(0, 4000) })
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  // Ctrl+Z steps back, Ctrl+Shift+Z or Ctrl+Y forward, wherever the focus is (text fields keep their own)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.code !== 'KeyZ' && e.code !== 'KeyY')) return
      if (typing(document.activeElement) || document.querySelector('dialog[open]')) return
      e.preventDefault()
      travel(d.id, e.code === 'KeyZ' && !e.shiftKey)
      setEditing(null)
      if (!stage.current?.contains(document.activeElement)) stage.current?.focus({ preventScroll: true })
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [d.id])

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const mod = e.ctrlKey || e.metaKey
    if (typing(e.target as Element) || !selected || (e.target as HTMLElement).dataset.card !== selected.id) return
    if (mod && e.code === 'KeyD') { e.preventDefault(); duplicate(selected); return }
    if (mod || e.altKey) return
    const step = e.shiftKey ? 50 : 10
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (move) {
      e.preventDefault()
      patchCard(d.id, selected.id, { x: selected.x + move[0], y: selected.y + move[1] })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      openCard(selected)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove(selected.id)
    } else if (e.key === 'Escape') {
      setSel(null)
      stage.current?.focus()
    }
  }

  const rename = () => {
    const n = name.trim()
    if (!n) return setName(d.name)
    if (n !== d.name) actions.updateDraft(d.id, { name: n })
  }

  return (
    <div ref={page} className="desk" onKeyDown={onKeyDown}>
      <header className="bhead glass" data-enter>
        <a className="ibtn ibtn--sm" href="#draft" aria-label="Ноорог руу буцах"><ArrowLeft className="ico" /></a>
        <h1 id="page-title" tabIndex={-1} className="sr-only">{d.name}</h1>
        <input className="bhead__name" aria-label="Самбарын нэр" value={name} size={Math.max(6, [...name].length + 1)} maxLength={80}
          onChange={e => setName(e.target.value)} onBlur={rename} onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { if (e.key === 'Escape') setName(d.name); e.currentTarget.blur() } }} />
      </header>

      {problem && (
        <div className="bnote pnote pnote--bad" role="alert">
          <p>{problem}</p>
          <button type="button" className="ibtn ibtn--sm" aria-label="Мэдэгдлийг хаах" onClick={() => setProblem(null)}><X className="ico" /></button>
        </div>
      )}

      <section
        ref={stage}
        className="board"
        tabIndex={-1}
        aria-label="Самбар"
        aria-describedby="board-help"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={e => { if (swallowClick.current) { swallowClick.current = false; e.preventDefault(); e.stopPropagation() } }}
        onDoubleClick={e => {
          // Fingers are handled in onPointerUp; some phones also send a double click
          if (lastType.current !== 'mouse') return
          const t = e.target as HTMLElement
          const cardEl = t.closest<HTMLElement>('[data-card]')
          if (!cardEl) add('note', {}, toWorld(e.clientX, e.clientY))
          else if (!t.closest('input, textarea, button, a')) { const c = cards.find(x => x.id === cardEl.dataset.card); if (c && editing !== c.id) openCard(c) }
        }}
        onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
        onDrop={e => {
          const files = [...e.dataTransfer.files]
          if (!files.length) return
          e.preventDefault()
          addFiles(files, toWorld(e.clientX, e.clientY))
        }}
      >
        <p id="board-help" className="sr-only">
          Картыг сумаар зөөнө, Enter товчоор засна, Delete товчоор устгана. Ctrl Z товчоор буцаана. Шинэ зүйлийг доорх хэрэгслээр нэмнэ.
        </p>
        <div className="board__origin" ref={origin}>
          <div className="board__world" ref={world}>
            {cards.map(c => (
              <Card key={c.id} c={c} selected={sel === c.id} editing={editing === c.id} edit={edit} warn={setProblem}
                onSelect={() => setSel(c.id)} onFinish={finish}
                onToggle={item => patchCard(d.id, c.id, { items: c.items?.map(i => (i.id === item ? { ...i, done: !i.done } : i)) })}
                onAddItem={() => { setSel(c.id); setEditing(c.id) }} />
            ))}
          </div>
        </div>
        {!cards.length && (
          <div className="board__hint">
            <StickyNote className="ico" />
            <p className="board__hint-title">Хоосон самбар</p>
            <p>Доорх товчоор тэмдэглэл, жагсаалт, зураг нэмнэ үү. Хоосон газар хоёр товшиж ч нэмж болно.</p>
          </div>
        )}
      </section>

      {selected && (
        <SelDock label={`${KIND[selected.kind]}: үйлдэл`}>
          {EDITABLE.includes(selected.kind) && <DockBtn icon={Pencil} label="Засах" onClick={() => openCard(selected)} />}
          {(isPdf(selected) || selected.kind === 'image') && selected.file && <DockBtn icon={Eye} label="Харах" onClick={() => open({ kind: 'file', file: selected.file! })} />}
          {isPdf(selected) && <DockBtn icon={Pencil} label="PDF засах" onClick={() => openCard(selected)} />}
          {selected.kind === 'file' && <DockBtn icon={Download} label="Татах" onClick={() => download(selected)} />}
          {COLOURED.includes(selected.kind) && (
            <div className="dock__colors" role="group" aria-label="Цаасны өнгө">
              {PAPER.map(([hue, label]) => (
                <button key={label} type="button" className={`swatch bpaper${hue ? ` hue--${hue}` : ''}`} aria-label={label} aria-pressed={selected.hue === hue}
                  onClick={() => patchCard(d.id, selected.id, { hue })} />
              ))}
            </div>
          )}
          <DockBtn icon={Copy} label="Хувилах" onClick={() => duplicate(selected)} />
          <DockBtn icon={Trash2} label="Устгах" onClick={() => remove(selected.id)} />
        </SelDock>
      )}

      <div className="dock glass" ref={dock} role="toolbar" aria-label="Самбарт нэмэх" data-enter>
        {ADD.map(([kind, Icon, label]) => (
          <DockBtn key={kind} icon={Icon} label={label} onClick={() => (kind === 'image' ? pickImage.current?.click() : kind === 'file' ? pickFile.current?.click() : add(kind))} />
        ))}
        <input ref={pickImage} type="file" accept="image/*" multiple hidden onChange={e => { addFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
        <input ref={pickFile} type="file" multiple hidden onChange={e => { addFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
      </div>

      <div className="bview glass" role="toolbar" aria-label="Харагдац" data-enter>
        <button type="button" className="ibtn ibtn--sm" aria-label="Буцаах" title="Буцаах (Ctrl Z)" disabled={!h.past.length} onClick={() => { travel(d.id, true); setEditing(null) }}><Undo2 className="ico" /></button>
        <button type="button" className="ibtn ibtn--sm bview__more" aria-label="Дахин хийх" title="Дахин хийх (Ctrl Shift Z)" disabled={!h.future.length} onClick={() => travel(d.id, false)}><Redo2 className="ico" /></button>
        <span className="bview__sep bview__more" aria-hidden="true" />
        <button type="button" className="ibtn ibtn--sm bview__more" aria-label="Жижигрүүлэх" onClick={() => zoomBy(1 / 1.25)}><Minus className="ico" /></button>
        <button type="button" className="bview__z bview__more tnum" aria-label={`Одоо ${Math.round(zoom * 100)}%. 100% болгох`} onClick={() => zoomBy(1 / view.current.z)}>{Math.round(zoom * 100)}%</button>
        <button type="button" className="ibtn ibtn--sm bview__more" aria-label="Томруулах" onClick={() => zoomBy(1.25)}><Plus className="ico" /></button>
        <button type="button" className="ibtn ibtn--sm" aria-label="Бүгдийг харах" title="Бүгдийг харах" onClick={() => fit()}><Maximize className="ico" /></button>
      </div>
    </div>
  )
}

/** What can be done with the chosen card: a bar that rises above the tools */
function SelDock({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { if (ref.current) enter([ref.current], { opacity: 0, transform: 'translateY(8px) scale(.98)' }, { duration: 0.3, ease: 'power3.out' }) }, [])
  return <div ref={ref} className="dock dock--sel glass" role="toolbar" aria-label={label}>{children}</div>
}

function DockBtn({ icon: Icon, label, onClick }: { icon: typeof StickyNote; label: string; onClick: () => void }) {
  return (
    <button type="button" className="dock__btn" onClick={onClick}>
      <Icon className="ico" />
      <span>{label}</span>
    </button>
  )
}

function Card({ c, selected, editing, edit, warn, onSelect, onFinish, onToggle, onAddItem }: {
  c: DraftCard
  selected: boolean
  editing: boolean
  edit: RefObject<Edit | null>
  warn: (problem: string) => void
  onSelect: () => void
  onFinish: (refocus: boolean) => void
  onToggle: (item: string) => void
  onAddItem: () => void
}) {
  const paper = c.kind !== 'title'
  const style = { left: c.x, top: c.y, width: c.w, minHeight: c.kind === 'image' ? undefined : c.h, '--tilt': `${c.tilt}deg` } as CSSProperties
  // Leaving the card while editing saves it; Esc saves and stays on the card
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onFinish(true) }
  }
  let body: ReactNode
  if (editing) {
    if (c.kind === 'todo') body = <TodoEdit c={c} edit={edit} />
    else if (c.kind === 'link') body = <LinkEdit c={c} edit={edit} warn={warn} onDone={() => onFinish(true)} />
    else body = <TextEdit c={c} edit={edit} onDone={() => onFinish(true)} />
  } else if (c.kind === 'note') body = <p className="dnote">{c.text}</p>
  else if (c.kind === 'title') body = <h2 className="dtitle">{c.text}</h2>
  else if (c.kind === 'todo') body = <Todo c={c} selected={selected} onToggle={onToggle} onAdd={onAddItem} />
  else if (c.kind === 'image') body = <Picture c={c} />
  else if (c.kind === 'link') body = <LinkView c={c} />
  else body = <FileView c={c} />

  return (
    <div
      data-card={c.id}
      className={`bcard bcard--${c.kind}${paper ? ' bpaper' : ''}${c.hue && paper ? ` hue--${c.hue}` : ''}${selected ? ' is-sel' : ''}${editing ? ' is-edit' : ''}`}
      style={style}
      role="group"
      aria-roledescription={KIND[c.kind]}
      aria-label={cardSummary(c) || KIND[c.kind]}
      tabIndex={0}
      onFocus={onSelect}
      onKeyDown={editing ? keys : undefined}
      onBlur={e => { if (editing && !e.currentTarget.contains(e.relatedTarget as Node | null)) onFinish(false) }}
    >
      {body}
      {selected && !editing && <span className="bcard__resize" data-resize aria-hidden="true" />}
    </div>
  )
}

/** Grows with its text, so the card never scrolls inside */
function grow(t: HTMLTextAreaElement) {
  t.style.height = '0'
  t.style.height = `${t.scrollHeight}px`
}

function TextEdit({ c, edit, onDone }: { c: DraftCard; edit: RefObject<Edit | null>; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const t = ref.current!
    t.focus({ preventScroll: true })
    t.setSelectionRange(t.value.length, t.value.length)
    grow(t)
    edit.current = () => ({ text: t.value.trim() ? t.value.replace(/\s+$/, '') : '' })
  }, [edit])
  const label = c.kind === 'title' ? 'Гарчиг' : c.kind === 'image' ? 'Зургийн тайлбар' : 'Тэмдэглэл'
  return (
    <>
      {c.kind === 'image' && <Picture c={c} />}
      <textarea
        ref={ref}
        className={`dedit dedit--${c.kind}`}
        defaultValue={c.text}
        aria-label={label}
        placeholder={c.kind === 'title' ? 'Гарчиг' : c.kind === 'image' ? 'Тайлбар (заавал биш)' : 'Энд бичнэ үү'}
        rows={1}
        onInput={e => grow(e.currentTarget)}
        // A title or a caption is one line: Enter finishes. In a note Enter starts a new line, Ctrl+Enter finishes.
        onKeyDown={e => { if (e.key === 'Enter' && (c.kind !== 'note' ? !e.shiftKey : e.ctrlKey || e.metaKey)) { e.preventDefault(); onDone() } }}
      />
    </>
  )
}

function Todo({ c, selected, onToggle, onAdd }: { c: DraftCard; selected: boolean; onToggle: (item: string) => void; onAdd: () => void }) {
  const items = c.items ?? []
  const done = items.filter(i => i.done).length
  return (
    <div className="dtodo">
      <h3 className="dtodo__head">
        <span>{c.text || KIND.todo}</span>
        {items.length > 0 && <small className="tnum">{done}/{items.length}</small>}
      </h3>
      {items.length > 0 && (
        <ul className="dtodo__list">
          {items.map(it => (
            <li key={it.id} className={`dtodo__item${it.done ? ' is-done' : ''}`}>
              <input type="checkbox" checked={it.done} aria-labelledby={`${it.id}-t`} onChange={() => onToggle(it.id)} />
              <span id={`${it.id}-t`}>{it.title}</span>
            </li>
          ))}
        </ul>
      )}
      {(selected || !items.length) && <button type="button" className="dtodo__add" onClick={onAdd}><Plus className="ico" />Мөр нэмэх</button>}
    </div>
  )
}

function TodoEdit({ c, edit }: { c: DraftCard; edit: RefObject<Edit | null> }) {
  const [title, setTitle] = useState(c.text ?? '')
  const [items, setItems] = useState(() => (c.items?.length || c.text ? [...(c.items ?? []), { id: cid(), title: '', done: false }] : [{ id: cid(), title: '', done: false }]))
  const [focus, setFocus] = useState<string | null>(() => (c.text ? items[items.length - 1].id : null))
  const list = useRef<HTMLUListElement>(null)
  edit.current = () => ({ text: title.trim(), items: items.filter(i => i.title.trim()).map(i => ({ ...i, title: i.title.trim() })) })
  useLayoutEffect(() => {
    if (focus) list.current?.querySelector<HTMLInputElement>(`[data-item="${focus}"]`)?.focus({ preventScroll: true })
  }, [focus])
  const set = (id: string, p: Partial<(typeof items)[number]>) => setItems(xs => xs.map(x => (x.id === id ? { ...x, ...p } : x)))
  const insertAfter = (i: number) => {
    const n = { id: cid(), title: '', done: false }
    setItems(xs => [...xs.slice(0, i + 1), n, ...xs.slice(i + 1)])
    setFocus(n.id)
  }
  const drop = (i: number) => {
    setItems(xs => xs.filter((_, j) => j !== i))
    setFocus(items[i - 1]?.id ?? items[i + 1]?.id ?? null)
  }
  return (
    <div className="dtodo">
      <input className="dedit dedit--todo" value={title} placeholder="Жагсаалтын нэр" aria-label="Жагсаалтын нэр" autoFocus={!focus}
        onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (items.length) setFocus(items[0].id); else insertAfter(-1) } }} />
      <ul className="dtodo__list" ref={list}>
        {items.map((it, i) => (
          <li key={it.id} className="dtodo__item is-edit">
            <input type="checkbox" checked={it.done} aria-label="Хийсэн" onChange={() => set(it.id, { done: !it.done })} />
            <input data-item={it.id} className="dedit dedit--item" value={it.title} placeholder="Хийх зүйл" aria-label={`${i + 1}-р мөр`}
              onChange={e => set(it.id, { title: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); insertAfter(i) }
                if (e.key === 'Backspace' && !it.title && items.length > 1) { e.preventDefault(); drop(i) }
              }} />
            <button type="button" className="ibtn ibtn--sm dtodo__x" aria-label={`${i + 1}-р мөрийг хасах`} onClick={() => drop(i)}><X className="ico" /></button>
          </li>
        ))}
      </ul>
      <button type="button" className="dtodo__add" onClick={() => insertAfter(items.length - 1)}><Plus className="ico" />Мөр нэмэх</button>
    </div>
  )
}

function Picture({ c }: { c: DraftCard }) {
  const url = useFileUrl(c.file!.id)
  const ratio = `${c.w - 16} / ${Math.max(1, c.h - 16)}`
  return (
    <figure className="dpic">
      {url ? <img src={url} alt={c.text || c.file!.name} draggable={false} style={{ aspectRatio: ratio }} />
        : <span className="dpic__none" style={{ aspectRatio: ratio }}>{url === null ? 'Зураг олдсонгүй' : ''}</span>}
      {c.text && <figcaption>{c.text}</figcaption>}
    </figure>
  )
}

function LinkView({ c }: { c: DraftCard }) {
  const site = c.url ? host(c.url) : ''
  return (
    <div className="dlink">
      <span className="dlink__ico" aria-hidden="true"><Link2 className="ico" /></span>
      <span className="dlink__text">
        <b>{c.text || site}</b>
        {c.text && <small>{site}</small>}
      </span>
      {c.url && (
        <a className="ibtn ibtn--sm dlink__go" href={c.url} target="_blank" rel="noopener noreferrer" aria-label={`${c.text || site} шинэ цонхонд нээх`} title="Нээх">
          <ExternalLink className="ico" />
        </a>
      )}
    </div>
  )
}

function LinkEdit({ c, edit, warn, onDone }: { c: DraftCard; edit: RefObject<Edit | null>; warn: (problem: string) => void; onDone: () => void }) {
  const url = useRef<HTMLInputElement>(null)
  const text = useRef<HTMLInputElement>(null)
  const [bad, setBad] = useState(false)
  edit.current = () => {
    const typed = url.current!.value.trim()
    const ok = safeUrl(typed)
    if (typed && !ok) warn('Холбоосын хаяг буруу тул өмнөх хаяг хэвээр үлдлээ.')
    return { url: typed ? ok ?? c.url : undefined, text: text.current!.value.trim() || undefined }
  }
  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (url.current!.value.trim() && !safeUrl(url.current!.value)) return setBad(true)
    onDone()
  }
  return (
    <div className="dlink-edit">
      <label className="dfield">
        <span>Хаяг</span>
        <input ref={url} className="dedit dedit--field" defaultValue={c.url} placeholder="erp.mn" inputMode="url" autoComplete="off" autoFocus
          aria-invalid={bad || undefined} aria-describedby={bad ? `${c.id}-bad` : undefined} onKeyDown={onEnter} onInput={() => setBad(false)} />
      </label>
      {bad && <p className="field__error" id={`${c.id}-bad`}>Хаягаа шалгана уу. Жишээ нь: erp.mn</p>}
      <label className="dfield">
        <span>Нэр (заавал биш)</span>
        <input ref={text} className="dedit dedit--field" defaultValue={c.text} autoComplete="off" onKeyDown={onEnter} />
      </label>
    </div>
  )
}

function FileView({ c }: { c: DraftCard }) {
  const f = c.file!
  const pdf = isPdf(c)
  return (
    <div className="dfile">
      <span className={`dfile__ico${pdf ? ' is-pdf' : ''}`} aria-hidden="true">{pdf ? 'PDF' : <FileIcon className="ico" />}</span>
      <span className="dfile__text">
        <b>{f.name}</b>
        <small>{fileSize(f.size)}{f.pages ? `, ${f.pages} хуудас` : ''}</small>
      </span>
    </div>
  )
}
