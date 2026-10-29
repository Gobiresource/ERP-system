// Зурвас (the chat): my chats on the left, one chat on the right (messages by day and a box to write in). A message can
// name people (@), point to a task, a meeting or a document in Бичиг хэрэг, and carry files and pictures
// (docs/decisions.md, 2026-10-29). On a phone the list and a chat are two views. The demo has no server: other people's messages are made up.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { AtSign, CalendarDays, Check, CheckCheck, ChevronLeft, Download, FileText, Image as ImageIcon, Maximize2, MessagesSquare, MoreHorizontal, Paperclip, Plus, Search, Send, Settings, Smile, SquareCheck, SquarePen, Trash2, User, X } from 'lucide-react'
import '../styles/screens/chat.css'
import type { BoardFile, Chat, ChatRef, Id, Message, State } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { open, toast } from '../lib/ui'
import { chatName, myChats, unread } from '../lib/chat'
import { DOC_KIND, seen } from '../lib/docs'
import { collator, dueLabel, hm, parse, short, today, ymd } from '../lib/format'
import { getFile, putFile, saveBlob, useFileUrl } from '../lib/files'
import { cid, fileSize } from '../lib/draft'
import { Avatar, AvatarStack, Empty, KIND, PRESENCE, PresenceLabel, STATUS } from '../ui/bits'
import { PageHead } from '../ui/PageHead'
import { DocTile } from './Docs'
import { isPdfName } from '../dialogs/Viewer'

const MB25 = 25 * 1024 * 1024
const lower = (s: string) => s.toLocaleLowerCase('mn')

export default function ChatPage({ id }: { id?: string }) {
  const s = useApp()
  const chats = myChats(s)
  const chat = id ? chats.find(c => c.id === id) : undefined
  // With no chat open, a page change focuses the title as on every page; an open chat focuses its own name (Thread)
  useLayoutEffect(() => { if (!id && document.body.dataset.navigated) document.getElementById('page-title')?.focus({ preventScroll: true }) }, [id])
  return (
    <div className={`chatpage${id ? ' has-chat' : ''}`}>
      <PageHead title="Зурвас" actions={<button type="button" className="btn btn--accent" onClick={() => open({ kind: 'newChat' })}><SquarePen className="ico" />Шинэ зурвас</button>} />
      <div className="chat">
        <ChatList chats={chats} at={chat?.id} />
        {chat ? <Thread key={chat.id} chat={chat} /> : (
          <section className="chat__thread chat__none">
            {id && <a className="ibtn ibtn--glass ct__back" href="#chat" aria-label="Бүх зурвас"><ChevronLeft className="ico" /></a>}
            <Empty icon={<MessagesSquare className="ico" />} title={id ? 'Зурвас олдсонгүй' : 'Зурвас сонгоно уу'} text={id ? 'Устгагдсан эсвэл та гишүүн биш байна.' : 'Зүүн талаас сонгоно уу эсвэл шинэ зурвас бичнэ үү.'} />
          </section>
        )}
      </div>
    </div>
  )
}

/** A group's mark: its colour and the first letters of its name */
export function ChatMark({ chat }: { chat: Chat }) {
  const letters = (chat.name ?? '').split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase()
  return <span className={`cmark hue--${chat.hue ?? 'blue'}`} aria-hidden="true">{letters}</span>
}

function ChatList({ chats, at }: { chats: Chat[]; at?: string }) {
  const s = useApp()
  const [q, setQ] = useState('')
  const t = lower(q.trim())
  const shown = chats.filter(c => !t || lower(chatName(c, s.people, s.me)).includes(t))
  return (
    <section className="chat__list" aria-label="Миний зурвас">
      <label className="tk-find chat__find">
        <Search className="ico" />
        <span className="sr-only">Хүн, бүлэг хайх</span>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Хүн, бүлэг хайх" />
      </label>
      {shown.length ? (
        <ul className="clist">{shown.map(c => <ChatItem key={c.id} c={c} on={c.id === at} />)}</ul>
      ) : <p className="clist__none">{t ? 'Илэрц алга' : 'Зурвас алга'}</p>}
    </section>
  )
}

