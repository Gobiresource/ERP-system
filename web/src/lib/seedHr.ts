// Demo HR data: departments, positions, the personal-file checklist and employees for the three demo ХХК.
// Everyone is made up. Registration numbers start with "ЖШ" (жишээ) and phone numbers count up, so none is real.
import type { ContractKind, Department, DocType, EmpStatus, Employee, FileItem, Hue, Move, MoveKind, Person, Position } from './types'
import { addDays, ymd } from './format'

/** The personal-file list every ХХК starts with: 12 required documents and 2 that depend on the job */
const DOCS: [name: string, required: boolean, expires: boolean][] = [
  ['Ажилд орох өргөдөл', true, false],
  ['Ажилтны анкет', true, false],
  ['Иргэний үнэмлэхийн хуулбар', true, true],
  ['Цээж зураг', true, false],
  ['Боловсролын баримт бичиг', true, false],
  ['Нийгмийн даатгалын лавлагаа', true, false],
  ['Эрүүл мэндийн магадлагаа', true, true],
  ['Ял шийтгэлтэй эсэх тодорхойлолт', true, false],
  ['Оршин суугаа хаягийн лавлагаа', true, false],
  ['Хөдөлмөрийн гэрээ', true, false],
  ['Ажлын байрны тодорхойлолт', true, false],
  ['Нууцын гэрээ', true, false],
  ['Мэргэжлийн үнэмлэх', false, true],
  ['Жолооны үнэмлэх', false, true],
]

/** Departments → [position, headcount] */
type Plan = [dept: string, code: string, positions: [string, number][]][]
const PLAN: Record<string, Plan> = {
  c1: [
    ['Удирдлага', 'УДР', [['Ерөнхий захирал', 1], ['Гүйцэтгэх захирал', 1], ['Дэд захирал', 1], ['Туслах ажилтан', 1]]],
    ['Санхүү', 'САН', [['Санхүү хариуцсан захирал', 1], ['Ахлах нягтлан бодогч', 1], ['Нягтлан бодогч', 2], ['Нярав', 1]]],
    ['Борлуулалт', 'БОР', [['Борлуулалтын менежер', 1], ['Маркетингийн менежер', 1], ['Борлуулалтын ажилтан', 4]]],
    ['Үйл ажиллагаа', 'ҮАЖ', [['Үйл ажиллагааны менежер', 1], ['Мэдээллийн технологийн инженер', 1], ['Жолооч', 3], ['Харуул', 2], ['Үйлчлэгч', 2]]],
    ['Хүний нөөц', 'ХНӨ', [['Хүний нөөцийн менежер', 1], ['Хүний нөөцийн ажилтан', 1]]],
  ],
  c2: [
    ['Удирдлага', 'УДР', [['Ерөнхий захирал', 1], ['Гүйцэтгэх захирал', 1], ['Дэд захирал', 1]]],
    ['Санхүү', 'САН', [['Санхүү хариуцсан захирал', 1], ['Нягтлан бодогч', 1]]],
    ['Үйл ажиллагаа', 'ҮАЖ', [['Үйл ажиллагааны менежер', 1], ['Тээврийн зохицуулагч', 1], ['Агуулахын эрхлэгч', 1], ['Жолооч', 5], ['Ачигч', 2]]],
    ['Хүний нөөц', 'ХНӨ', [['Хүний нөөцийн менежер', 1]]],
  ],
  c3: [
    ['Удирдлага', 'УДР', [['Ерөнхий захирал', 1], ['Гүйцэтгэх захирал', 1]]],
    ['Санхүү', 'САН', [['Санхүү хариуцсан захирал', 1], ['Нягтлан бодогч', 1], ['Нярав', 1]]],
    ['Борлуулалт', 'БОР', [['Борлуулалтын менежер', 1], ['Борлуулалтын ажилтан', 3]]],
    ['Хүний нөөц', 'ХНӨ', [['Хүний нөөцийн менежер', 1]]],
  ],
}

