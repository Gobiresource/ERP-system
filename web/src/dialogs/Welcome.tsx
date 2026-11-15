// Тавтай морил: the page a person sees once, at their first sign-in (lib/auth.ts). Clean white paper with the company it
// comes from and its letter to a new colleague, in the user's own words (docs/decisions.md, 2026-11-15); the person's own
// name is the one large thing on it. It opens as a small celebration, since it is seen only once: the name's letters swing
// down like paper tags, bits of coloured paper burst out from behind it, a stroke is drawn under it and the letter arrives
// word by word. From here they go on to the tour of the system, or past it.
import { Fragment, useLayoutEffect, useRef, type CSSProperties } from 'react'
import '../styles/viewer.css'
import '../styles/welcome.css'
import type { Hue } from '../lib/types'
import { scoped, useApp } from '../lib/store'
import { close, startTour } from '../lib/ui'
import { FIRST_TOUR, TOURS } from '../lib/tours'
import { enter, reduced } from '../lib/motion'
import { Sheet, useCloseSheet } from '../ui/Sheet'
import { Letters } from '../ui/PageHead'
import { AvatarStack } from '../ui/bits'
import { CompanyMark } from '../shell/CompanySwitcher'

type Bit = [left: number, top: number, shape: 'pill' | 'dot' | 'square' | 'ring', hue: Hue, turn?: number]
// Bits of coloured paper, decoration only: where each comes to lie in its band (%), its shape, colour and turn. They burst
// out from behind the name as the page opens and settle above and below the text, never over it: none lies lower than
// two thirds of its band. A narrow page shows every other one.
const ABOVE: Bit[] = [
  [4, 30, 'pill', 'blue', -28], [9, 62, 'dot', 'orange'], [15, 8, 'square', 'green', 18], [21, 36, 'ring', 'purple'], [27, 54, 'pill', 'pink', 64],
  [33, 10, 'dot', 'teal'], [40, 20, 'square', 'yellow', -12], [47, 56, 'pill', 'indigo', 36], [55, 46, 'dot', 'pink'], [61, 22, 'ring', 'orange'],
  [67, 10, 'pill', 'green', -52], [74, 60, 'square', 'blue', 30], [81, 58, 'dot', 'purple'], [88, 8, 'pill', 'teal', 14], [95, 26, 'square', 'pink', -24],
]
const BELOW: Bit[] = [
  [8, 30, 'dot', 'green'], [19, 60, 'pill', 'indigo', 80], [33, 36, 'square', 'orange', 12], [68, 56, 'pill', 'blue', -70], [81, 26, 'ring', 'pink'], [92, 58, 'square', 'teal', -18],
]
const bits = (list: Bit[]) => list.map(([left, top, shape, hue, turn = 0], i) => (
  <i key={i} className={`welcome__bit welcome__bit--${shape} hue--${hue}`} style={{ left: `${left}%`, top: `${top}%`, rotate: `${turn}deg` }} />
))

/**
 * The ХХК as the letter names it, «… ХХК-ийн хамт олны нэг»: a name ending in ХХК or ХК takes «-ийн»; any other name is
 * followed by «компанийн», so no ending is ever joined to a name it may not suit (Gemini 53).
 */
const ofCompany = (name: string) => (/(ХХК|ХК)$/.test(name.trim().toUpperCase()) ? `${name.trim()}-ийн` : `${name.trim()} компанийн`)

/** A text split into words that arrive one after another. Screen readers get the plain text. */
function Words({ text }: { text: string }) {
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(' ').map((w, i) => <Fragment key={i}>{i > 0 && ' '}<span className="welcome__w">{w}</span></Fragment>)}
      </span>
    </>
  )
}

export function Welcome() {
  // Whether the person asked for the tour; it starts once the page has gone
  const tour = useRef(false)
  return (
    <Sheet kind="full" look="welcome" label="Тавтай морилно уу" closeButton={false} onClose={() => { close(); if (tour.current) startTour(FIRST_TOUR) }}>
      <Page onTour={() => { tour.current = true }} />
    </Sheet>
  )
}

