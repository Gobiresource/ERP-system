import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AtSign, Bell, CalendarClock, Check, ChevronRight, Contrast, Database, Download, Flag, Hourglass, Inbox, Layers, Mail, Minus, Moon, Palette, Play, Plus, RotateCcw, Shield, Square, Sun, SunMoon, Timer, User, BadgeCheck, Droplet } from 'lucide-react'
import '../styles/screens/settings.css'
import type { Accent, Settings as Prefs, Wall } from '../lib/types'
import { actions, getState, scoped, useApp } from '../lib/store'
import { clock, short, today } from '../lib/format'
import { focus, focusLeft, toast, useUi } from '../lib/ui'
import { applyAppearance } from '../lib/theme'
import { gsap, reduced, useLens, usePageEnter } from '../lib/motion'
import { downloadCsv } from '../lib/insights'
import { PageHead } from '../ui/PageHead'
import { Seg } from '../ui/Seg'
import { Avatar, PRIO, STATUS } from '../ui/bits'
import { WaveArt } from '../shell/Wallpaper'

const WALLS: [Wall, string][] = [['ash', 'Үнс'], ['sand', 'Элс'], ['sage', 'Шарилж'], ['aurora', 'Туяа'], ['smoke', 'Утаа'], ['tide', 'Давалгаа'], ['bloom', 'Цэцэг'], ['ember', 'Цог'], ['grove', 'Төгөл'], ['dusk', 'Бүрэнхий']]
const ACCENTS: [Accent, string][] = [['blue', 'Цэнхэр'], ['purple', 'Нил ягаан'], ['pink', 'Ягаан'], ['orange', 'Улбар шар'], ['green', 'Ногоон'], ['graphite', 'Бараан саарал']]
const SECTIONS = [
  { id: 'set-profile', label: 'Профайл', icon: User, hue: 'blue' },
  { id: 'set-notifications', label: 'Мэдэгдэл', icon: Bell, hue: 'pink' },
  { id: 'set-appearance', label: 'Харагдах байдал', icon: Palette, hue: 'purple' },
  { id: 'set-focus', label: 'Төвлөрөл', icon: Timer, hue: 'orange' },
  { id: 'set-data', label: 'Өгөгдөл', icon: Database, hue: 'teal' },
] as const

/** Saves appearance settings; the change cross-fades */
function setLook(patch: Partial<Prefs>) {
  applyAppearance({ ...getState().settings, ...patch }, true)
  actions.setSettings(patch)
}

export default function Settings() {
  const s = useApp()
  const me = scoped(s).me
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const [active, setActive] = useState<string>(SECTIONS[0].id)
  const track = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLSpanElement>(null)
  useLens(track, lens, '[aria-current="true"]', active)

  // The menu follows the section in view
  useEffect(() => {
    const io = new IntersectionObserver(es => {
      const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (vis) setActive(vis.target.id)
    }, { rootMargin: '-90px 0px -55% 0px' })
    SECTIONS.forEach(x => { const el = document.getElementById(x.id); if (el) io.observe(el) })
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref}>
      <PageHead title="Тохиргоо" sub="Таны профайл, системийн харагдах байдал, мэдэгдлүүд." />
      <div className="settings">
        <nav className="snav glass" aria-label="Тохиргооны хэсгүүд" data-enter>
          <div className="snav__me">
            <Avatar person={me} size="md" />
            <span><b>{short(me)}</b><small>{me.email}</small></span>
          </div>
          <div className="snav__track" ref={track}>
            <span className="snav__lens" ref={lens} aria-hidden="true" />
            {SECTIONS.map(x => (
              <button key={x.id} type="button" className="snav__item" aria-current={active === x.id}
                onClick={() => {
                  setActive(x.id)
                  document.getElementById(x.id)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
                }}>
                <span className={`picon picon--sm hue--${x.hue}`} aria-hidden="true"><x.icon className="ico" /></span>
                {x.label}
                <ChevronRight className="ico snav__chev" />
              </button>
            ))}
          </div>
        </nav>
        <div className="settings__col">
          <Profile />
          <Notifications />
          <Appearance />
          <FocusPrefs />
          <Data />
        </div>
      </div>
    </div>
  )
}

function Group({ id, title, sub, children }: { id: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="sgroup glass" id={id} aria-labelledby={`${id}-t`} data-enter>
      <header className="sgroup__head"><h2 className="sgroup__title" id={`${id}-t`}>{title}</h2><p className="sgroup__sub">{sub}</p></header>
      <div className="cells">{children}</div>
    </section>
  )
}

