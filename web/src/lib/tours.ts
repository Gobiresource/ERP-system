// The ERP's guided tours (Сургалт → ERP заавар): each teaches one piece of work on the real screens; shell/Tour.tsx
// runs them. A step lights one element and says what it does. With `click` the person presses the element itself, and
// the step after says where that led. `page` and `win` hold for the steps that follow until one changes them, so going
// on, going back and Үргэлжлүүлэх instead of a press all find the screen each step is about.
// Elements are named by what the pages already have (a class, an id, an address), the first that is on screen; a step
// whose element may not be there (no such data, no such right, a phone) is `optional` and is passed over.
// Every part of the ERP has a tour except Тохиргоо (the user's request, docs/decisions.md, 2026-11-14).
import {
  CalendarCheck, CalendarDays, ChartColumn, ClipboardCheck, Compass, FilePen, FileText, Files, Folder, GraduationCap, House, IdCard, Inbox,
  MessagesSquare, Network, NotebookPen, ScanLine, ShieldCheck, SquareCheck, SquareKanban, Users,
} from 'lucide-react'
import type { State } from './types'
import { getState, scoped } from './store'
import { getUi, type Dialog } from './ui'
import { accessOf, docView, hrView } from './access'
import { myChats } from './chat'
import { teaches } from './training'
import { today } from './format'

export interface Step {
  /** The element to light: the first of these that is on screen. None: the card stands in the middle of a dark screen. */
  at?: string | string[]
  title: string
  text: string
  /** The person presses the lit element to go on. Without it the element cannot be pressed while it is explained. */
  click?: boolean
  /** The page (what follows # in the address) from this step on; a function for a record found when the tour runs */
  page?: string | (() => string | undefined)
  /** The window open from this step on; null for none */
  win?: Dialog | (() => Dialog | undefined)
  /** Anything else the step needs first: a tab, a view */
  before?: () => void
  /** Passed over when its element is not there */
  optional?: boolean
  /** Passed over when false: a step only some people may take */
  when?: () => boolean
}

export interface Tour {
  id: string
  group: string
  icon: typeof House
  title: string
  sub: string
  /** Shown only to those who may open what it teaches */
  can?: (s: State) => boolean
  steps: Step[]
}

const s = () => getState()
/** Presses a tab or a view unless it is on already */
const press = (sel: string) => {
  const el = document.querySelector<HTMLElement>(sel)
  if (el && el.getAttribute('aria-pressed') !== 'true') el.click()
}
/** The window of this kind that is open already (the person pressed their own), or else the one made here */
const keep = (kind: NonNullable<Dialog>['kind'], make: () => Dialog | undefined) => () => {
  const d = getUi().dialog
  return d?.kind === kind ? d : make()
}

// Records the tours open, found when a tour runs: the first the person can see
const aProject = () => { const p = scoped(s()).projects[0]; return p && `project-${p.id}` }
const aChat = () => { const c = myChats(s())[0]; return c && `chat-${c.id}` }
const aBoard = () => { const d = s().drafts.find(x => x.company === s().company && x.owner === s().me); return d && `draft-${d.id}` }
const anEmployee = () => { const e = hrView(s()).employees[0]; return e && `hr-${e.id}` }
const aContract = () => { const c = s().contracts.find(x => x.company === s().company && docView(s()).contract(x)); return c && `docs-contract-${c.id}` }
const aUser = () => { const p = scoped(s()).people.find(x => x.id !== s().me); return p && `admin-${p.id}` }
const aTask = (): Dialog | undefined => { const t = scoped(s()).tasks.find(x => x.status !== 'done'); return t && { kind: 'task', id: t.id } }
const myReport = () => `insights-report-${s().me}-${today().slice(0, 7)}`
const nothingSaved = 'Энэ зааварт юу ч хадгалахгүй: цонх хаагдана.'

const START = 'Эхлэл', DAILY = 'Өдөр тутмын ажил', PLAN = 'Төсөл, төлөвлөлт', OFFICE = 'Бичиг хэрэг', HR = 'Хүний нөөц', ADMIN = 'Удирдлага'

