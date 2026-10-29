// Гэрээ байгуулах: a contract goes from the employee who writes it to finance and the lawyer (both at the same time), the
// office, the director, then gets its number and goes to the other side. As in the user's HR system (WF_STAGE), the stages
// are set here only: the list, the progress and the buttons all read them. Everyone works in one text, kept with each
// person's version (docs/decisions.md, 2026-10-29).
import type { Clause, Company, Contract, ContractEvent, ContractType, ContractStage, ContractVersion, Id, ProcessRole, State } from './types'
import { num } from './format'

/** The stages in order; canceled stands outside */
export const FLOW: ContractStage[] = ['draft', 'review', 'clerk', 'director', 'register', 'deliver', 'done']

/** Each stage: its name in the progress, its short state in the list, and where approving it leads */
export const STAGE: Record<ContractStage, { label: string; pill: string; next?: ContractStage }> = {
  draft: { label: 'Ноорог', pill: 'Ноорог', next: 'review' },
  review: { label: 'Санхүү, хуулийн хяналт', pill: 'Хянаж буй', next: 'clerk' },
  clerk: { label: 'Бичиг хэрэг', pill: 'Бичиг хэрэгт', next: 'director' },
  director: { label: 'Захирал батлах', pill: 'Батлуулахаар илгээсэн', next: 'register' },
  register: { label: 'Дугаар олгох', pill: 'Батлагдсан', next: 'deliver' },
  deliver: { label: 'Харилцагчид хүргүүлэх', pill: 'Бүртгэгдсэн', next: 'done' },
  done: { label: 'Дууссан', pill: 'Хүчин төгөлдөр' },
  canceled: { label: 'Цуцалсан', pill: 'Цуцлагдсан' },
}

export const ROLE: Record<ProcessRole, string> = { finance: 'Санхүүгийн захирал', legal: 'Хуульч', clerk: 'Бичиг хэргийн ажилтан', director: 'Гүйцэтгэх захирал' }
export const ROLES = Object.keys(ROLE) as ProcessRole[]
/** These two look at the contract at the same time */
export const REVIEW: ProcessRole[] = ['finance', 'legal']
export const REVIEW_PART: Record<'finance' | 'legal', string> = { finance: 'Санхүү', legal: 'Хууль' }

export const CONTRACT_KIND: Record<ContractType, string> = {
  work: 'Ажил гүйцэтгэх гэрээ', sale: 'Худалдах, худалдан авах гэрээ', service: 'Үйлчилгээний гэрээ', lease: 'Түрээсийн гэрээ', employment: 'Хөдөлмөрийн гэрээ',
}
export const CONTRACT_KINDS = Object.keys(CONTRACT_KIND) as ContractType[]

/** A company's people for the process; a company set up later borrows the first one's until changed */
export const rolesOf = (s: Pick<State, 'roles'>, company: Id) => s.roles[company] ?? Object.values(s.roles)[0]

/** Who decides now: the writer while drafting; in review, finance and the lawyer who have not agreed yet; then the office or the director */
export function deciders(c: Contract, roles: Record<ProcessRole, Id>): Id[] {
  switch (c.stage) {
    case 'draft': return [c.owner]
    case 'review': return REVIEW.filter(r => !c.agreed.includes(r)).map(r => roles[r])
    case 'clerk': case 'register': case 'deliver': return [roles.clerk]
    case 'director': return [roles.director]
    default: return []
  }
}

/** The parts of the review a person still has to decide (one person may hold both) */
export const reviewsOf = (c: Contract, roles: Record<ProcessRole, Id>, p: Id) => (c.stage === 'review' ? REVIEW.filter(r => roles[r] === p && !c.agreed.includes(r)) : [])

/** The writer while drafting, finance and the lawyer while they review: they all work in the one text */
export const canEdit = (c: Contract, roles: Record<ProcessRole, Id>, p: Id) => (c.stage === 'draft' && c.owner === p) || reviewsOf(c, roles, p).length > 0