/** One employee. `u` links an ERP user (name, age and sex come from USERS); otherwise `n` = [given, family]. */
interface Spec {
  u?: string
  n?: [string, string]
  male?: boolean
  age?: number
  pos: string
  /** Years since hired */
  y: number
  st?: EmpStatus
  /** Birthday this month: days from today */
  bday?: number
  /** A fixed-term or service contract that ends in this many days */
  ends?: [ContractKind, number]
  /** Probation ends in this many days */
  prob?: number
  /** Left this many days ago */
  left?: number
  /** Required documents not handed in yet */
  missing?: number[]
  /** Documents ending soon: [document number in DOCS, days left] */
  due?: [number, number][]
  extra?: [kind: MoveKind, daysAgo: number, note?: string][]
}

/** Users who also have HR records: [age, male] */
const USERS: Record<string, [number, boolean]> = {
  u1: [44, true], u2: [56, true], u3: [47, false], u4: [39, true], u5: [35, false], u6: [31, false], u7: [33, false],
  u8: [27, true], u9: [30, false], u10: [41, true], u11: [36, true], u12: [38, false], u13: [40, false], u14: [32, true],
}

const STAFF: Record<string, Spec[]> = {
  c1: [
    { u: 'u2', pos: 'Ерөнхий захирал', y: 12.1 },
    { u: 'u1', pos: 'Гүйцэтгэх захирал', y: 8.3 },
    { u: 'u4', pos: 'Дэд захирал', y: 5.5 },
    { n: ['Мөнхцэцэг', 'Баттулга'], male: false, age: 27, pos: 'Туслах ажилтан', y: 0.45 },
    { u: 'u3', pos: 'Санхүү хариуцсан захирал', y: 9.2, extra: [['award', 300, 'Оны шилдэг удирдах ажилтан']] },
    { u: 'u5', pos: 'Ахлах нягтлан бодогч', y: 6.4, extra: [['promoted', 770, 'Нягтлан бодогч → Ахлах нягтлан бодогч']] },
    { u: 'u6', pos: 'Нягтлан бодогч', y: 3.1 },
    { n: ['Оюунчимэг', 'Дашдорж'], male: false, age: 42, pos: 'Нярав', y: 4.7, bday: 6 },
    { n: ['Отгонбаяр', 'Мягмар'], male: true, age: 29, pos: 'Нягтлан бодогч', y: 2.5, st: 'left', left: 75 },
    { u: 'u7', pos: 'Борлуулалтын менежер', y: 5, extra: [['promoted', 550, 'Борлуулалтын ажилтан → Борлуулалтын менежер']] },
    { u: 'u9', pos: 'Маркетингийн менежер', y: 2.8 },
    { n: ['Тэмүүжин', 'Ганболд'], male: true, age: 26, pos: 'Борлуулалтын ажилтан', y: 1.9, ends: ['fixed', 9] },
    { n: ['Хонгорзул', 'Батсүх'], male: false, age: 23, pos: 'Борлуулалтын ажилтан', y: 0.15, st: 'probation', prob: 22, missing: [5, 6, 7] },
    { n: ['Билгүүн', 'Эрдэнэ'], male: true, age: 28, pos: 'Борлуулалтын ажилтан', y: 0.9, bday: 14, missing: [8] },
    { n: ['Энхжаргал', 'Оюун'], male: false, age: 34, pos: 'Борлуулалтын ажилтан', y: 3, st: 'left', left: 140 },
    { u: 'u10', pos: 'Үйл ажиллагааны менежер', y: 7.6, extra: [['award', 305, 'Оны шилдэг менежер']] },
    { u: 'u14', pos: 'Мэдээллийн технологийн инженер', y: 2.2, extra: [['pay', 210]] },
    { n: ['Ганбат', 'Цогт'], male: true, age: 48, pos: 'Жолооч', y: 6.9, due: [[6, 6]], extra: [['award', 420, 'Осолгүй 5 жил ажилласан']] },
    { n: ['Бат-Эрдэнэ', 'Сүрэн'], male: true, age: 37, pos: 'Жолооч', y: 3.4, st: 'leave', extra: [['leave', 12, 'Цалингүй чөлөө, 30 хоног']] },
    { n: ['Дамдин', 'Нацаг'], male: true, age: 52, pos: 'Жолооч', y: 10.1, bday: -3, due: [[2, -12], [13, 18]] },
    { n: ['Батсайхан', 'Жамц'], male: true, age: 58, pos: 'Харуул', y: 4.2, ends: ['fixed', -3] },
    { n: ['Ням-Очир', 'Дорж'], male: true, age: 45, pos: 'Харуул', y: 0.7, missing: [8, 11], extra: [['penalty', 95, 'Сануулах']] },
    { n: ['Цэцэгмаа', 'Бямба'], male: false, age: 50, pos: 'Үйлчлэгч', y: 2.9, ends: ['service', 120], missing: [11] },
    { u: 'u12', pos: 'Хүний нөөцийн менежер', y: 6.1 },
    { n: ['Солонго', 'Гантөмөр'], male: false, age: 29, pos: 'Хүний нөөцийн ажилтан', y: 3.3, st: 'childcare', extra: [['childcare', 210, 'Хүүхэд 3 нас хүртэл']] },
  ],
  c2: [
    { u: 'u2', pos: 'Ерөнхий захирал', y: 7 },
    { u: 'u1', pos: 'Гүйцэтгэх захирал', y: 5 },
    { u: 'u4', pos: 'Дэд захирал', y: 3 },
    { u: 'u3', pos: 'Санхүү хариуцсан захирал', y: 6 },
    { n: ['Сэлэнгэ', 'Төрбат'], male: false, age: 31, pos: 'Нягтлан бодогч', y: 2.4, due: [[6, 21]] },
    { u: 'u10', pos: 'Үйл ажиллагааны менежер', y: 4 },
    { u: 'u11', pos: 'Тээврийн зохицуулагч', y: 3.6 },
    { u: 'u13', pos: 'Агуулахын эрхлэгч', y: 4.8 },
    { n: ['Батбилэг', 'Пүрэвдорж'], male: true, age: 35, pos: 'Жолооч', y: 2.7, extra: [['moved', 380, 'Ачигч → Жолооч']] },
    { n: ['Төгөлдөр', 'Чулуун'], male: true, age: 29, pos: 'Жолооч', y: 1.4, bday: 9 },
    { n: ['Мөнх-Эрдэнэ', 'Галсан'], male: true, age: 46, pos: 'Жолооч', y: 5.1 },
    { n: ['Алтангэрэл', 'Баасан'], male: true, age: 24, pos: 'Жолооч', y: 0.1, st: 'probation', prob: 12, missing: [2, 5, 6, 7] },
    { n: ['Пүрэвсүрэн', 'Гомбо'], male: true, age: 39, pos: 'Жолооч', y: 2, st: 'left', left: 30 },
    { n: ['Баярсайхан', 'Нямдорж'], male: true, age: 27, pos: 'Ачигч', y: 1.1, ends: ['fixed', 26], missing: [8] },
    { n: ['Эрдэнэцогт', 'Лувсан'], male: true, age: 33, pos: 'Ачигч', y: 0.8 },
    { u: 'u12', pos: 'Хүний нөөцийн менежер', y: 2 },
  ],
  c3: [
    { u: 'u2', pos: 'Ерөнхий захирал', y: 4 },
    { u: 'u1', pos: 'Гүйцэтгэх захирал', y: 4 },
    { u: 'u3', pos: 'Санхүү хариуцсан захирал', y: 4 },
    { u: 'u6', pos: 'Нягтлан бодогч', y: 1.8 },
    { n: ['Наранцэцэг', 'Сайнбаяр'], male: false, age: 44, pos: 'Нярав', y: 2.3, bday: 2 },
    { u: 'u7', pos: 'Борлуулалтын менежер', y: 2.5 },
    { u: 'u8', pos: 'Борлуулалтын ажилтан', y: 1.3 },
    { n: ['Энхтуяа', 'Болд'], male: false, age: 25, pos: 'Борлуулалтын ажилтан', y: 0.6, missing: [6, 9] },
    { u: 'u12', pos: 'Хүний нөөцийн менежер', y: 1.5 },
  ],
}

