// Emoji avatars: Microsoft Fluent Emoji in the 3D style (MIT, see src/assets/avatars/LICENSE).
// They look close to Apple's emoji and can be used on every device; Apple's own images may not.
import type { Person } from '../lib/types'

const files = import.meta.glob<string>('../assets/avatars/*.webp', { eager: true, query: '?url', import: 'default' })

export const AVATARS: [key: string, label: string][] = [
  ['grinning-face', 'Инээсэн царай'], ['smiling-face-with-smiling-eyes', 'Баяртай царай'], ['smiling-face-with-sunglasses', 'Нарны шилтэй'],
  ['nerd-face', 'Нүдний шилтэй'], ['star-struck', 'Од нүдтэй'], ['partying-face', 'Баярын малгайтай'], ['cowboy-hat-face', 'Малгайтай'],
  ['winking-face', 'Нүд ирмэсэн'], ['hugging-face', 'Тэврэх'], ['thinking-face', 'Бодлогошронгуй'], ['face-with-monocle', 'Монокльтой'],
  ['smiling-face-with-halo', 'Гэрэлт хүрээтэй'],
  ['horse-face', 'Морь'], ['two-hump-camel', 'Тэмээ'], ['cow-face', 'Үхэр'], ['ewe', 'Хонь'], ['goat', 'Ямаа'], ['wolf', 'Чоно'],
  ['eagle', 'Бүргэд'], ['fox', 'Үнэг'], ['panda', 'Панда'], ['bear', 'Баавгай'], ['tiger-face', 'Бар'], ['lion', 'Арслан'],
  ['owl', 'Шар шувуу'], ['rabbit-face', 'Туулай'], ['cat-face', 'Муур'], ['dog-face', 'Нохой'],
]

export const avatarUrl = (key: string) => files[`../assets/avatars/${key}.webp`]

/** The person's emoji image, or null when they chose letters. Without a choice, one is picked from the id. */
export function avatarOf(p: Pick<Person, 'id' | 'avatar'>) {
  if (p.avatar === 'letters') return null
  if (p.avatar && avatarUrl(p.avatar)) return avatarUrl(p.avatar)
  let h = 0
  for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return avatarUrl(AVATARS[h % AVATARS.length][0])
}