/** What a person has to do with a contract now, for "Миний хийх"; null when nothing */
export function todo(c: Contract, roles: Record<ProcessRole, Id>, p: Id): string | null {
  if (c.stage === 'draft' && c.asked.some(a => a.to === p && !a.done)) return 'Санал өгөх'
  if (!deciders(c, roles).includes(p)) return null
  const what: Partial<Record<ContractStage, string>> = {
    draft: c.resume ? 'Засаад илгээх' : 'Ноорог бэлтгэх', review: 'Хянах', clerk: 'Захиралд хүргүүлэх', director: 'Батлах', register: 'Дугаар олгох', deliver: 'Харилцагчид хүргүүлэх',
  }
  return what[c.stage] ?? null
}

export const isClosed = (c: Contract) => c.stage === 'done' || c.stage === 'canceled'

/** The next free number in a company this year: ГР-2026/015 */
export function nextNumber(contracts: Contract[], company: Company) {
  const year = new Date().getFullYear()
  const head = `${company.code}-${year}/`
  const last = Math.max(0, ...contracts.filter(c => c.company === company.id && c.number?.startsWith(head)).map(c => Number(c.number!.slice(head.length)) || 0))
  return `${head}${String(last + 1).padStart(3, '0')}`
}

/** A piece of text compared with an earlier one: kept (0), added (1) or taken out (-1) */
export interface Piece { t: string; k: 0 | 1 | -1 }

/** Word by word, what changed from `a` to `b` (the longest common run of words stays) */
export function diffWords(a: string, b: string): Piece[] {
  const x = a.split(/(\s+)/).filter(Boolean)
  const y = b.split(/(\s+)/).filter(Boolean)
  const n = x.length
  const m = y.length
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const out: Piece[] = []
  const push = (t: string, k: Piece['k']) => {
    const last = out.at(-1)
    if (last && last.k === k) last.t += t
    else out.push({ t, k })
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (x[i] === y[j]) { push(x[i], 0); i++; j++ }
    else if (L[i + 1][j] >= L[i][j + 1]) push(x[i++], -1)
    else push(y[j++], 1)
  }
  while (i < n) push(x[i++], -1)
  while (j < m) push(y[j++], 1)
  return out
}

/** Each clause of a version against the one before: changed words, new clauses, clauses taken out (where they were) */
export function diffClauses(before: Clause[], after: Clause[]) {
  const out: { id: Id; title: Piece[]; body: Piece[]; k: 0 | 1 | -1 }[] = []
  const old = new Map(before.map(c => [c.id, c]))
  const kept = new Set(after.map(c => c.id))
  let at = 0
  const gone = (upTo: number) => {
    for (; at < upTo; at++) if (!kept.has(before[at].id)) out.push({ id: before[at].id, title: [{ t: before[at].title, k: -1 }], body: [{ t: before[at].body, k: -1 }], k: -1 })
  }
  for (const c of after) {
    const was = old.get(c.id)
    if (was) gone(before.indexOf(was) + 1)
    out.push(was ? { id: c.id, title: diffWords(was.title, c.title), body: diffWords(was.body, c.body), k: 0 } : { id: c.id, title: [{ t: c.title, k: 1 }], body: [{ t: c.body, k: 1 }], k: 1 })
  }
  gone(before.length)
  return out
}

const ENDING = [
  'Бусад зүйл',
  'Гэрээ талууд гарын үсэг зурснаар (хуулийн этгээд тамга, тэмдэг дарснаар) хүчин төгөлдөр болно. Маргааныг эвийн журмаар шийдвэрлэх бөгөөд тохиролцоонд хүрээгүй бол хариуцагчийн оршин суугаа газрын шүүхээр шийдвэрлүүлнэ.',
] as const

