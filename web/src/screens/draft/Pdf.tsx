// PDF tool: join files, turn, reorder and delete pages, sign, then save to the device or onto a board.
// Everything happens in the browser (lib/pdf.ts): the file never leaves the device.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { ArrowLeft, ArrowRight, Download, FilePlus2, FileUp, RotateCw, Signature, StickyNote, Trash2, X } from 'lucide-react'
import type { Draft } from '../../lib/types'
import { actions, useApp } from '../../lib/store'
import { go } from '../../lib/router'
import { flip, usePageEnter } from '../../lib/motion'
import { cid, newCard } from '../../lib/draft'
import { getFile, putFile, saveBlob } from '../../lib/files'
import { OpenError, buildPdf, drawPage, openPdf, type Page, type Sign, type Source } from '../../lib/pdf'
import { toast } from '../../lib/ui'
import { PageHead } from '../../ui/PageHead'
import { Sheet, useCloseSheet } from '../../ui/Sheet'
import { Menu, MenuItem, usePopover } from '../../ui/Popover'
import { DraftNav } from '../Draft'
import { forget } from './Board'

const THUMB = 360
const INK = '#1d2b6e'
/** The signature drawn on this visit, offered again for the next page */
let lastInk: { png: string; ratio: number } | null = null

// While a page is dragged with a finger, the page must not scroll
let touchDragging = false
document.addEventListener('touchmove', e => { if (touchDragging && e.cancelable) e.preventDefault() }, { passive: false })

const isPdfFile = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
const base = (name: string) => name.replace(/\.pdf$/i, '')
/** The page as it is shown now: its own rotation plus the user's turns */
const shown = (p: Page) => ((p.rot + p.turn) % 180 ? { w: p.h, h: p.w } : { w: p.w, h: p.h })