export const TOURS: Tour[] = [
  {
    id: 'intro', group: START, icon: Compass, title: 'Системтэй танилцах', sub: 'Цэс, хайлт, мэдэгдэл хаана байдгийг үзнэ.',
    steps: [
      { page: 'home', at: ['.side nav', '.tabbar__bar'], title: 'Үндсэн цэс', text: 'Системийн бүх хэсэг рүү эндээс орно. Утсан дээр эхний дөрөв нь доод мөрөнд, үлдсэн нь «Бусад» дотор байна.' },
      { at: ['.side .brand', '.company-pill'], title: 'Компани', text: 'Одоо аль ХХК-ийн мэдээллийг харж байгааг энд харуулна. Хэд хэдэн ХХК-д ажилладаг бол эндээс солино.' },
      { at: ['.search-pill', '.tabbar__search'], title: 'Хайлт', text: 'Ажил, төсөл, хүн, бичиг баримт, хуудсыг нэрээр нь хайна.' },
      { at: '.toolbar [aria-label="Үүсгэх"]', title: 'Үүсгэх', text: 'Шинэ ажил, тов, төсөл, зурвасыг аль ч хуудаснаас эндээс үүсгэнэ.' },
      { at: '.toolbar [aria-label^="Мэдэгдэл"]', title: 'Мэдэгдэл', text: 'Таныг дурдсан, танд ажил оноосон зэрэг шинэ зүйлийг энд мэдэгдэнэ. Улаан цэг нь уншаагүй мэдэгдэл байгааг илтгэнэ.' },
      { at: ['.side__me', '.tbtn--me'], title: 'Хувийн цэс', text: 'Тохиргоо, гарын товчлол болон системээс гарах үйлдэл энд байна.' },
      { at: ['.side a[href="#training"]', '.tabbar__bar'], title: 'Сургалт', text: 'Бусад заавар «Сургалт» хэсэгт байна. Хэсэг бүрийг хэрхэн ашиглахыг тэндээс үзнэ.' },
    ],
  },
  {
    id: 'home', group: DAILY, icon: House, title: 'Нүүр хуудас', sub: 'Өдрийн ажил, тов, төвлөрөх цаг.',
    steps: [
      { page: 'home', at: '.head__stats', title: 'Өнөөдрийн үзүүлэлт', text: 'Өнөөдөр дуусгасан ажил, төвлөрсөн цаг зэрэг таны өдрийн үзүүлэлтийг харуулна.' },
      { at: '.w-tasks', title: 'Миний ажил', text: 'Өнөөдөр хийх болон хугацаа нь хэтэрсэн ажлуудыг харуулна. Дугуй тэмдгийг дарж дууссан гэж тэмдэглэнэ, нэр дээр нь дарж дэлгэрэнгүйг нээнэ.' },
      { at: '.w-next', title: 'Дараагийн тов', text: 'Хамгийн ойрын уулзалт, тов хэдий хугацааны дараа болохыг харуулна.' },
      { at: '.w-focus', title: 'Төвлөрөх цаг', text: 'Тасалдалгүй ажиллах хугацаагаа сонгоод «Эхлүүлэх» дээр дарна. Цаг дэлгэцийн дээд талд харагдаж, мэдэгдлүүд түр хүлээгдэнэ.' },
      { at: '.w-projects', optional: true, title: 'Төсөл', text: 'Таны төслүүдийн явцыг харуулна. Төсөл дээр дарж хуудсыг нь нээнэ.' },
      { at: '.w-people', optional: true, title: 'Яг одоо', text: 'Багийн гишүүд одоо идэвхтэй, төвлөрсөн эсвэл уулзалттай байгааг харуулна.' },
    ],
  },
  {
    id: 'task-new', group: DAILY, icon: SquareCheck, title: 'Ажил нэмэх', sub: 'Шинэ ажил үүсгэж, хариуцагч оноох.',
    steps: [
      { page: 'tasks', at: '#page-title', title: 'Ажил', text: 'Таны болон багийн ажлууд энэ хуудсанд харагдана. Шинэ ажил эндээс нэмнэ.' },
      { at: '.head__actions .btn--accent', click: true, title: 'Шинэ ажил', text: 'Ажил нэмэхдээ энэ товчийг дарна.' },
      { win: { kind: 'newTask' }, at: '.field:has(#nt-title)', title: 'Ажлын нэр', text: 'Юу хийхээ товч, тодорхой бичнэ. Жишээ нь: «Нийлүүлэгчээс үнийн санал авах».' },
      { at: '.field:has(#nt-project)', title: 'Төсөл', text: 'Ажил аль нэг төсөлд хамаарах бол төслөө сонгоно. Хамаарахгүй бол «Төсөлгүй» хэвээр үлдээнэ.' },
      { at: '.field:has(#nt-prio)', title: 'Ач холбогдол', text: 'Ажил хэр яаралтайг заана. «Өндөр», «Яаралтай» ажил самбарт тэмдэгтэй харагдана.' },
      { at: '.field:has(#nt-due)', title: 'Дуусах өдөр', text: 'Ажлыг дуусгах өдрийг сонгоно.' },
      { at: 'dialog[open] fieldset.field', title: 'Хариуцагч', text: 'Ажлыг хэн хийхийг сонгоно. Хэд хэдэн хүн сонгож болно. Ажлын төлөвийг зөвхөн хариуцагч сольж, дуусгана.' },
      { at: '.mform__head .btn--accent', title: 'Нэмэх', text: `«Нэмэх» дээр дарахад ажил самбарт орно. ${nothingSaved}` },
    ],
  },
  {
    id: 'task-board', group: DAILY, icon: SquareKanban, title: 'Ажлын самбар', sub: 'Ажлыг шүүх, нээх, төлөвийг нь солих.',
    steps: [
      { page: 'tasks', before: () => press('.tk-viewseg .seg__btn'), at: '.tk-viewseg', title: 'Харагдац', text: 'Ажлыг самбараар эсвэл жагсаалтаар харна. Самбар нь ажлыг төлөв бүрээр баганад хуваана.' },
      { at: '.tk-bar', title: 'Шүүлтүүр', text: 'Төслөөр болон зөвхөн өөрийн ажлаар шүүж, нэрээр нь хайна.' },
      { at: '.tk-col', optional: true, title: 'Багана', text: 'Ажил «Хийх», «Хийж буй», «Хянаж буй», «Дууссан» гэсэн дөрвөн төлөвтэй. Хариуцагч нь картыг чирж дараагийн баганад шилжүүлнэ.' },
      { at: ['.tk-card__open', '.tk-groups button'], click: true, optional: true, title: 'Ажил нээх', text: 'Ажлын нэр дээр дарж дэлгэрэнгүйг нь нээнэ.' },
      { win: keep('task', aTask), at: '.tp__title', title: 'Ажлын дэлгэрэнгүй', text: 'Ажлын нэр, төсөл, ач холбогдол, дуусах өдөр, хариуцагч энд харагдана.' },
      { at: '.tp__seg', title: 'Төлөв', text: 'Ажлын төлөвийг эндээс солино. Зөвхөн хариуцагч солино.' },
      { at: 'dialog[open] section.block', title: 'Дэд ажил', text: 'Том ажлыг жижиг алхмуудад хувааж, нэг бүрчлэн тэмдэглэнэ.' },
      { at: 'dialog[open] section.block ~ section.block', title: 'Сэтгэгдэл', text: 'Ажилтай холбоотой асуулт, тайлбараа энд бичнэ. Хамтран ажиллагсад тань харна.' },
      { at: '.tp__foot', title: 'Дуусгах', text: 'Ажил дуусмагц хариуцагч нь «Дуусгах» дээр дарна. Ажил «Дууссан» баганад шилжинэ.' },
    ],
  },
  {
    id: 'calendar', group: DAILY, icon: CalendarDays, title: 'Календарь, тов', sub: 'Товоо харах, шинэ тов нэмэх.',
    steps: [
      { page: 'calendar', at: '.cal-monthcard', optional: true, title: 'Сар', text: 'Өдөр бүр дээр тэр өдрийн тов харагдана. Өдөр дээр дарж товуудыг нь жагсаалтаар харна.' },
      { at: '.cal-viewseg', title: 'Харагдац', text: '«Сар» эсвэл «Долоо хоног» харагдацыг сонгоно. Долоо хоногийн харагдац товыг цаг цагаар харуулна.' },
      { at: '.cal-agenda', optional: true, title: 'Өдрийн тов', text: 'Сонгосон өдрийн товууд цагийн дарааллаар, мөн тэр өдөр дуусах ажлууд харагдана.' },
      { at: '.head__actions .btn--accent', click: true, title: 'Шинэ тов', text: 'Уулзалт, эцсийн хугацаа зэрэг тов нэмэхдээ энэ товчийг дарна.' },
      { win: { kind: 'newEvent' }, at: '.field:has(#ne-title)', title: 'Нэр', text: 'Товын нэрийг бичнэ. Жишээ нь: «Төслийн хэлэлцүүлэг».' },
      { at: '.field:has(#ne-date)', title: 'Огноо', text: 'Өдрөө сонгоод хажуугийн талбаруудад эхлэх цаг, үргэлжлэх хугацааг заана.' },
      { at: '.field:has(#ne-kind)', title: 'Төрөл', text: 'Уулзалт, төвлөрөх цаг, хяналт, эцсийн хугацаа, багийн арга хэмжээ гэсэн төрлөөс сонгоно. Төрөл бүр өөр өнгөөр харагдана.' },
      { at: '.mform__head .btn--accent', title: 'Нэмэх', text: `«Нэмэх» дээр дарахад тов календарьт орно. ${nothingSaved}` },
    ],
  },
  {
    id: 'chat', group: DAILY, icon: MessagesSquare, title: 'Зурвас', sub: 'Хамт олонтойгоо бичиж, ажил, файл хавсаргах.',
    steps: [
      { page: 'chat', at: '.chat__list', title: 'Миний зурвас', text: 'Хувийн болон бүлгийн бүх зурвас энд байна. Шинэ зурвастай нь тоотой харагдана.' },
      { at: '.head__actions .btn--accent', title: 'Шинэ зурвас', text: 'Нэг хүн сонговол хувийн зурвас, хэд хэдэн хүн сонговол бүлэг үүснэ.' },
      { page: aChat, at: '.chat__thread', optional: true, title: 'Харилцаа', text: 'Зурвасууд цагийн дарааллаар харагдана. Зурвас дээр эможигоор хариу үйлдэл үзүүлж болно.' },
      { at: '.ccompose', optional: true, title: 'Зурвас бичих', text: 'Зурвасаа бичээд «Илгээх» дээр дарна. Enter дарсан ч илгээнэ.' },
      { at: '.ccompose [aria-label="Хавсаргах"]', optional: true, title: 'Хавсаргах', text: 'Зурваст ажил, тов, бичиг баримт, файл хавсаргана. Хавсаргасан зүйл дээр дарахад шууд нээгдэнэ.' },
    ],
  },
  {
    id: 'requests', group: DAILY, icon: Inbox, title: 'Хүсэлт гаргах', sub: 'Амралт, илүү цаг, худалдан авалтын хүсэлт.',
    steps: [
      { page: 'requests', at: '#page-title', title: 'Хүсэлт', text: 'Ээлжийн амралт, илүү цаг, шинэ ажилтан авах, худалдан авах, бичиг баримтын хүсэлтийг эндээс гаргаж, явцыг нь харна.' },
      { at: '.head__actions .btn--accent', click: true, title: 'Хүсэлт гаргах', text: 'Шинэ хүсэлт гаргахдаа энэ товчийг дарна.' },
      { win: { kind: 'newRequest' }, at: '.rnew__kind', click: true, title: 'Хүсэлтийн төрөл', text: 'Төрөл бүрийн доор хэн батлах нь харагдана. Жишээ болгож «Ээлжийн амралт»-ыг сонгоно.' },
      { win: { kind: 'hrRequestForm', type: 'leave' }, at: '.rbal', optional: true, title: 'Амралтын үлдэгдэл', text: 'Хэдэн хоногийн амралтын эрхтэй, хэдийг ашигласан, хэд үлдсэнийг харуулна.' },
      { at: '.field:has(#lv-from)', title: 'Хугацаа', text: 'Эхлэх, дуусах өдрөө сонгоно. Ажлын өдрийн тоог систем тооцно: амралтын болон баярын өдрийг хасна.' },
      { at: '.field:has(#lv-stand)', title: 'Орлох хүн', text: 'Таныг эзгүй байх үед ажлыг тань хэн орлохыг сонгож болно.' },
      { at: 'section[aria-labelledby="rq-plan"]', title: 'Батлах явц', text: 'Хүсэлт хэнээр дамжиж батлагдахыг дарааллаар нь харуулна.' },
      { at: '.mform__head .btn--accent', title: 'Илгээх', text: `«Илгээх» дээр дарахад хүсэлт эхний батлах хүнд очно. ${nothingSaved}` },
      { win: null, at: '.rtabs .seg', title: 'Миний ба ирсэн хүсэлт', text: '«Миний хүсэлт» хэсэгт өөрийн гаргасан хүсэлтийн явц, «Ирсэн хүсэлт» хэсэгт таны шийдэх хүсэлтүүд харагдана.' },
      { at: '.rlist', optional: true, title: 'Жагсаалт', text: 'Хүсэлт дээр дарж дэлгэрэнгүйг нээнэ. Шийдэх ээлж таных бол тэндээс батална эсвэл буцаана.' },
    ],
  },
  {
    id: 'projects', group: PLAN, icon: Folder, title: 'Төсөл', sub: 'Төслийн явц, үе шат, оролцогчид.',
    steps: [
      { page: 'projects', at: '.head__stats', title: 'Төслийн үзүүлэлт', text: 'Хэрэгжиж буй болон дууссан төслийн тоо, хугацаандаа яваа хувийг харуулна.' },
      { at: '.pfilter', title: 'Төлвөөр шүүх', text: 'Хэрэгжиж буй, төлөвлөж буй, дууссан төслөөр шүүнэ.' },
      { at: '.pcard__link', click: true, optional: true, title: 'Төсөл нээх', text: 'Картад төслийн явц, ахлах, дуусах хугацаа харагдана. Нэр дээр нь дарж хуудсыг нь нээнэ.' },
      { page: aProject, at: '.pd-over', title: 'Тойм', text: 'Төслийн ахлах, төлөв, хугацаа, оролцогчид энд харагдана. Төслийн ахлах оролцогч нэмнэ.' },
      { at: '.pd-ms', optional: true, title: 'Үе шат', text: 'Төслийн гол үе шатууд энд харагдана. Биелсэн үе шатыг тэмдэглэнэ.' },
      { at: '.pd-tasks', optional: true, title: 'Төслийн ажил', text: 'Энэ төсөлд хамаарах ажлууд төлвөөрөө харагдана. «Ажил нэмэх» дээр дарж шууд энэ төсөлд ажил нэмнэ.' },
      { at: '.head__actions .pstar', optional: true, title: 'Онцлох', text: 'Онцолсон төсөл хажуугийн цэсэнд байнга харагдана.' },
    ],
  },
  {
    id: 'draft', group: PLAN, icon: NotebookPen, title: 'Ноорог самбар', sub: 'Санаа, тэмдэглэлээ чөлөөтэй байрлуулах.',
    steps: [
      { page: 'draft', at: 'section[aria-labelledby="boards-mine"]', title: 'Миний самбар', text: 'Ноорог нь санаа, тэмдэглэл, зураг, файлаа чөлөөтэй байрлуулах самбар. Таны самбарууд энд байна.' },
      { at: 'section[aria-labelledby="boards-tpl"]', title: 'Загвар', text: 'Хурлын тэмдэглэл, 7 хоногийн төлөвлөгөө зэрэг бэлэн загвараас эхэлж болно.' },
      { page: aBoard, at: ['.bcard--note', '.bcard', '.board'], optional: true, title: 'Самбар', text: 'Хоосон газар хоёр товшиж тэмдэглэл нэмнэ. Картыг чирж хүссэн газраа байрлуулна.' },
      { at: '.dock', optional: true, title: 'Хэрэгсэл', text: 'Тэмдэглэл, жагсаалт, гарчиг, зураг, холбоос, файл нэмэх товчнууд энд байна.' },
      { at: '.bview', optional: true, title: 'Харах', text: 'Буцаах, дахин хийх, томруулах, жижигрүүлэх болон бүгдийг нэг дор харах товчнууд энд байна.' },
    ],
  },
  {
    id: 'insights', group: PLAN, icon: ChartColumn, title: 'Тайлан, үзүүлэлт', sub: 'Багийн ажлын тоон үзүүлэлт.',
    steps: [
      { page: 'insights', at: '.head__stats', title: 'Гол үзүүлэлт', text: 'Дууссан ажил, хугацаандаа дууссан хувь зэрэг багийн гол үзүүлэлтийг харуулна. Өмнөх үетэй харьцуулсан өөрчлөлт хажууд нь харагдана.' },
      { at: '.ins-range', title: 'Хугацаа', text: 'Сүүлийн 7, 30 эсвэл 90 хоногоор харна.' },
      { at: '.ins-thru', title: 'Дууссан ажил', text: 'Өдөр бүр хэдэн ажил дууссаныг харуулна. «Хүснэгтээр харах» дээр дарж тоогоор нь харна.' },
      { at: '.ins-work', optional: true, title: 'Ачаалал', text: 'Хүн бүрийн дуусаагүй ажлын цагийг харуулна. Хэн хэт ачаалалтай байгааг эндээс харна.' },
      { at: '.head__actions .btn--glass', optional: true, title: 'Excel-ээр татах', text: 'Тайлангийн тоонуудыг Excel файлаар татна.' },
    ],
  },
  {
    id: 'reports', group: PLAN, icon: ClipboardCheck, title: 'Сарын тайлан', sub: 'Сарын тайлангаа бөглөх, үнэлгээгээ харах.',
    steps: [
      { page: 'insights-reports', at: '#page-title', title: 'Сарын тайлан', text: 'Ажилтан бүр сар бүр ажлын тайлангаа бөглөж шууд удирдлагадаа илгээнэ. Шууд удирдлага үнэлнэ.' },
      { at: '.rtodo', optional: true, title: 'Миний хийх', text: 'Таны бөглөх эсвэл үнэлэх ёстой тайлангууд энд харагдана.' },
      { at: '.rtable', optional: true, title: 'Ажилтнуудын тайлан', text: 'Ажилтан бүрийн тайлангийн төлөв, оноог харуулна. Нэр дээр дарж тайланг нээнэ.' },
      { page: myReport, at: '.rpaper', optional: true, title: 'Тайлангийн хуудас', text: 'Хийсэн ажил, асуудал ба санал, дараа сарын төлөвлөгөө гэсэн хэсгүүдтэй.' },
      { at: '.ctstate', optional: true, title: 'Явц', text: 'Тайлан бөглөх, илгээх, үнэлэх шатаар явна. Одоо аль шатанд байгааг харуулна.' },
      { at: '.rfacts', optional: true, title: 'Системд бүртгэгдсэн', text: 'Тухайн сард дууссан ажил, оролцсон уулзалтын тоог систем өөрөө гаргана.' },
    ],
  },
  {
    id: 'team', group: PLAN, icon: Users, title: 'Баг', sub: 'Хамт олны төлөв, ачаалал.',
    steps: [
      { page: 'team', at: '.head__stats', title: 'Багийн үзүүлэлт', text: 'Одоо хэдэн хүн идэвхтэй, хэд нь төвлөрч байгаа болон дундаж ачааллыг харуулна.' },
      { at: 'main .seg', title: 'Хэлтсээр шүүх', text: 'Хэлтэс сонгож зөвхөн тэр хэлтсийн хүмүүсийг харна.' },
      { at: '.mcard', title: 'Хүний карт', text: 'Хүн бүрийн албан тушаал, одоогийн төлөв, ачааллыг харуулна. «Мэдээлэл харах» дээр дарж дэлгэрэнгүйг нээнэ.' },
      { win: () => ({ kind: 'person', id: s().me }), at: '.prof__seg', optional: true, title: 'Таны төлөв', text: 'Төлөвөө эндээс солино: идэвхтэй, төвлөрсөн, уулзалттай, түр эзгүй.' },
      { at: 'dialog[open] section.block', optional: true, title: 'Ажил, тов', text: 'Тухайн хүний дуусаагүй ажил болон энэ долоо хоногийн товуудыг харуулна.' },
    ],
  },
  {
    id: 'docs', group: OFFICE, icon: Files, title: 'Бичиг баримт', sub: 'Хавтаснаас баримт олох, бичиг хэргээс хүсэх.',
    steps: [
      { page: 'docs', at: '.folder', title: 'Хавтас', text: 'ХХК бүр өөрийн хавтастай. Хавтас дээр бичиг баримтын тоо харагдана. Дарж нээнэ.' },
      { at: '.dcats', optional: true, title: 'Ангилал', text: 'Одоогийн ХХК-ийн бичиг баримтыг төрлөөр нь харуулна: гэрээ, тушаал, журам, маягт гэх мэт. Дарж тэр төрлийг нээнэ.' },
      { at: '.head__actions .btn--accent', title: 'Бичиг баримт хүсэх', text: 'Тодорхойлолт зэрэг бичиг баримтыг бичиг хэргээс хүсэхдээ энэ товчийг дарна.' },
      { page: () => `docs-folder-${s().company}`, at: '.dpaper__open', optional: true, title: 'Бичиг баримт', text: 'Бичиг баримт дээр дарж томоор нээн уншина. Хажуугийн товчоор татаж авна.' },
      { at: '.head__actions .btn--accent', optional: true, title: 'Бичиг баримт нэмэх', text: 'Бичиг хэргийн ажилтан шинэ бичиг баримтыг эндээс нэмж, хэнд харагдахыг сонгоно.' },
    ],
  },
  {
    id: 'contracts', group: OFFICE, icon: FilePen, title: 'Гэрээ байгуулах', sub: 'Гэрээг ноорогоос бүртгэл хүртэл.',
    steps: [
      { page: 'docs-contracts', at: '#page-title', title: 'Гэрээ', text: 'Гэрээг ноорогоос эхлээд хянуулж, батлуулж, бүртгэх хүртэл энд хийнэ.' },
      { at: '.seg[aria-label="Гэрээ"]', title: 'Миний хийх', text: '«Миний хийх» хэсэгт таны хянах, батлах гэрээ, «Явагдаж буй» хэсэгт явцтай бүх гэрээ харагдана.' },
      { at: '.head__actions .btn--accent', click: true, title: 'Гэрээ үүсгэх', text: 'Шинэ гэрээ эхлүүлэхдээ энэ товчийг дарна.' },
      { win: { kind: 'newContract' }, at: '.field:has(#ctn-title)', title: 'Гэрээний нэр', text: 'Гэрээний нэрийг, доор нь харилцагч байгууллагын нэрийг бичнэ.' },
      { at: '.field:has(#ctn-kind)', title: 'Төрөл', text: 'Төрлөө сонгоход тухайн төрлийн загвар текст бэлэн орж ирнэ.' },
      { at: '.mform__head .btn--accent', title: 'Үүсгэх', text: `«Үүсгэх» дээр дарахад гэрээний ноорог нээгдэнэ. ${nothingSaved}` },
      { win: null, page: aContract, at: '.paper', optional: true, title: 'Гэрээний текст', text: 'Бүх оролцогч нэг текст дээр ажиллана. Ноорог үед хариуцсан ажилтан заалтыг засаж, нэмж, хасна.' },
      { at: '.ctstate', optional: true, title: 'Явц', text: 'Гэрээ одоо аль шатанд, хэний ээлж болохыг харуулна. Таны хийх үйлдлийн товч энд гарна.' },
      { at: '.ctver', optional: true, title: 'Хувилбар', text: 'Засвар бүр шинэ хувилбар болж хадгалагдана. Хувилбар хооронд юу өөрчлөгдсөнийг харж болно.' },
      { at: '.ctlog', optional: true, title: 'Түүх', text: 'Хэн, хэзээ, юу хийснийг дарааллаар нь харуулна. Тэмдэглэл үлдээж болно.' },
    ],
  },
  {
    id: 'scan', group: OFFICE, icon: ScanLine, title: 'Скан оруулах', sub: 'Цаасан баримтыг скан хийж хавтаслах.',
    can: st => docView(st).edit(st.company),
    steps: [
      { page: 'docs-scan', at: '.sdrop', title: 'Скан оруулах', text: 'Скан хийсэн файл эсвэл хавтсаа энд чирж тавина. PDF, JPG, PNG файл болно.' },
      { at: '.sbar', optional: true, title: 'AI уншилт', text: 'AI холбогдсон үед баримтын төрөл, дугаар, огноо, харилцагчийг уншиж бөглөнө. Та шалгаад хавтаслана.' },
      { at: 'main > div > section.card', optional: true, title: 'Хавтаслах баримт', text: 'Оруулсан скан бүр энд жагсана. Мэдээллийг нь шалгаж, зөв хавтсанд хийнэ.' },
    ],
  },
  {
    id: 'pdf', group: OFFICE, icon: FileText, title: 'PDF засах', sub: 'Хуудас эрэмбэлэх, нэгтгэх, гарын үсэг зурах.',
    steps: [
      { page: 'docs-pdf', at: '.pdrop', title: 'PDF файл', text: 'PDF файлаа энд чирж тавина эсвэл «Файл сонгох» дээр дарна. Хэд хэдэн файл сонговол нэг файл болгон нэгтгэнэ.' },
      { at: '.pdrop .btn--accent', optional: true, title: 'Файл нээсний дараа', text: 'Хуудсыг чирж эрэмбэлнэ, эргүүлнэ, устгана. Хуудсан дээр бичиж, гарын үсэг зурна.' },
    ],
  },
  {
    id: 'hr', group: HR, icon: IdCard, title: 'Ажилтны бүртгэл', sub: 'Ажилтан хайх, бүртгэлийг нь харах.',
    can: st => accessOf(st, st.me, st.company).hr !== 'none',
    steps: [
      { page: 'hr', at: '.head__stats', title: 'Хүний нөөцийн үзүүлэлт', text: 'Ажилтны тоо, орон тооны бүрдэлт, хувийн хэргийн бүрдэлтийг харуулна.' },
      { at: 'section[aria-labelledby="hra-t"]', optional: true, title: 'Анхаарах зүйл', text: 'Ойрын 30 хоногт хугацаа нь дуусах гэрээ болон дутуу бичиг баримтыг сануулна.' },
      { page: 'hr-employees', at: '.tk-bar', title: 'Шүүх, хайх', text: 'Төлөв, хэлтсээр шүүж, нэр, код, регистрийн дугаар, утсаар хайна.' },
      { at: '.emp-table', title: 'Ажилтны жагсаалт', text: 'Баганын нэр дээр дарж эрэмбэлнэ. Ажилтны нэр дээр дарж бүртгэлийг нь нээнэ.' },
      { at: 'a[href="#hr-new"]', optional: true, title: 'Ажилтан нэмэх', text: 'Шинэ ажилтны бүртгэлийг эндээс үүсгэнэ. Регистрийн дугаараас төрсөн огноо, хүйсийг систем өөрөө гаргана.' },
      { page: anEmployee, at: '.esheet', optional: true, title: 'Ажилтны бүртгэл', text: 'Хувийн мэдээлэл, ажлын мэдээлэл, хувийн хэргийн бичиг баримтыг харуулна. «Түүх» хэсэгт албан тушаалын өөрчлөлт харагдана.' },
      { at: '.head__actions', optional: true, title: 'Ирц, засах', text: '«Ирц» дээр дарж тухайн ажилтны ирцийг харна. Засах эрхтэй бол «Засах» дээр дарж бүртгэлийг өөрчилнө.' },
    ],
  },
  {
    id: 'structure', group: HR, icon: Network, title: 'Бүтэц, орон тоо', sub: 'Хэлтэс, албан тушаал, орон тоо.',
    can: st => accessOf(st, st.me, st.company).hr === 'all',
    steps: [
      { page: 'hr-structure', at: '.head__stats', title: 'Орон тоо', text: 'Нийт орон тоо, бүрдсэн болон сул орон тоог харуулна.' },
      { at: '.dcard', optional: true, title: 'Хэлтэс', text: 'Хэлтэс бүрийн албан тушаал, орон тоог харуулна. Албан тушаал бүрд хэдэн хүн ажиллаж байгаа нь харагдана.' },
      { at: '.head__actions .btn--accent', optional: true, title: 'Хэлтэс нэмэх', text: 'Засах эрхтэй хүн шинэ хэлтэс, албан тушаалыг нэмнэ.' },
    ],
  },
  {
    id: 'attendance', group: HR, icon: CalendarCheck, title: 'Ирц', sub: 'Ажилтнуудын ирцийг сараар харах.',
    can: st => accessOf(st, st.me, st.company).attendance !== 'none',
    steps: [
      { page: 'hr-attendance', at: '#page-title', title: 'Ирц', text: 'Ирцийн мэдээлэл Timely системээс ирнэ. Ажилтныг регистрийн дугаараар нь тулгана.' },
      { at: 'main .seg.seg--sm', optional: true, title: 'Сар', text: 'Харах сараа сонгоно.' },
      { at: '.att-table', optional: true, title: 'Ажилтнуудын ирц', text: 'Ажилтан бүрийн ажилласан өдөр, цаг, ирцийн хувийг харуулна. Мөр дээр дарж өдөр бүрийн ирцийг календариар харна.' },
    ],
  },
  {
    id: 'admin', group: ADMIN, icon: ShieldCheck, title: 'Хэрэглэгч, эрх', sub: 'Хэрэглэгч нэмэх, эрхийг нь тохируулах.',
    can: st => accessOf(st, st.me, st.company).admin,
    steps: [
      { page: 'admin', at: '.head__stats', title: 'Хэрэглэгчийн тоо', text: 'Хэдэн хэрэглэгч байгаа, хэд нь идэвхгүй, хэд нь удирдлагын эрхтэйг харуулна.' },
      { at: '.adm-table', title: 'Хэрэглэгчид', text: 'Хэрэглэгч бүрийн нэвтрэх нэр, эрхийг харуулна. Мөр дээр дарж эрхийг нь өөрчилнө.' },
      { at: '.head__actions .btn--accent', title: 'Хэрэглэгч нэмэх', text: 'Шинэ хүнд нэвтрэх эрх үүсгэнэ.' },
      { page: aUser, at: '.adm-presets', optional: true, title: 'Бэлэн эрх', text: 'Захирал, Хүний нөөц, Бичиг хэрэг, Салбарын захирал, Ажилтан гэсэн бэлэн эрхээс сонгоно.' },
      { at: '.adm-each', optional: true, title: 'Эрх тус бүр', text: 'Шаардлагатай бол эрх бүрийг тусад нь тохируулна: хэний мэдээллийг харах, юуг засах.' },
      { at: '.adm-side', optional: true, title: 'Нэвтрэлт', text: 'Нэвтрэх нэрийг солих, нууц үгийг шинэчлэх, хэрэглэгчийг идэвхгүй болгох үйлдлийг эндээс хийнэ.' },
    ],
  },
  {
    id: 'training', group: START, icon: GraduationCap, title: 'Сургалтын материал', sub: 'Заавар, зураг, бичлэг үзэх, нэмэх.',
    steps: [
      { page: 'training', at: ['.tr-grid', 'main .card'], title: 'Материал', text: 'Байгууллагын заавар, зураг, бичлэг энд байна. Дарж нээн үзнэ.' },
      { at: '.tr-topics', optional: true, title: 'Сэдэв', text: 'Сэдвээр шүүж хэрэгтэй материалаа хурдан олно.' },
      { when: () => teaches(s(), s().me, s().company), at: '.head__actions .btn--accent', click: true, title: 'Материал нэмэх', text: 'Хүний нөөцийн ажилтан болон удирдлага шинэ материал нэмнэ.' },
      { when: () => teaches(s(), s().me, s().company), win: { kind: 'lessonForm' }, at: '.field:has(#lf-title)', title: 'Гарчиг', text: 'Материалын гарчгийг бичнэ. Хажууд нь сэдвийг бичвэл сэдвээр шүүхэд амар болно.' },
      { when: () => teaches(s(), s().me, s().company), at: '.field:has(#lf-text)', title: 'Заавар', text: 'Алхам бүрийг шинэ мөрөнд бичнэ. «1.» гэж эхэлсэн мөрүүд дугаартай жагсаалт болно.' },
      { when: () => teaches(s(), s().me, s().company), at: '.field:has(#lf-files)', title: 'Зураг, бичлэг, файл', text: `Зураг, бичлэг, PDF файлаа сонгоно. Бичлэг 200 MB хүртэл байж болно. ${nothingSaved}` },
      { win: null, at: '.subnav a[href="#training-erp"]', title: 'ERP заавар', text: 'Системийг ашиглах заавруудыг «ERP заавар» хэсгээс хүссэн үедээ дахин үзэж болно.' },
    ],
  },
]
