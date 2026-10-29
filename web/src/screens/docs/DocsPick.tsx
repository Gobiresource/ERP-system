// Temporary: Бичиг хэрэг's first page as folders in two looks, or as the list it was before, behind a picker, so the
// user can choose (variant skill, docs/decisions.md 2026-10-29). Once one is chosen: Docs.tsx renders it directly, and
// this file and docs-pick.css are deleted.
import { useEffect, useState } from 'react'
import '../../styles/screens/docs-pick.css'
import Folders from './Folders'
import Papers from './Papers'

const LIST = [
  { id: 'art', label: 'Хавтас, өнгөлөг' },
  { id: 'calm', label: 'Хавтас, тайван' },
  { id: 'list', label: 'Жагсаалт (өмнөх)' },
] as const
type Id = (typeof LIST)[number]['id']
const KEY = 'erp:docs-variant'

function initial(): Id {
  let saved: string | null = null
  try { saved = localStorage.getItem(KEY) } catch { /* private window */ }
  const v = new URLSearchParams(location.search).get('__variant') ?? saved
  return LIST.find(x => x.id === v)?.id ?? 'art'
}

export default function DocsPick() {
  const [id, setId] = useState<Id>(initial)
  const [hidden, setHidden] = useState(false)
  const choose = (v: Id) => {
    setId(v)
    try { localStorage.setItem(KEY, v) } catch { /* private window */ }
  }

  // ← → step through the looks, H hides the picker for screenshots
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

  return (
    <>
      <div className="variant-picker-select" hidden={hidden}>
        <span aria-hidden="true">Харагдац</span>
        <select aria-label="Бичиг хэргийн харагдац" value={id} onChange={e => choose(e.target.value as Id)}>
          <optgroup label="Нүүр хуудас">
            {LIST.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </optgroup>
        </select>
        <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
      </div>
      {id === 'list' ? <Papers /> : <Folders key={id} look={id} />}
    </>
  )
}
