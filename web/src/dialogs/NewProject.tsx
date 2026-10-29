// A new project, and who works on a project: its lead (Төслийн ахлах) and the people with them (Оролцогчид).
import { useState } from 'react'
import type { Hue, Id, ProjectIcon } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { go } from '../lib/router'
import { addDaysYmd, collator, short, today } from '../lib/format'
import { Field, FormSheet, fieldAria, type Errors } from '../ui/FormSheet'
import { PeoplePick } from '../ui/PeoplePick'

const HUES: [Hue, string][] = [['blue', 'Цэнхэр'], ['indigo', 'Хөх'], ['purple', 'Нил ягаан'], ['pink', 'Ягаан'], ['orange', 'Улбар шар'], ['yellow', 'Шар'], ['green', 'Ногоон'], ['teal', 'Усан цэнхэр']]
const ICONS: [ProjectIcon, string][] = [['rocket', 'Шинэ эхлэл'], ['building', 'Барилга'], ['file', 'Баримт бичиг'], ['clipboard', 'Жагсаалт'], ['monitor', 'Компьютер'], ['graduation', 'Сургалт'], ['truck', 'Тээвэр'], ['boxes', 'Агуулах'], ['handshake', 'Гэрээ'], ['receipt', 'Төлбөр']]

interface Team { lead: Id; members: Id[] }
/** The lead first, then everyone ticked: the lead is always on the team */
const team = (t: Team) => [t.lead, ...t.members.filter(x => x !== t.lead)]
const usePeople = () => [...scoped(useApp()).people].sort((a, b) => collator.compare(a.given, b.given))

function LeadField({ t, set, wide }: { t: Team; set: (t: Team) => void; wide?: boolean }) {
  const people = usePeople()
  return (
    <Field id="np-lead" label="Төслийн ахлах" wide={wide}>
      <select id="np-lead" value={t.lead} onChange={e => set({ ...t, lead: e.target.value })}>
        {people.map(p => <option key={p.id} value={p.id}>{short(p)}</option>)}
      </select>
    </Field>
  )
}

function MembersField({ t, set }: { t: Team; set: (t: Team) => void }) {
  const people = usePeople()
  const toggle = (id: Id) => set({ ...t, members: t.members.includes(id) ? t.members.filter(x => x !== id) : [...t.members, id] })
  return (
    <fieldset className="field field--wide">
      <legend className="field__label">Оролцогчид</legend>
      <PeoplePick people={people} value={t.members} onToggle={toggle} locked={{ id: t.lead, note: 'Төслийн ахлах' }} />
    </fieldset>
  )
}

export function NewProject() {
  const s = useApp()
  const [f, setF] = useState({ name: '', goal: '', lead: s.me, members: [s.me], hue: 'indigo' as Hue, due: addDaysYmd(today(), 30), icon: 'rocket' as ProjectIcon })
  const [errors, setErrors] = useState<Errors>({})
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    if (errors[`np-${k}`]) setErrors(({ [`np-${k}`]: _, ...rest }) => rest)
  }
  const setTeam = (t: Team) => setF({ ...f, ...t })

  const submit = () => {
    const e: Errors = {}
    if (!f.name.trim()) e['np-name'] = 'Төслийн нэрийг бичнэ үү.'
    if (!f.due) e['np-due'] = 'Дуусах өдрийг сонгоно уу.'
    else if (f.due < today()) e['np-due'] = 'Дуусах өдөр өнөөдрөөс хойш байх ёстой.'
    setErrors(e)
    if (Object.keys(e).length) return false
    const p = actions.addProject({ name: f.name.trim(), goal: f.goal.trim(), lead: f.lead, members: team(f), hue: f.hue, icon: f.icon, status: 'active', start: today(), due: f.due })
    toast('Төсөл үүсгэгдлээ.')
    go('projects', p.id)
    return true
  }

  return (
    <FormSheet title="Шинэ төсөл" submit="Үүсгэх" onSubmit={submit} onClose={close} errors={errors}>
      <Field id="np-name" label="Нэр" error={errors['np-name']} wide>
        <input {...fieldAria('np-name', errors['np-name'])} value={f.name} onChange={set('name')} placeholder="Хаврын борлуулалтын аян" data-autofocus />
      </Field>
      <Field id="np-goal" label="Зорилго" hint="Багийнхан бүгд санахуйц нэг хоёр өгүүлбэр." wide optional>
        <textarea id="np-goal" aria-describedby="np-goal-hint" value={f.goal} onChange={set('goal')} />
      </Field>
      <LeadField t={f} set={setTeam} />
      <Field id="np-due" label="Дуусах өдөр" error={errors['np-due']}>
        <input {...fieldAria('np-due', errors['np-due'])} type="date" value={f.due} onChange={set('due')} />
      </Field>
      <Field id="np-hue" label="Өнгө">
        <select id="np-hue" value={f.hue} onChange={set('hue')}>
          {HUES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field id="np-icon" label="Дүрс">
        <select id="np-icon" value={f.icon} onChange={set('icon')}>
          {ICONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <MembersField t={f} set={setTeam} />
    </FormSheet>
  )
}

/** From the project's page: change its lead, add or take off the people working on it */
export function ProjectTeam({ id }: { id: string }) {
  const p = scoped(useApp()).project(id)
  const [t, setT] = useState<Team>({ lead: p?.lead ?? '', members: p ? team(p) : [] })
  if (!p) return null
  const submit = () => {
    actions.updateProject(p.id, { lead: t.lead, members: team(t) })
    toast('Өөрчлөлт хадгалагдлаа.')
    return true
  }
  return (
    <FormSheet title="Оролцогчид" sub={p.name} submit="Хадгалах" onSubmit={submit} onClose={close} errors={{}}>
      <LeadField t={t} set={setT} wide />
      <MembersField t={t} set={setT} />
    </FormSheet>
  )
}