function Icon({ icon: I, hue }: { icon: typeof User; hue: string }) {
  return <span className={`picon picon--sm hue--${hue}`} aria-hidden="true"><I className="ico" /></span>
}

/** A text field that saves when you leave it or press Enter */
function InlineField({ id, icon, hue, label, value, onSave, validate, type = 'text' }: {
  id: string; icon: typeof User; hue: string; label: string; value: string; type?: string
  onSave: (v: string) => void; validate: (v: string) => string | null
}) {
  const [v, setV] = useState(value)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => setV(value), [value])
  const save = () => {
    if (v.trim() === value) return setErr(null)
    const e = validate(v.trim())
    setErr(e)
    if (e) return
    onSave(v.trim())
    toast('Хадгаллаа.')
  }
  return (
    <div className="cell">
      <Icon icon={icon} hue={hue} />
      <div className="cell__main">
        <label className="cell__text" htmlFor={id}><b>{label}</b></label>
        <input id={id} className="cell__input" type={type} value={v} aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-err` : undefined}
          onChange={e => setV(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        {err && <span className="cell__err" id={`${id}-err`} role="alert">{err}</span>}
      </div>
    </div>
  )
}

function Profile() {
  const s = useApp()
  const me = scoped(s).me
  const save = (patch: Partial<typeof me>) => actions.setProfile({ given: me.given, family: me.family, email: me.email, role: me.role, ...patch })
  return (
    <Group id="set-profile" title="Профайл" sub="Хамт ажиллагсад таныг ингэж харна">
      <div className="me-card">
        <Avatar person={me} size="xl" presence />
        <div className="me-card__text"><b>{short(me)}</b><span>{me.role}</span><small>{me.email}</small></div>
      </div>
      <InlineField id="pf-given" icon={User} hue="blue" label="Нэр" value={me.given} onSave={v => save({ given: v })} validate={v => (v ? null : 'Нэр хоосон байж болохгүй.')} />
      <InlineField id="pf-family" icon={User} hue="indigo" label="Овог" value={me.family} onSave={v => save({ family: v })} validate={v => (v ? null : 'Овог хоосон байж болохгүй.')} />
      <InlineField id="pf-email" icon={Mail} hue="purple" label="Имэйл" type="email" value={me.email} onSave={v => save({ email: v })}
        validate={v => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Имэйл хаяг буруу байна.')} />
      <InlineField id="pf-role" icon={BadgeCheck} hue="teal" label="Албан тушаал" value={me.role} onSave={v => save({ role: v })} validate={v => (v ? null : 'Албан тушаалыг бичнэ үү.')} />
    </Group>
  )
}

function Toggle({ id, icon, hue, label, hint, checked, onChange }: { id: string; icon: typeof User; hue: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="cell">
      <Icon icon={icon} hue={hue} />
      <div className="cell__main">
        <label className="cell__text" htmlFor={id}><b>{label}</b><small>{hint}</small></label>
        <span className="cell__ctl"><input id={id} type="checkbox" role="switch" className="switch" checked={checked} onChange={e => onChange(e.target.checked)} /></span>
      </div>
    </div>
  )
}

function Notifications() {
  const s = useApp()
  const n = s.settings.notify
  const set = (patch: Partial<typeof n>) => actions.setSettings({ notify: { ...n, ...patch } })
  return (
    <Group id="set-notifications" title="Мэдэгдэл" sub="Систем танд юуг сануулах вэ">
      <Toggle id="nt-mentions" icon={AtSign} hue="blue" label="Дурдсан үед" hint="Хэн нэгэн таныг дурдахад" checked={n.mentions} onChange={v => set({ mentions: v })} />
      <Toggle id="nt-due" icon={Flag} hue="orange" label="Дуусах хугацаа" hint="Таны ажлын хугацаа болох өглөө" checked={n.due} onChange={v => set({ due: v })} />
      <Toggle id="nt-meet" icon={CalendarClock} hue="pink" label="Уулзалт" hint="Эхлэхээс 5 минутын өмнө" checked={n.meetings} onChange={v => set({ meetings: v })} />
      <Toggle id="nt-digest" icon={Inbox} hue="teal" label="Өдрийн тойм" hint="Өглөө 9:00-д нэг тойм" checked={n.digest} onChange={v => set({ digest: v })} />
      <Toggle id="nt-focus" icon={Hourglass} hue="purple" label="Төвлөрөл дуусах" hint="Төвлөрөх цаг дуусахад" checked={n.focusEnd} onChange={v => set({ focusEnd: v })} />
    </Group>
  )
}

function Appearance() {
  const s = useApp()
  const p = s.settings
  const wallName = WALLS.find(([w]) => w === p.wall)?.[1]
  const accentName = ACCENTS.find(([a]) => a === p.accent)?.[1]
  return (
    <Group id="set-appearance" title="Харагдах байдал" sub="Бүх дэлгэц шилээрээ шинэ өнгөө авна">
      <div className="cell">
        <Icon icon={SunMoon} hue="indigo" />
        <div className="cell__main">
          <span className="cell__text"><b>Горим</b><small>Автомат нь таны төхөөрөмжийг дагана</small></span>
          <span className="cell__ctl">
            <Seg label="Горим" className="set-theme" value={p.theme} onChange={theme => setLook({ theme })}
              options={[{ value: 'light', label: 'Гэрэл', icon: <Sun className="ico" /> }, { value: 'dark', label: 'Харанхуй', icon: <Moon className="ico" /> }, { value: 'system', label: 'Автомат', icon: <Contrast className="ico" /> }]} />
          </span>
        </div>
      </div>
      <div className="cell cell--block">
        <Icon icon={Droplet} hue="pink" />
        <div className="cell__main">
          <span className="cell__text"><b>Арын зураг</b><small>{wallName}</small></span>
          <div className="wps" role="group" aria-label="Арын зураг">
            {WALLS.map(([w, name]) => (
              <button key={w} type="button" className="wp" aria-pressed={p.wall === w} onClick={() => setLook({ wall: w })}>
                <span className="wp__art" data-wall={w}>
                  <WaveArt />
                  <i className="wp__side" /><i className="wp__card" /><i className="wp__chip" />
                  <span className="wp__tick"><Check className="ico" /></span>
                </span>
                <span className="wp__name">{name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="cell cell--block">
        <Icon icon={Palette} hue="orange" />
        <div className="cell__main">
          <span className="cell__text"><b>Онцлох өнгө</b><small>{accentName}</small></span>
          <div className="sws" role="group" aria-label="Онцлох өнгө">
            {ACCENTS.map(([a, name]) => (
              <button key={a} type="button" className={`sw sw--${a}`} aria-pressed={p.accent === a} aria-label={name} title={name} onClick={() => setLook({ accent: a })}>
                <span className="sw__dot"><Check className="ico" /></span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="cell">
        <Icon icon={Layers} hue="blue" />
        <div className="cell__main">
          <span className="cell__text"><b>Шил</b><small>Тунгалаг нь арын зургийг илүү харуулна</small></span>
          <span className="cell__ctl">
            <Seg label="Шил" className="set-glass" value={p.glass} onChange={glass => setLook({ glass })} options={[{ value: 'clear', label: 'Тунгалаг' }, { value: 'tinted', label: 'Өнгөтэй' }]} />
          </span>
        </div>
      </div>
      <Toggle id="ap-solid" icon={Shield} hue="green" label="Тунгалаг байдлыг багасгах" hint="Шилэн эффектгүй, битүү гадаргуу" checked={p.solid} onChange={solid => setLook({ solid })} />
    </Group>
  )
}

/** The number rolls up or down when it changes */
function Rolling({ value }: { value: number }) {
  const el = useRef<HTMLElement>(null)
  const last = useRef(value)
  useLayoutEffect(() => {
    if (reduced() || !el.current || last.current === value) return
    gsap.fromTo(el.current, { yPercent: value > last.current ? 60 : -60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.42, ease: 'back.out(2.2)' })
    last.current = value
  }, [value])
  return <b ref={el} className="tnum">{value}</b>
}

function Stepper({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <span className="stepper__label">{label}</span>
      <div className="stepper__row">
        <button type="button" className="stepper__btn" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} aria-label={`${label}: ${step} минутаар багасгах`}><Minus className="ico" /></button>
        <span className="stepper__val" aria-live="polite"><Rolling value={value} /><small>мин</small></span>
        <button type="button" className="stepper__btn" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} aria-label={`${label}: ${step} минутаар нэмэх`}><Plus className="ico" /></button>
      </div>
    </div>
  )
}

function FocusPrefs() {
  const s = useApp()
  const ui = useUi()
  const fp = s.settings.focus
  const set = (patch: Partial<typeof fp>) => actions.setSettings({ focus: { ...fp, ...patch } })
  const running = ui.focus.status !== 'idle'
  const [, tick] = useState(0)
  useEffect(() => {
    if (ui.focus.status !== 'running') return
    const id = window.setInterval(() => tick(x => x + 1), 1000)
    return () => clearInterval(id)
  }, [ui.focus.status])
  return (
    <Group id="set-focus" title="Төвлөрөл" sub="Дээд талд харагдах цаг хэмжигч">
      <div className="steppers">
        <Stepper label="Ажиллах" value={fp.work} min={5} max={90} step={5} onChange={work => set({ work })} />
        <Stepper label="Завсарлага" value={fp.rest} min={1} max={30} step={1} onChange={rest => set({ rest })} />
      </div>
      <div className="cell">
        <Icon icon={Play} hue="orange" />
        <div className="cell__main">
          <span className="cell__text"><b>Одоо эхлүүлэх</b><small>{running ? `Төвлөрч байна, ${clock(focusLeft(ui.focus))} үлдсэн` : `${fp.work} минутын төвлөрөл`}</small></span>
          <span className="cell__ctl">
            {running
              ? <button type="button" className="btn btn--glass btn--sm" onClick={() => focus.end()}><Square className="ico" />Дуусгах</button>
              : <button type="button" className="btn btn--accent btn--sm" onClick={() => focus.start(fp.work)}><Play className="ico" />Эхлүүлэх</button>}
          </span>
        </div>
      </div>
    </Group>
  )
}

function Data() {
  const s = useApp()
  const sc = scoped(s)
  const [confirm, setConfirm] = useState(false)
  const exportTasks = () => {
    const rows: (string | number)[][] = [['Нэр', 'Төсөл', 'Хариуцагч', 'Төлөв', 'Чухал байдал', 'Дуусах өдөр', 'Төлөвлөсөн цаг', 'Үүсгэсэн', 'Дууссан']]
    for (const t of sc.tasks) {
      const who = sc.person(t.assignee)
      rows.push([t.title, sc.project(t.project)?.name ?? '', who ? short(who) : '', STATUS[t.status], PRIO[t.prio], t.due, t.estimate, t.createdAt.slice(0, 10), t.doneAt?.slice(0, 10) ?? ''])
    }
    downloadCsv(`ajluud-${today()}.csv`, rows)
  }
  return (
    <Group id="set-data" title="Өгөгдөл" sub="Одоогоор бүх өгөгдөл зөвхөн энэ хөтөч дээр хадгалагдана">
      <div className="cell cell--link">
        <Icon icon={Download} hue="green" />
        <div className="cell__main">
          <button type="button" className="cell__btn" onClick={exportTasks}>
            <span className="cell__text"><b>Ажлуудыг Excel-д татах</b><small>{sc.tasks.length} ажил, нэг мөрөнд нэг ажил</small></span>
            <ChevronRight className="ico cell__chev" />
          </button>
        </div>
      </div>
      <div className="cell cell--link">
        <Icon icon={RotateCcw} hue="danger" />
        <div className="cell__main">
          <button type="button" className="cell__btn cell__btn--danger" aria-expanded={confirm} onClick={() => setConfirm(true)}>
            <span className="cell__text"><b>Жишээ өгөгдлийг сэргээх</b><small>Анхны жишээ өгөгдөл рүү буцна</small></span>
            <ChevronRight className="ico cell__chev" />
          </button>
        </div>
      </div>
      {confirm && (
        <div className="confirm" role="alertdialog" aria-labelledby="reset-q">
          <p id="reset-q">Энд хийсэн бүх өөрчлөлт арилж, жишээ өгөгдөл анхны байдалдаа орно. Үргэлжлүүлэх үү?</p>
          <div>
            <button type="button" className="btn btn--glass btn--sm" onClick={() => setConfirm(false)} autoFocus>Болих</button>
            <button type="button" className="btn btn--danger btn--sm" onClick={() => { setConfirm(false); toast('Жишээ өгөгдлийг сэргээлээ.', { undo: actions.reset() }) }}>Сэргээх</button>
          </div>
        </div>
      )}
    </Group>
  )
}
