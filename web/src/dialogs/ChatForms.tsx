// Чат windows: start a chat (one person, or a group of several), change a group's name and people, see a picture.
import { useState } from 'react'
import { Download } from 'lucide-react'
import type { BoardFile, Hue, Id } from '../lib/types'
import { actions, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { go } from '../lib/router'
import { collator, short } from '../lib/format'
import { getFile, saveBlob, useFileUrl } from '../lib/files'
import { FOLDER_HUES } from '../lib/docs'
import { Sheet } from '../ui/Sheet'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'
import { PeoplePick } from '../ui/PeoplePick'

/** Everyone who works in one of my companies, but me */
function usePeople() {
  const s = useApp()
  const me = s.people.find(p => p.id === s.me)
  return s.people.filter(p => p.id !== s.me && p.companies.some(c => me?.companies.includes(c))).sort((a, b) => collator.compare(a.given, b.given))
}

const toggle = (list: Id[], id: Id) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])

/** One person opens our chat (the old one if there is); several make a group */
export function NewChat() {
  const s = useApp()
  const people = usePeople()
  const [f, setF] = useState({ members: [] as Id[], name: '' })
  const [errors, setErrors] = useState<Errors>({})
  const submit = () => {
    if (!f.members.length) {
      setErrors({ 'nc-people': 'Чатлах хүнээ сонгоно уу.' })
      return false
    }
    const names = people.filter(p => f.members.includes(p.id)).map(short).join(', ')
    const hue: Hue = FOLDER_HUES[s.chats.length % FOLDER_HUES.length]
    const c = f.members.length === 1 ? actions.directChat(f.members[0]) : actions.addGroup({ name: f.name.trim() || names, hue, members: [s.me, ...f.members] })
    go('chat', c.id)
    return true
  }
  return (
    <FormSheet title="Шинэ чат" sub="Нэг хүн сонговол хоёр хүний чат, олон хүн сонговол бүлэг үүснэ." submit="Эхлүүлэх" onSubmit={submit} onClose={close} errors={errors}>
      <fieldset className="field field--wide" id="nc-people" tabIndex={-1} aria-describedby={errors['nc-people'] ? 'nc-people-error' : undefined}>
        <legend className="field__label">Хэнтэй чатлах</legend>
        <PeoplePick people={people} value={f.members} onToggle={id => { setF({ ...f, members: toggle(f.members, id) }); setErrors({}) }} />
        {errors['nc-people'] && <span className="field__error" id="nc-people-error">{errors['nc-people']}</span>}
      </fieldset>
      {f.members.length > 1 && (
        <Field id="nc-name" label="Бүлгийн нэр" hint="Бичихгүй бол гишүүдийн нэрээр үүснэ." wide optional>
          <input id="nc-name" aria-describedby="nc-name-hint" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        </Field>
      )}
    </FormSheet>
  )
}

/** A group's name and people; I stay in it */
export function ChatGroup({ id }: { id: string }) {
  const s = useApp()
  const people = usePeople()
  const c = s.chats.find(x => x.id === id)
  const [f, setF] = useState({ name: c?.name ?? '', members: c?.members ?? [] })
  const [errors, setErrors] = useState<Errors>({})
  if (!c) return null
  const submit = () => {
    const e: Errors = {}
    if (!f.name.trim()) e['cg-name'] = 'Бүлгийн нэрийг бичнэ үү.'
    if (!f.members.some(x => x !== s.me)) e['cg-people'] = 'Дор хаяж нэг хүн сонгоно уу.'
    setErrors(e)
    if (Object.keys(e).length) return false
    actions.updateChat(c.id, { name: f.name.trim(), members: [s.me, ...f.members.filter(x => x !== s.me)] })
    toast('Өөрчлөлт хадгалагдлаа.')
    return true
  }
  return (
    <FormSheet title="Бүлэг засах" submit="Хадгалах" onSubmit={submit} onClose={close} errors={errors}>
      <Field id="cg-name" label="Бүлгийн нэр" error={errors['cg-name']} wide>
        <input {...fieldAria('cg-name', errors['cg-name'])} value={f.name} onChange={e => { setF({ ...f, name: e.target.value }); setErrors({}) }} />
      </Field>
      <fieldset className="field field--wide" id="cg-people" tabIndex={-1} aria-describedby={errors['cg-people'] ? 'cg-people-error' : undefined}>
        <legend className="field__label">Гишүүд</legend>
        <PeoplePick people={people} value={f.members} onToggle={x => { setF({ ...f, members: toggle(f.members, x) }); setErrors({}) }} />
        {errors['cg-people'] && <span className="field__error" id="cg-people-error">{errors['cg-people']}</span>}
      </fieldset>
    </FormSheet>
  )
}

/** A picture sent in a chat, big, with a way to save it */
export function Picture({ file }: { file: BoardFile }) {
  const url = useFileUrl(file.id)
  return (
    <Sheet label={file.name} onClose={close} wide>
      <div className="cbig">
        {url ? <img src={url} alt={file.name} /> : <p className="dview__note">{url === null ? 'Зураг олдсонгүй.' : 'Нээж байна…'}</p>}
        <button type="button" className="btn btn--accent" onClick={() => getFile(file.id).then(b => b && saveBlob(file.name, b))}><Download className="ico" />Татах</button>
      </div>
    </Sheet>
  )
}
