// Скан оруулах windows: cutting a file into its papers by hand, when AI is off or cut a stack wrong. The pages show in rows,
// a row a paper, so the clerk sees what each paper will hold; a page can begin a new paper or be left out.
import { useEffect, useState } from 'react'
import { EyeOff, Scissors } from 'lucide-react'
import type { Id } from '../lib/types'
import { useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { getFile } from '../lib/files'
import { drawPage, viewPdf } from '../lib/pdf'
import { focusScan, groupsOf, splitItem } from '../lib/scan'
import { FormSheet, type Errors } from '../ui/FormSheet'

export function ScanSplit({ id, ai }: { id: Id; ai: boolean }) {
  const it = useApp().scans.find(x => x.id === id)
  const n = it?.file.pages ?? 1
  // Marked as AI would cut it, on the demo stack
  const [starts, setStarts] = useState(() => new Set(it?.suggest?.starts))
  const [drop, setDrop] = useState(() => new Set(it?.suggest?.blank))
  const [pics, setPics] = useState<string[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const file = it?.file.id
  useEffect(() => {
    let dead = false
    ;(async () => {
      const blob = file && (await getFile(file))
      if (!blob) return
      const view = await viewPdf(blob)
      try {
        for (let i = 0; i < view.numPages && !dead; i++) {
          const url = (await drawPage({ view }, i, 440)).toDataURL('image/jpeg', 0.75)
          if (!dead) setPics(p => Object.assign([...p], { [i]: url }))
        }
      } finally {
        view.loadingTask.destroy()
      }
    })().catch(() => {})
    return () => {
      dead = true
    }
  }, [file])
  if (!it) return null

  const flip = (marks: Set<number>, put: (s: Set<number>) => void, p: number) => {
    const next = new Set(marks)
    if (!next.delete(p)) next.add(p)
    put(next)
    setErrors({})
  }
  const groups = groupsOf(n, [...starts], [...drop])
  // A row from each start, its left-out pages still in it
  const rows: number[][] = []
  for (let p = 1; p <= n; p++) {
    if (p === 1 || starts.has(p)) rows.push([])
    rows[rows.length - 1].push(p)
  }
  const submit = () => {
    if (!groups.length) {
      setErrors({ 'ss-1-drop': 'Бүх хуудсыг хасах боломжгүй. Дор хаяж нэг хуудас үлдээнэ үү.' })
      return false
    }
    if (groups.length === 1 && groups[0].length === n) {
      setErrors({ [n > 1 ? 'ss-2-start' : 'ss-1-drop']: 'Шинэ баримт эхлэх эсвэл хасах хуудсаа сонгоно уу.' })
      return false
    }
    // The demo readings fit only the cut AI would make
    const g = it.suggest
    const same = g && JSON.stringify(groups) === JSON.stringify(groupsOf(n, g.starts, g.blank))
    splitItem(it, groups, ai, same ? g.readings : undefined).then(
      parts => {
        toast(`${parts.length} баримт болгон хуваалаа.`)
        focusScan(parts[0]?.id)
      },
      e => toast(e instanceof Error ? e.message : 'Файлыг хувааж чадсангүй.', { kind: 'warn' }),
    )
    return true
  }
  let paper = 0
  return (
    <FormSheet title="Хуудас хуваах" sub={it.file.name} submit="Хуваах" onSubmit={submit} onClose={close} errors={errors} wide>
      <div className="ssplit">
        <p className="ssplit__help">
          {it.suggest && <><b>Жишээ:</b> AI-ийн санал болгосноор тэмдэглэв. </>}
          Баримт эхэлж буй хуудсанд «Баримт эхлүүлэх», хоосон хуудсанд «Хасах» гэснийг дарна уу.
        </p>
        <p className="ssplit__sum" role="status">{groups.length} баримт болно.{drop.size > 0 && ` ${drop.size} хуудсыг хасна.`}</p>
        <div className="ssplit__pages">
          {rows.flatMap(row => {
            const kept = row.filter(p => !drop.has(p)).length
            if (kept) paper++
            return [
              <h3 key={`h${row[0]}`} className="ssplit__head">{kept ? `${paper}-р баримт · ${kept} хуудас` : 'Хасагдах хуудас'}</h3>,
              ...row.map(p => (
                <div key={p} className={`ssplit__page${drop.has(p) ? ' is-out' : ''}`}>
                  <span className="ssplit__pic">
                    {pics[p - 1] && <img src={pics[p - 1]} alt="" />}
                    <b className="ssplit__n">{p}</b>
                    {drop.has(p) && <span className="ssplit__out">Хасагдах</span>}
                  </span>
                  {p > 1 ? (
                    <button type="button" id={`ss-${p}-start`} className="ssplit__btn" aria-pressed={starts.has(p)} aria-label={`${p}-р хуудас: Баримт эхлүүлэх`} onClick={() => flip(starts, setStarts, p)}>
                      <Scissors className="ico" />Баримт эхлүүлэх
                    </button>
                  ) : <span className="ssplit__gap" aria-hidden="true" />}
                  <button type="button" id={`ss-${p}-drop`} className="ssplit__btn ssplit__btn--drop" aria-pressed={drop.has(p)} aria-label={`${p}-р хуудас: Хасах`} onClick={() => flip(drop, setDrop, p)}>
                    <EyeOff className="ico" />Хасах
                  </button>
                </div>
              )),
            ]
          })}
        </div>
      </div>
    </FormSheet>
  )
}
