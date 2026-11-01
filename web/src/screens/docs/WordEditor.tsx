// A contract's Word file in a Word-like editor: SuperDoc 1.47.2 (AGPL-3.0), loaded only by the Word page because it is
// large. It runs in the browser with its telemetry and AI off, so the file never leaves the device (docs/decisions.md,
// 2026-11-01). A trial beside the contract's text: the file starts from that text, or from a .docx the person picks, and
// is kept with the contract in the browser's file store.
import { useEffect, useRef, useState } from 'react'
import { SuperDoc, createZip } from 'superdoc'
import 'superdoc/style.css'
import { Download, FileUp } from 'lucide-react'
import type { Contract, Id } from '../../lib/types'
import { actions, getState } from '../../lib/store'
import { getFile, putFile, saveBlob } from '../../lib/files'
import { contractPaper } from '../../lib/paper'
import { toast } from '../../lib/ui'
import { cid } from '../../lib/draft'
import { short } from '../../lib/format'

export type Mode = 'editing' | 'suggesting' | 'viewing'

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
/** Text for the XML of the file; control characters XML does not allow (a pasted vertical tab) would leave it unreadable */
// eslint-disable-next-line no-control-regex
const esc = (t: string) => t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** A part's links to other parts: [type, target] */
const rels = (...to: [string, string][]) =>
  `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${to.map(([type, target], i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join('')}</Relationships>`

/** A paragraph in the file's Times New Roman 12: bold, a size in half points, aligned; a tab in it jumps to the right edge */
function para(text: string, o: { b?: boolean; sz?: number; jc?: 'center' | 'both'; after?: number; keep?: boolean } = {}) {
  const rPr = o.b || o.sz ? `<w:rPr>${o.b ? '<w:b/>' : ''}${o.sz ? `<w:sz w:val="${o.sz}"/>` : ''}</w:rPr>` : ''
  const runs = text.split('\t').map(t => `<w:r>${rPr}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`).join('<w:r><w:tab/></w:r>')
  return `<w:p><w:pPr>${o.keep ? '<w:keepNext/>' : ''}<w:tabs><w:tab w:val="right" w:pos="9355"/></w:tabs><w:spacing w:after="${o.after ?? 120}"/>${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}</w:pPr>${runs}</w:p>`
}

/**
 * The contract's paper copy (what its PDF says) as a Word file: A4 with the margins of an official letter (left 30 mm,
 * right 15 mm, top and bottom 20 mm), Times New Roman 12, the only font the company uses.
 */
