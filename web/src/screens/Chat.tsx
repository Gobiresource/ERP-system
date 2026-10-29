// Чат: my chats on the left, one chat on the right (messages by day and a box to write in). A message can name people
// (@), point to a task, a meeting or a document in Бичиг хэрэг, and carry files and pictures (docs/decisions.md,
// 2026-10-29). On a phone the list and a chat are two views. The demo has no server: other people's messages are made up.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { CalendarDays, ChevronLeft, Download, MessagesSquare, Paperclip, Plus, Search, Send, Settings, SquareCheck, SquarePen, User, X } from 'lucide-react'
import '../styles/screens/chat.css'
import type { BoardFile, Chat, ChatRef, Message } from '../lib/types'
import { actions, scoped, useApp } from '../lib/store'
import { open } from '../lib/ui'
import { chatName, myChats, unread } from '../lib/chat'
import { DOC_KIND, seen } from '../lib/docs'
import { collator, dueLabel, hm, parse, short, today, ymd } from '../lib/format'
import { getFile, putFile, saveBlob, useFileUrl } from '../lib/files'
import { cid } from '../lib/draft'
import { Avatar, Empty, KIND, STATUS } from '../ui/bits'
import { PageHead } from '../ui/PageHead'
import { DocTile } from './Docs'

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
      <PageHead title="Чат" actions={<button type="button" className="btn btn--accent" onClick={() => open({ kind: 'newChat' })}><SquarePen className="ico" />Шинэ чат</button>} />
      <div className="chat glass">
        <ChatList chats={chats} at={chat?.id} />
        {chat ? <Thread key={chat.id} chat={chat} /> : (
          <section className="chat__thread chat__none">
            {id && <a className="ibtn ibtn--glass ct__back" href="#chat" aria-label="Бүх чат"><ChevronLeft className="ico" /></a>}
            <Empty icon={<MessagesSquare className="ico" />} title={id ? 'Чат олдсонгүй' : 'Чатаа сонгоно уу'} text={id ? 'Устгагдсан эсвэл та энэ чатад байхгүй байна.' : 'Зүүн талаас чатаа сонгоно уу эсвэл шинэ чат эхлүүлнэ үү.'} />
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
    <section className="chat__list" aria-label="Миний чат">
      <label className="tk-find chat__find">
        <Search className="ico" />
        <span className="sr-only">Чат хайх</span>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Чат хайх" />
      </label>
      {shown.length ? (
        <ul className="clist">{shown.map(c => <ChatItem key={c.id} c={c} on={c.id === at} />)}</ul>
      ) : <p className="clist__none">{t ? 'Илэрц алга' : 'Чат алга'}</p>}
    </section>
  )
}

/** What the list shows of a message: its words, else what it carries */
function preview(m: Message) {
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
          <b>{name}</b>
          <small>{last ? `${last.by === s.me ? 'Та: ' : ''}${preview(last)}` : 'Мессеж алга'}</small>
        </span>
        <span className="citem__side">
          <time className="tnum">{when}</time>
          {n > 0 && <span className="citem__n tnum">{n}<span className="sr-only"> шинэ мессеж</span></span>}
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
  useLayoutEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [msgs.length])
  // Coming from another page or chat, focus goes to the chat's name (not the box: a phone would open its keyboard)
  useLayoutEffect(() => { if (document.body.dataset.navigated) title.current?.focus({ preventScroll: true }) }, [])

  return (
    <section className="chat__thread" aria-labelledby="ct-name">
      <header className="ct__head">
        <a className="ibtn ibtn--glass ct__back" href="#chat" aria-label="Бүх чат"><ChevronLeft className="ico" /></a>
        {other ? <Avatar person={other} size="md" presence /> : <ChatMark chat={chat} />}
        <div className="ct__titles">
          <h2 id="ct-name" ref={title} tabIndex={-1}>{chatName(chat, s.people, s.me)}</h2>
          <p>{other ? other.role : `${chat.members.length} гишүүн`}</p>
        </div>
        {chat.kind === 'group' ? (
          <button type="button" className="ibtn ibtn--glass" aria-label="Бүлэг засах" title="Бүлэг засах" onClick={() => open({ kind: 'chatGroup', id: chat.id })}><Settings className="ico" /></button>
        ) : other && (
          <button type="button" className="ibtn ibtn--glass" aria-label={`${short(other)}: мэдээлэл харах`} title="Мэдээлэл харах" onClick={() => open({ kind: 'person', id: other.id })}><User className="ico" /></button>
        )}
      </header>
      <div className="cmsgs" ref={log} role="log" aria-label="Мессеж" tabIndex={0}>
        {msgs.length === 0 && <p className="cmsgs__none">Мессеж алга. Бичихдээ @ дарж хүн, ажил, тов, бичиг баримтыг дурдана.</p>}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1]
          const day = ymd(new Date(m.at))
          const newDay = !prev || ymd(new Date(prev.at)) !== day
          // Messages one person sends within 5 minutes share one face and name
          const first = newDay || prev.by !== m.by || new Date(m.at).getTime() - new Date(prev.at).getTime() > 5 * 6e4
          return (
            <Fragment key={m.id}>
              {newDay && <p className="cday"><span>{dueLabel(day)}</span></p>}
              <Bubble m={m} first={first} group={chat.kind === 'group'} />
            </Fragment>
          )
        })}
      </div>
      <Composer chat={chat} />
    </section>
  )
}

