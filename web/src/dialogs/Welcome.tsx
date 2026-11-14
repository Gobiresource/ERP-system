// Тавтай морил: the page a person sees once, at their first sign-in (lib/auth.ts). Clean white paper with the company it
// comes from, the person's own name as the one large thing on it, a word of welcome and the people they join. From here
// they go on to the tour of the system, or past it (the user's request, docs/decisions.md, 2026-11-14).
import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import '../styles/viewer.css'
import '../styles/welcome.css'
import type { Hue } from '../lib/types'
import { scoped, useApp } from '../lib/store'
import { close, startTour } from '../lib/ui'
import { FIRST_TOUR, TOURS } from '../lib/tours'
import { enter } from '../lib/motion'
import { Sheet, useCloseSheet } from '../ui/Sheet'
import { Letters } from '../ui/PageHead'
import { AvatarStack } from '../ui/bits'
import { CompanyMark } from '../shell/CompanySwitcher'

type Bit = [left: number, top: number, shape: 'pill' | 'dot' | 'square' | 'ring', hue: Hue, turn?: number]
// Bits of coloured paper, decoration only: where each lies in its band (%), its shape, colour and turn. Those above the
// text fall into place as the page opens; a few lie below it. None lies lower than two thirds of its band, so none is
// cut at the band's edge; a narrow page shows every other one.
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
    const anims = [
      ...enter(el.querySelectorAll('.welcome__above .welcome__bit'), { opacity: 0, translate: '0 -56px' }, { duration: 0.9, ease: 'power3.out', delay: 0.1, stagger: 0.03 }),
      ...enter(el.querySelectorAll('.welcome__name .ch'), { transform: 'translateY(115%) rotate(6deg)' }, { duration: 0.85, ease: 'power4.out', delay: 0.15, stagger: 0.03 }),
      ...enter(el.querySelectorAll('[data-rise]'), { opacity: 0, transform: 'translateY(10px)' }, { duration: 0.55, ease: 'power3.out', delay: 0.2, stagger: 0.06 }),
      ...enter(el.querySelectorAll('.welcome__below .welcome__bit'), { opacity: 0, scale: '.4' }, { duration: 0.5, ease: 'back.out(2)', delay: 0.6, stagger: 0.05 }),
    ]
    return () => anims.forEach(a => a.cancel())
  }, [])

  return (
    <div className="welcome__page" ref={root}>
      <div className="welcome__above" aria-hidden="true">{bits(ABOVE)}</div>
      <div className="welcome__body">
        <p className="welcome__from" data-rise><CompanyMark company={company} /><span>{company.name}</span></p>
        {/* The name fits one line: its size follows its length */}
        <h1 className="welcome__title" style={{ '--n': Math.max(4, [...me.given].length) } as CSSProperties}>
          <span className="welcome__hello" data-rise>Тавтай морилно уу</span>
          <span className="welcome__name"><Letters text={me.given} /></span>
        </h1>
        {me.role && <p className="welcome__role" data-rise>{me.role}</p>}
        <p className="welcome__motto" data-rise>
          Та манай хамт олны нэг болсноор бидэнд шинэ эрч хүч нэмэгдэж, шинэ боломж нээгдэж байна. Хамтдаа суралцаж, их амжилтыг бүтээцгээе.
        </p>
        {others.length > 0 && (
          <p className="welcome__team" data-rise>
            <span aria-hidden="true"><AvatarStack people={others} max={6} size="md" /></span>
            <span>Таны хамт олон</span>
          </p>
        )}
        <div className="welcome__go" data-rise>
          <button type="button" className="btn btn--accent" data-autofocus onClick={() => { onTour(); closeSheet() }}>Системтэй танилцах</button>
          <button type="button" className="btn btn--ghost welcome__skip" onClick={closeSheet}>Алгасах</button>
        </div>
        <p className="welcome__hint" data-rise>Заавар {steps} алхамтай. Хүссэн үедээ «Алгасах» товчийг дарж гарна.</p>
      </div>
      <div className="welcome__below" aria-hidden="true">{bits(BELOW)}</div>
    </div>
  )
}
