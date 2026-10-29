// Ноорог: each employee's free boards (notes, checklists, pictures, links, files) and the PDF tool.
// Ideas from Mochiboard, our own code (docs/decisions.md, 2026-10-29).
import '../styles/screens/draft.css'
import { SubNav } from '../ui/SubNav'
import Boards from './draft/Boards'
import Board from './draft/Board'
import Pdf from './draft/Pdf'

export default function Draft({ id }: { id?: string }) {
  if (!id) return <Boards />
  // #draft-pdf, or #draft-pdf-<board>-<card> to edit a PDF that sits on a board
  if (id === 'pdf' || id.startsWith('pdf-')) return <Pdf from={id.slice(4) || undefined} />
  return <Board id={id} />
}

const TABS = [['', 'Самбар'], ['pdf', 'PDF засах']] as const

export const DraftNav = ({ at }: { at: (typeof TABS)[number][0] }) => <SubNav label="Ноорог" base="draft" tabs={TABS} at={at} />