/** What the list shows of a message: its words, else what it carries */
function preview(m: Message) {
  if (m.recalled) return 'Зурвас устгагдсан'
  if (m.text) return m.text
  if (m.files.length) return m.files[0].type.startsWith('image/') ? 'Зураг' : `Файл: ${m.files[0].name}`
  return m.refs[0]?.label ?? ''
}

function ChatItem({ c, on }: { c: Chat; on: boolean }) {
  const s = useApp()
  const name = chatName(c, s.people, s.me)
  const other = c.kind === 'direct' ? s.people.find(p => p.id !== s.me && c.members.includes(p.id)) : undefined
  const last = s.messages.filter(m => m.chat === c.id).at(-1)
  const n = unread(c, s.messages, s.me)
  const when = last ? (ymd(new Date(last.at)) === today() ? hm(new Date(last.at)) : dueLabel(ymd(new Date(last.at)))) : ''
  return (
    <li>
      <a className={`citem${n ? ' is-new' : ''}`} href={`#chat-${c.id}`} aria-current={on ? 'page' : undefined}>
        {other ? <Avatar person={other} size="md" presence /> : <ChatMark chat={c} />}
        <span className="citem__main">
          <b>{name}{other && <span className="sr-only">, {PRESENCE[other.presence]}</span>}</b>
          <small>{last ? `${last.by === s.me ? 'Та: ' : ''}${preview(last)}` : 'Зурвас алга'}</small>
        </span>
        <span className="citem__side">
          <time className="tnum">{when}</time>
          {n > 0 && <span className="citem__n tnum">{n}<span className="sr-only"> шинэ зурвас</span></span>}
        </span>
      </a>
    </li>
  )
}

function Thread({ chat }: { chat: Chat }) {
  const s = useApp()
  const log = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const msgs = s.messages.filter(m => m.chat === chat.id)
  const other = chat.kind === 'direct' ? s.people.find(p => p.id !== s.me && chat.members.includes(p.id)) : undefined
  const fresh = unread(chat, s.messages, s.me)

  // Opening a chat reads it; so does a message that comes while it is open
  useEffect(() => { if (fresh) actions.readChat(chat.id) }, [fresh, chat.id])
  // The newest message at the bottom, in view
  // How many messages there were when the chat opened: later ones glide in
  const [seenCount] = useState(msgs.length)
  const opened = useRef(false)
  useLayoutEffect(() => {
    const el = log.current
    if (!el) return
    // Opening: straight to the newest. Later: a short glide, unless less motion is asked for.
    const glide = opened.current && !matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: el.scrollHeight, behavior: glide ? 'smooth' : 'auto' })
    opened.current = true
  }, [msgs.length])
  // Coming from another page or chat, focus goes to the chat's name (not the box: a phone would open its keyboard)
  useLayoutEffect(() => { if (document.body.dataset.navigated) title.current?.focus({ preventScroll: true }) }, [])
  // The message whose actions are open (react, who read it, take it back); a tap anywhere else closes them
  const [menu, setMenu] = useState<Id | null>(null)
  useEffect(() => {
    if (!menu) return
    const away = (e: PointerEvent) => { if (!(e.target as Element).closest?.(`[data-msg="${menu}"]`)) setMenu(null) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [menu])
  const last = msgs.at(-1)

  return (
    <section className="chat__thread" aria-labelledby="ct-name">
      <header className="ct__head">
        <a className="ibtn ibtn--glass ct__back" href="#chat" aria-label="Бүх зурвас"><ChevronLeft className="ico" /></a>
        {other ? <Avatar person={other} size="md" presence /> : <ChatMark chat={chat} />}
        <div className="ct__titles">
          <h2 id="ct-name" ref={title} tabIndex={-1}>{chatName(chat, s.people, s.me)}</h2>
          {other ? <p className="ct__sub"><PresenceLabel presence={other.presence} /><span aria-hidden="true">·</span><span>{other.role}</span></p> : <p>{groupLine(chat, s)}</p>}
        </div>
        {chat.kind === 'group' ? (
          <button type="button" className="ibtn ibtn--glass" aria-label="Бүлэг засах" title="Бүлэг засах" onClick={() => open({ kind: 'chatGroup', id: chat.id })}><Settings className="ico" /></button>
        ) : other && (
          <button type="button" className="ibtn ibtn--glass" aria-label={`${short(other)}: мэдээлэл харах`} title="Мэдээлэл харах" onClick={() => open({ kind: 'person', id: other.id })}><User className="ico" /></button>
        )}
      </header>
      <div className="cmsgs" ref={log} role="log" aria-label="Зурвас" tabIndex={0}>
        {msgs.length === 0 && <p className="cmsgs__none">Зурвас алга. + дарж хавсаргана, @ дарж хүн дурдана.</p>}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1]
          const day = ymd(new Date(m.at))
          const newDay = !prev || ymd(new Date(prev.at)) !== day
          // Messages one person sends within 5 minutes share one face and name
          const first = newDay || prev.by !== m.by || new Date(m.at).getTime() - new Date(prev.at).getTime() > 5 * 6e4
          return (
            <Fragment key={m.id}>
              {newDay && <p className="cday"><span>{dueLabel(day)}</span></p>}
              <Bubble m={m} first={first} group={chat.kind === 'group'} fresh={i >= seenCount} on={menu === m.id} toggle={() => setMenu(menu === m.id ? null : m.id)} />
            </Fragment>
          )
        })}
        {last?.by === s.me && !last.recalled && <Seen chat={chat} m={last} />}
      </div>
      <Composer chat={chat} />
    </section>
  )
}

