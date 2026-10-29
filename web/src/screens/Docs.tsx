// Бичиг хэрэг: a folder for each ХХК with its documents by category (an employee's own, rules, forms, templates), requests
// to the office for a document, and the PDF tool (docs/decisions.md, 2026-10-29).
import { BookOpenText, ClipboardList, FileCheck, FilePen, FileText, Mail, ScrollText, Stamp } from 'lucide-react'
import '../styles/screens/docs.css'
import type { DocKind, DocRequest } from '../lib/types'
import { DOC_HUE, REQ_STATUS, stepsOf } from '../lib/docs'
import { SubNav } from '../ui/SubNav'
import Folders from './docs/Folders'
import FolderPage from './docs/Folder'
import Requests from './docs/Requests'
import Pdf from './docs/Pdf'

export default function Docs({ id }: { id?: string }) {
  if (id === 'requests') return <Requests />
  // #docs-pdf, or #docs-pdf-<board>-<card> to edit a PDF that sits on a board
  if (id === 'pdf' || id?.startsWith('pdf-')) return <Pdf from={id.slice(4) || undefined} />
  if (id?.startsWith('folder-')) return <FolderPage key={id} id={id.slice(7)} />
  return <Folders />
}

const TABS = [['', 'Бичиг баримт'], ['requests', 'Хүсэлт'], ['pdf', 'PDF засах']] as const

export const DocsNav = ({ at }: { at: (typeof TABS)[number][0] }) => <SubNav label="Бичиг хэрэг" base="docs" tabs={TABS} at={at} />

export const KIND_ICON: Record<DocKind, typeof Stamp> = {
  contract: FilePen, order: Stamp, certificate: FileCheck, rule: BookOpenText, decision: ScrollText, letter: Mail, form: ClipboardList, template: FileText,
}

/** The kind of a document as a coloured tile */
export function DocTile({ kind }: { kind: DocKind }) {
  const Icon = KIND_ICON[kind]
  return <span className={`dtile hue--${DOC_HUE[kind]}`} aria-hidden="true"><Icon className="ico" /></span>
}

export function ReqPill({ r }: { r: DocRequest }) {
  return <span className={`rpill rpill--${r.status}`}>{REQ_STATUS[r.status]}</span>
}

/** How far a request has come: a dot for each step. The words are in ReqPill next to it. */
export function Steps({ r }: { r: DocRequest }) {
  const all = stepsOf(r)
  const at = all.indexOf(r.status)
  return (
    <ol className={`rsteps${r.status === 'declined' ? ' is-declined' : ''}`} aria-hidden="true">
      {all.map((st, i) => <li key={st} className={i < at ? 'is-past' : i === at ? 'is-now' : ''} />)}
    </ol>
  )
}