function Bubble({ m, first, group }: { m: Message; first: boolean; group: boolean }) {
  const s = useApp()
  const mine = m.by === s.me
  const by = s.people.find(p => p.id === m.by)
  const who = mine ? 'Та' : by ? short(by) : 'Устгагдсан ажилтан'
  const cards = m.refs.filter(r => r.kind !== 'person')
  return (
    <div className={`cmsg${mine ? ' is-mine' : ''}${first ? ' is-first' : ''}`}>
      {!mine && <span className="cmsg__face">{first && by && <Avatar person={by} size="sm" />}</span>}
      <div className="cmsg__body">
        {!mine && group && first ? <b className="cmsg__who">{who}</b> : <span className="sr-only">{who}:</span>}
        {m.text && <p className="cmsg__text"><Words m={m} /></p>}
        {cards.map(r => <RefCard key={`${r.kind}-${r.id}`} r={r} />)}
        {m.files.map(f => <FileView key={f.id} f={f} />)}
        <time className="cmsg__at tnum" dateTime={m.at}>{hm(new Date(m.at))}</time>
      </div>
    </div>
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

const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

/** A picture shows itself and opens bigger; another file can be saved */
function FileView({ f }: { f: BoardFile }) {
  const pic = f.type.startsWith('image/')
  const url = useFileUrl(pic ? f.id : '')
  if (pic) {
    return (
      <button type="button" className="cpic" onClick={() => open({ kind: 'picture', file: f })} aria-label={`${f.name}: томоор харах`}>
        {url ? <img src={url} alt="" /> : <span className="cpic__wait" />}
      </button>
    )
  }
  return (
    <button type="button" className="cref" onClick={() => getFile(f.id).then(b => b && saveBlob(f.name, b))}>
      <span className="cref__ico"><Paperclip className="ico" /></span>
      <span className="cref__main"><b>{f.name}</b><small>{size(f.size)}, татах</small></span>
      <Download className="ico cref__dl" />
    </button>
  )
}

interface Option { key: string; group: string; label: string; sub: string; ref?: ChatRef; file?: true }

/** The box to write in. @ opens a list to name a person or point to a task, a meeting or a document; + opens the same
 * list with files and pictures from this device at the top. */
function Composer({ chat }: { chat: Chat }) {
  const s = useApp()
  const sc = scoped(s)
  const [text, setText] = useState('')
  const [refs, setRefs] = useState<ChatRef[]>([])
  const [files, setFiles] = useState<BoardFile[]>([])
  // at: where the @ is in the text; -1 when the list was opened with +
  const [menu, setMenu] = useState<{ q: string; at: number } | null>(null)
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const pick = useRef<HTMLInputElement>(null)

  const options = useMemo(() => {
    if (!menu) return []
    const t = lower(menu.q)
    const has = (x: string) => !t || lower(x).includes(t)
    const out: Option[] = menu.at < 0 ? [{ key: 'file', group: 'Төхөөрөмжөөс', label: 'Файл, зураг', sub: '25 MB хүртэл', file: true }] : []
    const add = (group: string, list: Omit<Option, 'group'>[]) => out.push(...list.filter(o => has(o.label)).slice(0, 5).map(o => ({ ...o, group })))
    add('Хүн', s.people.filter(p => p.id !== s.me && chat.members.includes(p.id)).sort((a, b) => collator.compare(a.given, b.given))
      .map(p => ({ key: `p${p.id}`, label: short(p), sub: p.role, ref: { kind: 'person', id: p.id, label: short(p) } })))
    add('Ажил', [...sc.tasks].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.due.localeCompare(b.due))
      .map(x => ({ key: `t${x.id}`, label: x.title, sub: `${STATUS[x.status]}, ${dueLabel(x.due)}`, ref: { kind: 'task', id: x.id, label: x.title } })))
    add('Тов', sc.events.filter(e => e.start.slice(0, 10) >= today()).sort((a, b) => a.start.localeCompare(b.start))
      .map(e => ({ key: `e${e.id}`, label: e.title, sub: `${dueLabel(e.start.slice(0, 10))} ${hm(parse(e.start))}`, ref: { kind: 'event', id: e.id, label: e.title } })))
    add('Бичиг баримт', s.docs.filter(d => d.company === s.company && seen(d, s.me))
      .map(d => ({ key: `d${d.id}`, label: d.name, sub: DOC_KIND[d.kind], ref: { kind: 'doc', id: d.id, label: d.name } })))
    return out
  }, [menu, s, sc, chat.members])
  const current = Math.min(active, Math.max(0, options.length - 1))

  const type = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setText(v)
    setError('')
    // Grows with the text, up to about six lines
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
    const caret = e.target.selectionStart ?? v.length
    const m = /(^|\s)@([^\s@]{0,30})$/.exec(v.slice(0, caret))
    if (m) {
      setMenu({ q: m[2], at: caret - m[2].length - 1 })
      setActive(0)
    } else if (menu && menu.at >= 0) setMenu(null)
  }

  const choose = (o: Option) => {
    setMenu(null)
    if (o.file) return pick.current?.click()
    const r = o.ref!
    let v = text
    const named = r.kind === 'person' ? `@${r.label} ` : ''
    if (menu && menu.at >= 0) v = v.slice(0, menu.at) + named + v.slice(menu.at + 1 + menu.q.length)
    else if (named) v = `${v}${v && !/\s$/.test(v) ? ' ' : ''}${named}`
    setText(v)
    setRefs(rs => (rs.some(x => x.kind === r.kind && x.id === r.id) ? rs : [...rs, r]))
    box.current?.focus()
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
    setMenu(null)
  }

  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menu && options.length && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
      e.preventDefault()
      if (e.key === 'ArrowDown') setActive((current + 1) % options.length)
      else if (e.key === 'ArrowUp') setActive((current - 1 + options.length) % options.length)
      else choose(options[current])
      return
    }
    if (menu && e.key === 'Escape') {
      e.preventDefault()
      return setMenu(null)
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
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
  return (
    <form className="ccompose" onSubmit={e => { e.preventDefault(); send() }}>
      {menu && (
        <div className="cmenu" role="listbox" id="cmenu" aria-label="Дурдах зүйл">
          {options.length === 0 && <p className="cmenu__none">Илэрц алга</p>}
          {options.map((o, i) => (
            <Fragment key={o.key}>
              {(i === 0 || options[i - 1].group !== o.group) && <p className="cmenu__group" aria-hidden="true">{o.group}</p>}
              <button type="button" role="option" id={`cm-${o.key}`} className="cmenu__opt" aria-selected={i === current}
                onMouseDown={e => e.preventDefault()} onClick={() => choose(o)} tabIndex={-1}>
                <b>{o.label}</b><small>{o.sub}</small>
              </button>
            </Fragment>
          ))}
        </div>
      )}
      {(cards.length > 0 || files.length > 0 || busy) && (
        <ul className="cdraft" aria-label="Хавсаргасан">
          {cards.map(r => (
            <li key={`${r.kind}-${r.id}`}>
              {r.kind === 'task' ? <SquareCheck className="ico" /> : r.kind === 'event' ? <CalendarDays className="ico" /> : <Paperclip className="ico" />}
              <span>{r.label}</span>
              <button type="button" className="ibtn ibtn--sm" aria-label={`${r.label}: хасах`} onClick={() => setRefs(rs => rs.filter(x => x !== r))}><X className="ico" /></button>
            </li>
          ))}
          {files.map(f => (
            <li key={f.id}>
              <Paperclip className="ico" />
              <span>{f.name}</span>
              <button type="button" className="ibtn ibtn--sm" aria-label={`${f.name}: хасах`} onClick={() => setFiles(fs => fs.filter(x => x !== f))}><X className="ico" /></button>
            </li>
          ))}
          {busy && <li className="cdraft__wait" role="status">Хавсаргаж байна…</li>}
        </ul>
      )}
      <div className="ccompose__row">
        <button type="button" className="ibtn ibtn--glass" aria-label="Хавсаргах" title="Хавсаргах" aria-expanded={!!menu && menu.at < 0} aria-controls="cmenu"
          onClick={() => setMenu(menu && menu.at < 0 ? null : { q: '', at: -1 })}>
          <Plus className="ico" />
        </button>
        <textarea ref={box} className="ccompose__box" rows={1} value={text} onChange={type} onKeyDown={key} aria-label="Мессеж"
          placeholder="Мессеж бичих" aria-controls={menu ? 'cmenu' : undefined} aria-expanded={!!menu}
          aria-activedescendant={menu && options[current] ? `cm-${options[current].key}` : undefined} />
        <button type="submit" className="csend" aria-label="Илгээх" title="Илгээх"><Send className="ico" /></button>
      </div>
      {error && <p className="field__error" role="alert">{error}</p>}
      <input ref={pick} type="file" multiple hidden onChange={attach} />
    </form>
  )
}
