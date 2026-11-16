// Who may read and change what, asked on the server: the same rules the screens follow (src/lib/access.ts and each
// part's own rules), where nobody can step around them. A browser is sent only what its person may see, and a change it
// sends is taken only if its person may make it.
//
// Reading follows the screens exactly. Changing is checked by who may touch a record at all (its ХХК, its owner, its
// part in a process); the finer order of a process's steps is still the browser's to keep (docs/decisions.md, 2026-11-15).
import type { Chat, Contract, Doc, DocRequest, Draft, Employee, HrRequest, Id, Message, MonthReport, Person, ScanItem, State } from '../src/lib/types.ts'
import { accessOf, docView, managesAccount, seer, teamOf } from '../src/lib/access.ts'
import { rolesOf } from '../src/lib/contracts.ts'
import { actorsOf, involves } from '../src/lib/hrRequests.ts'
import { managerOf, seesAll } from '../src/lib/reports.ts'
import { teaches } from '../src/lib/training.ts'
import type { Op } from '../src/lib/patch.ts'
import type { Table } from '../src/lib/tables.ts'

/** What the rules read: who works where with which rights, who reports to whom, who holds which role, who is in which chat */
export const ORG = ['people', 'companies', 'roles', 'employees', 'departments', 'chats', 'timely'] as const
export type Org = Pick<State, (typeof ORG)[number]>

/** A person asking, and what is already known about them */
export interface Ctx {
  me: Id
  /** The organisation as a state the app's own rules read, with this person as `me` */
  s: State
  /** Whoever set the system up: every right in every ХХК */
  sys: boolean
  /** The ХХК the person works in */
  mine: Set<Id>
  /** The chats the person is in */
  chats: Set<Id>
  /** A record of the organisation, already read */
  rec<T>(c: (typeof ORG)[number], id: Id): T | undefined
  sees: Map<Id, (e: Employee) => boolean>
}

export function ctxOf(org: Org, me: Id, rec: Ctx['rec']): Ctx | null {
  const p = org.people.find(x => x.id === me)
  if (!p?.account?.active) return null
  return {
    me, rec, sys: !!p.account.sysadmin, mine: new Set(p.companies), sees: new Map(),
    s: { ...org, me } as unknown as State,
    chats: new Set(org.chats.filter(c => c.members.includes(me)).map(c => c.id)),
  }
}

const member = (x: Ctx, company: Id) => x.sys || x.mine.has(company)
const rights = (x: Ctx, company: Id) => accessOf(x.s, x.me, company)
/** Whether Хүний нөөц's reach lets the person see an employee's record whole */
function whole(x: Ctx, e: Employee) {
  let f = x.sees.get(e.company)
  if (!f) x.sees.set(e.company, (f = seer(x.s, x.me, e.company, rights(x, e.company).hr)))
  return f(e)
}

/**
 * An employee as everyone of the ХХК gets them: their place in the structure, which monthly reports, requests and
 * Шууд удирдлага go by. The registration number, phone, address, contract, history and personal file stay with those
 * Хүний нөөц's rights reach. `card` tells the browser the rest was kept back.
 */
export const card = (e: Employee): Employee => ({
  id: e.id, company: e.company, user: e.user, code: e.code, family: e.family, given: e.given, dept: e.dept, position: e.position, hired: e.hired, status: e.status,
  hue: e.hue, manager: e.manager, regNo: '', phone: '', contract: { kind: 'open', no: '', start: '' }, moves: [], files: [], card: true,
})

/** What the rules read without opening a record: its ХХК, and whose it is or which chat's */
export function cols(c: Table, id: Id, r: unknown): { co: string; k: string } {
  const x = r as { company?: Id; to?: unknown; who?: Id; owner?: Id; chat?: Id; by?: Id }
  const co = c === 'companies' || c === 'roles' || c === 'kpi' || c === 'timely' ? id : c === 'scans' ? ((x.to as ScanItem['to'] | undefined)?.company ?? '') : (x.company ?? '')
  const k = c === 'notices' ? x.to : c === 'focusLog' ? x.who : c === 'drafts' ? x.owner : c === 'messages' ? x.chat : c === 'requests' || c === 'scans' ? x.by : ''
  return { co: String(co), k: typeof k === 'string' ? k : '' }
}