export default function Pdf({ from }: { from?: string }) {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const sources = useRef(new Map<string, Source>())
  const [pages, setPages] = useState<Page[]>([])
  const pagesRef = useRef(pages)
  pagesRef.current = pages
  const [thumbs, setThumbs] = useState(new Map<string, string>())
  const thumbsRef = useRef(thumbs)
  const [sel, setSel] = useState(new Set<string>())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signing, setSigning] = useState<string | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const pick = useRef<HTMLInputElement>(null)
  const savePop = usePopover()

  // Opened from a file on a board: #draft-pdf-<board>-<card>
  const [boardId, cardId] = from?.split('-') ?? []
  const board = s.drafts.find(d => d.id === boardId && d.company === s.company && d.owner === s.me)
  const card = board?.cards.find(c => c.id === cardId && c.file)
  const mine = s.drafts.filter(d => d.company === s.company && d.owner === s.me).sort((a, b) => b.updated.localeCompare(a.updated))
  const onBoards = mine.flatMap(d => d.cards.filter(c => c.kind === 'file' && c.file && (c.file.type === 'application/pdf' || /\.pdf$/i.test(c.file.name))).map(c => ({ d, c })))
  const first = sources.current.get(pages[0]?.src ?? '')
  const fileName = `${base(card?.file?.name ?? first?.name ?? 'баримт')}.pdf`

  const open = async (files: { blob: Blob; name: string }[]) => {
    setError(null)
    setBusy('Файлыг уншиж байна…')
    const added: Page[] = []
    for (const f of files) {
      try {
        const id = cid()
        const r = await openPdf(f.blob, f.name, id)
        sources.current.set(id, r.src)
        added.push(...r.pages)
      } catch (e) {
        setError(e instanceof OpenError ? e.message : `${f.name} файлыг нээж чадсангүй.`)
      }
    }
    setBusy(null)
    if (added.length) setPages(ps => [...ps, ...added])
  }
  const openFiles = (list: FileList | File[]) => {
    const files = [...list]
    const pdfs = files.filter(isPdfFile)
    if (pdfs.length < files.length) setError('Зөвхөн PDF файл нээх боломжтой.')
    if (pdfs.length) open(pdfs.map(f => ({ blob: f, name: f.name })))
  }

  // The file of the board card
  useEffect(() => {
    if (!card?.file) return
    let live = true
    getFile(card.file.id)
      .then(b => { if (live) b ? open([{ blob: b, name: card.file!.name }]) : setError('Файл олдсонгүй. Өөр төхөөрөмж эсвэл хөтөч дээр нэмсэн байж магадгүй.') })
      .catch(() => live && setError('Файлыг уншиж чадсангүй.'))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Page pictures, drawn one at a time in page order
  const alive = useRef(true)
  const running = useRef(false)
  const pump = useCallback(async () => {
    if (running.current) return
    running.current = true
    for (;;) {
      const p = pagesRef.current.find(x => !thumbsRef.current.has(x.key))
      const src = p && sources.current.get(p.src)
      if (!alive.current || !p || !src) break
      let url = ''
      try {
        const canvas = await drawPage(src, p.index, THUMB)
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.85))
        if (blob) url = URL.createObjectURL(blob)
      } catch { /* stays a grey page */ }
      thumbsRef.current = new Map(thumbsRef.current).set(p.key, url)
      if (alive.current) setThumbs(thumbsRef.current)
    }
    running.current = false
  }, [])
  useEffect(() => { pump() }, [pages, pump])
  useEffect(() => () => {
    alive.current = false
    thumbsRef.current.forEach(u => u && URL.revokeObjectURL(u))
    sources.current.forEach(src => src.view.loadingTask.destroy())
  }, [])

  // Page actions
  const turn = (keys: Set<string>) => setPages(ps => ps.map(p => (keys.has(p.key) ? { ...p, turn: (p.turn + 90) % 360 } : p)))
  const remove = (keys: Set<string>) => {
    const before = pages
    setPages(ps => ps.filter(p => !keys.has(p.key)))
    setSel(new Set([...sel].filter(k => !keys.has(k))))
    toast(keys.size === 1 ? 'Хуудас устгагдлаа.' : `${keys.size} хуудас устгагдлаа.`, { undo: () => setPages(before) })
  }
  /** Moves the chosen pages one place earlier or later, keeping them in their order */
  const shift = (dir: -1 | 1) => {
    const done = flip('.ppage')
    setPages(ps => {
      const xs = [...ps]
      const order = dir < 0 ? xs.keys() : [...xs.keys()].reverse()
      for (const i of order) {
        const j = i + dir
        if (sel.has(xs[i].key) && j >= 0 && j < xs.length && !sel.has(xs[j].key)) [xs[i], xs[j]] = [xs[j], xs[i]]
      }
      return xs
    })
    requestAnimationFrame(done)
  }
  const toggle = (key: string) => setSel(x => { const n = new Set(x); if (!n.delete(key)) n.add(key); return n })

  // Saving
  const build = async (list: Page[]) => {
    setError(null)
    setBusy('Файлыг бэлтгэж байна…')
    try {
      const bytes = await buildPdf(list, sources.current)
      return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
    } catch {
      setError('Файлыг бэлтгэж чадсангүй. Дахин оролдоно уу.')
      return null
    } finally {
      setBusy(null)
    }
  }
  const download = async (only?: Set<string>) => {
    savePop.close()
    const list = only ? pages.filter(p => only.has(p.key)) : pages
    const blob = await build(list)
    if (blob) saveBlob(only ? `${base(fileName)} (${list.length} хуудас).pdf` : fileName, blob)
  }
  const toBoard = async (d: Draft) => {
    savePop.close()
    const blob = await build(pages)
    if (!blob) return
    const file = { id: `f${cid()}`, name: fileName, type: 'application/pdf', size: blob.size, pages: pages.length }
    try {
      await putFile(file.id, blob)
    } catch {
      return setError('Энэ хөтөч файл хадгалах боломжгүй байна.')
    }
    if (card && d.id === board?.id) {
      actions.updateDraft(d.id, { cards: d.cards.map(c => (c.id === card.id ? { ...c, file } : c)) })
    } else {
      // A new card to the right of what is already on the board
      const right = d.cards.length ? Math.max(...d.cards.map(c => c.x + c.w)) + 40 : 40
      const top = d.cards.length ? Math.min(...d.cards.map(c => c.y)) : 40
      actions.updateDraft(d.id, { cards: [...d.cards, newCard('file', right, top, { file })] })
    }
    forget(d.id)
    toast(`Файл ${d.name} самбарт хадгалагдлаа.`)
  }

  // Drag a page to a new place. With a finger, hold it a moment first, so that a swipe still scrolls.
  const startDrag = (e: RPointerEvent<HTMLElement>, key: string) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || (e.target as Element).closest('button, input, label')) return
    const el = e.currentTarget.closest<HTMLElement>('.ppage')!
    const r = el.getBoundingClientRect()
    const touch = e.pointerType === 'touch'
    const p = { x: e.clientX, y: e.clientY }
    const off = { x: e.clientX - r.left, y: e.clientY - r.top }
    let started = false
    let timer = 0
    const place = () => { if (ghost.current) ghost.current.style.transform = `translate(${p.x - off.x}px, ${p.y - off.y}px)` }
    const begin = () => {
      started = true
      touchDragging = touch
      setDragKey(key)
      requestAnimationFrame(() => {
        if (!ghost.current) return
        ghost.current.style.width = `${r.width}px`
        place()
      })
    }
    const move = (ev: PointerEvent) => {
      p.x = ev.clientX
      p.y = ev.clientY
      if (!started) {
        const far = Math.hypot(p.x - e.clientX, p.y - e.clientY) > 6
        if (far) { if (touch) end(); else begin() }
        return
      }
      place()
      const over = document.elementFromPoint(p.x, p.y)?.closest<HTMLElement>('[data-page]')
      if (!over || over.dataset.page === key) return
      const to = pagesRef.current.findIndex(x => x.key === over.dataset.page)
      const done = flip([...document.querySelectorAll('.ppage')].filter(x => x !== el))
      setPages(ps => {
        const from = ps.findIndex(x => x.key === key)
        const xs = [...ps]
        const [moved] = xs.splice(from, 1)
        xs.splice(to, 0, moved)
        return xs
      })
      requestAnimationFrame(done)
    }
    const end = () => {
      clearTimeout(timer)
      touchDragging = false
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', end)
      removeEventListener('pointercancel', end)
      if (!started) return
      // The click that ends a drag must not tick the page
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
      addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => removeEventListener('click', swallow, { capture: true }), 0)
      setDragKey(null)
    }
    if (touch) timer = window.setTimeout(begin, 300)
    addEventListener('pointermove', move)
    addEventListener('pointerup', end)
    addEventListener('pointercancel', end)
  }

  const onDrop = (e: DragEvent) => {
    if (!e.dataTransfer.files.length) return
    e.preventDefault()
    openFiles(e.dataTransfer.files)
  }
  const signPage = pages.find(p => p.key === signing)
  const dragged = pages.find(p => p.key === dragKey)
  const many = sources.current.size > 1

  return (
    <div ref={ref} className="pdf" onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }} onDrop={onDrop}>
      <DraftNav at="pdf" />
      <PageHead
        title="PDF засах"
        sub={card && board ? `${card.file!.name}, ${board.name} самбараас` : 'Файл нэгтгэх, хуудас эргүүлэх, зөөх, устгах, гарын үсэг зурах. Файл төхөөрөмжөөс гарахгүй.'}
        actions={pages.length > 0 && (
          <>
            {card && board && <a className="btn btn--glass" href={`#draft-${board.id}`}><ArrowLeft className="ico" />Самбар руу буцах</a>}
            <button type="button" className="btn btn--glass" onClick={() => pick.current?.click()}><FilePlus2 className="ico" />Файл нэмэх</button>
            <button ref={savePop.anchor} type="button" className="btn btn--accent" aria-haspopup="menu" aria-expanded={savePop.open} onClick={savePop.toggle} disabled={!!busy}>
              <Download className="ico" />Хадгалах
            </button>
            <Menu state={savePop} label="Хадгалах">
              <MenuItem icon={<Download className="ico" />} onSelect={() => download()}>Төхөөрөмж рүү татах</MenuItem>
              {(card && board ? [board] : mine.slice(0, 4)).map(d => (
                <MenuItem key={d.id} icon={<StickyNote className="ico" />} onSelect={() => toBoard(d)}>{d.name} самбарт хадгалах</MenuItem>
              ))}
            </Menu>
          </>
        )}
      />
      <input ref={pick} type="file" accept="application/pdf,.pdf" multiple hidden onChange={e => { openFiles(e.target.files ?? []); e.target.value = '' }} />

      {error && (
        <div className="pnote pnote--bad" role="alert" data-enter>
          <p>{error}</p>
          <button type="button" className="ibtn ibtn--sm" aria-label="Мэдэгдлийг хаах" onClick={() => setError(null)}><X className="ico" /></button>
        </div>
      )}
      {busy && <p className="pnote" role="status">{busy}</p>}

      {pages.length === 0 ? (
        !busy && (
          <>
            <div className="pdrop card glass" data-enter>
              <FileUp className="ico" />
              <p className="pdrop__title">PDF файлаа энд чирж тавина уу</p>
              <p className="pdrop__text">Хэд хэдэн файл сонговол нэг файл болгон нэгтгэнэ.</p>
              <button type="button" className="btn btn--accent" onClick={() => pick.current?.click()}>Файл сонгох</button>
            </div>
            {onBoards.length > 0 && (
              <section className="boards" aria-labelledby="pdf-on-boards" data-enter>
                <h2 className="boards__h" id="pdf-on-boards">Самбар дээрх PDF</h2>
                <ul className="pfiles card glass">
                  {onBoards.map(({ d, c }) => (
                    <li key={c.id}>
                      <a href={`#draft-pdf-${d.id}-${c.id}`} className="pfiles__row" onClick={e => { e.preventDefault(); go('draft', `pdf-${d.id}-${c.id}`) }}>
                        <span className="dfile__ico is-pdf" aria-hidden="true">PDF</span>
                        <span className="pfiles__text"><b>{c.file!.name}</b><small>{d.name}</small></span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )
      ) : (
        <>
          <div className="pbar" data-enter>
            <p className="pbar__count" aria-live="polite">{sel.size ? `${pages.length} хуудаснаас ${sel.size} нь сонгогдсон` : `${pages.length} хуудас`}</p>
            {sel.size > 0 ? (
              <div className="pbar__tools" role="toolbar" aria-label="Сонгосон хуудас">
                <button type="button" className="btn btn--glass btn--sm" onClick={() => turn(sel)}><RotateCw className="ico" />Эргүүлэх</button>
                <button type="button" className="btn btn--glass btn--sm" onClick={() => shift(-1)}><ArrowLeft className="ico" />Урагш зөөх</button>
                <button type="button" className="btn btn--glass btn--sm" onClick={() => shift(1)}><ArrowRight className="ico" />Хойш зөөх</button>
                <button type="button" className="btn btn--glass btn--sm" onClick={() => download(sel)}><Download className="ico" />Тусад нь татах</button>
                <button type="button" className="btn btn--glass btn--sm" onClick={() => remove(sel)}><Trash2 className="ico" />Устгах</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSel(new Set())}>Сонголт арилгах</button>
              </div>
            ) : (
              <p className="pbar__hint">Хуудсыг чирж байрыг нь солино. Олон хуудсыг сонгоод хамтад нь эргүүлж, зөөж болно.</p>
            )}
          </div>
          <ol className="pdf-grid" aria-label="Хуудас">
            {pages.map((p, i) => (
              <PageTile key={p.key} p={p} n={i + 1} thumb={thumbs.get(p.key)} selected={sel.has(p.key)} away={p.key === dragKey}
                from={many ? sources.current.get(p.src)?.name : undefined}
                onToggle={() => toggle(p.key)} onTurn={() => turn(new Set([p.key]))} onSign={() => setSigning(p.key)} onRemove={() => remove(new Set([p.key]))}
                onDrag={e => startDrag(e, p.key)} />
            ))}
          </ol>
        </>
      )}

      {dragged && (
        <div className="pghost" ref={ghost} aria-hidden="true">
          <div className="ppage__sheet"><Sheetlet p={dragged} thumb={thumbs.get(dragged.key)} /></div>
        </div>
      )}
      {signPage && sources.current.get(signPage.src) && (
        <SignSheet page={signPage} src={sources.current.get(signPage.src)!} onClose={() => setSigning(null)}
          onSave={sign => setPages(ps => ps.map(p => (p.key === signPage.key ? { ...p, sign } : p)))} />
      )}
    </div>
  )
}

function PageTile({ p, n, thumb, selected, away, from, onToggle, onTurn, onSign, onRemove, onDrag }: {
  p: Page; n: number; thumb?: string; selected: boolean; away: boolean; from?: string
  onToggle: () => void; onTurn: () => void; onSign: () => void; onRemove: () => void; onDrag: (e: RPointerEvent<HTMLElement>) => void
}) {
  return (
    <li className={`ppage${selected ? ' is-sel' : ''}${away ? ' is-away' : ''}`} data-page={p.key}>
      <div className="ppage__sheet" onPointerDown={onDrag} onClick={onToggle}>
        <Sheetlet p={p} thumb={thumb} />
      </div>
      <div className="ppage__foot">
        <label className="ppage__pick">
          <input type="checkbox" checked={selected} onChange={onToggle} />
          <span className="tnum">{n}<span className="sr-only">-р хуудсыг сонгох</span></span>
        </label>
        <button type="button" className="ibtn ibtn--sm" aria-label={`${n}-р хуудсыг эргүүлэх`} title="Эргүүлэх" onClick={onTurn}><RotateCw className="ico" /></button>
        <button type="button" className="ibtn ibtn--sm" aria-label={`${n}-р хуудсанд гарын үсэг зурах`} title="Гарын үсэг" onClick={onSign}><Signature className="ico" /></button>
        <button type="button" className="ibtn ibtn--sm" aria-label={`${n}-р хуудсыг устгах`} title="Устгах" onClick={onRemove}><Trash2 className="ico" /></button>
      </div>
      {from && <small className="ppage__from">{from}</small>}
    </li>
  )
}

/** A page picture, turned as the user turned it, with its signature */
function Sheetlet({ p, thumb }: { p: Page; thumb?: string }) {
  const d = shown(p)
  const fit: CSSProperties = { aspectRatio: `${d.w} / ${d.h}`, ...(d.w >= d.h ? { width: '100%' } : { height: '100%' }) }
  const ink = p.sign && (p.turn - p.sign.turn + 360) % 360
  return (
    <div className="ppage__fit" style={fit}>
      <div className={`player${p.turn % 180 ? ' is-side' : ''}`} style={{ rotate: `${p.turn}deg` }}>
        {thumb ? <img src={thumb} alt="" draggable={false} /> : <span className="player__wait" />}
      </div>
      {p.sign && (
        <div className={`player${ink! % 180 ? ' is-side' : ''}`} style={{ rotate: `${ink}deg` }}>
          <img className="player__ink" src={p.sign.png} alt="Гарын үсэг" draggable={false}
            style={{ left: `${p.sign.x * 100}%`, top: `${p.sign.y * 100}%`, width: `${p.sign.w * 100}%` }} />
        </div>
      )}
    </div>
  )
}

function SignSheet({ page, src, onSave, onClose }: { page: Page; src: Source; onSave: (s: Sign | undefined) => void; onClose: () => void }) {
  const [ink, setInk] = useState(lastInk)
  const [drawing, setDrawing] = useState(!lastInk)
  return (
    <Sheet label="Гарын үсэг" onClose={onClose} wide>
      <h2 className="sheet__title">Гарын үсэг</h2>
      {drawing || !ink
        ? <Pad onDone={i => { lastInk = i; setInk(i); setDrawing(false) }} />
        : <Place page={page} src={src} ink={ink} onSave={onSave} onRedraw={() => setDrawing(true)} />}
    </Sheet>
  )
}

/** Draw with a mouse or a finger, or type a name */
function Pad({ onDone }: { onDone: (ink: { png: string; ratio: number }) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [name, setName] = useState('')
  const [empty, setEmpty] = useState(false)
  const box = useRef({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity })
  const last = useRef<{ x: number; y: number } | null>(null)
  // At least twice the screen pixels, so the signature stays sharp on paper
  const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1))

  const ctx = () => canvas.current!.getContext('2d')!
  // The window opens after this mounts, so the canvas gets its pixel size once it has a size on screen
  useLayoutEffect(() => {
    const c = canvas.current!
    const ro = new ResizeObserver(() => {
      const w = Math.round(c.clientWidth * dpr)
      const h = Math.round(c.clientHeight * dpr)
      if (w && h && (w !== c.width || h !== c.height)) { c.width = w; c.height = h; box.current = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity } }
    })
    ro.observe(c)
    return () => ro.disconnect()
  }, [dpr])
  const clear = () => {
    ctx().clearRect(0, 0, canvas.current!.width, canvas.current!.height)
    box.current = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  }
  const at = (e: RPointerEvent<HTMLCanvasElement>) => {
    const r = canvas.current!.getBoundingClientRect()
    const p = { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }
    const b = box.current
    const m = 3 * dpr
    box.current = { x0: Math.min(b.x0, p.x - m), y0: Math.min(b.y0, p.y - m), x1: Math.max(b.x1, p.x + m), y1: Math.max(b.y1, p.y + m) }
    return p
  }
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const c = ctx()
    c.strokeStyle = INK
    c.lineWidth = 2.6 * dpr
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.beginPath()
    c.moveTo(a.x, a.y)
    c.lineTo(b.x, b.y)
    c.stroke()
  }
  const typed = (text: string) => {
    setName(text)
    clear()
    if (!text.trim()) return
    const c = ctx()
    const w = canvas.current!.width
    const h = canvas.current!.height
    let size = 64 * dpr
    c.font = `italic 600 ${size}px "Golos Text Variable", "Golos Text", sans-serif`
    const tw = c.measureText(text).width
    if (tw > w * 0.9) { size *= (w * 0.9) / tw; c.font = `italic 600 ${size}px "Golos Text Variable", "Golos Text", sans-serif` }
    c.fillStyle = INK
    c.textBaseline = 'middle'
    const x = (w - Math.min(tw, w * 0.9)) / 2
    c.fillText(text, x, h / 2)
    box.current = { x0: x - 8 * dpr, y0: h / 2 - size * 0.75, x1: x + Math.min(tw, w * 0.9) + 8 * dpr, y1: h / 2 + size * 0.75 }
  }
  const done = () => {
    const b = box.current
    const c = canvas.current!
    if (!Number.isFinite(b.x0)) return setEmpty(true)
    const x0 = Math.max(0, Math.floor(b.x0))
    const y0 = Math.max(0, Math.floor(b.y0))
    const w = Math.min(c.width, Math.ceil(b.x1)) - x0
    const h = Math.min(c.height, Math.ceil(b.y1)) - y0
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    out.getContext('2d')!.drawImage(c, x0, y0, w, h, 0, 0, w, h)
    onDone({ png: out.toDataURL('image/png'), ratio: h / w })
  }
  return (
    <div className="spad">
      <p className="muted">Хулгана эсвэл хуруугаараа доорх талбарт гарын үсгээ зурна уу.</p>
      <canvas
        ref={canvas}
        className="spad__canvas"
        aria-label="Гарын үсэг зурах талбар"
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); if (name) typed(''); setEmpty(false); last.current = at(e); line(last.current, last.current) }}
        onPointerMove={e => { if (!last.current) return; const p = at(e); line(last.current, p); last.current = p }}
        onPointerUp={() => { last.current = null }}
        onPointerCancel={() => { last.current = null }}
      />
      <label className="field">
        <span className="field__label">Эсвэл нэрээ бичнэ үү</span>
        <input value={name} onChange={e => { setEmpty(false); typed(e.target.value) }} autoComplete="name" />
      </label>
      {empty && <p className="field__error" role="alert">Эхлээд гарын үсгээ зурна уу, эсвэл нэрээ бичнэ үү.</p>}
      <div className="spad__actions">
        <button type="button" className="btn btn--accent" onClick={done}>Үргэлжлүүлэх</button>
        <button type="button" className="btn btn--plain" onClick={() => { clear(); setName('') }}>Арилгах</button>
      </div>
    </div>
  )
}

