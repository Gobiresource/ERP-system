// The task board: four columns, cards you can drag between them (mouse, pen, or a long press on touch).
// The card menu does the same with the keyboard.
import { Fragment, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'
import type { Task, TaskStatus } from '../../lib/types'
import { open } from '../../lib/ui'
import { Flip, checkPop, gsap, popIn, reduced, settle } from '../../lib/motion'
import { STATUS, STATUSES } from '../../ui/bits'
import { TaskCard, moveTask } from './TaskCard'

const LIMIT = 8
const EMPTY: Record<TaskStatus, string> = {
  todo: 'Ажлаа энд чирж оруулна уу',
  doing: 'Ажлаа энд чирж оруулна уу',
  review: 'Хянуулах ажлаа энд чирж оруулна уу',
  done: 'Дууссан ажлаа энд чирж оруулна уу',
}

interface Drag {
  id: string
  col: TaskStatus
  index: number
  height: number
}

// While a touch drag runs, stop the page from scrolling
let touchDragging = false
document.addEventListener('touchmove', e => { if (touchDragging && e.cancelable) e.preventDefault() }, { passive: false })

export function Board({ tasks }: { tasks: Task[] }) {
  const board = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [expanded, setExpanded] = useState<Partial<Record<TaskStatus, boolean>>>({})
  const [dropped, setDropped] = useState<{ id: string; toDone: boolean } | null>(null)
  const flipState = useRef<Flip.FlipState | null>(null)
  const pointer = useRef({ x: 0, y: 0, offX: 0, offY: 0, width: 0, startLeft: 0, startTop: 0, vx: 0 })

  const byCol = useMemo(() => {
    const m = { todo: [], doing: [], review: [], done: [] } as Record<TaskStatus, Task[]>
    for (const t of tasks) m[t.status].push(t)
    return m
  }, [tasks])

  useLayoutEffect(() => {
    popIn(board.current!.querySelectorAll('.tk-card'))
  }, [])

  // Cards make room for the dragged one
  useLayoutEffect(() => {
    if (flipState.current) {
      Flip.from(flipState.current, { duration: 0.55, ease: 'power3.inOut' })
      flipState.current = null
    }
  }, [drag?.col, drag?.index])

  // Lift the card when the drag starts
  useLayoutEffect(() => {
    const g = ghost.current
    if (!drag || !g) return
    const p = pointer.current
    gsap.set(g, { x: p.x - p.offX, y: p.y - p.offY, width: p.width })
    if (!reduced()) gsap.fromTo(g, { scale: 1 }, { scale: 1.045, duration: 0.45, ease: 'back.out(2.4)' })
  }, [drag?.id])

  // Squash on drop, and the check pop when it landed in Done
  useLayoutEffect(() => {
    if (!dropped) return
    const el = board.current?.querySelector<HTMLElement>(`.tk-card[data-id="${dropped.id}"]`)
    if (el) {
      settle(el)
      const check = el.querySelector<HTMLElement>('.tk-card__check')
      if (dropped.toDone && check) checkPop(check)
    }
    setDropped(null)
  }, [dropped])

  const start = (e: ReactPointerEvent<HTMLElement>, t: Task) => {
    if (e.button !== 0 || (e.target as Element).closest('.tk-card__more')) return
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const touch = e.pointerType === 'touch'
    const p = pointer.current
    Object.assign(p, { x: e.clientX, y: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top, width: r.width, startLeft: r.left, startTop: r.top, vx: 0 })
    const x0 = e.clientX
    const y0 = e.clientY
    let started = false
    let ready = !touch
    let current: Drag | null = null
    let raf = 0
    let timer = 0

    const tilt = () => {
      if (!ghost.current || reduced()) return
      gsap.to(ghost.current, { rotation: Math.max(-6, Math.min(6, p.vx * 0.35)), duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
    }

    const hit = () => {
      const cols = [...board.current!.querySelectorAll<HTMLElement>('.tk-col')]
      const col = cols.find(c => { const b = c.getBoundingClientRect(); return p.x >= b.left && p.x <= b.right }) ??
        cols.reduce((a, c) => (Math.abs(c.getBoundingClientRect().left - p.x) < Math.abs(a.getBoundingClientRect().left - p.x) ? c : a))
      const status = col.dataset.col as TaskStatus
      const cards = [...col.querySelectorAll<HTMLElement>('.tk-card:not(.is-away)')]
      const index = cards.filter(c => { const b = c.getBoundingClientRect(); return b.top + b.height / 2 < p.y }).length
      if (current && (current.col !== status || current.index !== index)) {
        if (!reduced()) flipState.current = Flip.getState(board.current!.querySelectorAll('.tk-card:not(.is-away), .tk-slot'))
        current = { ...current, col: status, index }
        setDrag(current)
      }
    }

    // Scroll the page (and the board on small screens) near the edges
    const edge = () => {
      const b = board.current
      if (!b || !started) return
      if (p.y < 80) window.scrollBy(0, -Math.ceil((80 - p.y) / 6))
      else if (p.y > innerHeight - 80) window.scrollBy(0, Math.ceil((p.y - innerHeight + 80) / 6))
      const br = b.getBoundingClientRect()
      if (p.x < br.left + 50) b.scrollLeft -= 10
      else if (p.x > br.right - 50) b.scrollLeft += 10
      hit()
      raf = requestAnimationFrame(edge)
    }

    const begin = () => {
      started = true
      touchDragging = touch
      document.documentElement.classList.add('tk-dragging')
      current = { id: t.id, col: t.status, index: byCol[t.status].indexOf(t), height: r.height }
      setDrag(current)
      raf = requestAnimationFrame(edge)
    }

    const move = (ev: PointerEvent) => {
      p.vx = ev.clientX - p.x
      p.x = ev.clientX
      p.y = ev.clientY
      if (!started) {
        const dist = Math.hypot(p.x - x0, p.y - y0)
        if (!ready) { if (dist > 8) finish(false); return }
        if (dist < 6) return
        begin()
      }
      if (ghost.current) gsap.set(ghost.current, { x: p.x - p.offX, y: p.y - p.offY })
      tilt()
      hit()
    }

    const cleanup = () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      touchDragging = false
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
      removeEventListener('pointercancel', cancel)
      removeEventListener('keydown', key)
      document.documentElement.classList.remove('tk-dragging')
    }

    const finish = (commit: boolean) => {
      cleanup()
      if (!started || !current) return
      // The click that ends a drag should not open a card
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
      addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => removeEventListener('click', swallow, { capture: true }), 0)
      const d = current
      const slot = board.current?.querySelector<HTMLElement>('.tk-slot')
      const target = commit && slot ? slot.getBoundingClientRect() : { left: p.startLeft, top: p.startTop }
      const done = () => {
        if (commit) {
          const before = byCol[d.col].filter(x => x.id !== t.id)[d.index]?.id
          if (d.col !== t.status || d.index !== byCol[t.status].indexOf(t)) moveTask(t, d.col, before)
          setDropped({ id: t.id, toDone: d.col === 'done' && t.status !== 'done' })
        }
        setDrag(null)
      }
      if (!ghost.current || reduced()) return done()
      gsap.to(ghost.current, { x: target.left, y: target.top, scale: 1, rotation: 0, duration: 0.32, ease: 'power3.out', onComplete: done })
    }
    const up = () => finish(true)
    const cancel = () => finish(false)
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') finish(false) }

    if (touch) timer = window.setTimeout(() => { ready = true; begin() }, 280)
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    addEventListener('pointercancel', cancel)
    addEventListener('keydown', key)
  }

  const dragged = drag ? tasks.find(t => t.id === drag.id) : undefined

  return (
    <div className="tk-board" ref={board}>
      {STATUSES.map(st => {
        const list = byCol[st]
        const showAll = expanded[st] || drag?.col === st
        const visible = showAll ? list : list.slice(0, LIMIT)
        const rest = visible.filter(t => t.id !== drag?.id)
        return (
          <section key={st} className={`tk-col glass${drag?.col === st ? ' is-over' : ''}`} data-col={st} aria-labelledby={`col-${st}`}>
            <header className="tk-col__head">
              <span className={`tk-dot tk-dot--${st}`} aria-hidden="true" />
              <h2 className="tk-col__name" id={`col-${st}`}>{STATUS[st]}</h2>
              <span className="tk-col__count tnum">{list.length}<span className="sr-only"> ажил</span></span>
              <button type="button" className="ibtn ibtn--sm tk-col__add" aria-label={`"${STATUS[st]}" баганад ажил нэмэх`} onClick={() => open({ kind: 'newTask', defaults: { status: st } })}>
                <Plus className="ico" />
              </button>
            </header>
            <div className="tk-col__list">
              {visible.map(t => {
                const i = rest.indexOf(t)
                return (
                  <Fragment key={t.id}>
                    {drag?.col === st && i === drag.index && <div className="tk-slot" style={{ height: drag.height }} aria-hidden="true" />}
                    <TaskCard task={t} away={t.id === drag?.id} onPointerDown={e => start(e, t)} />
                  </Fragment>
                )
              })}
              {drag?.col === st && drag.index >= rest.length && <div className="tk-slot" style={{ height: drag.height }} aria-hidden="true" />}
              {list.length === 0 && drag?.col !== st && <p className="tk-col__empty">{EMPTY[st]}</p>}
            </div>
            {list.length > LIMIT && !drag && (
              <button type="button" className="btn btn--ghost btn--sm tk-col__all" aria-expanded={!!expanded[st]} onClick={() => setExpanded({ ...expanded, [st]: !expanded[st] })}>
                {expanded[st] ? 'Цөөнийг харах' : `Бүгдийг харах (${list.length})`}
              </button>
            )}
          </section>
        )
      })}
      {dragged && createPortal(
        <div className="tk-layer" aria-hidden="true">
          <TaskCard task={dragged} ref={ghost} lifted menu={false} />
        </div>,
        document.body,
      )}
    </div>
  )
}
