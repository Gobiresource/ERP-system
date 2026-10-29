// Ноорог: card sizes, paper colours, ready-made boards and the demo boards.
import type { CardKind, Draft, DraftCard, Hue, Subtask } from './types'

export const KIND: Record<CardKind, string> = { note: 'Тэмдэглэл', todo: 'Жагсаалт', title: 'Гарчиг', image: 'Зураг', link: 'Холбоос', file: 'Файл' }

/** Size of a new card, in board pixels */
export const SIZE: Record<CardKind, [number, number]> = {
  note: [220, 150], todo: [250, 120], title: [380, 52], image: [280, 200], link: [260, 84], file: [260, 84],
}

/** Paper colours. No hue is plain white. */
export const PAPER: [Hue | undefined, string][] = [
  [undefined, 'Цагаан'], ['yellow', 'Шар'], ['pink', 'Ягаан'], ['blue', 'Цэнхэр'], ['green', 'Ногоон'], ['purple', 'Нил ягаан'],
]
/** Cards that take a paper colour */
export const COLOURED: CardKind[] = ['note', 'todo', 'link']

export const cid = () => 'k' + Math.random().toString(36).slice(2, 9)
const tilt = () => Math.round((Math.random() * 4 - 2) * 10) / 10

export function newCard(kind: CardKind, x: number, y: number, more: Partial<DraftCard> = {}): DraftCard {
  const [w, h] = SIZE[kind]
  return { id: cid(), kind, x, y, w, h, tilt: kind === 'title' ? 0 : tilt(), ...more }
}

const items = (...texts: (string | [string, boolean])[]): Subtask[] =>
  texts.map(t => (typeof t === 'string' ? { id: cid(), title: t, done: false } : { id: cid(), title: t[0], done: t[1] }))

/** Only web addresses: "erp.mn" becomes https://erp.mn, anything that is not http(s) is refused */
export function safeUrl(input: string) {
  const t = input.trim()
  if (!t) return null
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}
export const host = (url: string) => { try { return new URL(url).host.replace(/^www\./, '') } catch { return url } }

