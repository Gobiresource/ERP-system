// Сургалт: what each ХХК's people learn from (a text with pictures, videos and files), and who may add to it.
// The ERP's own lessons are guided tours over the real screens: lib/tours.ts.
import type { BoardFile, Id, Lesson, State } from './types'
import { accessOf } from './access'

/** Whoever keeps the ХХК's employee records or runs it adds and changes what its people learn from */
export function teaches(s: Pick<State, 'people'>, who: Id, company: Id) {
  const a = accessOf(s, who, company)
  return a.admin || a.hrEdit
}

export const isVideo = (f: Pick<BoardFile, 'type'>) => f.type.startsWith('video/')
export const isImage = (f: Pick<BoardFile, 'type'>) => f.type.startsWith('image/')

/** A video may be large; the browser's file store holds it without reading it into memory */
export const MAX_VIDEO = 200 * 1024 * 1024
export const MAX_FILE = 25 * 1024 * 1024

export type LessonKind = 'video' | 'image' | 'file' | 'text'
export const LESSON_KIND: Record<LessonKind, string> = { video: 'Бичлэг', image: 'Зураг', file: 'Файл', text: 'Заавар' }
/** What a lesson mostly is: a video before pictures, pictures before other files, text alone last */
export const kindOf = (l: Pick<Lesson, 'files'>): LessonKind =>
  l.files.some(isVideo) ? 'video' : l.files.some(isImage) ? 'image' : l.files.length ? 'file' : 'text'

/** The ХХК's topics in use, in the Mongolian alphabet's order */
export const topicsOf = (lessons: Lesson[]) => [...new Set(lessons.map(l => l.topic))].sort(new Intl.Collator('mn').compare)

export interface Block { kind: 'p' | 'ol' | 'ul'; lines: string[] }
/** The text as paragraphs and lists: lines that begin "1." or "2)" make a numbered list, "- " a plain one */
export function blocksOf(text: string): Block[] {
  const out: Block[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const kind = /^\d+[.)]\s+/.test(line) ? 'ol' : /^[-•]\s+/.test(line) ? 'ul' : 'p'
    const body = line.replace(/^(\d+[.)]|[-•])\s+/, '')
    const last = out.at(-1)
    if (kind !== 'p' && last?.kind === kind) last.lines.push(body)
    else out.push({ kind, lines: [kind === 'p' ? line : body] })
  }
  return out
}

/** Example lessons, text only: each says it is an example, to be replaced with the company's own */
export function seedLessons(now: Date): Lesson[] {
  const ago = (days: number) => new Date(now.getTime() - days * 864e5).toISOString()
  const demo = 'Жишээ материал. Байгууллагынхаа батлагдсан заавраар солино уу.'
  return [
    {
      id: 'ls1', company: 'c1', by: 'u12', added: ago(3), topic: 'Шинэ ажилтан', title: 'Шинэ ажилтны эхний долоо хоног', files: [],
      text: [
        demo,
        'Ажилд орсон эхний долоо хоногтоо дараах зүйлийг хийнэ.',
        '1. Хүний нөөцийн ажилтнаас ажлын үнэмлэх болон системд нэвтрэх эрхээ авна.',
        '2. Шууд удирдлагатайгаа уулзаж, ажлын байрны тодорхойлолттойгоо танилцана.',
        '3. Хөдөлмөрийн дотоод журам болон аюулгүй ажиллагааны зааврыг уншина.',
        '4. ERP системд нэвтэрч, «Сургалт» цэсний «ERP заавар» хэсгийг үзнэ.',
        '5. Долоо хоногийн төгсгөлд шууд удирдлагатайгаа ажлын төлөвлөгөөгөө тохирно.',
        'Асуух зүйл гарвал Хүний нөөцийн ажилтанд хандана.',
      ].join('\n'),
    },
    {
      id: 'ls2', company: 'c1', by: 'u12', added: ago(9), topic: 'ХАБЭА', title: 'Гал гарсан үед юу хийх вэ?', files: [],
      text: [
        demo,
        '1. Ойр байгаа хүмүүст чангаар мэдэгдэж, галын дохиоллын товчийг дарна.',
        '2. 101 дугаарт залгаж, хаяг болон юу шатаж байгааг хэлнэ.',
        '3. Жижиг галыг галын хороор унтраана. Амь насанд аюултай бол унтраах гэж оролдохгүй.',
        '4. Цахилгаан шатаар биш, шатаар гарна. Утаатай үед бөхийж явна.',
        '5. Гадаа цугларах цэг дээр очиж, удирдлагадаа бүртгүүлнэ.',
      ].join('\n'),
    },
    {
      id: 'ls3', company: 'c1', by: 'u12', added: ago(20), topic: 'Ажлын заавар', title: 'Томилолтын тайлан гаргах', files: [],
      text: [
        demo,
        '1. Томилолтоос ирснээс хойш ажлын 3 өдөрт багтааж тайлангаа гаргана.',
        '2. Тээвэр, байр, хоолны зардлын баримтаа цуглуулж, огнооны дарааллаар эрэмбэлнэ.',
        '3. Томилолтын зорилго, хийсэн ажил, үр дүнг нэг хуудсанд багтааж бичнэ.',
        '4. Тайлан, баримтаа шууд удирдлагадаа хянуулаад санхүүгийн албанд өгнө.',
      ].join('\n'),
    },
  ]
}
