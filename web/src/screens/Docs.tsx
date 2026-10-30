// Бичиг хэрэг: a folder for each ХХК with its documents by category (an employee's own, rules, forms, templates), contracts
// and their approval, requests to the office for a document, and the PDF tool (docs/decisions.md, 2026-10-29).
import { BookOpenText, ClipboardList, FileCheck, FilePen, FileText, Mail, ScrollText, Stamp } from 'lucide-react'
import '../styles/screens/docs.css'
import type { DocKind, DocRequest } from '../lib/types'
import { DOC_HUE, REQ_STATUS, stepsOf } from '../lib/docs'
import { SubNav } from '../ui/SubNav'
import Folders from './docs/Folders'
import FolderPage from './docs/Folder'
import Requests from './docs/Requests'
import Contracts, { useContractTodo } from './docs/Contracts'
import ContractPage from './docs/Contract'
import Pdf from './docs/Pdf'
import Scans from './docs/Scans'
import { useApp } from '../lib/store'

export default function Docs({ id }: { id?: string }) {
  if (id === 'requests') return <Requests />
  if (id === 'contracts') return <Contracts />
  if (id === 'scan') return <Scans />
  if (id?.startsWith('contract-')) return <ContractPage key={id} id={id.slice(9)} />
  // #docs-pdf, or #docs-pdf-<board>-<card> to edit a PDF that sits on a board
  if (id === 'pdf' || id?.startsWith('pdf-')) return <Pdf from={id.slice(4) || undefined} />
  if (id?.startsWith('folder-')) return <FolderPage key={id} id={id.slice(7)} />
  return <Folders />
}

const TABS = [['', 'Бичиг баримт'], ['contracts', 'Гэрээ'], ['requests', 'Хүсэлт'], ['scan', 'Скан оруулах'], ['pdf', 'PDF засах']] as const

/** The section's tabs; Гэрээ counts the contracts waiting for the person, Скан оруулах the papers not filed yet */
export function DocsNav({ at }: { at: (typeof TABS)[number][0] }) {
  const n = useContractTodo()
  const scans = useApp().scans.length
  const tabs = TABS.map(([key, text]) => [key,
    key === 'contracts' && n ? <>{text}<span className="seg__count">{n}<span className="sr-only"> хийх</span></span></>
      : key === 'scan' && scans ? <>{text}<span className="seg__count">{scans}<span className="sr-only"> хавтаслах</span></span></> : text] as const)
  return <SubNav label="Бичиг хэрэг" base="docs" tabs={tabs} at={at} />
}

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
