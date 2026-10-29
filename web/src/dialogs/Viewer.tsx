// A file over the whole screen: a PDF's pages one under another, a picture at its own size, with zoom and the page
// you are on. Бичиг хэрэг, Зурвас and Ноорог open their files here (docs/decisions.md, 2026-10-29).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Download, FilePen, Minus, Plus, X } from 'lucide-react'
import '../styles/viewer.css'
import type { BoardFile } from '../lib/types'
import { close } from '../lib/ui'
import { go } from '../lib/router'
import { getFile, saveBlob } from '../lib/files'
import { fileSize } from '../lib/draft'
import { drawPage, viewPdf } from '../lib/pdf'
import { Sheet, useCloseSheet } from '../ui/Sheet'

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]
/** Pages past this are left out: drawing them all would take minutes and a lot of memory */
const MAX_PAGES = 300
export const isPdfName = (f: { name: string; type?: string }) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

/** A button in the viewer's top bar; on a phone only its icon shows */
export function Tool({ icon: Icon, label, onClick }: { icon: typeof X; label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn btn--glass fview__tool" title={label} onClick={onClick}>
      <Icon className="ico" /><span className="fview__lbl">{label}</span>
    </button>
  )
}

/** Closes the viewer and opens the PDF tool on this file (`from`: what follows #docs-pdf-) */
export function EditPdf({ from }: { from: string }) {
  const closeSheet = useCloseSheet()
  return <Tool icon={FilePen} label="PDF засах" onClick={() => { closeSheet(); go('docs', `pdf-${from}`) }} />
}

export function Viewer({ name, sub, load, tools }: { name: string; sub?: string; load: () => Promise<Blob | undefined>; tools?: ReactNode }) {
  return (
    <Sheet kind="full" label={name} onClose={close} closeButton={false}>
      <Body name={name} sub={sub} load={load} tools={tools} />
    </Sheet>
  )
}

/** A file from Зурвас or a board: look at it, open a PDF in the PDF tool, save it */
export function FileSheet({ file }: { file: BoardFile }) {
  return (
    <Viewer name={file.name} sub={fileSize(file.size)} load={() => getFile(file.id)} tools={
      <>
        {isPdfName(file) && <EditPdf from={`file-${file.id}`} />}
        <Tool icon={Download} label="Татах" onClick={() => getFile(file.id).then(b => b && saveBlob(file.name, b))} />
      </>
    } />
  )
}

interface Shown { url: string; ratio: number }