/** The starting text of each kind of contract (samples to be checked by the lawyer) */
export function clausesFor(kind: ContractType, party: string, amount?: number, ids: () => Id = (() => { let i = 0; return () => `cl${++i}` })()): Clause[] {
  const sum = amount ? `${num(amount)} төгрөг` : '___ төгрөг'
  const who = party || '___'
  const text: Record<ContractType, [string, string][]> = {
    work: [
      ['Ерөнхий зүйл', `Энэхүү гэрээгээр Гүйцэтгэгч (${who}) Захиалагчийн даалгасан ажлыг гүйцэтгэж, Захиалагч ажлын үр дүнг хүлээн авч хөлсийг төлөх харилцааг зохицуулна.`],
      ['Ажлын агуулга, хугацаа', 'Гүйцэтгэгч ажлыг гэрээ байгуулснаас хойш 30 хоногт багтаан гүйцэтгэнэ. Ажлын нарийвчилсан жагсаалтыг хавсралтаар баталгаажуулна.'],
      ['Ажлын хөлс, төлбөр', `Ажлын нийт хөлс ${sum}. Захиалагч урьдчилгаа 30 хувийг гэрээ байгуулснаас хойш ажлын 5 өдөрт, үлдэгдлийг ажил хүлээн авснаас хойш ажлын 10 өдөрт шилжүүлнэ.`],
      ['Талуудын эрх, үүрэг', 'Гүйцэтгэгч ажлыг чанартай, хугацаанд нь гүйцэтгэнэ. Захиалагч ажил гүйцэтгэхэд шаардлагатай мэдээллээр хангана.'],
      ['Хариуцлага', 'Талууд гэрээгээр хүлээсэн үүргээ хугацаанд нь биелүүлээгүй бол хоног тутамд гүйцэтгээгүй үүргийн үнийн дүнгийн 0.5 хувиар алданги төлөх бөгөөд алдангийн нийт дүн гүйцэтгээгүй үүргийн үнийн дүнгийн 50 хувиас хэтрэхгүй.'],
    ],
    sale: [
      ['Ерөнхий зүйл', `Энэхүү гэрээгээр Худалдагч (${who}) барааг Худалдан авагчийн өмчлөлд шилжүүлж, Худалдан авагч барааг хүлээн авч үнийг төлөх харилцааг зохицуулна.`],
      ['Бараа, тоо хэмжээ', 'Нийлүүлэх барааны нэр төрөл, тоо хэмжээ, үнийг хавсралтад заана.'],
      ['Үнэ, төлбөр', `Гэрээний нийт үнэ ${sum}, нэмэгдсэн өртгийн албан татвар орсон. Төлбөрийг бараа хүлээн авснаас хойш 14 хоногт шилжүүлнэ.`],
      ['Нийлүүлэх нөхцөл', 'Худалдагч барааг Худалдан авагчийн агуулахад өөрийн зардлаар хүргэнэ. Барааг хүлээлцсэн акт үйлдэж баталгаажуулна.'],
      ['Чанарын баталгаа', 'Худалдагч бараанд 12 сарын баталгаа гаргана. Чанарын шаардлага хангаагүй барааг 7 хоногт сольж өгнө.'],
    ],
    service: [
      ['Ерөнхий зүйл', `Энэхүү гэрээгээр Үйлчилгээ үзүүлэгч (${who}) Захиалагчид үйлчилгээ үзүүлэх, Захиалагч үйлчилгээний үр дүнг хүлээн авч тохиролцсон хөлс төлөх харилцааг зохицуулна.`],
      ['Үйлчилгээний хүрээ', 'Үйлчилгээний төрөл, давтамж, чанарын шаардлагыг хавсралтад заана.'],
      ['Төлбөр', `Сарын үйлчилгээний хөлс ${sum}. Захиалагч тухайн сарын төлбөрийг дараа сарын 10-ны дотор шилжүүлнэ.`],
      ['Талуудын эрх, үүрэг', 'Үйлчилгээ үзүүлэгч үйлчилгээг тасралтгүй, чанартай үзүүлнэ. Захиалагч үйлчилгээ үзүүлэх нөхцөлөөр хангана.'],
      ['Гэрээний хугацаа', 'Гэрээ 1 жилийн хугацаатай. Аль нэг тал 30 хоногийн өмнө бичгээр мэдэгдэж гэрээг цуцалж болно.'],
    ],
    lease: [
      ['Ерөнхий зүйл', `Энэхүү гэрээгээр Түрээслүүлэгч (${who}) түрээсийн зүйлийг Түрээслэгчийн эзэмшил, ашиглалтад шилжүүлэх, Түрээслэгч түрээсийн төлбөрийг төлөх харилцааг зохицуулна.`],
      ['Түрээсийн зүйл', 'Түрээсийн зүйлийн байршил, талбай, тоноглолыг хүлээлцсэн актад заана.'],
      ['Түрээсийн төлбөр', `Сарын түрээсийн төлбөр ${sum}. Төлбөрийг сар бүрийн 5-ны дотор шилжүүлнэ.`],
      ['Талуудын эрх, үүрэг', 'Түрээслэгч түрээсийн зүйлийг зориулалтын дагуу ашиглаж, хэвийн элэгдлээс бусад гэмтлийг өөрийн зардлаар засна.'],
      ['Гэрээний хугацаа', 'Гэрээ 1 жилийн хугацаатай. Талууд тохиролцож сунгаж болно.'],
    ],
    employment: [
      ['Ерөнхий зүйл', `Энэхүү гэрээгээр Ажилтан (${who}) ажлын байрны тодорхойлолтод заасан ажил үүргийг биечлэн гүйцэтгэж дотоод журмыг сахих, Ажил олгогч хөдөлмөрийн хөлс олгож, ажиллах нөхцөлөөр хангах харилцааг зохицуулна.`],
      ['Ажлын байр, үүрэг', 'Ажилтан ажлын байрны тодорхойлолтод заасан чиг үүргийг гүйцэтгэнэ.'],
      ['Цалин хөлс', `Ажилтны үндсэн цалин сард ${sum}. Цалинг сард 2 удаа, сарын 15, 30-ны өдөр олгоно.`],
      ['Ажлын цаг, амралт', 'Ажлын долоо хоног 5 өдөр, өдөрт 8 цаг. Ажилтан хуульд заасан ээлжийн амралт эдэлнэ.'],
      ['Гэрээний хугацаа', 'Гэрээ хугацаагүй байна. Ажилтан ажлын байранд тавигдах шаардлага хангаж буй эсэхийг шалгах туршилтын хугацаа 3 сар байна.'],
    ],
  }
  return [...text[kind], ENDING].map(([title, body]) => ({ id: ids(), title, body }))
}

