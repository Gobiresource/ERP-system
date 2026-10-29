// Зурвас (chat) windows: start one (one person, or a group of several), change a group's name and people, see who has
// read a message.
import { useState } from 'react'
import type { Hue, Id, Person } from '../lib/types'
import { actions, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { go } from '../lib/router'
import { collator, short } from '../lib/format'
import { FOLDER_HUES } from '../lib/docs'
import { Sheet } from '../ui/Sheet'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'
import { PeoplePick } from '../ui/PeoplePick'
import { Avatar, PRESENCE } from '../ui/bits'

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
      setErrors({ 'nc-people': 'Хэнд бичихээ сонгоно уу.' })
      return false
    }
    const names = people.filter(p => f.members.includes(p.id)).map(short).join(', ')
    const hue: Hue = FOLDER_HUES[s.chats.length % FOLDER_HUES.length]
    const c = f.members.length === 1 ? actions.directChat(f.members[0]) : actions.addGroup({ name: f.name.trim() || names, hue, members: [s.me, ...f.members] })
    go('chat', c.id)
    return true
  }
  return (
    <FormSheet title="Шинэ зурвас" sub="Нэг хүн сонговол хувийн зурвас, олон хүн сонговол бүлэг үүснэ." submit="Бичих" onSubmit={submit} onClose={close} errors={errors}>
      <fieldset className="field field--wide" id="nc-people" tabIndex={-1} aria-describedby={errors['nc-people'] ? 'nc-people-error' : undefined}>
        <legend className="field__label">Хэнд бичих</legend>
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
/** Who has read one of my messages and who has not yet, with each one's reaction */
export function Readers({ id }: { id: Id }) {
  const s = useApp()
  const m = s.messages.find(x => x.id === id)
  const chat = s.chats.find(c => c.id === m?.chat)
  if (!m || !chat) return null
  const others = s.people.filter(p => p.id !== s.me && chat.members.includes(p.id)).sort((a, b) => collator.compare(a.given, b.given))
  const read = others.filter(p => (chat.read[p.id] ?? '') >= m.at)
  const list = (title: string, people: Person[]) => people.length > 0 && (
    <section className="creaders">
      <h3>{title} <span className="tnum">{people.length}</span></h3>
      <ul>
        {people.map(p => (
          <li key={p.id}>
            <Avatar person={p} size="sm" presence />
            <span><b>{short(p)}</b><small>{PRESENCE[p.presence]}</small></span>
            {m.reactions?.[p.id] && <span className="creaders__emoji">{m.reactions[p.id]}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
  return (
    <Sheet label="Хэн уншсан" onClose={close}>
      <div className="creaders__wrap">
        <h2 className="sheet__title">Хэн уншсан</h2>
        <p className="creaders__what">{m.text || m.files[0]?.name || m.refs[0]?.label}</p>
        {list('Уншсан', read)}
        {list('Уншаагүй', others.filter(p => !read.includes(p)))}
      </div>
    </Sheet>
  )
}
