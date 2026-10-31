// Who may see and do what (Удирдлага). Each person signs in with their own account and has rights in each ХХК they
// belong to. Хүний нөөц and Ирц reach everyone in the ХХК, or only the people under the person by Шууд удирдлага: a
// branch director's or a department head's own people (docs/decisions.md, 2026-10-31). Screens and actions check these;
// in this preview everything lives in the browser, so the server checks them again once it holds the data.
import type { Access, Account, Employee, Id, Person, Scope, State } from './types'
import { current, hrScoped, type HrScoped } from './hr'
import { bossOf } from './reports'

export const NO_ACCESS: Access = { admin: false, hr: 'none', hrEdit: false, attendance: 'none' }

/** Ready-made sets of rights; the admin picks one and may change any right after */
export const PRESETS: { key: string; name: string; hint: string; access: Access }[] = [
  { key: 'director', name: 'Захирал', hint: 'Бүх мэдээллийг харж, хэрэглэгч, эрхийг удирдана.', access: { admin: true, hr: 'all', hrEdit: true, attendance: 'all' } },
  { key: 'hr', name: 'Хүний нөөц', hint: 'Бүх ажилтны бүртгэлийг хөтөлж, ирцийг харна.', access: { admin: false, hr: 'all', hrEdit: true, attendance: 'all' } },
  { key: 'head', name: 'Салбарын захирал', hint: 'Зөвхөн хариуцсан ажилтныхаа мэдээлэл, ирцийг харна.', access: { admin: false, hr: 'team', hrEdit: false, attendance: 'team' } },
  { key: 'staff', name: 'Ажилтан', hint: 'Өөрийн ажил, зурвас, бичиг хэргийг харна.', access: NO_ACCESS },
]

export const SCOPE: Record<Scope, string> = { none: 'Харахгүй', team: 'Хариуцсан ажилтан', all: 'Бүх ажилтан' }

const same = (a: Access, b: Access) => a.admin === b.admin && a.hr === b.hr && a.hrEdit === b.hrEdit && a.attendance === b.attendance
/** The ready-made set the rights are, if any */
export const presetOf = (a: Access) => PRESETS.find(p => same(p.access, a))

/** The person's rights in the ХХК: none without an active account or outside the ХХК; all for whoever sets the system up */
export function accessOf(s: Pick<State, 'people'>, who: Id, company: Id): Access {
  const a = s.people.find(p => p.id === who)?.account
  if (!a?.active) return NO_ACCESS
  if (a.sysadmin) return PRESETS[0].access
  return s.people.find(p => p.id === who)!.companies.includes(company) ? a.access[company] ?? NO_ACCESS : NO_ACCESS
}

type Org = Pick<State, 'employees' | 'departments' | 'roles'>

/** The ХХК's employees under the person by Шууд удирдлага, all the way down, and the person's own record */
export function teamOf(s: Org, who: Id, company: Id): Set<Id> {
  const staff = s.employees.filter(e => e.company === company && current(e))
  const under = new Map<Id, Id[]>()
  for (const e of staff) {
    const b = bossOf(s, e)
    if (b && b !== 'none') under.set(b.id, [...(under.get(b.id) ?? []), e.id])
  }
  const mine = staff.filter(e => e.user === who).map(e => e.id)
  const team = new Set(mine)
  for (const todo = [...mine]; todo.length; ) for (const id of under.get(todo.pop()!) ?? []) if (!team.has(id)) (team.add(id), todo.push(id))
  return team
}

/** Whether a right that reaches so far lets the person see an employee */
export function seer(s: Org, who: Id, company: Id, scope: Scope): (e: Employee) => boolean {
  if (scope === 'all') return () => true
  if (scope === 'none') return () => false
  const team = teamOf(s, who, company)
  return e => team.has(e.id)
}

/** Хүний нөөц as the signed-in person may see it; everyone of the ХХК stays in `all`, for codes, Шууд удирдлага and headcount */
export interface HrView extends HrScoped { all: Employee[]; access: Access }
const views = new WeakMap<State, HrView>()
export function hrView(s: State): HrView {
  let v = views.get(s)
  if (!v) {
    const base = hrScoped(s)
    const access = accessOf(s, s.me, s.company)
    const employees = base.employees.filter(seer(s, s.me, s.company, access.hr))
    const ids = new Set(employees.map(e => e.id))
    v = { ...base, employees, all: base.employees, access, employee: id => (ids.has(id) ? base.employee(id) : undefined) }
    views.set(s, v)
  }
  return v
}

// Passwords: PBKDF2-SHA256 with a salt of its own, 600,000 rounds (OWASP 2023). The server will use scrypt.
const ROUNDS = 600_000
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

export async function hashOf(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return b64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: ROUNDS }, key, 256)))
}
export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)))
/** At least 8 characters, letters and figures both */
export const strongEnough = (p: string) => p.length >= 8 && /\p{L}/u.test(p) && /\d/.test(p)
/** Lower case, without spaces at the ends: "Bold " signs in as "bold" */
export const loginKey = (login: string) => login.trim().toLowerCase()

/** The example password of the example accounts, already hashed (the same for all of them; the real system has none) */
export const DEMO_PASSWORD = 'erp2026'
const DEMO = { salt: 'ZXJwLWRlbW8tc2FsdC12MQ==', hash: '0xWuK0wKKs7aEqDWFT5dvrFxDFRNaNbYY18QpJqd/+Y=' }
/** Still on the example password: the sign-in page offers it to try the preview */
export const isDemo = (a?: Account) => a?.hash === DEMO.hash

/**
 * Accounts for the example people: the e-mail's name to sign in with, the example password, and rights by what each
 * does: the directors run everything, Хүний нөөц keeps the records, those with people under them see those people.
 */
export function demoAccounts(s: Pick<State, 'people' | 'companies'> & Org): Person[] {
  return s.people.map(p => {
    if (p.account) return p
    const access: Account['access'] = {}
    for (const c of p.companies) {
      // Ерөнхий, Гүйцэтгэх, Дэд захирал run the ХХК; Санхүү хариуцсан захирал heads a branch
      const preset = /захирал$/i.test(p.role) && !/хариуцсан/i.test(p.role) ? 'director'
        : p.team === 'Хүний нөөц' ? 'hr'
          : teamOf(s, p.id, c).size > 1 ? 'head' : 'staff'
      access[c] = { ...PRESETS.find(x => x.key === preset)!.access }
    }
    return { ...p, account: { login: p.email.split('@')[0], ...DEMO, active: true, sysadmin: p.id === 'u1' || undefined, access } }
  })
}