/** "5 гишүүн, 2 нь идэвхтэй": a group's people, and how many of the others are on */
function groupLine(chat: Chat, s: Pick<State, 'people' | 'me'>) {
  const on = s.people.filter(p => p.id !== s.me && chat.members.includes(p.id) && p.presence === 'online').length
  return on ? `${chat.members.length} гишүүн, ${on} нь идэвхтэй` : `${chat.members.length} гишүүн`
}

const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏']
/** Only emoji, three at most: shown big, without a bubble */
const onlyEmoji = (t: string) => /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u.test(t) && [...t.replace(/[\s\uFE0F\u200D]/g, '')].length <= 3

function Bubble({ m, first, group, fresh, on, toggle }: { m: Message; first: boolean; group: boolean; fresh?: boolean; on: boolean; toggle: () => void }) {
  const s = useApp()
  const more = useRef<HTMLButtonElement>(null)
  const acts = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { if (on) acts.current?.scrollIntoView({ block: 'nearest' }) }, [on])
  const mine = m.by === s.me
  const by = s.people.find(p => p.id === m.by)
  const name = (id: Id) => {
    if (id === s.me) return 'Та'
    const p = s.people.find(x => x.id === id)
    return p ? short(p) : 'Устгагдсан ажилтан'
  }
  const who = name(m.by)
  const cls = `cmsg${mine ? ' is-mine' : ''}${first ? ' is-first' : ''}${fresh ? ' is-fresh' : ''}${on ? ' is-on' : ''}`
  const face = !mine && <span className="cmsg__face">{first && by && <Avatar person={by} size="sm" />}</span>

  if (m.recalled) {
    return (
      <div className={cls}>
        <div className="cmsg__line">
          {face}
          <p className="cmsg__gone">{mine ? 'Та зурвасаа устгасан' : `${who} зурвасаа устгасан`}</p>
        </div>
      </div>
    )
  }

  const cards = m.refs.filter(r => r.kind !== 'person')
  const big = !cards.length && !m.files.length && onlyEmoji(m.text)
  // Each emoji with the people who chose it, in the order they first came
  const reacts = new Map<string, Id[]>()
  for (const [id, e] of Object.entries(m.reactions ?? {})) reacts.set(e, [...(reacts.get(e) ?? []), id])
  // On a touch screen a tap on the message opens its actions (a tap on a link in it, or selecting text, does not)
  const tap = (e: MouseEvent) => {
    if (matchMedia('(hover: hover)').matches || (e.target as Element).closest('a, button') || !getSelection()?.isCollapsed) return
    toggle()
  }
  const done = () => {
    toggle()
    more.current?.focus({ preventScroll: true })
  }
  const recall = () => {
    more.current?.closest<HTMLElement>('.cmsgs')?.focus({ preventScroll: true })
    toggle()
    const was = actions.recallMessage(m.id)
    if (was) toast('Зурвас устгагдлаа.', { undo: () => actions.restoreMessage(was) })
  }

  return (
    <div className={cls} data-msg={m.id} onKeyDown={e => { if (on && e.key === 'Escape') { e.stopPropagation(); done() } }}>
      <div className="cmsg__line">
        {face}
        <div className={`cmsg__body${big ? ' is-big' : ''}`} onClick={tap}>
          {!mine && group && first ? <b className="cmsg__who">{who}</b> : <span className="sr-only">{who}:</span>}
          {m.text && <p className="cmsg__text"><Words m={m} /></p>}
          {cards.map(r => <RefCard key={`${r.kind}-${r.id}`} r={r} />)}
          {m.files.map(f => <FileView key={f.id} f={f} />)}
          <time className="cmsg__at tnum" dateTime={m.at}>{hm(new Date(m.at))}</time>
        </div>
        <button ref={more} type="button" className="ibtn ibtn--sm cmsg__more" aria-label="Нэмэлт үйлдэл" title="Нэмэлт үйлдэл" aria-expanded={on}
          onClick={e => { toggle(); if (e.detail === 0 && !on) requestAnimationFrame(() => acts.current?.querySelector('button')?.focus()) }}>
          <MoreHorizontal className="ico" />
        </button>
      </div>
      {reacts.size > 0 && (
        <div className="creacts">
          {[...reacts].map(([e, ids]) => {
            const names = ids.map(name).join(', ')
            return (
              <button key={e} type="button" className="creact" aria-pressed={ids.includes(s.me)} title={names} aria-label={`${e} ${ids.length}: ${names}`} onClick={() => actions.react(m.id, e)}>
                {e}{ids.length > 1 && <span className="tnum">{ids.length}</span>}
              </button>
            )
          })}
        </div>
      )}
      {on && (
        <div className="cacts" ref={acts} role="group" aria-label="Зурвасын үйлдэл">
          {QUICK.map(e => (
            <button key={e} type="button" className="cacts__emoji" aria-pressed={m.reactions?.[s.me] === e} onClick={() => { actions.react(m.id, e); done() }}>{e}</button>
          ))}
          {mine && (
            <>
              <button type="button" className="cacts__btn" onClick={() => { toggle(); open({ kind: 'readers', id: m.id }) }}><CheckCheck className="ico" />Хэн уншсаныг харах</button>
              <button type="button" className="cacts__btn is-danger" onClick={recall}><Trash2 className="ico" />Бүгдээс устгах</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Under my newest message: whether it has been read; in a group, by how many and whom */
function Seen({ chat, m }: { chat: Chat; m: Message }) {
  const s = useApp()
  const others = s.people.filter(p => p.id !== s.me && chat.members.includes(p.id))
  const read = others.filter(p => (chat.read[p.id] ?? '') >= m.at)
  const Icon = read.length ? CheckCheck : Check
  const text = !read.length ? 'Илгээсэн' : chat.kind === 'direct' ? 'Уншсан' : read.length === others.length ? 'Бүгд уншсан' : `${read.length} хүн уншсан`
  if (chat.kind === 'direct') return <p className="cseen"><Icon className="ico" />{text}</p>
  return (
    <button type="button" className="cseen" onClick={() => open({ kind: 'readers', id: m.id })}>
      <Icon className="ico" />{text}
      {read.length > 0 && <AvatarStack people={read} max={3} size="xs" />}
    </button>
  )
}

/** The text with each @name it mentions as a link to the person */
function Words({ m }: { m: Message }) {
  const people = m.refs.filter(r => r.kind === 'person')
  if (!people.length) return <>{m.text}</>
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = m.text.split(new RegExp(`(${people.map(r => esc(`@${r.label}`)).join('|')})`))
  return <>{parts.map((part, i) => {
    const r = people.find(x => `@${x.label}` === part)
    return r ? <button key={i} type="button" className="cmsg__name" onClick={() => open({ kind: 'person', id: r.id })}>{part}</button> : part
  })}</>
}

/** A task, a meeting or a document a message points to; opens it */
function RefCard({ r }: { r: ChatRef }) {
  const s = useApp()
  let card: { icon: ReactNode; title: string; sub: string; go: () => void } | null = null
  if (r.kind === 'task') {
    const t = s.tasks.find(x => x.id === r.id)
    if (t) card = { icon: <span className="cref__ico"><SquareCheck className="ico" /></span>, title: t.title, sub: `Ажил, ${STATUS[t.status].toLowerCase()}, ${dueLabel(t.due)}`, go: () => open({ kind: 'task', id: t.id }) }
  } else if (r.kind === 'event') {
    const e = s.events.find(x => x.id === r.id)
    if (e) card = { icon: <span className="cref__ico"><CalendarDays className="ico" /></span>, title: e.title, sub: `${KIND[e.kind]}, ${dueLabel(e.start.slice(0, 10))} ${hm(parse(e.start))}`, go: () => open({ kind: 'event', id: e.id }) }
  } else if (r.kind === 'doc') {
    const d = s.docs.find(x => x.id === r.id)
    if (d && seen(d, s.me)) card = { icon: <DocTile kind={d.kind} />, title: d.name, sub: `Бичиг баримт, ${DOC_KIND[d.kind].toLowerCase()}`, go: () => open({ kind: 'doc', id: d.id }) }
  }
  if (!card) return <p className="cref is-gone">{r.label}: устгагдсан эсвэл харах эрх байхгүй</p>
  return (
    <button type="button" className="cref" onClick={card.go}>
      {card.icon}
      <span className="cref__main"><b>{card.title}</b><small>{card.sub}</small></span>
    </button>
  )
}

/** A picture shows itself; it and a PDF open over the whole screen. Another file can be saved. */
function FileView({ f }: { f: BoardFile }) {
  const pic = f.type.startsWith('image/')
  const url = useFileUrl(pic ? f.id : '')
  if (pic) {
    return (
      <button type="button" className="cpic" onClick={() => open({ kind: 'file', file: f })} aria-label={`${f.name}: томоор харах`}>
        {url ? <img src={url} alt="" /> : <span className="cpic__wait" />}
      </button>
    )
  }
  const pdf = isPdfName(f)
  return (
    <button type="button" className="cref" onClick={() => (pdf ? open({ kind: 'file', file: f }) : getFile(f.id).then(b => b && saveBlob(f.name, b)))}>
      <span className="cref__ico">{pdf ? <FileText className="ico" /> : <Paperclip className="ico" />}</span>
      <span className="cref__main"><b>{f.name}</b><small>{fileSize(f.size)}, {pdf ? 'харах' : 'татах'}</small></span>
      {pdf ? <Maximize2 className="ico cref__dl" /> : <Download className="ico cref__dl" />}
    </button>
  )
}

/** What the box's panel shows: people for @ (at: where the @ is in the text), what + can attach, one kind to pick from, or emoji */
type Panel = { kind: 'people'; q: string; at: number } | { kind: 'attach' } | { kind: 'emoji' } | { kind: 'task' | 'event' | 'doc'; q: string }
interface Row { key: string; icon: ReactNode; label: string; sub: string; ref: ChatRef }
const TITLE = { task: 'Ажил', event: 'Тов', doc: 'Бичиг баримт' } as const
const EMOJI = ['😀', '😁', '😂', '🤣', '😊', '🙂', '😉', '😍', '🥰', '😘', '😎', '🤔', '😮', '😢', '😭', '😡', '😴', '🤝', '👍', '👎', '👏', '🙌', '🙏', '💪', '👌', '✌️', '👀', '❤️', '🔥', '🎉', '✅', '❌', '⭐', '💡', '📌', '📎', '📅', '⏰', '☕', '🚀']

/**
 * The box to write in. @ (typed, or the @ button) lists the chat's people to name. + shows what can be attached, each
 * with its own picture: a picture or a file from this device, or a task, a meeting or a document picked from its list.
 */
function Composer({ chat }: { chat: Chat }) {
  const s = useApp()
  const sc = scoped(s)
  const [text, setText] = useState('')
  const [refs, setRefs] = useState<ChatRef[]>([])
  const [files, setFiles] = useState<BoardFile[]>([])
  const [panel, setPanel] = useState<Panel | null>(null)
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const pick = useRef<HTMLInputElement>(null)
  const pane = useRef<HTMLDivElement>(null)

  const rows = useMemo((): Row[] => {
    if (!panel || panel.kind === 'attach' || panel.kind === 'emoji') return []
    const t = lower(panel.q)
    const has = (x: string) => !t || lower(x).includes(t)
    const icon = (i: ReactNode) => <span className="cpick__ico" aria-hidden="true">{i}</span>
    if (panel.kind === 'people') {
      return s.people.filter(p => p.id !== s.me && chat.members.includes(p.id) && has(short(p))).sort((a, b) => collator.compare(a.given, b.given))
        .map(p => ({ key: `p${p.id}`, icon: <Avatar person={p} size="sm" presence />, label: short(p), sub: p.role, ref: { kind: 'person', id: p.id, label: short(p) } }))
    }
    if (panel.kind === 'task') {
      return [...sc.tasks].filter(x => has(x.title)).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.due.localeCompare(b.due))
        .map(x => ({ key: `t${x.id}`, icon: icon(<SquareCheck className="ico" />), label: x.title, sub: `${STATUS[x.status]}, ${dueLabel(x.due)}`, ref: { kind: 'task', id: x.id, label: x.title } }))
    }
    if (panel.kind === 'event') {
      return sc.events.filter(e => e.start.slice(0, 10) >= today() && has(e.title)).sort((a, b) => a.start.localeCompare(b.start))
        .map(e => ({ key: `e${e.id}`, icon: icon(<CalendarDays className="ico" />), label: e.title, sub: `${KIND[e.kind]}, ${dueLabel(e.start.slice(0, 10))} ${hm(parse(e.start))}`, ref: { kind: 'event', id: e.id, label: e.title } }))
    }
    return s.docs.filter(d => d.company === s.company && seen(d, s.me) && has(d.name))
      .map(d => ({ key: `d${d.id}`, icon: <DocTile kind={d.kind} />, label: d.name, sub: DOC_KIND[d.kind], ref: { kind: 'doc', id: d.id, label: d.name } }))
  }, [panel, s, sc, chat.members])
  const current = Math.min(active, Math.max(0, rows.length - 1))

  const close = () => {
    setPanel(null)
    box.current?.focus()
  }
  /** Opens a panel; opened from the keyboard, focus goes to its first button */
  const show = (p: Panel, e: MouseEvent) => {
    setPanel(p)
    if (e.detail === 0) requestAnimationFrame(() => pane.current?.querySelector<HTMLElement>('button')?.focus())
  }
  const attaching = !!panel && panel.kind !== 'people' && panel.kind !== 'emoji'

  /** Puts an emoji where the cursor is; the panel stays open for more */
  const putEmoji = (e: string) => {
    const el = box.current
    const from = el?.selectionStart ?? text.length
    const to = el?.selectionEnd ?? from
    setText(text.slice(0, from) + e + text.slice(to))
    setError('')
    const at = from + e.length
    requestAnimationFrame(() => { if (el && document.activeElement === el) el.setSelectionRange(at, at) })
  }
  /** Arrows move in the emoji grid, 8 a row */
  const gridKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 } as Record<string, number>)[e.key]
    const btns = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    if (!step || i < 0) return
    e.preventDefault()
    btns[Math.min(btns.length - 1, Math.max(0, i + step))].focus()
  }

  const type = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setText(v)
    setError('')
    // Grows with the text, up to about six lines. Measured only when it may have to grow or shrink: each measure makes
    // the browser lay the page out again, which a fast typist feels.
    const el = e.target
    if (el.scrollHeight > el.clientHeight || v.length < text.length) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`
    }
    const caret = e.target.selectionStart ?? v.length
    const m = /(^|\s)@([^\s@]{0,30})$/.exec(v.slice(0, caret))
    if (m) {
      setPanel({ kind: 'people', q: m[2], at: caret - m[2].length - 1 })
      setActive(0)
    } else if (panel?.kind === 'people') setPanel(null)
  }

  /** The @ button: puts an @ where the cursor is and lists the people */
  const mention = () => {
    const el = box.current
    if (!el) return
    const caret = el.selectionStart ?? text.length
    const before = text.slice(0, caret)
    const glue = before && !/\s$/.test(before) ? ' ' : ''
    const at = caret + glue.length
    setText(`${before}${glue}@${text.slice(caret)}`)
    setPanel({ kind: 'people', q: '', at })
    setActive(0)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(at + 1, at + 1) })
  }

  const choose = (r: ChatRef) => {
    if (panel?.kind === 'people') {
      const end = panel.at + 1 + panel.q.length
      setText(`${text.slice(0, panel.at)}@${r.label} ${text.slice(end)}`)
    }
    setRefs(rs => (rs.some(x => x.kind === r.kind && x.id === r.id) ? rs : [...rs, r]))
    close()
  }

  const send = () => {
    const t = text.trim()
    // A person stays named only while their @name is still in the text
    const keep = refs.filter(r => r.kind !== 'person' || t.includes(`@${r.label}`))
    if (busy || (!t && !keep.some(r => r.kind !== 'person') && !files.length)) return
    actions.sendMessage(chat.id, { text: t, refs: keep, files })
    if (box.current) box.current.style.height = ''
    setText('')
    setRefs([])
    setFiles([])
    setPanel(null)
  }

  /** Arrows move in the list, Enter or Tab picks, Esc closes; in the box, Enter sends */
  const listKeys = (e: KeyboardEvent<HTMLElement>) => {
    if (rows.length && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
      e.preventDefault()
      if (e.key === 'ArrowDown') setActive((current + 1) % rows.length)
      else if (e.key === 'ArrowUp') setActive((current - 1 + rows.length) % rows.length)
      else choose(rows[current].ref)
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return true
    }
    return false
  }
  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (panel?.kind === 'people' && listKeys(e)) return
    if (panel && e.key === 'Escape') return close()
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  const files_ = (accept: string) => {
    setPanel(null)
    if (!pick.current) return
    pick.current.accept = accept
    pick.current.click()
  }
  const attach = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = [...(e.target.files ?? [])]
    e.target.value = ''
    if (list.some(f => f.size > MB25)) setError('25 MB хүртэлх файл сонгоно уу.')
    setBusy(true)
    try {
      for (const f of list.filter(x => x.size <= MB25)) {
        const ref = { id: `f${cid()}`, name: f.name, type: f.type, size: f.size }
        await putFile(ref.id, f)
        setFiles(fs => [...fs, ref])
      }
    } catch {
      setError('Энэ хөтөч дээр файл хавсаргах боломжгүй байна.')
    } finally {
      setBusy(false)
      box.current?.focus()
    }
  }

  const cards = refs.filter(r => r.kind !== 'person')
  const list = panel && panel.kind !== 'attach' && panel.kind !== 'emoji' && (
    <div className="cpick" role="listbox" id="cpick" aria-label={panel.kind === 'people' ? 'Хүн дурдах' : TITLE[panel.kind]}>
      {rows.length === 0 && <p className="cpick__none">Илэрц алга</p>}
      {rows.map((r, i) => (
        <button key={r.key} type="button" role="option" id={`cp-${r.key}`} className="cpick__row" aria-selected={i === current} tabIndex={-1}
          onMouseDown={e => e.preventDefault()} onClick={() => choose(r.ref)}>
          {r.icon}
          <span className="cpick__main"><b>{r.label}</b><small>{r.sub}</small></span>
        </button>
      ))}
    </div>
  )
  return (
    <form className="ccompose" onSubmit={e => { e.preventDefault(); send() }}>
      {panel && (
        <div className="cpanel" ref={pane} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); close() } }}>
          {panel.kind === 'attach' && (
            <div className="ctiles" role="group" aria-label="Хавсаргах">
              <button type="button" className="ctile" onClick={() => files_('image/*')}><span className="ctile__ico hue--blue"><ImageIcon className="ico" /></span>Зураг</button>
              <button type="button" className="ctile" onClick={() => files_('')}><span className="ctile__ico hue--purple"><Paperclip className="ico" /></span>Файл</button>
              <button type="button" className="ctile" onClick={() => { setPanel({ kind: 'task', q: '' }); setActive(0) }}><span className="ctile__ico hue--green"><SquareCheck className="ico" /></span>Ажил</button>
              <button type="button" className="ctile" onClick={() => { setPanel({ kind: 'event', q: '' }); setActive(0) }}><span className="ctile__ico hue--orange"><CalendarDays className="ico" /></span>Тов</button>
              <button type="button" className="ctile" onClick={() => { setPanel({ kind: 'doc', q: '' }); setActive(0) }}><span className="ctile__ico hue--teal"><FileText className="ico" /></span>Бичиг баримт</button>
            </div>
          )}
          {panel.kind === 'emoji' && (
            <div className="cemoji" role="group" aria-label="Эможи" onKeyDown={gridKeys}>
              {EMOJI.map((e, i) => <button key={e} type="button" tabIndex={i ? -1 : 0} onMouseDown={x => x.preventDefault()} onClick={() => putEmoji(e)}>{e}</button>)}
            </div>
          )}
          {panel.kind === 'people' && <p className="cpanel__title">Хүн дурдах</p>}
          {(panel.kind === 'task' || panel.kind === 'event' || panel.kind === 'doc') && (
            <div className="cpanel__head">
              <button type="button" className="ibtn ibtn--sm" aria-label="Буцах" onClick={() => setPanel({ kind: 'attach' })}><ChevronLeft className="ico" /></button>
              <b>{TITLE[panel.kind]}</b>
              <label className="tk-find cpanel__find">
                <Search className="ico" />
                <span className="sr-only">{TITLE[panel.kind]} хайх</span>
                <input type="search" ref={el => el?.focus({ preventScroll: true })} value={panel.q} placeholder="Хайх"
                  onChange={e => { setPanel({ kind: panel.kind, q: e.target.value }); setActive(0) }}
                  onKeyDown={listKeys} aria-controls="cpick" aria-activedescendant={rows[current] ? `cp-${rows[current].key}` : undefined} />
              </label>
            </div>
          )}
          {list}
        </div>
      )}
      {(cards.length > 0 || files.length > 0 || busy) && (
        <ul className="cdraft" aria-label="Хавсаргасан">
          {cards.map(r => (
            <li key={`${r.kind}-${r.id}`}>
              {r.kind === 'task' ? <SquareCheck className="ico" /> : r.kind === 'event' ? <CalendarDays className="ico" /> : <FileText className="ico" />}
              <span>{r.label}</span>
              <button type="button" className="ibtn ibtn--sm" aria-label={`${r.label}: хасах`} onClick={() => setRefs(rs => rs.filter(x => x !== r))}><X className="ico" /></button>
            </li>
          ))}
          {files.map(f => (
            <li key={f.id}>
              {f.type.startsWith('image/') ? <ImageIcon className="ico" /> : <Paperclip className="ico" />}
              <span>{f.name}</span>
              <button type="button" className="ibtn ibtn--sm" aria-label={`${f.name}: хасах`} onClick={() => setFiles(fs => fs.filter(x => x !== f))}><X className="ico" /></button>
            </li>
          ))}
          {busy && <li className="cdraft__wait" role="status">Хавсаргаж байна…</li>}
        </ul>
      )}
      <div className="ccompose__row">
        <button type="button" className="ibtn ibtn--glass" aria-label="Хавсаргах" title="Хавсаргах" aria-expanded={attaching}
          onClick={e => (attaching ? close() : show({ kind: 'attach' }, e))}>
          <Plus className="ico" />
        </button>
        <button type="button" className="ibtn ibtn--glass" aria-label="Хүн дурдах" title="Хүн дурдах" aria-expanded={panel?.kind === 'people'} onClick={mention}>
          <AtSign className="ico" />
        </button>
        <span className="ccompose__field">
          <textarea ref={box} className="ccompose__box" rows={1} value={text} onChange={type} onKeyDown={key} aria-label="Зурвас" placeholder="Зурвас бичих"
            aria-controls={panel?.kind === 'people' ? 'cpick' : undefined} aria-expanded={panel?.kind === 'people'}
            aria-activedescendant={panel?.kind === 'people' && rows[current] ? `cp-${rows[current].key}` : undefined} />
          <button type="button" className="ibtn ibtn--sm ccompose__emoji" aria-label="Эможи оруулах" title="Эможи оруулах" aria-expanded={panel?.kind === 'emoji'}
            onMouseDown={e => e.preventDefault()} onClick={e => (panel?.kind === 'emoji' ? close() : show({ kind: 'emoji' }, e))}>
            <Smile className="ico" />
          </button>
        </span>
        <button type="submit" className="csend" aria-label="Илгээх" title="Илгээх"><Send className="ico" /></button>
      </div>
      {error && <p className="field__error" role="alert">{error}</p>}
      <input ref={pick} type="file" multiple hidden onChange={attach} />
    </form>
  )
}