const CLANS = ['Боржигон', 'Тайчууд', 'Хиад', 'Олхонуд', 'Сартуул', 'Зургаан', 'Хонгирад', 'Уриангхай']
const DISTRICTS = ['Баянзүрх', 'Сүхбаатар', 'Хан-Уул', 'Баянгол', 'Чингэлтэй', 'Сонгинохайрхан']
const RELATIONS = ['Эхнэр', 'Нөхөр', 'Ээж', 'Аав', 'Эгч', 'Ах', 'Дүү']
const HUES: Hue[] = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'indigo', 'yellow']
const EXECS = ['Ерөнхий захирал', 'Гүйцэтгэх захирал', 'Дэд захирал', 'Санхүү хариуцсан захирал']

/** Small fixed-seed random numbers, so the demo looks the same every time */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A registration number for a made-up person: "ЖШ" + birth date + sex digit */
function regNo(birth: Date, male: boolean, r: () => number) {
  const p = (n: number) => String(n).padStart(2, '0')
  const month = birth.getMonth() + 1 + (birth.getFullYear() >= 2000 ? 20 : 0)
  const sex = Math.floor(r() * 5) * 2 + (male ? 1 : 0)
  return `ЖШ${p(birth.getFullYear() % 100)}${p(month)}${p(birth.getDate())}${sex}${Math.floor(r() * 10)}`
}