/** What the person gets of a record: its JSON as kept, a lesser version, or null when it is not theirs to see */
export function see(x: Ctx, c: Table, r: { id: Id; co: string; k: string; data: string | null }): string | null {
  if (r.data === null) return null
  const ok = (yes: boolean) => (yes ? r.data : null)
  switch (c) {
    case 'companies': case 'roles': case 'kpi': case 'timely':
      return ok(member(x, r.id))
    case 'projects': case 'tasks': case 'events': case 'departments': case 'positions': case 'docTypes': case 'lessons':
      return ok(member(x, r.co))
    case 'notices': case 'drafts': case 'focusLog':
      return ok(r.k === x.me)
    case 'toursDone':
      return ok(r.id === x.me)
    case 'people': {
      const p = x.rec<Person>('people', r.id)
      // Whoever set the system up is the owner's own way in, out of everyone else's sight (the owner's wish,
      // docs/decisions.md, 2026-11-16): no list or picker of anyone else's ever shows them
      if (p?.account?.sysadmin && p.id !== x.me && !x.sys) return null
      return ok(!!p && (x.sys || p.id === x.me || p.companies.some(co => x.mine.has(co))))
    }
    case 'chats':
      return ok(x.chats.has(r.id))
    case 'messages':
      return ok(x.chats.has(r.k))
    case 'employees': {
      const e = x.rec<Employee>('employees', r.id)
      return !e || !member(x, e.company) ? null : whole(x, e) ? r.data : JSON.stringify(card(e))
    }
    case 'requests': case 'scans':
      return ok(r.k === x.me || rights(x, r.co).docsEdit)
    case 'docs':
      return ok(docView(x.s).doc(JSON.parse(r.data) as Doc))
    case 'contracts':
      return ok(docView(x.s).contract(JSON.parse(r.data) as Contract))
    case 'reports': {
      const m = JSON.parse(r.data) as MonthReport
      return ok(m.person === x.me || m.manager === x.me || seesAll(x.s, m.company, x.me) || managerOf(x.s, m.company, m.person) === x.me)
    }
    case 'hrRequests': {
      const q = JSON.parse(r.data) as HrRequest
      if (involves(x.s, q, x.me)) return r.data
      // A leave the director has signed shows in Календарь to everyone of the ХХК: who is away and when, nothing more
      if (q.kind !== 'leave' || !q.order || q.status === 'canceled' || !member(x, q.company)) return null
      return JSON.stringify({ id: q.id, company: q.company, by: q.by, kind: q.kind, status: q.status, step: q.step, from: q.from, to: q.to, days: q.days, order: q.order, history: [] })
    }
  }
}

/**
 * What decides which records the person may see, as one short word. A browser sends back the word it was last given;
 * when it differs (rights, people under them or a role changed), old records may have come into reach or gone out of
 * it, so the browser is sent everything afresh.
 */
export function scopeOf(x: Ctx): string {
  const p = x.rec<Person>('people', x.me)!
  const per = p.companies.map(c => {
    const team = teamOf(x.s, x.me, c)
    const staff = x.s.employees.filter(e => e.company === c && e.user)
    return [
      c, rights(x, c), [...team].sort(),
      staff.filter(e => team.has(e.id)).map(e => e.user).sort(),
      staff.filter(e => managerOf(x.s, c, e.user!) === x.me).map(e => e.user).sort(),
      Object.entries(x.s.roles[c] ?? {}).filter(([, who]) => who === x.me).map(([role]) => role).sort(),
      actorsOf(x.s, { company: c }, 'hr').includes(x.me),
    ]
  })
  const text = JSON.stringify([x.sys, per])
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return `${text.length.toString(36)}.${(h >>> 0).toString(36)}`
}

// Changing

/** Why a change was not taken, as the person reads it (lib/ui.ts shows it as it is) */
export const NO = 'Танд энэ өөрчлөлтийг хийх эрх алга. Өөрчлөлт хадгалагдсангүй.'
/** Records nothing ever removes */
const KEPT: Table[] = ['companies', 'people', 'employees', 'notices', 'focusLog', 'requests', 'hrRequests', 'chats', 'messages', 'contracts', 'reports', 'roles', 'kpi', 'toursDone']

/** A person's own fields, theirs to change */
const OWN = ['role', 'avatar', 'presence', 'tz', 'capacity', 'team', 'hue']
/** The name and e-mail, which Хүний нөөц's keeper changes with the HR record too */
const NAME = ['given', 'family', 'email']
const LOGIN = /^[a-z0-9._-]{3,32}$/

/** A change to a person: each place by its own rule; null when all may be made */
function person(x: Ctx, old: Person, next: Person, ops: Op[]): string | null {
  for (const [path] of ops) {
    const [a, b, c] = path
    if (NAME.includes(a) && path.length === 1) {
      if (old.id !== x.me && !old.companies.some(co => rights(x, co).hrEdit)) return NO
    } else if (OWN.includes(a)) {
      if (old.id !== x.me) return NO
    } else if (a === 'companies' && path.length === 1) {
      // Whoever set the system up joins the ХХК they add; nobody is taken out of one here
      if (!x.sys || old.id !== x.me || !old.companies.every(co => next.companies.includes(co))) return NO
    } else if (a === 'account' && old.account && next.account) {
      if (b === 'toured' || b === 'lastLogin') {
        if (old.id !== x.me) return NO
      } else if (b === 'access' && c) {
        if (!rights(x, c).admin || (old.account.sysadmin && !x.sys)) return NO
        if (old.id === x.me && !x.sys && !next.account.access[c]?.admin) return 'Өөрийн удирдлагын эрхийг хасах боломжгүй.'
      } else if (b === 'login' && path.length === 2) {
        if (!managesAccount(x.s, x.me, old.id)) return NO
        if (!LOGIN.test(next.account.login)) return 'Нэвтрэх нэр латин үсэг, тоотой, 3-аас 32 тэмдэгт байх ёстой.'
      } else if (b === 'active' && path.length === 2) {
        if (!managesAccount(x.s, x.me, old.id)) return NO
        if (old.id === x.me && !next.account.active) return 'Өөрийгөө идэвхгүй болгох боломжгүй.'
      } else return NO
    } else return NO
  }
  return null
}