function Body({ name, sub, load, tools }: { name: string; sub?: string; load: () => Promise<Blob | undefined>; tools?: ReactNode }) {
  const closeSheet = useCloseSheet()
  const body = useRef<HTMLDivElement>(null)
  /** A PDF's pages: null until drawn */
  const [pages, setPages] = useState<(Shown | null)[] | null>(null)
  const [left, setLeft] = useState(0)
  /** Height over width of the first page, for the pages not drawn yet */
  const [ratio, setRatio] = useState(1.414)
  const [pic, setPic] = useState<string | null>(null)
  const [nat, setNat] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const [z, setZ] = useState(1)
  const [at, setAt] = useState(1)
  const anchor = useRef<{ x: number; y: number } | null>(null)
  const raf = useRef(0)

  useEffect(() => {
    let live = true
    const urls: string[] = []
    ;(async () => {
      try {
        const blob = await load()
        if (!live) return
        if (!blob) return setNote('Файл олдсонгүй. Өөр төхөөрөмж эсвэл хөтөч дээр нэмсэн байж магадгүй.')
        if (blob.type.startsWith('image/')) {
          urls.push(URL.createObjectURL(blob))
          return setPic(urls[0])
        }
        if (!isPdfName({ name, type: blob.type })) return setNote('Энэ файлыг энд харах боломжгүй. Татаж нээнэ үү.')
        const view = await viewPdf(blob)
        try {
          const n = Math.min(view.numPages, MAX_PAGES)
          const first = (await view.getPage(1)).getViewport({ scale: 1 })
          if (!live) return
          const list: (Shown | null)[] = Array(n).fill(null)
          setRatio(first.height / first.width)
          setLeft(view.numPages - n)
          setPages([...list])
          // One page at a time, in order: the first ones show while the rest are drawn
          for (let i = 0; i < n && live; i++) {
            const canvas = await drawPage({ view }, i, 2000)
            const b = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.88))
            if (!b || !live) continue
            urls.push(URL.createObjectURL(b))
            list[i] = { url: urls.at(-1)!, ratio: canvas.height / canvas.width }
            setPages([...list])
          }
        } finally {
          view.loadingTask.destroy()
        }
      } catch {
        if (live) setNote('Файлыг нээж чадсангүй.')
      }
    })()
    return () => {
      live = false
      urls.forEach(u => URL.revokeObjectURL(u))
    }
    // The file is read once, when the viewer opens (a demo document gets its file while it is read)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zooming keeps the middle of the screen where it was
  const zoomTo = (next: number) => {
    const el = body.current
    if (el) anchor.current = { x: (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth, y: (el.scrollTop + el.clientHeight / 2) / el.scrollHeight }
    setZ(next)
  }
  const step = (dir: 1 | -1) => zoomTo(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + dir))])
  useLayoutEffect(() => {
    const el = body.current
    const a = anchor.current
    if (!el || !a) return
    el.scrollLeft = a.x * el.scrollWidth - el.clientWidth / 2
    el.scrollTop = a.y * el.scrollHeight - el.clientHeight / 2
    anchor.current = null
  }, [z])

  /** The page a third of the way down the screen is the one being read */
  const track = () => {
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      const el = body.current
      if (!el) return
      const line = el.scrollTop + el.clientHeight / 3
      const kids = el.querySelectorAll<HTMLElement>('.fview__page')
      let i = 0
      while (i < kids.length - 1 && kids[i + 1].offsetTop <= line) i++
      setAt(i + 1)
    })
  }

  // + and − zoom, 0 fits the page to the screen
  const keys = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === '+' || e.key === '=') step(1)
    else if (e.key === '-') step(-1)
    else if (e.key === '0') zoomTo(1)
    else return
    e.preventDefault()
  }

  const pct = `${Math.round(z * 100)}%`
  return (
    <div className="fview" onKeyDown={keys}>
      <header className="fview__bar">
        <button type="button" className="ibtn ibtn--glass" aria-label="Хаах" title="Хаах" onClick={closeSheet}><X className="ico" /></button>
        <div className="fview__title">
          <h2>{name}</h2>
          {sub && <p>{sub}</p>}
        </div>
        <div className="fview__tools">{tools}</div>
      </header>
      <div className="fview__body" ref={body} tabIndex={0} data-autofocus onScroll={track} role="region" aria-label="Файлын агуулга">
        {note ? <p className="fview__note">{note}</p> : (
          <div className="fview__pages" style={{ '--z': z, '--r': ratio, ...(nat ? { '--nat': `${nat}px` } : {}) } as CSSProperties}>
            {pic && <img className="fview__pic" src={pic} alt={name} onLoad={e => setNat(e.currentTarget.naturalWidth)} />}
            {pages?.map((p, i) => (p
              ? <img key={i} className="fview__page" src={p.url} alt={`${i + 1}-р хуудас`} style={{ aspectRatio: `1 / ${p.ratio}` }} decoding="async" />
              : <span key={i} className="fview__page is-wait" />))}
            {!pic && !pages && <p className="fview__note" role="status">Нээж байна…</p>}
            {left > 0 && <p className="fview__note">Эхний {pages?.length} хуудас харагдаж байна. Бүгдийг харахын тулд татна уу.</p>}
          </div>
        )}
      </div>
      {(pic || pages) && (
        <div className="fview__hud">
          {pages && <span className="fview__at tnum">{at} / {pages.length + left}</span>}
          <button type="button" className="ibtn ibtn--sm" aria-label="Жижигрүүлэх" title="Жижигрүүлэх (−)" disabled={z === ZOOMS[0]} onClick={() => step(-1)}><Minus className="ico" /></button>
          <button type="button" className="fview__z tnum" aria-label={`${pct}, дэлгэцэнд тааруулах`} title="Дэлгэцэнд тааруулах (0)" onClick={() => zoomTo(1)}>{pct}</button>
          <button type="button" className="ibtn ibtn--sm" aria-label="Томруулах" title="Томруулах (+)" disabled={z === ZOOMS.at(-1)} onClick={() => step(1)}><Plus className="ico" /></button>
        </div>
      )}
    </div>
  )
}