export function seedHr(now: Date, people: Person[]) {
  const r = rng(20261029)
  const day = (offset: number) => ymd(addDays(now, Math.round(offset)))
  const departments: Department[] = []
  const positions: Position[] = []
  const docTypes: DocType[] = []
  const employees: Employee[] = []
  let phone = 0
  const users = new Map<string, { birth: Date; reg: string; clan: string; address: string; contact: Employee['contact'] }>()

  for (const [c, plan] of Object.entries(PLAN)) {
    DOCS.forEach(([name, required, expires], i) => docTypes.push({ id: `${c}-d${i + 1}`, company: c, name, required, expires }))
    for (const [dname, code, list] of plan) {
      const dept = { id: `${c}-${code}`, company: c, name: dname, code }
      departments.push(dept)
      list.forEach(([name, quota], i) => positions.push({ id: `${dept.id}-${i + 1}`, company: c, dept: dept.id, name, quota }))
    }

    const prefix: string = ({ c1: 'ГР', c2: 'ГЛ', c3: 'ГТ' } as Record<string, string>)[c]
    const specs = [...STAFF[c]].sort((a, b) => b.y - a.y)
    const company: Employee[] = []
    specs.forEach((sp, i) => {
      const person = sp.u ? people.find(p => p.id === sp.u)! : undefined
      const [age, male] = sp.u ? USERS[sp.u] : [sp.age!, sp.male!]
      const position = positions.find(p => p.company === c && p.name === sp.pos)!
      const hired = day(-sp.y * 365)
      // The same person keeps the same personal details in every ХХК
      let me = sp.u ? users.get(sp.u) : undefined
      if (!me) {
        let birth = addDays(now, -age * 365 - Math.floor(r() * 300))
        if (sp.bday !== undefined) {
          const b = addDays(now, sp.bday)
          birth = new Date(now.getFullYear() - age, b.getMonth(), b.getDate())
        }
        me = {
          birth, reg: regNo(birth, male, r), clan: CLANS[Math.floor(r() * CLANS.length)],
          address: `Улаанбаатар, ${DISTRICTS[Math.floor(r() * DISTRICTS.length)]} дүүрэг, ${1 + Math.floor(r() * 30)}-р хороо`,
          contact: { name: `${['Б', 'Д', 'Г', 'Ц', 'Н'][Math.floor(r() * 5)]}.${['Ганаа', 'Сараа', 'Тулга', 'Оюука', 'Бат'][Math.floor(r() * 5)]}`, relation: RELATIONS[Math.floor(r() * RELATIONS.length)], phone: `8800${String(900 + ++phone).padStart(4, '0')}` },
        }
        if (sp.u) users.set(sp.u, me)
      }
      const exec = EXECS.includes(sp.pos)
      const status = sp.st ?? 'active'
      const contract: Employee['contract'] = sp.ends
        ? { kind: sp.ends[0], no: `ХГ-${hired.slice(0, 4)}/${String(i + 1).padStart(2, '0')}`, start: day(sp.ends[1] - 365), end: day(sp.ends[1]) }
        : { kind: 'open', no: `ХГ-${hired.slice(0, 4)}/${String(i + 1).padStart(2, '0')}`, start: hired }

      // Employment history, newest first after numbering below
      const moves: Move[] = [{ id: '', date: hired, kind: 'hired', note: sp.pos }]
      if (!exec && status !== 'probation' && sp.y * 365 > 95) moves.push({ id: '', date: day(-sp.y * 365 + 90), kind: 'confirmed' })
      for (const back of [1, 2]) {
        const v = new Date(now.getFullYear() - back + (now.getMonth() >= 6 ? 1 : 0), 6, 8)
        if (v > addDays(now, -sp.y * 365 + 365) && v < now && status !== 'left') moves.push({ id: '', date: ymd(v), kind: 'vacation', note: '15 хоног' })
      }
      for (const [kind, ago, note] of sp.extra ?? []) moves.push({ id: '', date: day(-ago), kind, note })
      if (status === 'left') moves.push({ id: '', date: day(-sp.left!), kind: 'left', note: c === 'c2' ? 'Гэрээний хугацаа дууссан' : 'Өөрийн хүсэлтээр' })

      // Personal file: every required document unless listed as missing; job documents for drivers and engineers
      const files: FileItem[] = []
      DOCS.forEach(([, required, expires], d) => {
        const job = (d === 12 && sp.pos.includes('инженер')) || (d === 13 && sp.pos === 'Жолооч')
        if ((!required && !job) || sp.missing?.includes(d)) return
        const due = sp.due?.find(([n]) => n === d)
        const added = day(-sp.y * 365 + Math.floor(r() * 20))
        files.push({
          type: `${c}-d${d + 1}`, added,
          file: `${['ozgodol', 'anket', 'unemleh', 'zurag', 'diplom', 'ndd', 'eruul-mend', 'yal-shiitgelgui', 'hayag', 'geree', 'ajliin-bair', 'nuutsiin-geree', 'mergejliin-unemleh', 'jolooch'][d]}.pdf`,
          expires: expires ? day(due ? due[1] : 40 + Math.floor(r() * 900)) : undefined,
        })
      })

      const e: Employee = {
        id: `${c}-e${i + 1}`, company: c, user: sp.u, code: `${prefix}-${String(i + 1).padStart(3, '0')}`,
        clan: r() > 0.3 ? me.clan : undefined,
        family: person?.family ?? sp.n![1], given: person?.given ?? sp.n![0], regNo: me.reg,
        phone: `8800${String(++phone).padStart(4, '0')}`, email: person?.email,
        address: me.address, education: exec || sp.pos.includes('менежер') ? 'Магистр' : sp.pos === 'Жолооч' || sp.pos === 'Харуул' || sp.pos === 'Ачигч' || sp.pos === 'Үйлчлэгч' ? 'Бүрэн дунд' : 'Бакалавр',
        profession: sp.pos.includes('нягтлан') || sp.pos.includes('Нягтлан') || sp.pos === 'Нярав' || sp.pos.includes('Санхүү') ? 'Нягтлан бодогч' : sp.pos.includes('инженер') ? 'Програм хангамжийн инженер' : exec || sp.pos.includes('менежер') ? 'Бизнесийн удирдлага' : undefined,
        contact: me.contact,
        dept: position.dept, position: position.id, hired,
        probationEnd: status === 'probation' ? day(sp.prob!) : undefined,
        contract, status, moves, files,
        hue: person?.hue ?? HUES[i % HUES.length],
      }
      company.push(e)
    })

    // Order numbers: "Б/1", "Б/2"… in date order, starting again every year
    const all = company.flatMap(e => e.moves).sort((a, b) => a.date.localeCompare(b.date))
    const count = new Map<string, number>()
    for (const m of all) {
      const y = m.date.slice(0, 4)
      count.set(y, (count.get(y) ?? 0) + 1)
      m.order = `Б/${count.get(y)}`
      m.id = `${c}-m${y}-${count.get(y)}`
    }
    for (const e of company) e.moves.sort((a, b) => b.date.localeCompare(a.date))
    // Хэлтсийн дарга: whoever holds the department's first position, in Удирдлага the executive director. The general
    // director gives no monthly report.
    const holder = (name: string) => company.find(e => e.status !== 'left' && positions.find(p => p.id === e.position)?.name === name)
    for (const [, code, list] of plan) departments.find(d => d.id === `${c}-${code}`)!.head = holder(code === 'УДР' ? 'Гүйцэтгэх захирал' : list[0][0])?.id
    const top = holder('Ерөнхий захирал')
    if (top) top.manager = 'none'
    employees.push(...company)
  }
  return { departments, positions, docTypes, employees }
}
