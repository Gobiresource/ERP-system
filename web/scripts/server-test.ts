// Checks the server (server/api.ts) by itself, with a database in memory: founding, signing in, who gets which records,
// who may change what, two people changing one record, Ирц by rights (Timely is made up here), and the browser's side of
// sharing (src/lib/merge.ts) against it. No browser and no network:
//   node web/scripts/server-test.ts
// Before a deploy that changes a query, the same checks against Cloudflare's own database (scripts/d1-rest.ts), in an
// empty one made for the test and removed after:
//   NODE_USE_ENV_PROXY=1 node web/scripts/server-test.ts --d1=gobi-erp-test
import { handleApi, type ApiEnv } from '../server/api.ts'
import type { About, FileStore } from '../server/files.ts'
import { openDb } from '../server/sqlite.ts'
import { forget } from '../server/timely.ts'
import { restDb } from './d1-rest.ts'
import { PRESETS, NO_ACCESS } from '../src/lib/access.ts'
import { Mirror, type Answer, type Change } from '../src/lib/merge.ts'
import { diff, type Op } from '../src/lib/patch.ts'
import { LISTS, MAPS, type Shared, type Table } from '../src/lib/tables.ts'
import type { Access, Employee, Person } from '../src/lib/types.ts'

let failed = 0
let passed = 0
function ok(cond: unknown, what: string) {
  if (cond) passed++
  else {
    failed++
    console.log(`  FAIL ${what}`)
  }
}

const CODE = 'test-code-0123456789abcdef'
const b64 = (n: number, fill: number) => Buffer.alloc(n, fill).toString('base64')
/** What a browser would send for a password: here any 32 bytes, the same for the same word */
const hashOf = (password: string) => Buffer.from(password.padEnd(32, '.').slice(0, 32)).toString('base64')
const SALT = b64(16, 7)