/** "640 KB", "1.2 MB", as elsewhere in the app (writing.md) */
export function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`
}

/** What a card says, for its accessible name */
export function cardSummary(c: DraftCard) {
  const cut = (s = '') => (s.length > 60 ? s.slice(0, 60) + '…' : s)
  if (c.kind === 'todo') return `${cut(c.text) || KIND.todo}, ${(c.items ?? []).filter(i => i.done).length}/${(c.items ?? []).length} хийсэн`
  if (c.kind === 'link') return cut(c.text) || (c.url ? host(c.url) : '')
  if (c.kind === 'file') return c.file?.name ?? ''
  return cut(c.text)
}

// Ready-made boards. Positions start at 0, 0; the board opens with them in view.
export const TEMPLATES: { id: string; name: string; text: string; cards: () => DraftCard[] }[] = [
  {
    id: 'meeting', name: 'Хурлын тэмдэглэл', text: 'Оролцогчид, хэлэлцсэн асуудал, шийдвэр',
    cards: () => [
      newCard('title', 0, 0, { text: 'Хурлын тэмдэглэл' }),
      newCard('note', 0, 84, { hue: 'blue', text: 'Огноо, цаг:\nОролцогчид:', h: 130 }),
      newCard('note', 252, 84, { hue: 'yellow', text: 'Хэлэлцсэн асуудал\n\n1.\n2.\n3.', w: 260, h: 190 }),
      newCard('todo', 544, 84, { hue: 'green', text: 'Шийдвэр, даалгавар', items: [] }),
      newCard('note', 0, 246, { text: 'Дараагийн хурал:', h: 110 }),
    ],
  },
  {
    id: 'week', name: '7 хоногийн төлөвлөгөө', text: 'Гараг бүрийн хийх ажил',
    cards: () => [
      newCard('title', 0, 0, { text: 'Энэ 7 хоног' }),
      newCard('note', 0, 70, { hue: 'yellow', text: 'Гол зорилго:', w: 300, h: 90 }),
      ...(['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан'] as const).map((d, i) =>
        newCard('todo', i * 240, 196, { w: 220, text: d, items: [], hue: (['blue', 'green', 'pink', 'purple', undefined] as const)[i] })),
    ],
  },
  {
    id: 'ideas', name: 'Санаа цуглуулах', text: 'Асуудал, санаа, асуулт, дараагийн алхам',
    cards: () => [
      newCard('title', 0, 0, { text: 'Санаа цуглуулах' }),
      newCard('note', 0, 76, { hue: 'pink', text: 'Ямар асуудлыг шийдэх вэ?' }),
      newCard('note', 250, 96, { hue: 'yellow', text: 'Санаа' }),
      newCard('note', 500, 70, { hue: 'blue', text: 'Асуух зүйл' }),
      newCard('todo', 250, 290, { hue: 'green', text: 'Дараагийн алхам', items: [] }),
    ],
  },
]

/** Demo boards of the first ХХК, for the signed-in user */
export function seedDrafts(now: Date, me: string): Draft[] {
  const ago = (h: number) => new Date(now.getTime() - h * 36e5).toISOString()
  const view = { x: 40, y: 40, z: 1 }
  return [
    {
      id: 'b1', company: 'c1', owner: me, name: 'Агуулах нүүлгэх', view, updated: ago(2),
      cards: [
        newCard('title', 0, 0, { text: 'Шинэ агуулах руу нүүх' }),
        newCard('note', 0, 80, { hue: 'yellow', text: 'Налайх руу 11-р сарын 20-нд нүүнэ. Тээврийн 3 машин хэрэгтэй.', h: 130 }),
        newCard('todo', 250, 74, {
          hue: 'green', text: 'Нүүхээс өмнө',
          items: items(['Барааны тооллого хийх', true], ['Тээврийн гэрээ байгуулах', true], 'Тавиур захиалах', 'Ажилчдад мэдэгдэх'),
        }),
        newCard('note', 540, 96, { hue: 'pink', text: 'Асуух: шинэ агуулахын түлхүүрийг хэн хариуцах вэ?', w: 200, h: 130 }),
        newCard('link', 0, 250, { text: 'Хөдөлмөрийн аюулгүй байдлын тухай хууль', url: 'https://legalinfo.mn/' }),
        newCard('note', 300, 300, { hue: 'blue', text: 'Шинэ хаяг: Налайх дүүрэг, 2-р хороо, Говь Ресурсын агуулах', w: 240, h: 120 }),
      ],
    },
    {
      id: 'b2', company: 'c1', owner: me, name: 'Энэ 7 хоног', view, updated: ago(26),
      cards: [
        newCard('title', 0, 0, { text: 'Энэ 7 хоног' }),
        newCard('note', 0, 70, { hue: 'yellow', text: 'Гол зорилго: жилийн тайлангийн төслийг Баасан гарагт хүлээлгэж өгөх', w: 300, h: 100 }),
        newCard('todo', 0, 206, { w: 220, hue: 'blue', text: 'Даваа', items: items(['Хурлын тэмдэглэл илгээх', true], ['Санхүүгийн хэлтэстэй уулзах', true]) }),
        newCard('todo', 240, 206, { w: 220, hue: 'green', text: 'Мягмар', items: items(['Тайлангийн хүснэгт шалгах', true], 'Гэрээний хуулбар авах') }),
        newCard('todo', 480, 206, { w: 220, hue: 'pink', text: 'Лхагва', items: items('Аудитын асуултад хариулах') }),
        newCard('todo', 720, 206, { w: 220, hue: 'purple', text: 'Пүрэв', items: items('Тайлангийн төсөл бэлдэх') }),
        newCard('todo', 960, 206, { w: 220, text: 'Баасан', items: items('Тайлан хүлээлгэж өгөх') }),
      ],
    },
  ]
}
