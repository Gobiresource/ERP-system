// The task board: four columns, cards you can drag between them (mouse, pen, or a long press on touch).
// The card menu does the same with the keyboard.
import { Fragment, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'
import type { Task, TaskStatus } from '../../lib/types'
import { scoped, useApp } from '../../lib/store'
import { open } from '../../lib/ui'
import { checkPop, gsap, popIn, reduced, settle, slideFrom, tops } from '../../lib/motion'
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
  const sc = scoped(useApp())
  const board = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [expanded, setExpanded] = useState<Partial<Record<TaskStatus, boolean>>>({})
  const [dropped, setDropped] = useState<{ id: string; toDone: boolean } | null>(null)
  const first = useRef<Map<Element, number> | null>(null)
  const pointer = useRef({ x: 0, y: 0, offX: 0, offY: 0, width: 0, startLeft: 0, startTop: 0 })

  const byCol = useMemo(() => {
    const m = { todo: [], doing: [], review: [], done: [] } as Record<TaskStatus, Task[]>
    for (const t of tasks) m[t.status].push(t)
    return m
  }, [tasks])

  // Only the cards on screen pop in; the others are simply there when scrolled to
  useLayoutEffect(() => {
    popIn([...board.current!.querySelectorAll('.tk-card')].filter(c => c.getBoundingClientRect().top < innerHeight))
  }, [])

  // Cards make room for the dragged one: they slide from where they were
  useLayoutEffect(() => {
    if (first.current) slideFrom(first.current)
    first.current = null
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

  const start = (e: ReactPointerEvent<HTMLElement>, t: Task, el: HTMLElement) => {
    if (e.button !== 0 || (e.target as Element).closest('.tk-card__more')) return
    const r = el.getBoundingClientRect()
    const touch = e.pointerType === 'touch'
    const p = pointer.current
    Object.assign(p, { x: e.clientX, y: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top, width: r.width, startLeft: r.left, startTop: r.top })
    const x0 = e.clientX
    const y0 = e.clientY
    let lastX = x0
    let started = false
    let ready = !touch
    let current: Drag | null = null
    let raf = 0
    let timer = 0
    let tilt: ((deg: number) => void) | null = null

    // Which column and place the pointer is over. Card positions come from the layout (offsetTop), so cards
    // that are still sliding out of the way do not change the answer.
    const hit = () => {
      const cols = [...board.current!.querySelectorAll<HTMLElement>('.tk-col')]
      const boxes = cols.map(c => c.getBoundingClientRect())
      let i = boxes.findIndex(b => p.x >= b.left && p.x <= b.right)
      if (i < 0) i = boxes.reduce((best, b, k) => (Math.abs(b.left - p.x) < Math.abs(boxes[best].left - p.x) ? k : best), 0)
      const status = cols[i].dataset.col as TaskStatus
      const list = cols[i].querySelector<HTMLElement>('.tk-col__list')!
      const top = list.getBoundingClientRect().top
      const index = [...list.querySelectorAll<HTMLElement>('.tk-card:not(.is-away)')].filter(c => top + c.offsetTop + c.offsetHeight / 2 < p.y).length
      if (current && (current.col !== status || current.index !== index)) {
        first.current = tops([current.col, status].flatMap(st => [...board.current!.querySelectorAll(`.tk-col[data-col="${st}"] .tk-card:not(.is-away)`)]))
        current = { ...current, col: status, index }
        setDrag(current)
      }
    }

    // Once per frame: move and tilt the card, scroll near the edges, find the drop place
    const frame = () => {
      const g = ghost.current
      const b = board.current
      if (!b || !started) return
      if (g) {
        gsap.set(g, { x: p.x - p.offX, y: p.y - p.offY })
        if (!reduced()) {
          tilt ??= gsap.quickTo(g, 'rotation', { duration: 0.3, ease: 'power2.out' })
          tilt(Math.max(-6, Math.min(6, (p.x - lastX) * 0.35)))
        }
        lastX = p.x
      }
      if (p.y < 80) window.scrollBy(0, -Math.ceil((80 - p.y) / 6))
      else if (p.y > innerHeight - 80) window.scrollBy(0, Math.ceil((p.y - innerHeight + 80) / 6))
      const br = b.getBoundingClientRect()
      if (p.x < br.left + 50) b.scrollLeft -= 10
      else if (p.x > br.right - 50) b.scrollLeft += 10
      hit()
      raf = requestAnimationFrame(frame)
    }

    const begin = () => {
      started = true
      touchDragging = touch
      current = { id: t.id, col: t.status, index: byCol[t.status].indexOf(t), height: r.height }
      setDrag(current)
      raf = requestAnimationFrame(frame)
    }

    const move = (ev: PointerEvent) => {
      p.x = ev.clientX
      p.y = ev.clientY
      if (!started) {
        const dist = Math.hypot(p.x - x0, p.y - y0)
        if (!ready) { if (dist > 8) finish(false); return }
        if (dist < 6) return
        begin()
      }
    }

    const cleanup = () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      touchDragging = false
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
      removeEventListener('pointercancel', cancel)
      removeEventListener('keydown', key)
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
      gsap.to(ghost.current, { x: target.left, y: target.top, scale: 1, rotation: 0, duration: 0.32, ease: 'power3.out', overwrite: true, onComplete: done })
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
  // One listener for all cards, so the cards keep the same props and are not redrawn during a drag
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    const el = (e.target as Element).closest<HTMLElement>('.tk-card')
    const t = el && tasks.find(x => x.id === el.dataset.id)
    if (el && t) start(e, t, el)
  }

  return (
    <div className="tk-board" ref={board} onPointerDown={onPointerDown}>
      {STATUSES.map(st => {
        const list = byCol[st]
        const showAll = expanded[st]
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
                    <TaskCard task={t} project={sc.project(t.project)} person={sc.person(t.assignee)} away={t.id === drag?.id} />
                  </Fragment>
                )
              })}
              {drag?.col === st && drag.index >= rest.length && <div className="tk-slot" style={{ height: drag.height }} aria-hidden="true" />}
              {list.length === 0 && drag?.col !== st && <p className="tk-col__empty">{EMPTY[st]}</p>}
            </div>
            {list.length > LIMIT && !drag && (
              <button type="button" className="btn btn--ghost btn--sm tk-col__all" aria-expanded={!!expanded[st]} onClick={() => setExpanded({ ...expanded, [st]: !expanded[st] })}>
                {expanded[st] ? 'Хураах' : `Бүгдийг харах (${list.length})`}
              </button>
            )}
          </section>
        )
      })}
      {dragged && createPortal(
        <div className="tk-layer" aria-hidden="true">
          <TaskCard task={dragged} project={sc.project(dragged.project)} person={sc.person(dragged.assignee)} ref={ghost} lifted menu={false} />
        </div>,
        document.body,
      )}
    </div>
  )
}