/**
 * Whether the person may make this change: `old` is the record as kept (undefined when new), `next` as it would be
 * (undefined when removed), `ops` the places that change. Null when they may; else why not, to show them.
 */
export function may(x: Ctx, c: Table, id: Id, old: unknown, next: unknown, ops: Op[]): string | null {
  if (!next && (!old || KEPT.includes(c))) return NO
  /** The rule holds for the record as it was and as it will be: nobody moves a record out of, or into, their reach */
  const both = <T>(f: (r: T) => boolean) => ((!old || f(old as T)) && (!next || f(next as T)) ? null : NO)
  const co = (r: { company: Id }) => r.company
  switch (c) {
    case 'companies':
      // A new ХХК by whoever set the system up; its name and colour by its admin
      return old ? (rights(x, id).admin && (next as { code: string }).code === (old as { code: string }).code ? null : NO) : x.sys ? null : NO
    case 'people':
      // New people come through Хэрэглэгч нэмэх (server/auth.ts), with their password
      return old && next ? person(x, old as Person, next as Person, ops) : NO
    case 'projects': case 'tasks': case 'events':
      return both<{ company: Id }>(r => member(x, co(r)))
    case 'notices':
      return old && ops.every(([path]) => path.join() === 'read') && (old as { to: Id }).to === x.me ? null : NO
    case 'focusLog':
      return !old && (next as { who: Id }).who === x.me ? null : NO
    case 'drafts':
      return both<Draft>(r => r.owner === x.me && member(x, r.company))
    case 'departments': case 'positions': case 'docTypes':
      return both<{ company: Id }>(r => rights(x, co(r)).hrEdit)
    case 'employees': {
      if (both<Employee>(e => rights(x, e.company).hrEdit && whole(x, e)) === null) return null
      const e = old as Employee | undefined
      if (!e || !next) return NO
      // Their own name and e-mail follow their profile; a leave the director signs adds its line to the history
      const mine = e.user === x.me && ops.every(([path]) => path.length === 1 && NAME.includes(path[0]))
      const signed = rolesOf(x.s, e.company)?.director === x.me && whole(x, e) && ops.every(([path]) => path.join() === 'moves')
      return mine || signed ? null : NO
    }
    case 'docs':
      // The office keeps them; Гэрээ's clerk files a contract, and the director's signature makes a leave's order
      return both<Doc>(d => rights(x, d.company).docsEdit || (!old && [rolesOf(x.s, d.company)?.clerk, rolesOf(x.s, d.company)?.director].includes(x.me) && d.by === x.me))
    case 'requests':
      return both<DocRequest>(r => (old ? rights(x, r.company).docsEdit : r.by === x.me && member(x, r.company)))
    case 'scans':
      return both<ScanItem>(r => rights(x, r.to.company).docsEdit)
    case 'hrRequests':
      return both<HrRequest>(r => member(x, r.company) && (old ? involves(x.s, r, x.me) : r.by === x.me))
    case 'chats':
      // A member changes it; when each one read it is theirs alone to say
      if (old) return (old as Chat).members.includes(x.me) && ops.every(([path]) => path[0] !== 'read' || path[1] === x.me) ? null : NO
      return (next as Chat).by === x.me && (next as Chat).members.includes(x.me) ? null : NO
    case 'messages': {
      const m = (old ?? next) as Message
      if (!x.chats.has(m.chat) || (next as Message).chat !== m.chat) return NO
      // Someone else's message takes only one's own reaction
      return m.by === x.me || (!!old && ops.every(([path]) => path.length === 2 && path[0] === 'reactions' && path[1] === x.me)) ? null : NO
    }
    case 'contracts':
      return both<Contract>(k => member(x, k.company) && (old ? docView(x.s).contract(k) : k.owner === x.me))
    case 'reports': {
      const r = (old ?? next) as MonthReport
      const n = next as MonthReport
      if (n.company !== r.company || n.person !== r.person || n.month !== r.month || !member(x, r.company)) return NO
      return r.person === x.me || (!!old && (r.manager === x.me || managerOf(x.s, r.company, r.person) === x.me)) ? null : NO
    }
    case 'roles': case 'timely':
      return rights(x, id).admin ? null : NO
    case 'kpi':
      return seesAll(x.s, id, x.me) ? null : NO
    case 'lessons':
      return both<{ company: Id }>(r => teaches(x.s, x.me, co(r)))
    case 'toursDone':
      return id === x.me ? null : NO
  }
}
