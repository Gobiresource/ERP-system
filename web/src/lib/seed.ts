// Demo data. All names, companies and numbers are made up. Dates are relative to the day the data is created.
import type { CalEvent, Company, EventKind, Notice, Person, Priority, Project, State, Task, TaskStatus } from './types'
import { addDays, ymd, ymdhm } from './format'
import { seedHr } from './seedHr'
import { seedDrafts } from './draft'
import { seedDocs } from './docs'
import { seedChats } from './chat'
import { seedContracts } from './contracts'
import { seedReports } from './reports'

let n = 0
const uid = (p: string) => `${p}${++n}`

export function seed(): State {
  n = 0
  const now = new Date()
  const day = (offset: number) => ymd(addDays(now, offset))
  const at = (offset: number, time: string) => {
    const [h, m] = time.split(':').map(Number)
    const d = addDays(now, offset)
    d.setHours(h, m, 0, 0)
    return ymdhm(d)
  }
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 6e4).toISOString()

  const companies: Company[] = [
    { id: 'c1', name: 'Говь Ресурс ХХК', hue: 'blue', code: 'ГР' },
    { id: 'c2', name: 'Говь Логистик ХХК', hue: 'green', code: 'ГЛ' },
    { id: 'c3', name: 'Говь Трейд ХХК', hue: 'orange', code: 'ГТ' },
  ]
  const all = ['c1', 'c2', 'c3']

  const person = (id: string, given: string, family: string, role: string, team: string, cs: string[], presence: Person['presence'], hue: Person['hue'], email: string, capacity = 40, tz?: Person['tz']): Person =>
    ({ id, given, family, role, team, companies: cs, presence, hue, email: `${email}@example.mn`, capacity, tz })

  const people: Person[] = [
    person('u1', 'Болд', 'Батбаяр', 'Гүйцэтгэх захирал', 'Удирдлага', all, 'online', 'indigo', 'bold'),
    person('u2', 'Ганбаатар', 'Гомбо', 'Ерөнхий захирал', 'Удирдлага', all, 'meeting', 'blue', 'ganbaatar'),
    person('u3', 'Сарантуяа', 'Дорж', 'Санхүү хариуцсан захирал', 'Санхүү', all, 'focus', 'pink', 'sarantuya'),
    person('u4', 'Тэмүүлэн', 'Энхбаяр', 'Дэд захирал', 'Удирдлага', ['c1', 'c2'], 'online', 'teal', 'temuulen'),
    person('u5', 'Номин', 'Цэрэн', 'Ахлах нягтлан бодогч', 'Санхүү', ['c1'], 'online', 'purple', 'nomin'),
    person('u6', 'Мөнхзул', 'Очир', 'Нягтлан бодогч', 'Санхүү', ['c1', 'c3'], 'away', 'orange', 'munkhzul', 32),
    person('u7', 'Анударь', 'Жаргал', 'Борлуулалтын менежер', 'Борлуулалт', ['c1', 'c3'], 'meeting', 'green', 'anudari'),
    person('u8', 'Эрдэнэбат', 'Нямаа', 'Борлуулалтын ажилтан', 'Борлуулалт', ['c3'], 'online', 'yellow', 'erdenebat'),
    person('u9', 'Хүслэн', 'Пүрэв', 'Маркетингийн менежер', 'Борлуулалт', ['c1'], 'focus', 'pink', 'khuslen', 36),
    person('u10', 'Батзориг', 'Сүхбаатар', 'Үйл ажиллагааны менежер', 'Үйл ажиллагаа', ['c1', 'c2'], 'online', 'blue', 'batzorig'),
    person('u11', 'Өлзийсайхан', 'Төмөр', 'Тээврийн зохицуулагч', 'Үйл ажиллагаа', ['c2'], 'online', 'green', 'ulziisaikhan', 40, { city: 'Ховд', offset: 7 }),
    person('u12', 'Ариунаа', 'Хишигт', 'Хүний нөөцийн менежер', 'Хүний нөөц', all, 'online', 'purple', 'ariunaa'),
    person('u13', 'Үүрцайх', 'Лхагва', 'Агуулахын эрхлэгч', 'Үйл ажиллагаа', ['c2'], 'away', 'teal', 'uurtsaikh'),
    person('u14', 'Ганзориг', 'Мөнх', 'Мэдээллийн технологийн инженер', 'Үйл ажиллагаа', ['c1'], 'focus', 'indigo', 'ganzorig'),
    // The lawyer and the office clerk of the contract process (Гэрээ)
    person('u15', 'Энхжин', 'Баатар', 'Хуульч', 'Хууль эрх зүй', all, 'online', 'teal', 'enkhjin'),
    person('u16', 'Нандин', 'Цэрэндорж', 'Бичиг хэргийн ажилтан', 'Захиргаа', all, 'away', 'orange', 'nandin'),
  ]
  // A different emoji for everyone in the demo; each person can change theirs in Settings
  const emoji = ['horse-face', 'grinning-face', 'fox', 'smiling-face-with-sunglasses', 'panda', 'smiling-face-with-smiling-eyes', 'owl',
    'star-struck', 'rabbit-face', 'winking-face', 'two-hump-camel', 'hugging-face', 'wolf', 'cowboy-hat-face', 'face-with-monocle', 'cat-face']
  people.forEach((p, i) => { p.avatar = emoji[i] })

  const ms = (list: [string, number, boolean][]) => list.map(([name, off, done]) => ({ id: uid('m'), name, date: day(off), done }))
  const projects: Project[] = [
    { id: 'p1', company: 'c1', name: 'Шинэ агуулахын барилга', goal: 'Налайхын шинэ агуулахыг 2027 оны хавар ашиглалтад оруулах.', status: 'active', hue: 'orange', icon: 'building', lead: 'u10', members: ['u10', 'u1', 'u4', 'u14', 'u5'], start: day(-60), due: day(120), pinned: true,
      milestones: ms([['Зураг төсөл батлах', -30, true], ['Суурь цутгах', 10, false], ['Дээвэр хаах', 60, false], ['Ашиглалтад оруулах', 120, false]]) },
    { id: 'p2', company: 'c1', name: 'Жилийн тайлан 2026', goal: 'Санхүүгийн жилийн тайланг хугацаанд нь аудитад хүлээлгэн өгөх.', status: 'active', hue: 'blue', icon: 'file', lead: 'u3', members: ['u3', 'u5', 'u6', 'u1'], start: day(-30), due: day(45), pinned: true,
      milestones: ms([['Гүйлгээ тулгах', -5, true], ['Аудитын материал бэлтгэх', 14, false], ['Тайлан хүлээлгэн өгөх', 45, false]]) },
    { id: 'p3', company: 'c1', name: 'Худалдан авалтын журам', goal: 'Худалдан авалт батлах шинэ журмыг бүх ХХК-д нэвтрүүлэх.', status: 'planning', hue: 'purple', icon: 'clipboard', lead: 'u4', members: ['u4', 'u12', 'u1'], start: day(7), due: day(75), pinned: false,
      milestones: ms([['Журмын төсөл', 20, false], ['Хэлэлцүүлэг', 40, false], ['Батлах', 75, false]]) },
    { id: 'p4', company: 'c1', name: 'ERP систем нэвтрүүлэх', goal: 'Ажил, төсөл, хурлын бүртгэлийг нэг системд оруулах.', status: 'active', hue: 'teal', icon: 'monitor', lead: 'u14', members: ['u14', 'u1', 'u12', 'u5'], start: day(-14), due: day(90), pinned: false,
      milestones: ms([['Загвар батлах', -2, true], ['Туршилт', 30, false], ['Бүх ажилтанд нээх', 90, false]]) },
    { id: 'p5', company: 'c1', name: 'Ажилтны сургалт', goal: 'Аюулгүй ажиллагааны сургалтад бүх ажилтныг хамруулах.', status: 'done', hue: 'pink', icon: 'graduation', lead: 'u12', members: ['u12', 'u10', 'u9'], start: day(-90), due: day(-10), pinned: false,
      milestones: ms([['Хөтөлбөр батлах', -70, true], ['Сургалт явуулах', -20, true], ['Шалгалт авах', -10, true]]) },
    { id: 'p6', company: 'c1', name: 'Намрын борлуулалтын аян', goal: 'Улирлын борлуулалтыг өмнөх оныхоос 15%-иар өсгөх.', status: 'active', hue: 'green', icon: 'rocket', lead: 'u9', members: ['u9', 'u7', 'u1'], start: day(-20), due: day(25), pinned: false,
      milestones: ms([['Сурталчилгаа эхлүүлэх', -6, true], ['Үзэсгэлэн', 9, false], ['Дүн гаргах', 25, false]]) },
    { id: 'p7', company: 'c2', name: 'Тээврийн чиглэл шинэчлэх', goal: 'Баруун бүсийн тээврийн хуваарийг шинэчилж, зардлыг бууруулах.', status: 'active', hue: 'green', icon: 'truck', lead: 'u10', members: ['u10', 'u11', 'u4', 'u1'], start: day(-25), due: day(35), pinned: true,
      milestones: ms([['Чиглэл судлах', -10, true], ['Туршилтын аялал', 12, false], ['Шинэ хуваарь', 35, false]]) },
    { id: 'p8', company: 'c2', name: 'Агуулахын тооллого', goal: 'Жилийн эцсийн тооллогыг хоёр хоногт багтаан хийх.', status: 'active', hue: 'yellow', icon: 'boxes', lead: 'u13', members: ['u13', 'u11', 'u4'], start: day(-5), due: day(12), pinned: false,
      milestones: ms([['Маягт бэлтгэх', 2, false], ['Тооллого', 10, false], ['Акт батлах', 12, false]]) },
    { id: 'p9', company: 'c3', name: 'Шинэ харилцагч олох', goal: 'Энэ улиралд 10 шинэ байгууллагатай гэрээ байгуулах.', status: 'active', hue: 'indigo', icon: 'handshake', lead: 'u7', members: ['u7', 'u8', 'u1'], start: day(-40), due: day(50), pinned: true,
      milestones: ms([['Жагсаалт гаргах', -25, true], ['Уулзалтууд', 20, false], ['Гэрээ байгуулах', 50, false]]) },
    { id: 'p10', company: 'c3', name: '2027 оны үнийн санал', goal: 'Гол бүтээгдэхүүнүүдийн ирэх оны үнийг тогтоох.', status: 'planning', hue: 'pink', icon: 'receipt', lead: 'u8', members: ['u8', 'u7', 'u6', 'u1'], start: day(3), due: day(40), pinned: false,
      milestones: ms([['Зардлын тооцоо', 15, false], ['Үнийн санал', 40, false]]) },
  ]

  const task = (company: string, project: string | undefined, title: string, status: TaskStatus, prio: Priority, who: string | string[], due: number, estimate: number,
    extra: { subs?: [string, boolean][]; comments?: [string, string, number][]; doneAgo?: number } = {}): Task => ({
    id: uid('t'), company, project, title, status, prio, assignees: [who].flat(), due: day(due), estimate,
    subtasks: (extra.subs ?? []).map(([title, done]) => ({ id: uid('s'), title, done })),
    comments: (extra.comments ?? []).map(([author, text, minutes]) => ({ id: uid('k'), author, text, at: ago(minutes) })),
    // Open tasks were created 6–43 days ago; finished ones 2–10 days before they were done
    createdAt: ago(60 * 24 * (status === 'done' ? (extra.doneAgo ?? 1440) / 1440 + 2 + ((n * 3) % 9) : 6 + ((n * 7) % 38))),
    doneAt: status === 'done' ? ago(extra.doneAgo ?? 60 * 24) : undefined,
  })

  const tasks: Task[] = [
    task('c1', 'p1', 'Барилгын гүйцэтгэгчтэй гэрээ байгуулах', 'doing', 'high', ['u1', 'u10'], 0, 4, { subs: [['Гэрээний төслийг хянах', true], ['Хуульчаар шалгуулах', true], ['Гарын үсэг зурах', false]], comments: [['u10', 'Гүйцэтгэгч баасан гараг хүртэл хүлээнэ гэсэн.', 300]] }),
    task('c1', 'p1', 'Суурийн ажлын төсвийг батлах', 'todo', 'urgent', 'u1', 0, 2),
    task('c1', 'p1', 'Барилгын зөвшөөрлийн бичиг баримт', 'review', 'high', 'u10', 1, 6, { subs: [['Өргөдөл', true], ['Газрын гэрчилгээ', true], ['Зураг төсөл', false]], comments: [['u10', 'Зураг төслийн хуулбарыг маргааш авна.', 120]] }),
    task('c1', 'p1', 'Цахилгааны зургийг шалгуулах', 'todo', 'medium', 'u14', 5, 3),
    task('c1', 'p1', 'Ажлын талбайн хашаа барих', 'done', 'low', 'u10', -3, 8, { doneAgo: 60 * 24 * 3 }),
    task('c1', 'p1', 'Барилгын материалын үнийн санал авах', 'doing', 'medium', 'u5', 2, 5, { subs: [['Цемент', true], ['Арматур', false], ['Блок', false]] }),
    task('c1', 'p2', 'Гуравдугаар улирлын гүйлгээ тулгах', 'done', 'high', 'u5', -2, 10, { doneAgo: 60 * 26 }),
    task('c1', 'p2', 'Аудитын компанитай уулзалт товлох', 'todo', 'medium', 'u3', 3, 1),
    task('c1', 'p2', 'Үндсэн хөрөнгийн тооллогын акт', 'doing', 'high', ['u6', 'u5'], 1, 6, { subs: [['Оффис', true], ['Агуулах', false]] }),
    task('c1', 'p2', 'Татварын тайлангийн төслийг хянах', 'review', 'urgent', 'u1', 0, 3, { comments: [['u3', 'Хавсралт 4-ийг шинэчилсэн. Нэг харчихаарай.', 90]] }),
    task('c1', 'p2', 'Мөнгөн гүйлгээний тайлан', 'todo', 'medium', 'u5', 6, 4),
    task('c1', 'p2', 'Өглөгийн үлдэгдлийг баталгаажуулах', 'done', 'medium', 'u6', -4, 3, { doneAgo: 60 * 24 * 4 }),
    task('c1', 'p2', 'Нийлүүлэгчийн төлбөрийн хуваарь', 'todo', 'high', 'u6', -2, 2),
    task('c1', 'p4', 'Ажлын урсгалын шаардлага бичих', 'done', 'high', 'u1', -2, 6, { doneAgo: 60 * 24 * 2 }),
    task('c1', 'p4', 'Хэрэглэгчийн эрхийн жагсаалт гаргах', 'todo', 'high', 'u1', 0, 2),
    task('c1', 'p4', 'Туршилтын хэрэглэгчдийг сонгох', 'doing', 'medium', 'u12', 4, 2, { subs: [['Хэлтэс бүрээс нэг хүн', true], ['Зөвшөөрөл авах', false]] }),
    task('c1', 'p4', 'Нүүр дэлгэцийн загварыг батлах', 'done', 'high', 'u1', 0, 2, { doneAgo: 95 }),
    task('c1', 'p4', 'Багийн уулзалтын тэмдэглэл илгээх', 'done', 'low', 'u1', 0, 1, { doneAgo: 40 }),
    task('c1', 'p4', 'Серверийн үнийн санал харьцуулах', 'review', 'medium', 'u14', 2, 3),
    task('c1', 'p4', 'Нууц үгийн бодлого боловсруулах', 'todo', 'medium', 'u14', 8, 3),
    task('c1', 'p6', 'Сурталчилгааны төсвийг батлах', 'todo', 'high', 'u1', 0, 1),
    task('c1', 'p6', 'Фэйсбүүк хуудасны контент төлөвлөгөө', 'doing', 'medium', 'u9', 2, 6, { subs: [['10-р сар', true], ['11-р сар', false], ['12-р сар', false]] }),
    task('c1', 'p6', 'Харилцагчдад урилга илгээх', 'review', 'high', 'u7', 1, 2, { comments: [['u7', 'Жагсаалтад 140 байгууллага байна.', 200]] }),
    task('c1', 'p6', 'Үзэсгэлэнгийн лангуу захиалах', 'done', 'medium', 'u9', -5, 1, { doneAgo: 60 * 24 * 6 }),
    task('c1', 'p6', 'Борлуулалтын долоо хоногийн тайлан', 'todo', 'low', 'u7', 4, 2),
    task('c1', 'p3', 'Одоогийн журмыг судлах', 'doing', 'medium', 'u1', 0, 3),
    task('c1', 'p3', 'Бусад компанийн жишиг цуглуулах', 'todo', 'low', 'u4', 9, 4),
    task('c1', 'p3', 'Хэлэлцүүлгийн хуваарь гаргах', 'todo', 'medium', 'u12', 12, 1),
    task('c1', undefined, 'Шинэ ажилтны гэрээ бэлтгэх', 'review', 'medium', 'u12', 1, 2),
    task('c1', undefined, 'Оффисын интернэтийн гэрээ сунгах', 'done', 'low', 'u14', -1, 1, { doneAgo: 60 * 20 }),
    task('c1', undefined, 'Хурлын өрөөний проектор засуулах', 'todo', 'low', 'u14', 3, 1),
    task('c1', undefined, 'Түлшний зардлын тайлан', 'done', 'medium', 'u5', -3, 2, { doneAgo: 60 * 24 * 3 }),
    task('c1', 'p1', 'Барилгын талбайн хэмжилт', 'done', 'medium', 'u10', -8, 4, { doneAgo: 60 * 24 * 8 }),
    task('c1', 'p2', 'Банкны хуулга татах', 'done', 'low', 'u5', -7, 1, { doneAgo: 60 * 24 * 7 }),
    task('c1', 'p6', 'Сурталчилгааны зураг батлах', 'done', 'medium', 'u9', -8, 2, { doneAgo: 60 * 24 * 7.5 }),
    task('c1', 'p4', 'Одоогийн Excel файлуудыг цуглуулах', 'done', 'medium', 'u12', -6, 3, { doneAgo: 60 * 24 * 6.5 }),
    task('c1', undefined, 'Оффисын хангамж захиалах', 'done', 'low', 'u14', -9, 1, { doneAgo: 60 * 24 * 9 }),
    task('c1', 'p5', 'Сургалтын ирц нэгтгэх', 'done', 'low', 'u12', -10, 2, { doneAgo: 60 * 24 * 11 }),
    task('c1', 'p5', 'Гэрчилгээ хэвлэх', 'done', 'low', 'u12', -9, 1, { doneAgo: 60 * 24 * 9 }),

    task('c2', 'p7', 'Улаанбаатар–Ховд чиглэлийн хуваарь', 'doing', 'high', 'u11', 1, 5),
    task('c2', 'p7', 'Жолооч нарын ээлжийн хуваарь', 'todo', 'medium', 'u10', 3, 2),
    task('c2', 'p7', 'Түлшний зарцуулалтын нормыг шинэчлэх', 'review', 'medium', 'u4', 2, 3),
    task('c2', 'p7', 'Машины даатгал сунгах', 'todo', 'urgent', 'u1', 0, 1),
    task('c2', 'p8', 'Тооллогын хуваарь гаргах', 'done', 'high', 'u13', -2, 2, { doneAgo: 60 * 24 * 2 }),
    task('c2', 'p8', 'Тооллогын маягт бэлтгэх', 'doing', 'medium', 'u13', 1, 3),
    task('c2', 'p8', 'Илүүдэл барааны жагсаалт', 'todo', 'low', 'u11', 6, 2),
    task('c2', undefined, 'Агуулахын камер шалгах', 'done', 'low', 'u13', -1, 1, { doneAgo: 60 * 22 }),

    task('c3', 'p9', 'Харилцагчийн жагсаалт шинэчлэх', 'doing', 'medium', 'u8', 2, 3),
    task('c3', 'p9', 'Шинэ харилцагчтай уулзах', 'todo', 'high', 'u7', 1, 2),
    task('c3', 'p10', 'Үнийн саналын загвар', 'review', 'high', 'u1', 0, 2),
    task('c3', 'p10', 'Импортын татварын тооцоо', 'todo', 'medium', 'u6', 5, 4),
    task('c3', 'p9', 'Гэрээний загвар шинэчлэх', 'done', 'medium', 'u7', -3, 2, { doneAgo: 60 * 24 * 3 }),
    task('c3', undefined, 'Борлуулалтын сарын тайлан', 'done', 'medium', 'u8', -1, 3, { doneAgo: 60 * 21 }),
  ]

  const ev = (company: string, title: string, kind: EventKind, start: string, minutes: number, attendees: string[], extra: { project?: string; where?: string } = {}): CalEvent =>
    ({ id: uid('e'), company, title, kind, start, minutes, attendees, ...extra })

  const events: CalEvent[] = []
  // Daily stand-up on weekdays, from last week to the week after next
  for (let o = -10; o <= 17; o++) {
    const d = addDays(now, o).getDay()
    if (d > 0 && d < 6) events.push(ev('c1', 'Өглөөний шуурхай хурал', 'meeting', at(o, '09:00'), 20, ['u1', 'u2', 'u4', 'u10', 'u3'], { where: 'Хурлын өрөө 1' }))
  }
  events.push(
    ev('c1', 'Барилгын гүйцэтгэгчтэй уулзалт', 'meeting', at(0, '11:00'), 45, ['u1', 'u10', 'u4', 'u5'], { project: 'p1', where: 'Налайх, ажлын талбай' }),
    ev('c1', 'Үдийн сургалт: шинэ систем', 'social', at(0, '12:30'), 45, ['u1', 'u12', 'u14', 'u5', 'u9'], { project: 'p4', where: 'Хурлын өрөө 2' }),
    ev('c1', 'Төвлөрөх цаг', 'focus', at(0, '14:00'), 90, ['u1']),
    ev('c1', 'Татварын тайлангийн хяналт', 'review', at(0, '16:00'), 45, ['u1', 'u3', 'u5'], { project: 'p2', where: 'Санхүүгийн алба' }),
    ev('c1', 'Санхүүгийн долоо хоногийн хурал', 'meeting', at(1, '10:00'), 60, ['u1', 'u3', 'u5', 'u6'], { where: 'Хурлын өрөө 1' }),
    ev('c1', 'ERP туршилтын хэлэлцүүлэг', 'review', at(1, '15:00'), 60, ['u1', 'u14', 'u12'], { project: 'p4', where: 'Хурлын өрөө 2' }),
    ev('c1', 'Борлуулалтын аяны тойм', 'meeting', at(2, '11:00'), 45, ['u1', 'u9', 'u7'], { project: 'p6' }),
    ev('c1', 'Барилгын зөвшөөрөл өгөх эцсийн хугацаа', 'deadline', at(2, '17:00'), 30, ['u10', 'u1'], { project: 'p1' }),
    ev('c1', 'Удирдлагын хурал', 'meeting', at(3, '09:30'), 90, ['u1', 'u2', 'u3', 'u4'], { where: 'Захирлын өрөө' }),
    ev('c1', 'Багийн оройн зоог', 'social', at(3, '18:30'), 120, ['u1', 'u2', 'u3', 'u4', 'u5', 'u9', 'u10', 'u12', 'u14'], { where: 'Төв ресторан' }),
    ev('c1', 'Аудитын бэлтгэл хурал', 'meeting', at(-1, '10:00'), 60, ['u1', 'u3', 'u5'], { project: 'p2' }),
    ev('c1', 'Төвлөрөх цаг', 'focus', at(-1, '15:00'), 60, ['u1']),
    ev('c1', 'Нүүр дэлгэцийн загварын хэлэлцүүлэг', 'review', at(-2, '14:00'), 45, ['u1', 'u14', 'u12'], { project: 'p4' }),
    ev('c1', 'Хүний нөөцийн сарын хурал', 'meeting', at(6, '14:00'), 60, ['u1', 'u12', 'u2']),
    ev('c1', 'Сургалтын төлөвлөгөө', 'review', at(8, '11:00'), 45, ['u12', 'u1']),
    ev('c1', 'Аудитын материал хүлээлгэн өгөх', 'deadline', at(14, '17:00'), 30, ['u3', 'u5'], { project: 'p2' }),
    ev('c1', 'Суурь цутгах ажил эхлэх', 'deadline', at(10, '09:00'), 30, ['u10'], { project: 'p1' }),
    ev('c2', 'Тээврийн чиглэлийн хурал', 'meeting', at(1, '10:00'), 60, ['u1', 'u10', 'u11', 'u4'], { project: 'p7' }),
    ev('c2', 'Жолооч нарын сургалт', 'social', at(4, '14:00'), 90, ['u10', 'u11']),
    ev('c2', 'Тооллого дуусах хугацаа', 'deadline', at(12, '17:00'), 30, ['u13', 'u11'], { project: 'p8' }),
    ev('c2', 'Агуулахын долоо хоногийн тойм', 'review', at(0, '15:30'), 30, ['u1', 'u13', 'u4'], { project: 'p8' }),
    ev('c3', 'Шинэ харилцагчтай уулзалт', 'meeting', at(1, '11:00'), 60, ['u7', 'u8', 'u1'], { project: 'p9', where: 'Харилцагчийн оффис' }),
    ev('c3', 'Үнийн саналын хэлэлцүүлэг', 'review', at(3, '15:00'), 60, ['u1', 'u7', 'u8', 'u6'], { project: 'p10' }),
    ev('c3', 'Борлуулалтын өглөөний хурал', 'meeting', at(0, '10:00'), 30, ['u1', 'u7', 'u8']),
  )

  const note = (company: string, kind: Notice['kind'], text: string, minutes: number, read: boolean, link: { task?: string; project?: string } = {}): Notice =>
    ({ id: uid('n'), company, kind, text, at: ago(minutes), read, ...link })
  const tid = (title: string) => tasks.find(t => t.title === title)!.id
  const notices: Notice[] = [
    note('c1', 'mention', 'Б.Батзориг таныг "Барилгын зөвшөөрлийн бичиг баримт" ажилд дурдлаа.', 18, false, { task: tid('Барилгын зөвшөөрлийн бичиг баримт') }),
    note('c1', 'review', 'Д.Сарантуяа "Татварын тайлангийн төслийг хянах" ажлыг танд хянуулахаар илгээлээ.', 75, false, { task: tid('Татварын тайлангийн төслийг хянах') }),
    note('c1', 'approval', 'Ц.Номин "Барилгын материалын үнийн санал авах" ажилд таны зөвшөөрөл хүсэж байна.', 160, false, { task: tid('Барилгын материалын үнийн санал авах') }),
    note('c1', 'moved', 'Маргаашийн санхүүгийн хурал 10:00 цагт болохоор хойшиллоо.', 300, true),
    note('c1', 'done', 'Ж.Анударь "Үзэсгэлэнгийн лангуу захиалах" ажлыг дуусгалаа.', 60 * 26, true, { task: tid('Үзэсгэлэнгийн лангуу захиалах') }),
    note('c1', 'invite', 'Х.Ариунаа таныг "ERP систем нэвтрүүлэх" төсөлд нэмлээ.', 60 * 50, true, { project: 'p4' }),
    note('c2', 'review', 'Э.Тэмүүлэн "Түлшний зарцуулалтын нормыг шинэчлэх" ажлыг хянуулахаар илгээлээ.', 50, false, { task: tid('Түлшний зарцуулалтын нормыг шинэчлэх') }),
    note('c2', 'done', 'Л.Үүрцайх "Тооллогын хуваарь гаргах" ажлыг дуусгалаа.', 60 * 30, true),
    note('c3', 'mention', 'Ж.Анударь таныг "Үнийн саналын загвар" ажилд дурдлаа.', 35, false, { task: tid('Үнийн саналын загвар') }),
  ]

  // Focus sessions for the past 90 days (for Insights), deterministic
  const focusLog = []
  let r = 7
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280
  for (let o = -90; o <= 0; o++) {
    const d = addDays(now, o)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    const sessions = o === 0 ? 2 : Math.floor(rnd() * 4)
    for (let i = 0; i < sessions; i++) {
      const s = o === 0 ? new Date(now.getTime() - (i + 1) * 70 * 6e4) : new Date(d)
      if (o !== 0) s.setHours(9 + i * 2, 15, 0, 0)
      focusLog.push({ at: s.toISOString(), minutes: o === 0 ? (i ? 25 : 40) : [25, 25, 50, 15][Math.floor(rnd() * 4)] })
    }
  }

  const docs = seedDocs(now)
  const state: State = {
    version: 1,
    me: 'u1',
    company: 'c1',
    companies,
    people,
    projects,
    tasks,
    events,
    notices,
    focusLog,
    ...seedHr(now, people),
    drafts: seedDrafts(now, 'u1'),
    ...docs,
    ...seedChats(now, { tasks, events, docs: docs.docs }),
    ...seedContracts(now),
    reports: [],
    kpi: {},
    scans: [],
    aiSpent: 0,
    timely: {},
    settings: {
      theme: 'system',
      wall: 'ash',
      accent: 'blue',
      glass: 'tinted',
      solid: false,
      notify: { mentions: true, due: true, meetings: true, digest: false, focusEnd: true },
      focus: { work: 25, rest: 5, autoStart: false },
    },
  }
  return { ...state, ...seedReports(now, state) }
}
