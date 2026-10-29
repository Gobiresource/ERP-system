// Зурвас (chat): a chat's name, unread messages, my chats in order, and the demo chats (docs/decisions.md, 2026-10-29).
import type { Chat, ChatRef, Message, Person, State } from './types'
import { short } from './format'

/** A group by its name; a direct chat after the other person */
export function chatName(c: Chat, people: Person[], me: string) {
  if (c.kind === 'group') return c.name ?? ''
  const other = people.find(p => p.id !== me && c.members.includes(p.id))
  return other ? short(other) : 'Устгагдсан ажилтан'
}

/** Messages by others since I last read the chat */
export const unread = (c: Chat, messages: Message[], me: string) =>
  messages.filter(m => m.chat === c.id && m.by !== me && m.at > (c.read[me] ?? '')).length

/** The chats I am in, the one with the latest message first */
export function myChats(s: Pick<State, 'chats' | 'messages' | 'me'>) {
  const last = new Map<string, string>()
  for (const m of s.messages) if ((last.get(m.chat) ?? '') < m.at) last.set(m.chat, m.at)
  return s.chats.filter(c => c.members.includes(s.me)).sort((a, b) => (last.get(b.id) ?? b.created).localeCompare(last.get(a.id) ?? a.created))
}

/** Demo chats of Б.Болд (u1). Tasks, meetings and documents are found by their names; a missing one is left out. */
export function seedChats(now: Date, s: Pick<State, 'tasks' | 'events' | 'docs'>): Pick<State, 'chats' | 'messages'> {
  const ago = (min: number) => new Date(now.getTime() - min * 6e4).toISOString()
  const ref = (kind: ChatRef['kind'], label: string): ChatRef[] => {
    const id = kind === 'task' ? s.tasks.find(t => t.title === label)?.id
      : kind === 'event' ? s.events.find(e => e.title === label)?.id
        : s.docs.find(d => d.name === label)?.id
    return id ? [{ kind, id, label }] : []
  }
  const chats: Chat[] = []
  const messages: Message[] = []
  // `read`: minutes ago each person last read the chat. Everyone has read at least up to their own last message.
  const chat = (c: Pick<Chat, 'id' | 'kind' | 'name' | 'hue' | 'members'>, read: Record<string, number>, lines: [string, number, string, ChatRef[]?][]) => {
    const marks: Record<string, string> = {}
    for (const [by, min] of [...lines.map(([by, min]) => [by, min] as const), ...Object.entries(read)]) if ((marks[by] ?? '') < ago(min)) marks[by] = ago(min)
    chats.push({ ...c, by: c.members[0], created: ago(60 * 24 * 30), read: marks })
    lines.forEach(([by, min, text, refs = []], i) => messages.push({ id: `${c.id}m${i + 1}`, chat: c.id, by, at: ago(min), text, refs, files: [] }))
  }

  chat({ id: 'ch1', kind: 'direct', members: ['u1', 'u10'] }, { u1: 100 }, [
    ['u10', 125, 'Сайн байна уу, захирал аа. Зөвшөөрлийн бичиг баримтыг маргааш өгнө.', ref('task', 'Барилгын зөвшөөрлийн бичиг баримт')],
    ['u1', 112, 'Сайн. Гүйцэтгэгчтэй уулзалт хэвээрээ юу?', ref('event', 'Барилгын гүйцэтгэгчтэй уулзалт')],
    ['u10', 100, 'Тийм ээ. Зураг төслийн хуулбарыг авчирна.'],
    ['u10', 25, 'Гэрээний төслийг хуульчаар шалгуулчихлаа. Гарын үсэг л үлдлээ.', ref('task', 'Барилгын гүйцэтгэгчтэй гэрээ байгуулах')],
  ])
  chat({ id: 'ch2', kind: 'group', name: 'Шинэ агуулахын барилга', hue: 'orange', members: ['u10', 'u1', 'u4', 'u14', 'u5'] }, { u1: 180, u5: 15 }, [
    ['u4', 60 * 26, 'Цахилгааны зургийг энэ долоо хоногт шалгуулъя.', ref('task', 'Цахилгааны зургийг шалгуулах')],
    ['u14', 60 * 20, 'Би пүрэв гарагт инженертэй уулзана.'],
    ['u5', 190, 'Барилгын материалын үнийн санал хоёр компаниас ирлээ. Блокных маргааш ирнэ.', ref('task', 'Барилгын материалын үнийн санал авах')],
    ['u10', 40, 'Зөвшөөрөл өгөх эцсийн хугацаа нөгөөдөр шүү.', ref('event', 'Барилгын зөвшөөрөл өгөх эцсийн хугацаа')],
    ['u4', 10, 'Ойлголоо. Би маргааш бичиг баримтыг шалгая.'],
  ])
  chat({ id: 'ch3', kind: 'direct', members: ['u1', 'u12'] }, { u1: 60, u12: 30 }, [
    ['u12', 60 * 26, 'Ажлын газрын тодорхойлолт тань бэлэн боллоо.', ref('doc', 'Ажлын газрын тодорхойлолт')],
    ['u1', 60 * 25, 'Баярлалаа!'],
    ['u12', 300, 'Ажлын цаг, амралтын журмыг шинэчилсэн. Нэг харчихаарай.', ref('doc', 'Ажлын цаг, амралтын журам')],
    ['u1', 45, 'Харлаа, зөв болжээ. Баярлалаа!'],
  ])
  chat({ id: 'ch4', kind: 'group', name: 'Удирдлага', hue: 'indigo', members: ['u2', 'u1', 'u3', 'u4'] }, { u1: 60, u2: 60 * 22, u4: 60 * 20 }, [
    ['u3', 60 * 50, '2026 оны төсвийн шийдвэрийг хавсаргалаа.', ref('doc', '2026 оны төсвийн тухай хурлын шийдвэр')],
    ['u2', 60 * 24, 'Удирдлагын хурал дээр ярилцъя.', ref('event', 'Удирдлагын хурал')],
    ['u1', 60 * 23, 'Тэгье.'],
  ])
  // A few reactions, so the demo shows them
  const react = (id: string, r: Record<string, string>) => Object.assign(messages.find(m => m.id === id) ?? {}, { reactions: r })
  react('ch1m2', { u10: '👍' })
  react('ch2m3', { u10: '🙏', u4: '👍', u1: '👍' })
  react('ch4m1', { u2: '👍', u4: '👍' })
  return { chats, messages }
}
