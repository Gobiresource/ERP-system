// Ноорог: each employee's free boards (notes, checklists, pictures, links, files).
// Ideas from Mochiboard, our own code (docs/decisions.md, 2026-10-29). The PDF tool is in Бичиг хэрэг.
import '../styles/screens/draft.css'
import Boards from './draft/Boards'
import Board from './draft/Board'

export default function Draft({ id }: { id?: string }) {
  return id ? <Board id={id} /> : <Boards />
}
