// Бичиг хэрэг: names of document kinds and request steps, what can be asked for, the folders, and the demo documents and requests.
import type { Doc, DocKind, DocRequest, Folder, Hue, Id, ReqStatus } from './types'

export const DOC_KIND: Record<DocKind, string> = {
  contract: 'Гэрээ', order: 'Тушаал', certificate: 'Тодорхойлолт', rule: 'Журам', decision: 'Шийдвэр', letter: 'Албан бичиг', form: 'Маягт',
  template: 'Загвар',
}
export const DOC_KINDS = Object.keys(DOC_KIND) as DocKind[]
export const DOC_HUE: Record<DocKind, Hue> = {
  contract: 'blue', order: 'pink', certificate: 'green', rule: 'teal', decision: 'orange', letter: 'indigo', form: 'purple', template: 'yellow',
}

export const REQ_STATUS: Record<ReqStatus, string> = { sent: 'Илгээсэн', working: 'Хүлээн авсан', ready: 'Бэлэн', done: 'Олгосон', declined: 'Татгалзсан' }
/** The steps a request goes through: on paper it waits to be collected, a file is sent straight away */
export const stepsOf = (r: Pick<DocRequest, 'paper'>): ReqStatus[] => (r.paper ? ['sent', 'working', 'ready', 'done'] : ['sent', 'working', 'done'])
export const isOpen = (r: DocRequest) => r.status !== 'done' && r.status !== 'declined'

/** What employees most often ask the office for */
export const WHAT = ['Ажлын газрын тодорхойлолт', 'Цалингийн тодорхойлолт', 'Ажилласан жилийн тодорхойлолт', 'Хөдөлмөрийн гэрээний хуулбар', 'Тушаалын хуулбар']
export const PURPOSES = ['Банкны зээл авах', 'Виз мэдүүлэх', 'Нийгмийн даатгалд өгөх', 'Сургууль, цэцэрлэгт өгөх', 'Тэтгэмж авах']

/** Whether this user may see the document */
export const seen = (d: Doc, me: Id) => d.to === 'all' || d.to.includes(me)

/** Colours a folder can have, in the order the office is offered them */
export const FOLDER_HUES: Hue[] = ['blue', 'green', 'pink', 'teal', 'purple', 'orange', 'indigo', 'yellow']

/** The folders the office starts with, and which kinds of document go in each */
const START: [string, Hue, DocKind[]][] = [
  ['Хөдөлмөрийн гэрээ', 'blue', ['contract']],
  ['Тушаал, шийдвэр', 'pink', ['order', 'decision', 'letter']],
  ['Тодорхойлолт', 'green', ['certificate']],
  ['Дотоод журам', 'teal', ['rule']],
  ['Маягт, загвар', 'purple', ['form', 'template']],
]

/** Puts documents into the starting folders by kind: the demo data, and data saved before folders existed */
export function intoFolders(docs: (Omit<Doc, 'folder'> & { folder?: Id })[], at: string): { folders: Folder[]; docs: Doc[] } {
  const folders: Folder[] = []
  const filed = docs.map(d => {
    const [name, hue] = START.find(x => x[2].includes(d.kind)) ?? START[0]
    let f = folders.find(x => x.company === d.company && x.name === name)
    if (!f) folders.push((f = { id: `fd${folders.length + 1}`, company: d.company, name, hue, by: 'u12', added: at }))
    return { ...d, folder: f.id }
  })
  const order = (f: Folder) => START.findIndex(x => x[0] === f.name)
  return { folders: folders.sort((a, b) => order(a) - order(b)), docs: filed }
}

/** Where a document the office sends back goes: the folder that holds most documents of its kind, else the first one */
export function folderFor(folders: Folder[], docs: Doc[], company: Id, kind: DocKind): Folder | undefined {
  const mine = folders.filter(f => f.company === company)
  const count = (f: Folder) => docs.filter(d => d.folder === f.id && d.kind === kind).length
  return [...mine].sort((a, b) => count(b) - count(a))[0]
}

