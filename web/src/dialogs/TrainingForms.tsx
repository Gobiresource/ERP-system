// Сургалт: adding and changing a lesson (a title, its topic, a text and files)
import { useState, type ChangeEvent } from 'react'
import { Paperclip, X } from 'lucide-react'
import type { BoardFile } from '../lib/types'
import { actions, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { putFile } from '../lib/files'
import { cid, fileSize } from '../lib/draft'
import { MAX_FILE, MAX_VIDEO, topicsOf } from '../lib/training'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'

export function LessonForm({ id }: { id?: string }) {
  const s = useApp()
  const was = id ? s.lessons.find(l => l.id === id) : undefined
  const [f, setF] = useState({ title: was?.title ?? '', topic: was?.topic ?? '', text: was?.text ?? '' })
  const [files, setFiles] = useState<BoardFile[]>(was?.files ?? [])
  const [saving, setSaving] = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const drop = (k: string) => setErrors(({ [k]: _, ...rest }) => rest)
  const topics = topicsOf(s.lessons.filter(l => l.company === (was?.company ?? s.company)))

  // Each file is kept as soon as it is chosen, so saving the form never waits
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = [...(e.target.files ?? [])]
    e.target.value = '' // a file that was removed can be chosen again
    drop('lf-files')
    drop('lf-text')
    const big = chosen.filter(x => x.size > (x.type.startsWith('video/') ? MAX_VIDEO : MAX_FILE))
    if (big.length) setErrors(v => ({ ...v, 'lf-files': `Хэт том файл: ${big.map(x => x.name).join(', ')}. Бичлэг 200 MB, бусад файл 25 MB хүртэл байна.` }))
    const ok = chosen.filter(x => !big.includes(x))
    setSaving(n => n + ok.length)
    for (const x of ok) {
      const ref = { id: `f${cid()}`, name: x.name, type: x.type, size: x.size }
      try {
        await putFile(ref.id, x)
        setFiles(v => [...v, ref])
      } catch {
        setErrors(v => ({ ...v, 'lf-files': 'Энэ хөтөч дээр файл хадгалах боломжгүй байна.' }))
      } finally {
        setSaving(n => n - 1)
      }
    }
  }
  const submit = () => {
    const e: Errors = {}
    if (!f.title.trim()) e['lf-title'] = 'Материалын гарчгийг бичнэ үү.'
    if (saving) e['lf-files'] = 'Файл хадгалагдаж дуусахыг хүлээнэ үү.'
    else if (!f.text.trim() && !files.length) e['lf-text'] = 'Заавраа бичнэ үү, эсвэл файл сонгоно уу.'
    setErrors(e)
    if (Object.keys(e).length) return false
    const lesson = { title: f.title.trim(), topic: f.topic.trim() || 'Ерөнхий', text: f.text.trim(), files }
    if (was) {
      actions.updateLesson(was.id, lesson)
      toast('Өөрчлөлт хадгалагдлаа.')
    } else {
      actions.addLesson(lesson)
      toast('Материал нэмэгдлээ.')
    }
    return true
  }

  return (
    <FormSheet
      title={was ? 'Материал засах' : 'Материал нэмэх'}
      sub="Энэ ХХК-ийн бүх ажилтан үзнэ."
      submit={was ? 'Хадгалах' : 'Нэмэх'} onSubmit={submit} onClose={close} errors={errors} wide
    >
      <Field id="lf-title" label="Гарчиг" error={errors['lf-title']}>
        <input {...fieldAria('lf-title', errors['lf-title'])} data-autofocus value={f.title} onChange={e => { setF({ ...f, title: e.target.value }); drop('lf-title') }} />
      </Field>
      <Field id="lf-topic" label="Сэдэв" optional hint="Жишээ нь: ХАБЭА, Шинэ ажилтан">
        <input {...fieldAria('lf-topic', undefined, true)} list="lf-topics" value={f.topic} onChange={e => setF({ ...f, topic: e.target.value })} />
        <datalist id="lf-topics">{topics.map(t => <option key={t} value={t} />)}</datalist>
      </Field>
      <Field id="lf-text" label="Заавар" optional wide hint="Алхам бүрийг шинэ мөрөнд бичнэ. «1.» гэж эхэлсэн мөрүүд дугаартай жагсаалт болно." error={errors['lf-text']}>
        <textarea {...fieldAria('lf-text', errors['lf-text'], true)} rows={7} value={f.text} onChange={e => { setF({ ...f, text: e.target.value }); drop('lf-text') }} />
      </Field>
      <Field id="lf-files" label="Зураг, бичлэг, файл" optional wide hint="Хэдийг ч сонгож болно. Бичлэг 200 MB, бусад файл 25 MB хүртэл" error={errors['lf-files']}>
        <span className="dfilepick">
          <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" {...fieldAria('lf-files', errors['lf-files'], true)} onChange={pick} />
          <span className="btn btn--glass btn--sm" aria-hidden="true"><Paperclip className="ico" />Файл сонгох</span>
          <span className="dfilepick__name">{saving ? 'Хадгалж байна…' : files.length ? `Сонгосон файл: ${files.length}` : 'Файл сонгоогүй'}</span>
        </span>
        {files.length > 0 && (
          <ul className="tr-picked">
            {files.map(x => (
              <li key={x.id}>
                <span>{x.name}</span>
                <small>{fileSize(x.size)}</small>
                <button type="button" className="ibtn ibtn--sm" aria-label={`${x.name}: хасах`} title="Хасах" onClick={() => setFiles(v => v.filter(y => y.id !== x.id))}><X className="ico" /></button>
              </li>
            ))}
          </ul>
        )}
      </Field>
    </FormSheet>
  )
}