function Page({ onTour }: { onTour: () => void }) {
  const s = useApp()
  const closeSheet = useCloseSheet()
  const root = useRef<HTMLDivElement>(null)
  const me = s.people.find(p => p.id === s.me)!
  const company = s.companies.find(c => c.id === s.company)!
  const others = scoped(s).people.filter(p => p.id !== me.id)
  const steps = TOURS.find(t => t.id === FIRST_TOUR)!.steps.length

  useLayoutEffect(() => {
    const el = root.current!
    const q = (sel: string) => el.querySelectorAll(sel)
    // When the name has landed (seconds): everything after it is timed from here, so a long name is not hurried
    const land = 0.55 + (Math.min(12, q('.welcome__name .ch').length) - 1) * 0.045
    const anims = [
      ...enter(q('.welcome__from .brand__mark'), { opacity: 0, transform: 'scale(.7) rotate(-14deg)' }, { duration: 0.6, ease: 'back.out(2.2)', delay: 0.1 }),
      ...enter(q('[data-rise]'), { opacity: 0, transform: 'translateY(10px)' }, { duration: 0.55, ease: 'power3.out', delay: 0.12, stagger: 0.07 }),
      // Each letter hangs from its top edge and swings down, a little past and back
      ...enter(q('.welcome__name .ch'), { opacity: 0, transform: 'translateY(-.28em) rotateX(-96deg)' }, { duration: 0.7, ease: 'back.out(1.7)', delay: 0.25, stagger: 0.045 }),
      ...enter(q('.welcome__cheer'), { opacity: 0, transform: 'translateY(10px)' }, { duration: 0.55, ease: 'power3.out', delay: land + 0.2 }),
      // The stroke under the name, drawn from its left end
      ...enter(q('.welcome__stroke'), { clipPath: 'inset(-40% 100% -40% 0)' }, { duration: 0.7, ease: 'power3.out', delay: land + 0.25 }),
      ...enter(q('.welcome__w'), { opacity: 0, transform: 'translateY(.4em)' }, { duration: 0.45, ease: 'power3.out', delay: land + 0.35, stagger: 0.014 }),
      ...enter(q('.welcome__team .av'), { opacity: 0, transform: 'scale(.6)' }, { duration: 0.5, ease: 'back.out(2)', delay: land + 0.45, stagger: 0.05 }),
      ...enter(q('[data-late]'), { opacity: 0, transform: 'translateY(10px)' }, { duration: 0.5, ease: 'power3.out', delay: land + 0.45, stagger: 0.08 }),
      // The buttons keep to the screen's lower edge on a short screen: they only fade in, and do not move
      ...enter(q('.welcome__go'), { opacity: 0 }, { duration: 0.4, ease: 'power2.out', delay: land + 0.45 }),
    ]
    // The paper bursts from the middle of the name as it lands, and the name swells for a moment as it does. Measured
    // once the window is on the screen (it is shown after this runs, and fades in, so the bits are never seen waiting
    // in their places).
    const frame = requestAnimationFrame(() => {
      if (reduced()) return
      const name = el.querySelector('.welcome__name')!
      const from = name.getBoundingClientRect()
      const [x, y] = [from.left + from.width / 2, from.top + from.height / 2]
      anims.push(name.animate([{ scale: '1' }, { scale: '1.04', offset: 0.3 }, { scale: '1' }], { duration: 520, delay: land * 1000 - 60, easing: 'ease-out' }))
      q('.welcome__bit').forEach((b, i) => {
        const r = b.getBoundingClientRect()
        if (!r.width) return // not shown on a narrow page
        // Each its own pace and spin, the same every time; it is still turning as it comes to rest
        const [delay, pace, spin] = [land + (i % 5) * 0.025, 1.05 + (i % 4) * 0.12, (i % 2 ? -1 : 1) * (220 + ((i * 67) % 260))]
        anims.push(
          ...enter([b], { opacity: 0 }, { duration: 0.16, ease: 'power1.out', delay }),
          ...enter([b], { scale: '.5', translate: `${x - r.left - r.width / 2}px ${y - r.top - r.height / 2}px` }, { duration: pace, ease: 'power4.out', delay }),
          ...enter([b], { rotate: `${spin}deg` }, { duration: pace + 0.5, ease: 'power2.out', delay }),
        )
      })
    })
    return () => {
      cancelAnimationFrame(frame)
      anims.forEach(a => a.cancel())
    }
  }, [])

  return (
    <div className="welcome__page" ref={root}>
      <div className="welcome__above" aria-hidden="true">{bits(ABOVE)}</div>
      <div className="welcome__body">
        <p className="welcome__from" data-rise><CompanyMark company={company} /><span>{company.name}</span></p>
        {/* The letter's first line, «Эрхэм хүндэт … танд баяр хүргэе!», with the name as its one large word. The name fits
            one line: its size follows its length */}
        <h1 className="welcome__title" style={{ '--n': Math.max(4, [...me.given].length) } as CSSProperties}>
          <span className="welcome__hello" data-rise>Эрхэм хүндэт</span>
          <span className="welcome__name">
            <Letters text={me.given} />
            <svg className="welcome__stroke" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true"><path d="M4 16 C 56 5, 122 3, 178 10 S 262 15, 296 6" /></svg>
          </span>
          <span className="welcome__cheer">танд баяр хүргэе!</span>
        </h1>
        <div className="welcome__letter">
          <p><Words text={`${ofCompany(company.name)} хамт олны нэг болсонд тань баяр хүргэж, халуун дотноор угтан авч байна. Таны мэдлэг туршлага, ур чадвар манай байгууллагын хөгжил дэвшил, цаашдын амжилтад үнэтэй хувь нэмэр оруулна гэдэгт итгэлтэй байна.`} /></p>
          <p><Words text="Шинэ ажилд тань өндөр амжилт, урам зоригийг хүсэн ерөөе. Манай багт тавтай морилно уу!" /></p>
        </div>
        {others.length > 0 && (
          <p className="welcome__team">
            <span aria-hidden="true"><AvatarStack people={others} max={6} size="md" /></span>
            <span data-late>Таны хамт олон</span>
          </p>
        )}
        <div className="welcome__go">
          <button type="button" className="btn btn--accent" data-autofocus onClick={() => { onTour(); closeSheet() }}>Системтэй танилцах</button>
          <button type="button" className="btn btn--ghost welcome__skip" onClick={closeSheet}>Алгасах</button>
        </div>
        <p className="welcome__hint" data-late>Заавар {steps} алхамтай. Хүссэн үедээ «Алгасах» товчийг дарж гарна.</p>
      </div>
      <div className="welcome__below" aria-hidden="true">{bits(BELOW)}</div>
    </div>
  )
}
