// With a server behind the app: says so when this browser's changes cannot reach it. Nothing shows while all is well
// (the changes go within a moment); without a connection the person may work on, and is told nothing is lost.
import { CloudOff } from 'lucide-react'
import { useSaving } from '../lib/sync'

export function Saving() {
  const saving = useSaving()
  return (
    <div className="offline" role="status" aria-live="polite">
      {saving === 'offline' && <span className="offline__pill"><CloudOff className="ico" aria-hidden="true" />Холболт тасарсан. Холболт сэргэмэгц таны өөрчлөлт хадгалагдана.</span>}
    </div>
  )
}