async function paperDocx(c: Contract) {
  const d = contractPaper(c)
  const body = [
    para(d.company, { b: true, sz: 28, after: 0 }),
    para('Улаанбаатар хот', { after: 240 }),
    para(`${d.date}\t${d.number}`, { after: 360 }),
    para(d.title, { b: true, sz: 28, jc: 'center', after: 360 }),
    ...d.lines.flatMap(l => (typeof l === 'string' ? l.split(/\r?\n/).map(t => para(t, { jc: 'both' })) : [para(l.head, { b: true, keep: true, after: 60 })])),
    para('', { after: 360 }),
    ...d.signers.map(t => para(t, { after: 480 })),
  ]
  const parts: Record<string, string> = {
    '[Content_Types].xml': `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    // Without app.xml the editor takes the file for a Google Docs one and would keep comments the Google way, not Word's
    '_rels/.rels': rels(['officeDocument', 'word/document.xml'], ['extended-properties', 'docProps/app.xml']),
    'docProps/app.xml': `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Pane ERP</Application></Properties>`,
    'word/_rels/document.xml.rels': rels(['styles', 'styles.xml']),
    'word/document.xml': `${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    'word/styles.xml': `${XML}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="mn-MN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`,
  }
  const zip = await createZip(Object.values(parts).map(x => new Blob([x], { type: 'application/xml' })), Object.keys(parts))
  return new File([zip], `${c.title}.docx`, { type: DOCX })
}

/** A real Word file: a zip that has word/document.xml. The editor opens anything else as an empty page, with no error. */
async function isDocx(f: File) {
  const b = new Uint8Array(await f.arrayBuffer())
  return b[0] === 0x50 && b[1] === 0x4b && new TextDecoder('latin1').decode(b).includes('word/document.xml')
}

const SAVED = { '': 'Өөрчлөлт автоматаар хадгалагдана.', saving: 'Хадгалж байна…', saved: 'Хадгалагдсан', failed: 'Хадгалж чадсангүй. Дараагийн засвараар дахин оролдоно.' }

/** The editor with its toolbar. Those who may edit the text now edit the file, saved a moment after each change. */
export default function WordEditor({ c, who, mode }: { c: Contract; who: Id; mode: Mode }) {
  const host = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const sd = useRef<SuperDoc | null>(null)
  /** Saves at once what is waiting to be saved */
  const flush = useRef<() => Promise<void>>(async () => {})
  /** A picked file opens anew */
  const [opened, setOpened] = useState(0)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [saved, setSaved] = useState<keyof typeof SAVED>('')
  /** The saved file is not in this browser's file store (kept on another device or browser): it starts from the text */
  const [missing, setMissing] = useState(false)
  const edits = mode !== 'viewing'

  // Opened once for each person, mode and picked file: the contract changing with each save must not open it again
  useEffect(() => {
    let live = true
    let timer = 0
    let doc: SuperDoc | null = null
    const word = getState().contracts.find(x => x.id === c.id)?.word
    // A person keeps one file while they were the last to save; the one before them stays as it was
    const file = word?.by === who ? word.file : `wd${cid()}`
    const save = async () => {
      timer = 0
      try {
        await putFile(file, (await doc!.export({ triggerDownload: false })) as Blob)
        actions.saveContractWord(c.id, who, file)
        if (live) setSaved('saved')
      } catch {
        if (live) setSaved('failed')
      }
    }
    flush.current = async () => {
      if (!timer) return
      window.clearTimeout(timer)
      await save()
    }
    ;(async () => {
      const kept = word ? await getFile(word.file).catch(() => undefined) : undefined
      const blob = kept ?? (await paperDocx(c))
      if (!live) return
      setMissing(!!word && !kept)
      const me = getState().people.find(p => p.id === who)
      doc = sd.current = new SuperDoc({
        selector: host.current!,
        // Readers get no toolbar: every button would be greyed out
        ...(edits ? { toolbar: '#wordbar' } : {}),
        document: blob instanceof File ? blob : new File([blob], `${c.title}.docx`, { type: DOCX }),
        documentMode: mode,
        role: edits ? 'editor' : 'viewer',
        user: { name: me ? short(me) : 'Ажилтан', email: me?.email ?? '' },
        title: c.title,
        telemetry: { enabled: false },
        // A page narrower than A4 (a phone) shows it whole, smaller; never larger than its size
        zoom: { mode: 'fit-width', fitWidth: { padding: 16 } },
        modules: { toolbar: { fonts: [{ key: '"Times New Roman", serif', label: 'Times New Roman' }], excludeItems: ['ai'], responsiveToContainer: true } },
        onReady: () => { if (live) setState('ready') },
        onException: () => { if (live) setState(s => (s === 'loading' ? 'failed' : s)) },
        onTransaction: ({ transaction }) => {
          if (!edits || !transaction?.docChanged) return
          setSaved('saving')
          window.clearTimeout(timer)
          timer = window.setTimeout(save, 1200)
        },
      })
    })().catch(() => { if (live) setState('failed') })
    return () => {
      live = false
      sd.current = null
      // Leaving saves what is waiting, then closes the editor
      void flush.current().finally(() => doc?.destroy())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, who, mode, opened])

  const download = async () => {
    const blob = await sd.current?.export({ triggerDownload: false })
    if (blob) saveBlob(`${c.title}.docx`, blob as Blob)
  }
  const pick = async (f?: File) => {
    if (!f) return
    if (/\.doc$/i.test(f.name)) return toast('.doc файлыг нээх боломжгүй. Word-ийн Save As цэсээр .docx болгож хадгалаад сонгоно уу.', { kind: 'warn' })
    if (!/\.docx$/i.test(f.name) || f.size > 20 * 2 ** 20) return toast('20 MB хүртэлх .docx файл сонгоно уу.', { kind: 'warn' })
    if (!(await isDocx(f))) return toast('Файлыг нээж чадсангүй. Файл гэмтсэн эсвэл Word файл биш байна. Өөр .docx файл сонгоно уу.', { kind: 'warn' })
    await flush.current()
    const file = `wd${cid()}`
    try {
      await putFile(file, f)
    } catch {
      return toast('Файлыг хадгалж чадсангүй. Дахин оролдоно уу.', { kind: 'warn' })
    }
    actions.saveContractWord(c.id, who, file)
    setState('loading')
    setOpened(n => n + 1)
    toast(`Word файл солигдлоо: «${f.name}».`)
  }

  return (
    <section className="wdoc" aria-label="Word файл">
      <div className="wdoc__top">
        <p className="wdoc__mode" role="status">
          {missing && 'Хадгалсан Word файл энэ хөтөч дээр олдсонгүй. Гэрээний текстээс шинээр үүсгэлээ. '}
          {mode === 'viewing' ? 'Зөвхөн харах. Одоогийн шатанд танд засах эрх алга.'
            : mode === 'suggesting' ? `Таны засвар санал хэлбэрээр тэмдэглэгдэнэ. ${SAVED[saved]}` : SAVED[saved]}
        </p>
        <div className="wdoc__tools">
          {edits && <button type="button" className="btn btn--glass btn--sm" onClick={() => input.current?.click()}><FileUp className="ico" />Файл сонгох</button>}
          <button type="button" className="btn btn--glass btn--sm" disabled={state !== 'ready'} onClick={() => void download()}><Download className="ico" />Татах</button>
        </div>
      </div>
      {state === 'loading' && <p className="wdoc__wait" role="status">Word файлыг нээж байна…</p>}
      {state === 'failed' && <p className="wdoc__wait" role="alert">Word файлыг нээж чадсангүй. Хуудсыг дахин ачаална уу.</p>}
      <input ref={input} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      {edits && <div id="wordbar" className="wdoc__bar" />}
      <div ref={host} className="wdoc__doc" />
    </section>
  )
}
