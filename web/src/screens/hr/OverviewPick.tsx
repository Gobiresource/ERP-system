// Temporary: the HR overview in three directions plus the current one, behind a picker, so the user can choose
// (variant skill, docs/decisions.md 2026-10-29). Once one is chosen: Hr.tsx imports it directly, and this file,
// the variants folder and hr-variants.css are deleted.
import { useEffect, useState } from 'react'
import '../../styles/screens/hr-variants.css'
import Current from './Overview'
import Seats from './variants/Seats'
import Agenda from './variants/Agenda'
import Brief from './variants/Brief'

const LIST = [
  { id: 'current', label: 'Одоогийнх', C: Current },
  { id: 'seats', label: 'Орон тоо', C: Seats },
  { id: 'agenda', label: 'Хуваарь', C: Agenda },
  { id: 'brief', label: 'Товч', C: Brief },
] as const
type Id = (typeof LIST)[number]['id']
const KEY = 'erp:hr-variant'

function initial(): Id {
  let saved: string | null = null
  try { saved = localStorage.getItem(KEY) } catch { /* private window */ }
  const v = new URLSearchParams(location.search).get('__variant') ?? saved
  return LIST.find(x => x.id === v)?.id ?? 'seats'
}

export default function OverviewPick() {
  const [id, setId] = useState<Id>(initial)
  const [hidden, setHidden] = useState(false)
  const choose = (v: Id) => {
    setId(v)
    try { localStorage.setItem(KEY, v) } catch { /* private window */ }
  }

  // ← → step through the directions, H hides the picker for screenshots
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return
      if (e.code === 'KeyH') setHidden(h => !h)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const i = LIST.findIndex(x => x.id === id) + (e.key === 'ArrowRight' ? 1 : -1)
        choose(LIST[(i + LIST.length) % LIST.length].id)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [id])

  const { C } = LIST.find(x => x.id === id)!
  return (
    <>
      <div className="variant-picker-select" hidden={hidden}>
        <span aria-hidden="true">Тоймын хувилбар</span>
        <select aria-label="Тоймын хувилбар" value={id} onChange={e => choose(e.target.value as Id)}>
          <optgroup label="Эхэнд харагдах">
            {LIST.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </optgroup>
        </select>
        <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
      </div>
      <C key={id} />
    </>
  )
}
