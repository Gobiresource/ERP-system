// A new project, who works on a project (its lead, Төслийн ахлах, and the people with them, Оролцогчид), and its
// milestones (Үе шат).
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Hue, Id, ProjectIcon } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { close, toast } from '../lib/ui'
import { go } from '../lib/router'
import { addDaysYmd, collator, dateDots, parse, short, today } from '../lib/format'
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

/** A milestone (Үе шат), new or to change: a name and the day it is due. From the project's page, by anyone on it. */
export function MilestoneForm({ project, id }: { project: Id; id?: Id }) {
  const p = scoped(useApp()).project(project)
  const old = p?.milestones.find(m => m.id === id)
  // A new one two weeks on, or on the project's last day if that is sooner
  const soon = addDaysYmd(today(), 14)
  const [f, setF] = useState({ name: old?.name ?? '', date: old?.date ?? (p && p.due < soon ? p.due : soon) })
  const [errors, setErrors] = useState<Errors>({})
  if (!p) return null
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    if (errors[`ms-${k}`]) setErrors(({ [`ms-${k}`]: _, ...rest }) => rest)
  }
  const submit = () => {
    const e: Errors = {}
    if (!f.name.trim()) e['ms-name'] = 'Үе шатны нэрийг бичнэ үү.'
    if (!f.date) e['ms-date'] = 'Огноог сонгоно уу.'
    setErrors(e)
    if (Object.keys(e).length) return false
    actions.saveMilestone(p.id, { id: old?.id, name: f.name.trim(), date: f.date })
    toast(old ? 'Үе шат хадгалагдлаа.' : 'Үе шат нэмэгдлээ.')
    return true
  }
  // Taken away at once, with Буцаах: nothing else hangs on a milestone
  const remove = () => {
    const before = p.milestones
    actions.setMilestones(p.id, before.filter(m => m.id !== old?.id))
    close()
    toast('Үе шат устгагдлаа.', { undo: () => actions.setMilestones(p.id, before) })
  }
  return (
    <FormSheet title={old ? 'Үе шат засах' : 'Үе шат нэмэх'} sub={p.name} submit={old ? 'Хадгалах' : 'Нэмэх'} onSubmit={submit} onClose={close} errors={errors}>
      <Field id="ms-name" label="Нэр" error={errors['ms-name']} wide>
        <input {...fieldAria('ms-name', errors['ms-name'])} value={f.name} onChange={set('name')} placeholder="Жишээ нь: Зураг төсөл батлуулах" data-autofocus />
      </Field>
      <Field id="ms-date" label="Огноо" hint={`Төслийн хугацаа: ${dateDots(parse(p.start))}–${dateDots(parse(p.due))}`} error={errors['ms-date']} wide>
        <input {...fieldAria('ms-date', errors['ms-date'], true)} type="date" value={f.date} onChange={set('date')} />
      </Field>
      {old && (
        <div className="field field--wide">
          <button type="button" className="btn btn--ghost ms-remove" onClick={remove}><Trash2 className="ico" />Үе шатыг устгах</button>
        </div>
      )}
    </FormSheet>
  )
}