export function seedDocs(now: Date): { folders: Folder[]; docs: Doc[]; requests: DocRequest[] } {
  const ago = (days: number, hours = 0) => new Date(now.getTime() - (days * 24 + hours) * 36e5).toISOString()
  const day = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const hr = 'u12'
  const doc = (id: string, company: string, name: string, kind: DocKind, to: Doc['to'], days: number, text: string[]): Omit<Doc, 'folder'> =>
    ({ id, company, name, kind, to, by: hr, added: ago(days), text })

  const rules = (c: string, n: number) => [
    doc(`dc${n}`, c, 'Дотоод журам', 'rule', 'all', 150, [
      'Энэхүү журмаар компанийн ажилтны ажлын цаг, сахилга, харилцааны хэм хэмжээг тогтооно.',
      'Ажилтан ажлын байранд 08:30 цагт ирж, 17:30 цагт тарна. Үдийн завсарлага 12:30–13:30.',
      'Ажилтан компанийн эд хөрөнгө, мэдээллийг хамгаалах үүрэгтэй.',
    ]),
    doc(`dc${n + 1}`, c, 'Чөлөөний хүсэлтийн маягт', 'form', 'all', 90, [
      'Хэнд: ____________________________',
      'Хэнээс: __________________________',
      'Чөлөө авах хугацаа: ____ оны ___ сарын ___-ны өдрөөс ___ сарын ___-ны өдөр хүртэл',
      'Шалтгаан: ________________________',
      'Огноо: ____________   Гарын үсэг: ____________',
    ]),
  ]

  const docs = [
    doc('dc1', 'c1', 'Хөдөлмөрийн гэрээ', 'contract', ['u1'], 420, [
      'Гэрээ байгуулсан талууд: Говь Ресурс ХХК (ажил олгогч), Батбаяр овогтой Болд (ажилтан).',
      'Ажилтан Гүйцэтгэх захирлын албан тушаалд ажиллана.',
      'Ажлын цаг: 7 хоногт 40 цаг, Даваагаас Баасан гараг хүртэл.',
      'Гэрээний хугацаа: хугацаагүй.',
      'Талууд гэрээний нөхцөлийг Хөдөлмөрийн тухай хуулийн дагуу биелүүлнэ.',
    ]),
    doc('dc2', 'c1', 'Б/12 Ажилд томилох тушаал', 'order', ['u1'], 418, [
      'Хөдөлмөрийн тухай хуулийн 24 дүгээр зүйлийг үндэслэн ТУШААХ нь:',
      '1. Батбаяр овогтой Болдыг Гүйцэтгэх захирлын албан тушаалд томилсугай.',
      '2. Цалин хөлсийг компанийн цалингийн журмын дагуу олгохыг Санхүүгийн хэлтэст даалгасугай.',
    ]),
    doc('dc3', 'c1', 'Ажлын газрын тодорхойлолт', 'certificate', ['u1'], 21, [
      'Овог, нэр: Батбаяр Болд',
      'Албан тушаал: Гүйцэтгэх захирал',
      'Хэлтэс: Удирдлага',
      'Зориулалт: Сургууль, цэцэрлэгт өгөх',
      'Тодорхойлолтыг ажилтны хүсэлтээр олгов.',
    ]),
    ...rules('c1', 4),
    doc('dc6', 'c1', 'Ажлын цаг, амралтын журам', 'rule', 'all', 60, [
      'Ээлжийн амралтыг ажилтны ажилласан жилээс хамааран олгоно.',
      'Амралтын хуваарийг жил бүрийн 1-р сард батална.',
    ]),
    doc('dc7', 'c1', '2026 оны төсвийн тухай хурлын шийдвэр', 'decision', 'all', 35, [
      'Удирдлагын хурлаар 2026 оны төсвийг хэлэлцээд дараах шийдвэр гаргав:',
      '1. Шинэ агуулахын барилгын зардлыг төсөвт тусгах.',
      '2. Ажилтны сургалтын зардлыг 15%-иар нэмэгдүүлэх.',
    ]),
    doc('dc8', 'c1', 'Ээлжийн амралтын хүсэлтийн маягт', 'form', 'all', 90, [
      'Хэнд: ____________________________',
      'Хэнээс: __________________________',
      'Амралт эхлэх огноо: ______________   Дуусах огноо: ______________',
      'Ажлаа хүлээлгэн өгөх хүн: ________________',
      'Огноо: ____________   Гарын үсэг: ____________',
    ]),
    doc('dc9', 'c1', 'Томилолтын тайлангийн маягт', 'form', 'all', 90, [
      'Томилолтоор явсан газар: __________________',
      'Хугацаа: __________________',
      'Гүйцэтгэсэн ажил: __________________',
      'Гарсан зардал: __________________',
      'Огноо: ____________   Гарын үсэг: ____________',
    ]),
    // Samples to draft a document from
    doc('dc10', 'c1', 'Албан бичгийн загвар', 'template', 'all', 200, [
      'Огноо, дугаар: 2026.04.12, 01/45',
      'Хэнд: Хүлээн авах байгууллагын нэр, албан тушаалтны нэр',
      'Гарчиг: Хүсэлт хүргүүлэх тухай',
      'Эхний өгүүлбэрт юуны тухай бичиж байгаагаа товч хэлнэ. Дараагийн догол мөрөнд дэлгэрэнгүйг бичнэ.',
      'Гүйцэтгэх захирал (нэр, гарын үсэг)',
    ]),
    doc('dc17', 'c1', 'Тушаалын загвар', 'template', 'all', 120, [
      'Б/__ дугаартай, ____ оны __ сарын __-ны өдөр',
      'Гарчиг: Ажилд томилох тухай',
      'Хөдөлмөрийн тухай хуулийн __ дугаар зүйлийг үндэслэн ТУШААХ нь:',
      '1. ______________________________ сугай.',
      '2. Тушаалын биелэлтэд хяналт тавихыг ______________ даалгасугай.',
      'Гүйцэтгэх захирал (нэр, гарын үсэг)',
    ]),
    // Shared with other people: they see these, Б.Болд does not
    doc('dc11', 'c1', 'Хөдөлмөрийн гэрээ', 'contract', ['u5'], 300, ['Гэрээ байгуулсан талууд: Говь Ресурс ХХК (ажил олгогч), Цэрэн овогтой Номин (ажилтан).']),
    doc('dc12', 'c1', 'Б/27 Шагнах тушаал', 'order', ['u9'], 14, ['Пүрэв овогтой Хүслэнг Намрын борлуулалтын аяны амжилтын төлөө шагнасугай.']),
    ...rules('c2', 13),
    ...rules('c3', 15),
  ]

  const req = (id: string, by: string, what: string, purpose: string, extra: Partial<DocRequest>, steps: [ReqStatus, number, string?][]): DocRequest => ({
    id, company: 'c1', by, what, purpose, paper: false, copies: 1, need: day(3), ...extra,
    status: steps[steps.length - 1][0],
    steps: steps.map(([status, hoursAgo, note]) => ({ status, at: ago(0, hoursAgo), by: status === 'sent' ? by : hr, note })),
  })
  const requests: DocRequest[] = [
    req('rq1', 'u1', 'Ажлын газрын тодорхойлолт', 'Сургууль, цэцэрлэгт өгөх', { need: day(-20), doc: 'dc3' }, [['sent', 22 * 24], ['working', 21 * 24 + 6], ['done', 21 * 24]]),
    req('rq2', 'u1', 'Ажлын газрын тодорхойлолт', 'Виз мэдүүлэх', { where: 'БНСУ-ын Элчин сайдын яам', paper: true, copies: 2, need: day(1) },
      [['sent', 72], ['working', 50], ['ready', 3, 'Бичиг хэргийн өрөө, 204 тоот']]),
    req('rq3', 'u1', 'Цалингийн тодорхойлолт', 'Банкны зээл авах', { where: 'Хаан банк', need: day(3) }, [['sent', 26], ['working', 20]]),
    req('rq4', 'u5', 'Хөдөлмөрийн гэрээний хуулбар', 'Орон сууцны зээл авах', { where: 'Төрийн банк', paper: true, need: day(2) }, [['sent', 2]]),
    req('rq5', 'u9', 'Ажилласан жилийн тодорхойлолт', 'Нийгмийн даатгалд өгөх', { need: day(5) }, [['sent', 5]]),
    req('rq6', 'u7', 'Тушаалын хуулбар', 'Тэтгэмж авах', { where: 'Нийгмийн даатгалын хэлтэс', paper: true, need: day(-1) }, [['sent', 70], ['working', 48]]),
  ]
  return { ...intoFolders(docs, ago(400)), requests }
}