/** The contract as lines for its paper copy: each clause's heading, then its text */
export const contractLines = (c: Pick<Contract, 'clauses'>) => c.clauses.flatMap((cl, i) => [{ head: `${i + 1}. ${cl.title}` }, cl.body])

/** Demo contracts of Говь Ресурс at every stage, and each company's people for the process */
export function seedContracts(now: Date): Pick<State, 'contracts' | 'roles'> {
  const ago = (h: number) => new Date(now.getTime() - h * 36e5).toISOString()
  const roles: Record<ProcessRole, Id> = { finance: 'u3', legal: 'u15', clerk: 'u16', director: 'u1' }
  let n = 0
  const ev = (by: Id, h: number, kind: ContractEvent['kind'], more: Partial<ContractEvent> = {}): ContractEvent => ({ id: `ce${++n}`, by, at: ago(h), kind, ...more })
  const ver = (by: Id, h: number, clauses: Clause[]): ContractVersion => ({ id: `cv${++n}`, by, at: ago(h), clauses })
  const make = (c: Omit<Contract, 'company' | 'created' | 'updated'>): Contract => ({ ...c, company: 'c1', created: c.events[0].at, updated: [...c.events, ...c.versions].map(e => e.at).sort().at(-1)! })
  const edit = (cs: Clause[], id: Id, body: string) => cs.map(c => (c.id === id ? { ...c, body } : c))

  // At the director: finance agreed, the lawyer sent it back once, then fixed a clause in the text himself and agreed
  const shelf1 = clausesFor('sale', 'Тавиур Трейд ХХК', 48_500_000)
  const shelf2 = edit(shelf1, 'cl5', 'Худалдагч бараанд 12 сарын баталгаа гаргана. Чанарын шаардлага хангаагүй барааг ажлын 5 өдөрт сольж өгөх ба солих хүртэлх хугацааны алдангийг Худалдагч хариуцна.')
  const shelf3 = edit(shelf2, 'cl3', 'Гэрээний нийт үнэ 48,500,000 төгрөг, нэмэгдсэн өртгийн албан татвар орсон. Төлбөрийг бараа бүрэн хүлээн авч, хүлээлцсэн акт үйлдсэнээс хойш 14 хоногт шилжүүлнэ.')
  const office = clausesFor('work', 'Аркитект Студио ХХК', 32_000_000)
  const job = clausesFor('employment', 'Б.Хонгорзул', 1_800_000)
  const cargo = clausesFor('service', 'Говь Карго ХХК', 6_500_000)
  const rent = clausesFor('lease', 'Тэнгис Пропертиз ХХК', 9_000_000)

  const contracts = [
    make({
      id: 'ct1', title: 'Агуулахын тавиур нийлүүлэх гэрээ', party: 'Тавиур Трейд ХХК', kind: 'sale', amount: 48_500_000, owner: 'u10', stage: 'director', agreed: ['finance', 'legal'], asked: [],
      clauses: shelf3, versions: [ver('u10', 150, shelf1), ver('u10', 98, shelf2), ver('u15', 74, shelf3)],
      events: [
        ev('u10', 150, 'start'), ev('u10', 146, 'send', { to: 'review' }), ev('u3', 122, 'approve', { role: 'finance' }),
        ev('u15', 118, 'return', { to: 'draft', text: '5-р заалтад чанаргүй барааг солих хугацаа, алдангийг тодорхой бичнэ үү.' }),
        ev('u10', 97, 'send', { to: 'review' }), ev('u15', 73, 'approve', { role: 'legal', text: 'Төлбөрийн нөхцөлийг (3-р заалт) акттай уялдуулж зассан.' }),
        ev('u16', 26, 'approve', { role: 'clerk' }),
      ],
    }),
    make({
      id: 'ct2', title: 'Налайхын агуулахын зураг төсөл', party: 'Аркитект Студио ХХК', kind: 'work', amount: 32_000_000, owner: 'u4', stage: 'review', agreed: ['legal'], asked: [],
      clauses: office, versions: [ver('u4', 70, office)],
      events: [ev('u4', 70, 'start'), ev('u4', 50, 'send', { to: 'review' }), ev('u15', 20, 'approve', { role: 'legal' })],
    }),
    make({
      id: 'ct3', title: 'Б.Хонгорзулын хөдөлмөрийн гэрээ', party: 'Б.Хонгорзул', kind: 'employment', amount: 1_800_000, owner: 'u12', stage: 'draft', resume: 'review', agreed: [], asked: [{ to: 'u5' }],
      clauses: job, versions: [ver('u12', 52, job)],
      events: [
        ev('u12', 52, 'start'), ev('u12', 48, 'send', { to: 'review' }),
        ev('u3', 22, 'return', { to: 'draft', text: 'Цалин батлагдсан орон тооны төсвөөс давж байна. 1,650,000 төгрөг болгоно уу.' }),
        ev('u12', 20, 'ask', { people: ['u5'], text: 'Цалингийн хэмжээг шалгаж өгнө үү.' }),
      ],
    }),
    make({
      id: 'ct4', title: 'Ачаа тээврийн үйлчилгээний гэрээ', party: 'Говь Карго ХХК', kind: 'service', amount: 6_500_000, owner: 'u10', stage: 'done', agreed: ['finance', 'legal'], asked: [],
      clauses: cargo, versions: [ver('u10', 720, cargo)], number: `ГР-${now.getFullYear()}/014`, regDate: ago(576).slice(0, 10),
      events: [
        ev('u10', 720, 'start'), ev('u10', 700, 'send', { to: 'review' }), ev('u3', 690, 'approve', { role: 'finance' }), ev('u15', 680, 'approve', { role: 'legal' }),
        ev('u16', 650, 'approve', { role: 'clerk' }), ev('u1', 600, 'approve', { role: 'director' }), ev('u16', 576, 'register', { text: `ГР-${now.getFullYear()}/014` }), ev('u16', 560, 'deliver'),
      ],
    }),
    make({
      id: 'ct5', title: 'Оффисын түрээсийн гэрээ', party: 'Тэнгис Пропертиз ХХК', kind: 'lease', amount: 9_000_000, owner: 'u1', stage: 'draft', agreed: [], asked: [],
      clauses: rent, versions: [ver('u1', 2, rent)], events: [ev('u1', 2, 'start')],
    }),
  ]
  return { contracts, roles: { c1: roles, c2: roles, c3: roles } }
}