type Row = [c: Table, id: string, pos: number, data: unknown]
/** A browser as far as the server sees one: its cookie, the last change it saw, and the records it holds */
class Browser {
  cookie = ''
  since = 0
  scope = ''
  recs = new Map<string, unknown>()
  env: ApiEnv
  constructor(env: ApiEnv) {
    this.env = env
  }
  async call(method: 'GET' | 'POST', path: string, body?: unknown, headers: Record<string, string> = {}) {
    const req = new Request(`https://erp.test/api/${path}`, { method, headers: { cookie: this.cookie, 'sec-fetch-site': 'same-origin', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
    const res = (await handleApi(req, this.env))!
    const set = res.headers.get('set-cookie')
    if (set) this.cookie = set.split(';')[0]
    const j = await res.json().catch(() => null)
    return { status: res.status, j, set }
  }
  /** A file as it goes up or comes down: its bytes, not JSON */
  async file(method: 'GET' | 'PUT', id: string, body?: Uint8Array, headers: Record<string, string> = {}) {
    const req = new Request(`https://erp.test/api/files/${id}`, { method, headers: { cookie: this.cookie, 'sec-fetch-site': 'same-origin', ...headers }, body })
    const res = (await handleApi(req, this.env))!
    return { status: res.status, bytes: res.status === 200 && method === 'GET' ? new Uint8Array(await res.arrayBuffer()) : undefined, type: res.headers.get('content-type'), tag: res.headers.get('etag'), j: res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => null) : null }
  }
  take(j: { seq: number; scope: string; full: boolean; rows: Row[] }) {
    if (j.full) this.recs.clear()
    for (const [c, id, , data] of j.rows) {
      if (data === null) this.recs.delete(`${c} ${id}`)
      else this.recs.set(`${c} ${id}`, data)
    }
    this.since = j.seq
    this.scope = j.scope
  }
  async pull() {
    const r = await this.call('GET', `sync?since=${this.since}&scope=${encodeURIComponent(this.scope)}`)
    if (r.status === 200) this.take(r.j)
    return r
  }
  /** Sends changes; returns what was refused */
  async push(changes: { c: Table; id: string; ops?: Op[]; gone?: true; pos?: number }[]) {
    const r = await this.call('POST', 'sync', { since: this.since, scope: this.scope, changes })
    if (r.status === 200) this.take(r.j)
    return r
  }
  put = (c: Table, rec: { id: string }, pos = 0) => this.push([{ c, id: rec.id, ops: [[[], rec]], pos }])
  /** Changes a record it holds, sending only what differs */
  edit<T>(c: Table, id: string, f: (r: T) => T) {
    const old = this.recs.get(`${c} ${id}`) as T
    return this.push([{ c, id, ops: diff(old, f(old)) }])
  }
  get = <T>(c: Table, id: string) => this.recs.get(`${c} ${id}`) as T | undefined
  ids = (c: Table) => [...this.recs.keys()].filter(k => k.startsWith(`${c} `)).map(k => k.slice(c.length + 1)).sort()
  async login(login: string, password: string) {
    return this.call('POST', 'login', { login, hash: hashOf(password) })
  }
}

/** The app as it runs in a browser, as far as sharing goes: its state, and the mirror of the server's records (lib/merge.ts) */
class App extends Browser {
  mirror = new Mirror()
  state = { ...Object.fromEntries(LISTS.map(c => [c, []])), ...Object.fromEntries(MAPS.map(c => [c, {}])) } as unknown as Shared
  /** How many changes the last round sent */
  sentCount = 0
  /** One round: sends what is unsent, takes the answer in. `during` runs while the request is on its way. */
  async sync(during?: () => void) {
    const changes: Change[] = this.mirror.pending(this.state)
    const sent = this.mirror.sentOf(this.state, changes)
    this.sentCount = changes.length
    const asked = changes.length
      ? this.call('POST', 'sync', { since: this.mirror.since, scope: this.mirror.scope, changes })
      : this.call('GET', `sync?since=${this.mirror.since}&scope=${encodeURIComponent(this.mirror.scope)}`)
    during?.()
    const r = await asked
    if (r.status === 200) this.state = this.mirror.merge(this.state, r.j as Answer, sent)
    return r
  }
  /** Changes one list of the state, as an action of the store does */
  list<T>(c: Table, f: (list: T[]) => T[]) {
    this.state = { ...this.state, [c]: f((this.state as unknown as Record<string, T[]>)[c]) }
  }
  titles = () => (this.state.tasks as { title: string; company: string }[]).filter(t => t.company === 'c1').map(t => t.title).join(' ')
}

const person = (id: string, given: string, company: string, login: string, access: Access): Person =>
  ({ id, given, family: 'Туршилт', role: 'Ажилтан', team: 'Баг', email: '', companies: [company], presence: 'away', hue: 'blue', capacity: 40, account: { login, active: true, access: { [company]: access } } as Person['account'] })
const preset = (key: string) => ({ ...PRESETS.find(p => p.key === key)!.access })
const employee = (id: string, company: string, user: string | undefined, given: string, more: Partial<Employee> = {}): Employee =>
  ({ id, company, user, code: `Т-${id}`, family: 'Овог', given, regNo: `УБ900101${id.replace(/\D/g, '').padStart(2, '0')}`, phone: '99112233', dept: 'd1', position: 'o1', hired: '2025-01-01', contract: { kind: 'open', no: '1', start: '2025-01-01' }, status: 'active', moves: [], files: [], hue: 'blue', ...more })

async function main() {
  const d1 = process.argv.find(a => a.startsWith('--d1='))?.slice(5)
  // The files in memory, as a store keeps them
  const kept = new Map<string, { body: ArrayBuffer; about: About }>()
  const FILES: FileStore = { get: async id => kept.get(id) ?? null, put: async (id, body, about) => void kept.set(id, { body, about }) }
  const env: ApiEnv = { DB: d1 ? await restDb(d1) : openDb(':memory:'), ATTENDANCE_CODE: CODE, FILES }
  const admin = new Browser(env)

  console.log('Founding')
  let r = await admin.call('GET', 'state')
  ok(r.status === 200 && r.j.server && !r.j.started && r.j.me === null && r.j.code === true, 'a fresh database says: a server, not started, nobody signed in, a code is needed')
  const founder = person('u1', 'Админ', 'c1', 'admin', preset('director'))
  const founding = [
    { c: 'companies', id: 'c1', ops: [[[], { id: 'c1', name: 'Туршилт ХХК', hue: 'blue', code: 'ТУ' }]], pos: 1 },
    { c: 'people', id: 'u1', ops: [[[], founder]], pos: 1 },
    { c: 'roles', id: 'c1', ops: [[[], { finance: 'u1', legal: 'u1', clerk: 'u1', director: 'u1', supply: 'u1' }]] },
    { c: 'docTypes', id: 'dt1', ops: [[[], { id: 'dt1', company: 'c1', name: 'Иргэний үнэмлэх', required: true, expires: true }]], pos: 1 },
  ]
  r = await admin.call('POST', 'setup', { code: 'wrong', login: 'admin', salt: SALT, hash: hashOf('pass1234'), changes: founding })
  ok(r.status === 401 && r.j.field === 'code', 'the wrong code founds nothing')
  r = await admin.call('POST', 'setup', { login: 'admin', salt: SALT, hash: hashOf('pass1234'), changes: founding })
  ok(r.status === 401, 'no code founds nothing')
  r = await new Browser({ ...env, ATTENDANCE_CODE: '' }).call('POST', 'setup', { code: '', login: 'admin', salt: SALT, hash: hashOf('pass1234'), changes: founding })
  ok(r.status === 503, 'a server with no code set cannot be founded at all')
  r = await admin.call('POST', 'setup', { code: 'TEST-code 0123456789abcdef', login: 'admin', salt: SALT, hash: hashOf('pass1234'), changes: founding }, { 'sec-fetch-site': 'cross-site' })
  ok(r.status === 403, 'another site cannot found it')
  r = await admin.call('POST', 'setup', { code: 'TEST-code 0123456789abcdef', login: 'admin', salt: SALT, hash: hashOf('pass1234'), changes: founding })
  ok(r.status === 200 && r.j.me === 'u1' && /HttpOnly/.test(r.set ?? '') && /Secure/.test(r.set ?? '') && /SameSite=Strict/.test(r.set ?? ''), 'the right code (however typed) founds it and signs the founder in with a cookie scripts cannot read')
  r = await new Browser(env).call('POST', 'setup', { code: CODE, login: 'other', salt: SALT, hash: hashOf('pass1234'), changes: founding.map(ch => (ch.c === 'people' ? { ...ch, id: 'u9', ops: [[[], { ...founder, id: 'u9' }]] } : ch)) })
  ok(r.status === 409, 'it is founded once only')
  r = await admin.call('GET', 'state')
  ok(r.j.started && r.j.me === 'u1', 'state: started, the founder signed in')
  r = await admin.pull()
  ok(r.status === 200 && r.j.full && admin.ids('companies').length === 1 && admin.ids('docTypes').length === 1 && admin.get<Record<string, string>>('roles', 'c1')?.director === 'u1', 'the founder gets the founding records')
  const me = admin.get<Person>('people', 'u1')!
  ok(me.account?.sysadmin === true && me.account.active && !('hash' in me.account) && !('salt' in me.account), 'the founder is the system admin; no password hash or salt in the record')

  console.log('Signing in')
  const anon = new Browser(env)
  r = await anon.pull()
  ok(r.status === 401 && r.j.signedOut, 'nobody signed in gets no data')
  r = await anon.call('POST', 'login/salt', { login: 'admin' })
  ok(r.j.salt === SALT, 'a login gets its salt')
  const fake1 = (await anon.call('POST', 'login/salt', { login: 'nobody' })).j.salt
  const fake2 = (await anon.call('POST', 'login/salt', { login: 'nobody' })).j.salt
  ok(/^[A-Za-z0-9+/]{22}==$/.test(fake1) && fake1 === fake2 && fake1 !== SALT, 'a login nobody has gets a salt too, the same each time')
  r = await anon.login('admin', 'wrong')
  ok(r.status === 401 && r.j.wrong && !r.j.wait, 'a wrong password is refused')
  r = await anon.login('nobody', 'pass1234')
  ok(r.status === 401 && r.j.wrong, 'a wrong login is refused the same way')
  for (let i = 0; i < 3; i++) await anon.login('admin', 'wrong')
  r = await anon.login('admin', 'wrong')
  ok(r.status === 401 && r.j.wait === 30, 'the fifth wrong password makes the next try wait 30 seconds')
  r = await anon.login('admin', 'pass1234')
  ok(r.status === 429 && r.j.wait > 0, 'while waiting, even the right password is not tried')
  await env.DB!.prepare(`UPDATE accounts SET until = 0 WHERE login = 'admin'`).all()
  r = await anon.login('admin', 'pass1234')
  ok(r.status === 200 && r.j.me === 'u1', 'the right password signs in')
  r = await anon.pull()
  ok(r.status === 200 && anon.ids('people').length === 1, 'and the data comes')
  r = await anon.call('POST', 'logout', {})
  ok(r.status === 200 && (await anon.pull()).status === 401, 'signed out: no data any more')
  r = await admin.call('POST', 'sync', { since: 0, scope: '', changes: [] }, { 'content-type': 'text/plain' })
  ok(r.status === 403, 'a request that is not JSON changes nothing')

  console.log('People and rights')
  const invite = (who: Browser, p: Person, password = 'pass1234') => who.call('POST', 'invite', { person: p, salt: SALT, hash: hashOf(password), pos: 5 })
  r = await invite(admin, person('u2', 'Хүний нөөц', 'c1', 'keeper', preset('hr')))
  ok(r.status === 200, 'the admin adds a person')
  r = await invite(admin, person('u3', 'Ажилтан', 'c1', 'staff', NO_ACCESS))
  ok(r.status === 200, 'and another')
  r = await invite(admin, person('u4', 'Давхар', 'c1', 'staff', NO_ACCESS))
  ok(r.status === 409, 'a login already taken is refused')
  r = await invite(admin, { ...person('u5', 'Хуурамч', 'c1', 'fake', preset('director')), account: { login: 'fake', active: true, sysadmin: true, access: { c1: preset('director'), c2: preset('director') } } as Person['account'] })
  await admin.pull()
  const u5 = admin.get<Person>('people', 'u5')
  ok(r.status === 200 && !u5?.account?.sysadmin && Object.keys(u5?.account?.access ?? {}).join() === 'c1', 'an invited person never comes as a system admin, nor with rights in another ХХК')
  const hr = new Browser(env)
  const staff = new Browser(env)
  ok((await hr.login('keeper', 'pass1234')).status === 200 && (await staff.login('staff', 'pass1234')).status === 200, 'both sign in')
  await hr.pull()
  await staff.pull()
  r = await invite(staff, person('u6', 'Зөвшөөрөлгүй', 'c1', 'nope', NO_ACCESS))
  ok(r.status === 403, 'a person without the right adds nobody')
  ok(staff.ids('people').length === 4 && staff.get<Person>('people', 'u1')?.account?.login === 'admin', 'everyone of the ХХК sees its people')
  r = await staff.edit<Person>('people', 'u3', p => ({ ...p, account: { ...p.account!, access: { c1: preset('director') } } }))
  ok(r.j.refused.length === 1 && !staff.get<Person>('people', 'u3')?.account?.access.c1.admin, 'nobody gives themself rights; the record comes back as it is')
  r = await staff.edit<Person>('people', 'u3', p => ({ ...p, account: { ...p.account!, sysadmin: true } }))
  ok(r.j.refused.length === 1, 'nor makes themself the system admin')
  r = await staff.edit<Person>('people', 'u2', p => ({ ...p, given: 'Өөр' }))
  ok(r.j.refused.length === 1, "nor changes someone else's name")
  r = await staff.edit<Person>('people', 'u3', p => ({ ...p, given: 'Шинэ нэр', presence: 'online', account: { ...p.account!, toured: true } }))
  ok(r.j.refused.length === 0 && staff.get<Person>('people', 'u3')?.given === 'Шинэ нэр', 'but their own name, presence and first sign-in mark, yes')
  await admin.pull()
  r = await admin.edit<Person>('people', 'u3', p => ({ ...p, account: { ...p.account!, access: { c1: preset('head') } } }))
  ok(r.j.refused.length === 0, 'the admin changes their rights')
  r = await staff.pull()
  ok(r.j.full === true && staff.get<Person>('people', 'u3')?.account?.access.c1.hr === 'team', 'whose rights changed is sent everything afresh')
  r = await admin.edit<Person>('people', 'u1', p => ({ ...p, account: { ...p.account!, active: false } }))
  ok(r.j.refused[0]?.[2] === 'Өөрийгөө идэвхгүй болгох боломжгүй.', 'nobody stops themself from signing in')
  r = await admin.edit<Person>('people', 'u5', p => ({ ...p, account: { ...p.account!, login: 'keeper' } }))
  ok(r.j.refused[0]?.[2] === 'Энэ нэвтрэх нэр өөр хүнд бүртгэлтэй байна.', "a login is not renamed to someone else's")
  r = await admin.edit<Person>('people', 'u5', p => ({ ...p, account: { ...p.account!, login: 'renamed' } }))
  const fake = new Browser(env)
  ok(r.j.refused.length === 0 && (await fake.login('fake', 'pass1234')).status === 401 && (await fake.login('renamed', 'pass1234')).status === 200, 'renamed, the person signs in with the new login only')
  r = await admin.edit<Person>('people', 'u5', p => ({ ...p, account: { ...p.account!, active: false } }))
  ok(r.j.refused.length === 0 && (await fake.pull()).status === 401 && (await fake.login('renamed', 'pass1234')).status === 403, 'made inactive, they are signed out at once and cannot sign in')

  console.log('Passwords')
  r = await staff.call('POST', 'password', { who: 'u3', salt: SALT, hash: hashOf('newpass99'), old: hashOf('wrong') })
  ok(r.status === 401 && r.j.field === 'old', 'a new password of one\'s own needs the present one')
  const staff2 = new Browser(env)
  await staff2.login('staff', 'pass1234')
  r = await staff.call('POST', 'password', { who: 'u3', salt: SALT, hash: hashOf('newpass99'), old: hashOf('pass1234') })
  ok(r.status === 200 && (await staff.pull()).status === 200 && (await staff2.pull()).status === 401, 'changed: this browser stays signed in, the others are signed out')
  ok((await staff2.login('staff', 'pass1234')).status === 401 && (await staff2.login('staff', 'newpass99')).status === 200, 'the old password no longer signs in; the new one does')
  r = await staff.call('POST', 'password', { who: 'u2', salt: SALT, hash: hashOf('hacked123') })
  ok(r.status === 403, "nobody sets someone else's password without managing their account")
  r = await admin.call('POST', 'password', { who: 'u2', salt: SALT, hash: hashOf('byadmin12') })
  ok(r.status === 200 && (await hr.pull()).status === 401 && (await hr.login('keeper', 'byadmin12')).status === 200, 'the admin sets one for them: they are signed out and sign in with it')
  await hr.pull()


  console.log('Who gets which records')
  // u1 admin (director), u2 Хүний нөөц, u3 a branch head, u7 plain staff under u3, u8 staff of another ХХК
  r = await invite(admin, person('u7', 'Доор', 'c1', 'under', NO_ACCESS))
  const under = new Browser(env)
  await under.login('under', 'pass1234')
  await under.pull()
  r = await admin.push([
    { c: 'departments', id: 'd1', ops: [[[], { id: 'd1', company: 'c1', name: 'Борлуулалт', code: 'БОР' }]], pos: 1 },
    { c: 'positions', id: 'o1', ops: [[[], { id: 'o1', company: 'c1', dept: 'd1', name: 'Менежер', quota: 3 }]], pos: 1 },
    { c: 'employees', id: 'e1', ops: [[[], employee('e1', 'c1', 'u1', 'Админ', { manager: 'none' })]], pos: 1 },
    { c: 'employees', id: 'e3', ops: [[[], employee('e3', 'c1', 'u3', 'Дарга', { manager: 'e1' })]], pos: 2 },
    { c: 'employees', id: 'e7', ops: [[[], employee('e7', 'c1', 'u7', 'Доор', { manager: 'e3' })]], pos: 3 },
    { c: 'employees', id: 'e9', ops: [[[], employee('e9', 'c1', undefined, 'Бүртгэлгүй', { manager: 'e1' })]], pos: 4 },
  ])
  ok(r.j.refused.length === 0, 'the admin fills in the structure and the employees')
  await hr.pull()
  ok(hr.ids('employees').length === 4 && hr.get<Employee>('employees', 'e7')?.regNo !== '', 'Хүний нөөц gets every record whole')
  r = await staff.pull()
  ok(r.j.full === true, 'the head, who got people under them, is sent everything afresh')
  const [h3, h7, h9] = ['e3', 'e7', 'e9'].map(id => staff.get<Employee>('employees', id)!)
  ok(h3.regNo && h7.regNo && !h3.card && !h7.card, 'the head gets their own record and their people\'s whole')
  ok(h9.card === true && h9.regNo === '' && h9.phone === '' && h9.moves.length === 0 && h9.given === 'Бүртгэлгүй' && h9.manager === 'e1', 'and of the others only their place in the structure')
  await under.pull()
  ok(under.ids('employees').length === 4 && ['e1', 'e3', 'e7', 'e9'].every(id => under.get<Employee>('employees', id)?.card), 'plain staff get only places in the structure, their own record too')
  r = await under.edit<Employee>('employees', 'e7', e => ({ ...e, phone: '88001122' }))
  ok(r.j.refused.length === 1, 'and change no record')
  r = await under.edit<Employee>('employees', 'e7', e => ({ ...e, given: 'Шинэ' }))
  ok(r.j.refused.length === 0, 'except their own name, which follows their profile')
  r = await staff.edit<Employee>('employees', 'e7', e => ({ ...e, phone: '88001122' }))
  ok(r.j.refused.length === 1, 'seeing a record is not keeping it: the head changes nothing')
  r = await hr.edit<Employee>('employees', 'e7', e => ({ ...e, phone: '88001122' }))
  ok(r.j.refused.length === 0, 'Хүний нөөц does')
  r = await hr.push([{ c: 'employees', id: 'e7', ops: [[[], { ...employee('e7', 'c1', 'u7', 'Доор'), card: true }]] }])
  ok(r.j.refused.length === 1, 'a record with the personal fields kept back is never written over the whole one')

  // A second ХХК with one person who is nowhere else
  r = await admin.push([
    { c: 'companies', id: 'c2', ops: [[[], { id: 'c2', name: 'Хоёр ХХК', hue: 'green', code: 'ХО' }]], pos: 2 },
    { c: 'people', id: 'u1', ops: [[['companies'], ['c1', 'c2']]] },
    { c: 'roles', id: 'c2', ops: [[[], { finance: 'u1', legal: 'u1', clerk: 'u1', director: 'u1', supply: 'u1' }]] },
    { c: 'tasks', id: 't2', ops: [[[], { id: 't2', company: 'c2', title: 'Хоёрын ажил', status: 'todo', prio: 'low', assignees: [], due: '2026-12-01', estimate: 1, subtasks: [], comments: [], createdAt: '2026-11-15T00:00:00Z' }]], pos: 1 },
  ])
  ok(r.j.refused.length === 0, 'the system admin adds a second ХХК, joins it, and adds a task there')
  r = await invite(admin, person('u8', 'Хоёрын', 'c2', 'second', NO_ACCESS))
  const second = new Browser(env)
  await second.login('second', 'pass1234')
  await second.pull()
  ok(second.ids('companies').join() === 'c2' && second.ids('tasks').join() === 't2' && second.ids('people').sort().join() === 'u1,u8' && second.ids('employees').length === 0, 'someone of the second ХХК gets it, its task and its people, and nothing of the first')
  await staff.pull()
  ok(!staff.get('companies', 'c2') && !staff.get('tasks', 't2') && !staff.get('people', 'u8'), 'and the first one\'s people get nothing of the second')
  r = await staff.push([{ c: 'companies', id: 'c3', ops: [[[], { id: 'c3', name: 'Гурав', hue: 'pink', code: 'ГУ' }]] }])
  ok(r.j.refused.length === 1, 'only the system admin adds a ХХК')
  r = await staff.push([{ c: 'tasks', id: 't2', ops: [[['title'], 'Эвдсэн']] }])
  ok(r.j.refused.length === 1 && !staff.get('tasks', 't2'), 'a task of a ХХК one is not in cannot be changed, though its id is known')
  r = await staff.push([{ c: 'tasks', id: 't9', ops: [[[], { id: 't9', company: 'c2', title: 'Тэнд', status: 'todo', prio: 'low', assignees: [], due: '2026-12-01', estimate: 1, subtasks: [], comments: [], createdAt: '' }]] }])
  ok(r.j.refused.length === 1, 'nor a task added there')

  console.log('Work everyone shares')
  const task = (id: string, title: string) => ({ id, company: 'c1', title, status: 'todo', prio: 'low', assignees: ['u3'], due: '2026-12-01', estimate: 1, subtasks: [], comments: [], createdAt: '2026-11-15T00:00:00Z' })
  await staff.put('tasks', task('t1', 'Нэг'), 10)
  await under.pull()
  ok(under.get<{ title: string }>('tasks', 't1')?.title === 'Нэг', 'a task one person adds reaches the others of the ХХК')
  // Two people change different parts of one task without seeing each other's change
  const mine = under.push([{ c: 'tasks', id: 't1', ops: [[['status'], 'doing']] }])
  const theirs = staff.push([{ c: 'tasks', id: 't1', ops: [[['title'], 'Нэг, засав']] }])
  await Promise.all([mine, theirs])
  await under.pull()
  await staff.pull()
  const t1 = under.get<{ title: string; status: string }>('tasks', 't1')!
  ok(t1.title === 'Нэг, засав' && t1.status === 'doing' && JSON.stringify(staff.get('tasks', 't1')) === JSON.stringify(t1), 'changes to different parts of one record both stay, and both browsers end alike')
  r = await under.push([{ c: 'tasks', id: 't1', gone: true }])
  await staff.pull()
  ok(r.j.refused.length === 0 && !staff.get('tasks', 't1') && !under.get('tasks', 't1'), 'a removed task goes from the others too')
  r = await staff.push([{ c: 'tasks', id: 't1', ops: [[[], task('t1', 'Буцаасан')]], pos: 10 }])
  await under.pull()
  ok(r.j.refused.length === 0 && under.get<{ title: string }>('tasks', 't1')?.title === 'Буцаасан', 'and comes back when the removal is undone')
  r = await staff.push([{ c: 'tasks', id: 't1', ops: [], pos: 3.5 }])
  const fresh = new Browser(env)
  await fresh.login('under', 'pass1234')
  r = await fresh.pull()
  ok((r.j.rows as Row[]).find(x => x[0] === 'tasks' && x[1] === 't1')?.[2] === 3.5, 'a record\'s place in its list is kept and sent')

  console.log('Chats, boards, notices')
  const chat = { id: 'ch1', kind: 'direct', members: ['u3', 'u7'], by: 'u3', created: '2026-11-15T00:00:00Z', read: {} }
  r = await staff.push([{ c: 'chats', id: 'ch1', ops: [[[], chat]], pos: 1 }, { c: 'messages', id: 'm1', ops: [[[], { id: 'm1', chat: 'ch1', by: 'u3', at: '2026-11-15T00:00:01Z', text: 'Сайн уу', refs: [], files: [] }]], pos: 1 }])
  ok(r.j.refused.length === 0, 'a new chat and its first message go together')
  await under.pull()
  await hr.pull()
  ok(under.get('chats', 'ch1') && under.get('messages', 'm1') && !hr.get('chats', 'ch1') && !hr.get('messages', 'm1'), 'the chat and its message reach its members only')
  r = await hr.push([{ c: 'messages', id: 'm9', ops: [[[], { id: 'm9', chat: 'ch1', by: 'u2', at: '2026-11-15T00:00:02Z', text: 'Сэм', refs: [], files: [] }]] }])
  ok(r.j.refused.length === 1, 'nobody writes into a chat they are not in')
  r = await hr.push([{ c: 'chats', id: 'ch1', ops: [[['members'], ['u3', 'u7', 'u2']]] }])
  ok(r.j.refused.length === 1, 'nor adds themself to it')
  // Each marks it read at the same moment: both marks stay
  await Promise.all([under.push([{ c: 'chats', id: 'ch1', ops: [[['read', 'u7'], 'T7']] }]), staff.push([{ c: 'chats', id: 'ch1', ops: [[['read', 'u3'], 'T3']] }])])
  await under.pull()
  ok(JSON.stringify(under.get<{ read: object }>('chats', 'ch1')?.read) === JSON.stringify({ u7: 'T7', u3: 'T3' }) || JSON.stringify(under.get<{ read: object }>('chats', 'ch1')?.read) === JSON.stringify({ u3: 'T3', u7: 'T7' }), 'two members marking a chat read at once both keep their mark')
  r = await under.push([{ c: 'chats', id: 'ch1', ops: [[['read', 'u3'], 'T9']] }])
  ok(r.j.refused.length === 1, "nobody marks a chat read in someone else's name")
  r = await under.push([{ c: 'messages', id: 'm1', ops: [[['text'], 'Эвдсэн']] }])
  ok(r.j.refused.length === 1, "someone else's message is not rewritten")
  r = await under.push([{ c: 'messages', id: 'm1', ops: [[['reactions', 'u7'], '👍']] }])
  ok(r.j.refused.length === 0, 'but takes one\'s own reaction')
  r = await under.push([{ c: 'messages', id: 'm1', ops: [[['reactions', 'u3'], '👎']] }])
  ok(r.j.refused.length === 1, "and not a reaction in someone else's name")
  // A member added to a running chat gets its earlier messages
  await hr.pull()
  const before = hr.since
  r = await staff.push([{ c: 'chats', id: 'ch1', ops: [[['members'], ['u3', 'u7', 'u2']], [['kind'], 'group'], [['name'], 'Гурвуулаа']] }])
  r = await hr.pull()
  ok(before > 0 && r.j.full === true && hr.get('chats', 'ch1') && hr.get('messages', 'm1'), 'someone added to a running chat is sent everything afresh, its earlier messages with it')
  r = await staff.put('drafts', { id: 'b1', company: 'c1', owner: 'u3', name: 'Миний самбар', cards: [], view: { x: 0, y: 0, z: 1 }, updated: '' } as never)
  await under.pull()
  await admin.pull()
  ok(r.j.refused.length === 0 && !under.get('drafts', 'b1') && !admin.get('drafts', 'b1'), 'a board is its owner\'s alone: not even the admin gets it')
  r = await under.put('drafts', { id: 'b2', company: 'c1', owner: 'u3', name: 'Бусдын нэрээр', cards: [], view: { x: 0, y: 0, z: 1 }, updated: '' } as never)
  ok(r.j.refused.length === 1, "nobody makes a board in someone else's name")
  r = await under.push([{ c: 'toursDone', id: 'u7', ops: [[[], ['first']]] }, { c: 'toursDone', id: 'u3', ops: [[[], ['first']]] }, { c: 'focusLog', id: 'u7|2026-11-15T01:00:00Z', ops: [[[], { at: '2026-11-15T01:00:00Z', minutes: 25, who: 'u7' }]] }])
  ok(r.j.refused.length === 1 && r.j.refused[0][1] === 'u3' && under.get('toursDone', 'u7') && under.get('focusLog', 'u7|2026-11-15T01:00:00Z'), 'the tours gone through and the focus sessions are each person\'s own')

  console.log('Documents, contracts, requests, reports')
  const doc = (id: string, to: 'all' | string[], by = 'u1') => ({ id, company: 'c1', name: `Баримт ${id}`, kind: 'order', to, by, added: '2026-11-15T00:00:00Z' })
  r = await admin.push([{ c: 'docs', id: 'dc1', ops: [[[], doc('dc1', 'all')]], pos: 1 }, { c: 'docs', id: 'dc2', ops: [[[], doc('dc2', ['u7'])]], pos: 2 }, { c: 'docs', id: 'dc3', ops: [[[], doc('dc3', [])]], pos: 3 }])
  ok(r.j.refused.length === 0, 'the office files documents')
  await under.pull(); await staff.pull(); await hr.pull(); await second.pull()
  ok(under.ids('docs').join() === 'dc1,dc2', 'staff get what is shared with everyone or with them')
  ok(staff.ids('docs').join() === 'dc1,dc2', 'the head gets their people\'s too (Бичиг хэрэг: хариуцсан ажилтны)')
  ok(hr.ids('docs').join() === 'dc1,dc2,dc3' && second.ids('docs').length === 0, 'whoever sees every document gets them all; another ХХК none')
  r = await under.push([{ c: 'docs', id: 'dc2', ops: [[['to'], 'all']] }])
  ok(r.j.refused.length === 1, 'only the office changes whom a document is shared with')
  r = await under.put('docs', doc('dc9', 'all', 'u7') as never)
  ok(r.j.refused.length === 1, 'and only the office files one')
  r = await admin.push([{ c: 'docs', id: 'dc2', ops: [[['to'], []]] }])
  await under.pull()
  ok(!under.get('docs', 'dc2'), 'a document no longer shared with someone goes from their browser')
  const contract = { id: 'ct1', company: 'c1', title: 'Гэрээ', party: 'Нөгөө тал', kind: 'work', owner: 'u7', stage: 'draft', agreed: [], asked: [], clauses: [], versions: [], events: [], created: '', updated: '' }
  r = await under.put('contracts', contract as never)
  await staff.pull(); await hr.pull(); await admin.pull()
  ok(r.j.refused.length === 0 && staff.get('contracts', 'ct1') && hr.get('contracts', 'ct1') && admin.get('contracts', 'ct1'), 'a contract reaches its writer, their head, the office and the process\'s people')
  r = await invite(admin, person('u10', 'Гадна', 'c1', 'outside', NO_ACCESS))
  const outside = new Browser(env)
  await outside.login('outside', 'pass1234')
  await outside.pull()
  ok(!outside.get('contracts', 'ct1'), 'and nobody else')
  r = await outside.push([{ c: 'contracts', id: 'ct1', ops: [[['title'], 'Эвдсэн']] }])
  ok(r.j.refused.length === 1, 'who cannot see a contract cannot change it')
  r = await under.push([{ c: 'contracts', id: 'ct1', ops: [[['asked'], [{ to: 'u10' }]]] }])
  await outside.pull()
  ok(outside.get('contracts', 'ct1'), 'asked for an opinion, they get it')
  const leave = { id: 'hq1', company: 'c1', by: 'u7', kind: 'leave', status: 'open', step: 0, manager: 'u3', from: '2026-12-01', to: '2026-12-05', days: 5, note: 'Хувийн шалтгаан', history: [{ what: 'sent', by: 'u7', at: '' }] }
  r = await under.put('hrRequests', leave as never)
  await staff.pull(); await outside.pull(); await admin.pull()
  ok(r.j.refused.length === 0 && staff.get('hrRequests', 'hq1') && admin.get('hrRequests', 'hq1') && !outside.get('hrRequests', 'hq1'), 'a leave request reaches the asker, their manager and the steps\' people')
  r = await admin.push([{ c: 'hrRequests', id: 'hq1', ops: [[['order'], 'dc5'], [['step'], 2]] }])
  await outside.pull()
  const away = outside.get<{ note?: string; from: string; history: unknown[] }>('hrRequests', 'hq1')
  ok(away && away.note === undefined && away.from === '2026-12-01' && away.history.length === 0, 'once the director has signed it, everyone of the ХХК gets when the person is away, without the note or the history')
  r = await outside.push([{ c: 'hrRequests', id: 'hq1', ops: [[['status'], 'canceled']] }])
  ok(r.j.refused.length === 1, 'and cannot change it')
  const report = { id: 'mr1', company: 'c1', person: 'u7', month: '2026-11', done: [], issues: 'Асуудал', plan: [], status: 'draft', updated: '' }
  r = await under.put('reports', report as never)
  await staff.pull(); await outside.pull(); await hr.pull()
  ok(r.j.refused.length === 0 && staff.get('reports', 'mr1') && hr.get('reports', 'mr1') && !outside.get('reports', 'mr1'), 'a monthly report reaches its writer, their manager and whoever reads every report')
  r = await outside.put('reports', { ...report, id: 'mr2' } as never)
  ok(r.j.refused.length === 1, "nobody writes a report in someone else's name")
  r = await under.put('requests', { id: 'rq1', company: 'c1', by: 'u7', what: 'Тодорхойлолт', purpose: 'Банк', paper: false, copies: 1, need: '2026-12-01', status: 'sent', steps: [] } as never)
  await outside.pull(); await admin.pull()
  ok(r.j.refused.length === 0 && admin.get('requests', 'rq1') && !outside.get('requests', 'rq1'), 'a request to the office reaches the office, not the others')
  r = await under.push([{ c: 'requests', id: 'rq1', ops: [[['status'], 'done']] }])
  ok(r.j.refused.length === 1, 'and only the office moves it on')
  r = await under.push([{ c: 'roles', id: 'c1', ops: [[['director'], 'u7']] }, { c: 'timely', id: 'c1', ops: [[[], 5]] }, { c: 'kpi', id: 'c1', ops: [[[], { criteria: [], bands: [] }]] }])
  ok(r.j.refused.length === 3, 'the process\'s people, the Timely link and the report criteria are the admin\'s to set')
  r = await admin.push([{ c: 'timely', id: 'c1', ops: [[[], 77]] }])
  ok(r.j.refused.length === 0, 'and the admin sets them')

  console.log('Ирц by rights')
  // Timely itself, made up: one company under another name, four people of ours by registration number and two only it knows
  const timelyPeople = [[101, 'УБ90010101'], [103, 'УБ90010103'], [107, 'уб 900 10107'], [109, 'УБ90010109'], [150, 'ТТ99999999'], [151, '']] as const
  const asked: string[] = []
  const real = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(input instanceof Request ? input.url : input))
    if (u.hostname !== 'api.timely.mn') return real(input, init)
    asked.push(u.pathname.replace('/openapi', ''))
    const result = (v: unknown) => new Response(JSON.stringify({ success: true, result: v }), { headers: { 'content-type': 'application/json' } })
    const path = u.pathname.replace('/openapi', '')
    if (path === '/auth/token') return result({ accessToken: 'made-up', expiresIn: 3600, scopes: [] })
    if (path === '/company') return result({ id: 77, name: 'Өөр нэртэй байгууллага ХХК', register: '1234567' })
    if (path === '/employees') return result(timelyPeople.map(([workerId, register]) => ({ workerId, firstname: `Нэр${workerId}`, lastname: 'Овог', register, position: 'Ажилтан', division: { name: 'Хэлтэс' }, annualLeave: null })))
    if (path === '/employees/attendance-summary') return result({ supposedWorkDays: 10, supposedWorkHours: 80, workedDays: 10, workedHours: 80 })
    if (path === '/attendance/total' || path === '/request-types') return result([])
    if (path === '/employees/attendance') return result({ attendance: [{ date: '2026-11-03', clockIn: '08:50', clockOut: '18:05', statusDetail: [] }] })
    return new Response('{}', { status: 404 })
  }) as typeof fetch
  env.TIMELY_API_KEYS = 'made-up-key'
  forget()
  const month = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 7)
  type TRow = { workerId: number; register: string; emp?: string }
  const monthOf = async (who: Browser) => { const x = await who.call('GET', `attendance/month?company=77&month=${month}`); return { status: x.status, rows: (x.j?.employees ?? []) as TRow[] } }
  const days = async (who: Browser, worker: number) => (await who.call('GET', `attendance/days?company=77&worker=${worker}&month=${month}`)).status
  r = await new Browser(env).call('GET', 'attendance')
  ok(r.status === 401 && !r.j.locked, 'nobody signed in sees nothing of Ирц; no code is asked for any more')
  r = await under.call('GET', 'attendance')
  ok(r.status === 200 && r.j.ready && r.j.companies.length === 1 && !r.j.locked, 'signed in, the Timely company shows without a code')
  let m = await monthOf(admin)
  ok(m.status === 200 && m.rows.length === 6 && m.rows.find(t => t.workerId === 107)?.emp === 'e7' && m.rows.find(t => t.workerId === 107)?.register && m.rows.find(t => t.workerId === 150)?.emp === undefined && m.rows.find(t => t.workerId === 150)?.register === 'ТТ99999999', 'whoever sees everyone gets every row: ours matched by registration number (however it is typed), and those only Timely knows');
  m = await monthOf(staff)
  ok(m.status === 200 && m.rows.map(t => t.workerId).join() === '103,107' && m.rows.every(t => t.emp && t.register), 'a head gets their own row and their people\'s, with the numbers Хүний нөөц\'s rights let them see')
  m = await monthOf(under)
  ok(m.status === 200 && m.rows.length === 1 && m.rows[0].emp === 'e7' && m.rows[0].register === '', 'plain staff get their own row only, and not even their own registration number from here')
  m = await monthOf(outside)
  ok(m.status === 200 && m.rows.length === 0, 'someone of the ХХК with no employee record gets no row')
  m = await monthOf(second)
  ok(m.status === 403 && m.rows.length === 0, 'someone of another ХХК gets nothing of this one\'s attendance')
  ok((await days(under, 107)) === 200 && (await days(under, 103)) === 403 && (await days(under, 150)) === 403, 'days: one\'s own, not a colleague\'s, not a stranger\'s')
  ok((await days(staff, 107)) === 200 && (await days(staff, 109)) === 403, 'a head: their people\'s days, not the others\'')
  ok((await days(admin, 109)) === 200 && (await days(admin, 151)) === 200, 'whoever sees everyone: anyone\'s')
  r = await under.call('POST', 'attendance/unlock', { code: CODE })
  ok(r.status !== 200 || !r.set, 'the code opens nothing by itself any more')
  ok(!asked.includes('/employees/info'), 'salaries and bank details are never asked of Timely')
  globalThis.fetch = real
  delete env.TIMELY_API_KEYS

  console.log('Large records')
  // A long contract in Cyrillic: several of them in one round are more than the database takes in one value
  const long = (id: string, n: number) => ({ ...contract, id, owner: 'u7', title: `Урт гэрээ ${id}`, clauses: [{ id: 'cl1', title: 'Нэг', body: 'Гэрээний заалт. '.repeat(n) }] })
  r = await under.push([1, 2, 3, 4].map(i => ({ c: 'contracts' as Table, id: `big${i}`, ops: [[[], long(`big${i}`, 20_000)]] as Op[], pos: 10 + i })))
  ok(r.j.refused.length === 0 && [1, 2, 3, 4].every(i => under.get<{ clauses: { body: string }[] }>('contracts', `big${i}`)?.clauses[0].body.length === 320_000), 'four long contracts (2.4 MB together) sent at once are all kept, whole')
  r = await under.push([{ c: 'contracts', id: 'huge', ops: [[[], long('huge', 45_000)]] }, { c: 'tasks', id: 'tsmall', ops: [[[], task('tsmall', 'Жижиг')]] }])
  ok(r.j.refused.length === 1 && r.j.refused[0][1] === 'huge' && r.j.refused[0][2].includes('хэт том') && under.get('tasks', 'tsmall'), 'a record too large for the database is refused with why, and the rest of the round is kept')
  await under.push([{ c: 'tasks', id: 'tsmall', gone: true }])

  console.log('Files')
  const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 1, 2, 3])
  ok((await new Browser(env).file('PUT', 'fk1', pdf)).status === 401 && (await new Browser(env).file('GET', 'fk1')).status === 401, 'nobody signed in puts or gets a file')
  let f = await under.file('PUT', 'fk1', pdf, { 'content-type': 'application/pdf' })
  ok(f.status === 200 && f.j.v, 'someone signed in puts a file')
  f = await staff.file('GET', 'fk1')
  ok(f.status === 200 && f.type === 'application/pdf' && f.bytes?.join() === pdf.join(), 'and anyone signed in who has its id gets it, byte for byte')
  const tag = f.tag!
  ok((await staff.file('GET', 'fk1', undefined, { 'if-none-match': tag })).status === 304, 'a browser that has it already is told it has not changed')
  ok((await staff.file('PUT', 'fk1', new Uint8Array([9, 9]), { 'content-type': 'application/pdf' })).status === 409 && (await staff.file('GET', 'fk1')).bytes?.join() === pdf.join(), "nobody replaces someone else's file")
  f = await under.file('PUT', 'fk1', new Uint8Array([1, 2, 3, 4]), { 'content-type': 'application/pdf' })
  await new Promise(done => setTimeout(done, 5))
  ok(f.status === 200 && (await staff.file('GET', 'fk1', undefined, { 'if-none-match': tag })).status === 200, 'whoever put it there replaces it, and the others then get the new one')
  ok((await under.file('GET', 'fk-none')).status === 404 && (await under.file('GET', '..%2Fsecret')).status === 400 && (await under.file('PUT', 'fk2', new Uint8Array(0))).status === 400, 'a file that is not there, a name that is not an id and an empty file are each answered as such')
  ok((await under.file('PUT', 'fk3', pdf, { 'content-length': String(30 * 1024 * 1024) })).status === 413, 'a file over 25 MB is not taken')
  ok((await under.file('PUT', 'fk4', pdf, { 'sec-fetch-site': 'cross-site' })).status === 403, 'another site cannot put a file')

  console.log('What must never get in')
  r = await staff.call('POST', 'sync', { since: staff.since, scope: staff.scope, changes: [{ c: 'tasks', id: 't1', ops: [[['__proto__', 'x'], 1]] }] })
  ok(r.status === 400, 'a path into an object\'s workings is not read as a change')
  r = await staff.call('POST', 'sync', { since: staff.since, scope: staff.scope, changes: [{ c: 'accounts', id: 'u1', ops: [[['hash'], 'x']] }] })
  ok(r.status === 400, 'only the shared tables can be named')
  r = await staff.push([{ c: 'chats', id: 'ch1', ops: [[['members'], null]] }])
  ok(r.j.refused.length === 1 && (await under.pull()).status === 200, 'a chat without a list of members is refused, and everyone works on')
  r = await staff.push([{ c: 'tasks', id: 't1', ops: [[['id'], 'other']] }])
  ok(r.j.refused.length === 1, "a record's id is not changed")
  r = await admin.push([{ c: 'people', id: 'u3', ops: [[['account', 'hash'], 'x']] }])
  ok(r.j.refused.length === 1, 'no password hash goes into a record')
  r = await staff.push([{ c: 'people', id: 'u3', gone: true }, { c: 'chats', id: 'ch1', gone: true }, { c: 'employees', id: 'e3', gone: true }])
  ok(r.j.refused.length === 3, 'people, chats and employees are never removed')
  const rows = await env.DB!.prepare(`SELECT c, id, data FROM rows`).all<{ c: string; id: string; data: string | null }>()
  ok(rows.results.every(x => !/"hash"|"salt"/.test(x.data ?? '')), 'nothing kept for the browsers holds a password hash or salt')
  const accounts = await env.DB!.prepare(`SELECT hash FROM accounts`).all<{ hash: string }>()
  ok(accounts.results.every(a => a.hash !== hashOf('pass1234') && a.hash.length === 43), 'what is kept of a password is not what the browser sent')


  console.log('Two browsers, as the app runs them')
  type T = { id: string; company: string; title: string; status: string; subtasks: { id: string; title: string; done: boolean }[]; doneAt?: string }
  const [a, b] = [new App(env), new App(env)]
  await a.login('staff', 'newpass99')
  await b.login('under', 'pass1234')
  await a.sync(); await b.sync()
  ok(a.titles() === 'Буцаасан' && a.mirror.pending(a.state).length === 0, 'a browser starts with what the server has, and nothing to send')
  const mk = (id: string, title: string): T => ({ ...(task(id, title) as unknown as T) })
  a.list<T>('tasks', l => [mk('ta', 'А'), ...l])
  a.list<T>('tasks', l => [mk('tb', 'Б'), ...l])
  a.list<T>('tasks', l => [...l, mk('tc', 'В')])
  ok(a.titles() === 'Б А Буцаасан В', 'new tasks show at once, before anything is sent')
  await a.sync()
  ok(a.sentCount === 3 && a.titles() === 'Б А Буцаасан В' && a.mirror.pending(a.state).length === 0, 'three records are sent; nothing moves on the screen, and nothing is left to send')
  await b.sync()
  ok(b.titles() === 'Б А Буцаасан В', 'the other browser gets them in the same order')
  // Moving one task changes one record
  a.list<T>('tasks', l => { const x = l.find(t => t.id === 'tc')!; return [x, ...l.filter(t => t !== x)] })
  await a.sync()
  await b.sync()
  ok(a.sentCount === 1 && a.titles() === 'В Б А Буцаасан' && b.titles() === a.titles(), 'a task moved to the top is one change, and the order follows in the other browser')
  a.list<T>('tasks', l => { const x = l.find(t => t.id === 'tb')!; const rest = l.filter(t => t !== x); const i = rest.findIndex(t => t.id === 't1'); return [...rest.slice(0, i), x, ...rest.slice(i)] })
  await a.sync(); await b.sync()
  ok(a.sentCount === 1 && a.titles() === 'В А Б Буцаасан' && b.titles() === a.titles(), 'and one moved into the middle, too')
  // Both change one task without having heard of the other's change
  a.list<T>('tasks', l => l.map(t => (t.id === 'ta' ? { ...t, title: 'А (засав)' } : t)))
  b.list<T>('tasks', l => l.map(t => (t.id === 'ta' ? { ...t, status: 'done', doneAt: 'X' } : t)))
  await a.sync(); await b.sync(); await a.sync()
  const [ta, tb2] = [a, b].map(x => (x.state.tasks as T[]).find(t => t.id === 'ta')!)
  ok(ta.title === 'А (засав)' && ta.status === 'done' && JSON.stringify(ta) === JSON.stringify(tb2), 'each keeps their change to the same task, and both end alike')
  // A change made while the request is on its way
  a.list<T>('tasks', l => l.map(t => (t.id === 'ta' ? { ...t, title: 'Эхний' } : t)))
  await a.sync(() => a.list<T>('tasks', l => l.map(t => (t.id === 'ta' ? { ...t, status: 'review' } : t))))
  const mid = (a.state.tasks as T[]).find(t => t.id === 'ta')!
  const left = a.mirror.pending(a.state)
  ok(mid.title === 'Эхний' && mid.status === 'review' && left.length === 1 && JSON.stringify(left[0].ops) === JSON.stringify([[['status'], 'review']]), 'a change made while the first is being sent stays, and is the only thing left to send')
  await a.sync()
  // The later change of someone else is not undone by what this browser sent before
  b.list<T>('tasks', l => l) // nothing
  await b.sync()
  b.list<T>('tasks', l => l.map(t => (t.id === 'ta' ? { ...t, title: 'Сүүлийн' } : t)))
  await b.sync(); await a.sync()
  ok((a.state.tasks as T[]).find(t => t.id === 'ta')!.title === 'Сүүлийн' && a.mirror.pending(a.state).length === 0, "someone's later change comes in, and nothing sent earlier writes over it again")
  // Undefined fields and lists: nothing bounces back and forth
  a.list<T>('tasks', l => l.map(t => (t.id === 'ta' ? { ...t, doneAt: undefined, subtasks: [{ id: 's1', title: 'Дэд', done: false }] } : t)))
  await a.sync()
  ok(a.sentCount === 1 && a.mirror.pending(a.state).length === 0, 'a field taken out and a list changed are sent once')
  await a.sync()
  ok(a.sentCount === 0, 'and not again')
  // A refused change goes back as it was, and is not tried for ever
  const names = () => (a.state.people as Person[]).find(p => p.id === 'u2')!.given
  const was = names()
  a.list<Person>('people', l => l.map(p => (p.id === 'u2' ? { ...p, given: 'Булаав' } : p)))
  r = await a.sync()
  ok(r.j.refused.length === 1 && r.j.refused[0][2].length > 0 && names() === was && a.mirror.pending(a.state).length === 0, 'a refused change is put back as the server has it, with why, and nothing is left to send')
  // Removing, and undoing it
  const gone = (a.state.tasks as T[]).find(t => t.id === 'tb')!
  const at = (a.state.tasks as T[]).indexOf(gone)
  a.list<T>('tasks', l => l.filter(t => t.id !== 'tb'))
  await a.sync(); await b.sync()
  ok(!(b.state.tasks as T[]).some(t => t.id === 'tb'), 'a removed task goes from the other browser')
  a.list<T>('tasks', l => [...l.slice(0, at), gone, ...l.slice(at)])
  await a.sync(); await b.sync()
  ok(b.titles() === a.titles() && b.titles().includes('Б'), 'undone, it is back in its place in both')
  // Removing here what was already removed there does not loop
  a.list<T>('tasks', l => l.filter(t => t.id !== 'tc'))
  b.list<T>('tasks', l => l.filter(t => t.id !== 'tc'))
  await a.sync(); await b.sync(); await a.sync(); await b.sync()
  ok(a.mirror.pending(a.state).length === 0 && b.mirror.pending(b.state).length === 0 && b.sentCount === 0, 'both removing the same task ends with nothing left to send')
  // Maps: one record for each person or ХХК
  b.state = { ...b.state, toursDone: { ...b.state.toursDone, u7: ['first', 'tasks'] } }
  await b.sync()
  const b3 = new App(env)
  await b3.login('under', 'pass1234')
  await b3.sync()
  ok(JSON.stringify(b3.state.toursDone) === JSON.stringify({ u7: ['first', 'tasks'] }) && b3.titles() === b.titles(), 'a fresh browser of the same person gets their tours and the same lists')
  // Everything afresh keeps what this browser has not sent yet
  b3.list<T>('tasks', l => [mk('td', 'Шинэ'), ...l])
  b3.mirror.scope = 'stale'
  r = await b3.sync()
  ok(r.j.full === true && b3.titles().startsWith('Шинэ') && b3.mirror.pending(b3.state).length === 0, 'sent everything afresh, a browser keeps the record it was just sending')
  // Signed out on the server
  await b3.call('POST', 'logout', {})
  r = await b3.sync()
  ok(r.status === 401 && r.j.signedOut === true, 'a browser signed out elsewhere hears so at its next round')

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}
main()