/** Put the signature where it belongs on the page: drag it, or use the arrow keys */
function Place({ page, src, ink, onSave, onRedraw }: { page: Page; src: Source; ink: { png: string; ratio: number }; onSave: (s: Sign | undefined) => void; onRedraw: () => void }) {
  const close = useCloseSheet()
  const d = shown(page)
  const ar = d.w / d.h
  const old = page.sign && page.sign.turn === page.turn && page.sign.png === ink.png ? page.sign : null
  const [pos, setPos] = useState(() => {
    const w = old?.w ?? 0.28
    return { x: old?.x ?? 0.62 - (w - 0.28), y: old?.y ?? 1 - w * ink.ratio * ar - 0.06, w }
  })
  const [img, setImg] = useState<string | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const hFrac = pos.w * ink.ratio * ar
  const clamp = (p: typeof pos) => {
    const h = p.w * ink.ratio * ar
    return { w: p.w, x: Math.min(Math.max(0, p.x), 1 - p.w), y: Math.min(Math.max(0, p.y), Math.max(0, 1 - h)) }
  }

  useEffect(() => {
    let url = ''
    let live = true
    drawPage(src, page.index, 1100, page.turn)
      .then(c => c.toBlob(b => { if (b && live) setImg((url = URL.createObjectURL(b))) }, 'image/jpeg', 0.9))
      .catch(() => {})
    return () => { live = false; if (url) URL.revokeObjectURL(url) }
  }, [src, page.index, page.turn])

  const drag = (e: RPointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const r = frame.current!.getBoundingClientRect()
    const start = { x: e.clientX, y: e.clientY, p: pos }
    const move = (ev: PointerEvent) => setPos(clamp({ ...start.p, x: start.p.x + (ev.clientX - start.x) / r.width, y: start.p.y + (ev.clientY - start.y) / r.height }))
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up) }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.shiftKey ? 0.05 : 0.01
    const step = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] }[e.key]
    if (!step) return
    e.preventDefault()
    setPos(p => clamp({ ...p, x: p.x + step[0], y: p.y + step[1] }))
  }
  const save = () => {
    onSave({ png: ink.png, ratio: ink.ratio, turn: page.turn, ...pos })
    close()
  }
  return (
    <div className="splace">
      <p className="muted">Гарын үсгийг чирж, эсвэл сумаар зөөж байрлуулна уу.</p>
      <div className="splace__page" ref={frame} style={{ '--ar': ar } as CSSProperties}>
        {img ? <img src={img} alt={`${page.index + 1}-р хуудас`} draggable={false} /> : <span className="player__wait" />}
        <div className="splace__ink" role="img" tabIndex={0} aria-label="Гарын үсэг. Сумаар зөөнө." onPointerDown={drag} onKeyDown={keys}
          style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: `${pos.w * 100}%`, height: `${hFrac * 100}%` }}>
          <img src={ink.png} alt="" draggable={false} />
        </div>
      </div>
      <label className="field splace__size">
        <span className="field__label">Хэмжээ</span>
        <input type="range" min={8} max={70} value={Math.round(pos.w * 100)} onChange={e => setPos(p => clamp({ ...p, w: Number(e.target.value) / 100 }))} />
      </label>
      <div className="spad__actions">
        <button type="button" className="btn btn--accent" onClick={save}>Хадгалах</button>
        <button type="button" className="btn btn--plain" onClick={onRedraw}>Дахин зурах</button>
        {page.sign && <button type="button" className="btn btn--ghost" onClick={() => { onSave(undefined); close() }}>Гарын үсэг устгах</button>}
      </div>
    </div>
  )
}
