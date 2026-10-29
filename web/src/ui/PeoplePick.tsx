// A list of people to tick, with their face and job: who sees a document, who works on a project.
import type { Id, Person } from '../lib/types'
import { short } from '../lib/format'
import { Avatar } from './bits'

/** `locked` stays ticked, with a word on why in place of the job (a project's lead) */
export function PeoplePick({ people, value, onToggle, locked }: {
  people: Person[]
  value: Id[]
  onToggle: (id: Id) => void
  locked?: { id: Id; note: string }
}) {
  return (
    <ul className="people-pick">
      {people.map(p => {
        const fixed = p.id === locked?.id
        return (
          <li key={p.id}>
            <label>
              <input type="checkbox" className="check" checked={fixed || value.includes(p.id)} disabled={fixed} onChange={() => onToggle(p.id)} />
              <Avatar person={p} size="sm" />
              <span><b>{short(p)}</b><small>{fixed ? locked.note : p.role}</small></span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}
