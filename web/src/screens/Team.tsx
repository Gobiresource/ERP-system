import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Moon, SquareCheck, Sun, UserPlus } from 'lucide-react'
import '../styles/screens/team.css'
import type { Person } from '../lib/types'
import { scoped, useApp } from '../lib/store'
import { accessOf } from '../lib/access'
import { open } from '../lib/ui'
import { enter, usePageEnter } from '../lib/motion'
import { localTime, teamHue, workload } from '../lib/derive'
import { collator, short } from '../lib/format'
import { PageHead } from '../ui/PageHead'
import { Seg } from '../ui/Seg'
import { Avatar, PresenceLabel } from '../ui/bits'

export default function Team() {
  const s = useApp()
  const sc = scoped(s)
  const ref = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const [team, setTeam] = useState('all')
  usePageEnter(ref)

  const people = useMemo(
    () => [...sc.people].sort((a, b) => (a.id === s.me ? -1 : b.id === s.me ? 1 : collator.compare(a.given, b.given))),
    [sc.people, s.me],
  )
  const teams = useMemo(() => [...new Set(people.map(p => p.team))].sort(collator.compare), [people])
  const shown = team === 'all' ? people : people.filter(p => p.team === team)
  const loads = people.map(p => workload(p, sc.tasks))
  const online = people.filter(p => p.presence !== 'away').length
  const inFocus = people.filter(p => p.presence === 'focus').length
  const avg = Math.round(loads.reduce((n, l) => n + l.pct, 0) / Math.max(1, loads.length))

  // Workload bars grow in
  useLayoutEffect(() => {
    if (!grid.current) return
    const anims = enter(grid.current.querySelectorAll('.mload__bar i'), { transform: 'scaleX(0)' }, { duration: 1.1, ease: 'power3.out', stagger: 0.04, delay: 0.2 })
    return () => anims.forEach(a => a.cancel())
  }, [team])

  return (
    <div ref={ref}>
      <PageHead
        title="Баг"
        sub={`Энэ компанид ${people.length} хүн, ${teams.length} хэлтэс байна.`}
        stats={[
          { label: 'Идэвхтэй', value: online, unit: `/ ${people.length}` },
          { label: 'Төвлөрсөн', value: inFocus },
          { label: 'Дундаж ачаалал', value: avg, unit: '%' },
        ]}
        actions={
          <>
            <div className="tfilter-wrap">
              <Seg label="Хэлтсээр шүүх" value={team} onChange={setTeam} options={[{ value: 'all', label: 'Бүгд' }, ...teams.map(t => ({ value: t, label: t }))]} />
            </div>
            {accessOf(s, s.me, s.company).admin && (
              <button type="button" className="btn btn--accent" onClick={() => open({ kind: 'invite' })}>
                <UserPlus className="ico" />
                Хэрэглэгч нэмэх
              </button>
            )}
          </>
        }
      />
      <div className="tgrid" ref={grid}>
        {shown.map(p => <MemberCard key={p.id} person={p} me={p.id === s.me} />)}
      </div>
    </div>
  )
}

function MemberCard({ person: p, me }: { person: Person; me: boolean }) {
  const s = useApp()
  const load = workload(p, scoped(s).tasks)
  const where = localTime(p)
  const profile = () => open({ kind: 'person', id: p.id })
  return (
    <article className={`mcard glass hue--${teamHue(p.team)}`} data-enter>
      <div className="mcard__top">
        <Avatar person={p} size="lg" presence />
        <div className="mcard__id">
          <h2 className="mcard__name">
            <button type="button" onClick={profile}>{short(p)}</button>
            {me && <span className="badge">Та</span>}
          </h2>
          <p>{p.role}</p>
        </div>
        <span className={`pchip hue--${teamHue(p.team)}`}><i aria-hidden="true" /><span>{p.team}</span></span>
      </div>
      <div className="mcard__info">
        <PresenceLabel presence={p.presence} />
        {where && (
          <>
            <span className="mcard__where" data-day={where.day}>
              {where.day ? <Sun className="ico" /> : <Moon className="ico" />}
              <b className="tnum">{where.time}</b>
              <span>{where.city}</span>
            </span>
            <span className="mcard__gap">{where.gap}</span>
          </>
        )}
      </div>
      <div className={`mload mload--${load.level}`}>
        <div className="mload__head">
          <span>Ачаалал{load.level === 'over' && <em>Хэтэрсэн</em>}</span>
          <b className="tnum">{load.hours}<small> / {load.capacity} цаг</small></b>
        </div>
        <div className="mload__bar" aria-hidden="true">
          <i style={{ transform: `scaleX(${Math.min(1, load.pct / 100)})` }} />
        </div>
      </div>
      <div className="mcard__foot">
        <span className="mcard__open"><SquareCheck className="ico" /><span className="tnum">{load.open}</span> дуусаагүй ажил</span>
        <button type="button" className="btn btn--glass btn--sm" onClick={profile}>Мэдээлэл харах</button>
      </div>
    </article>
  )
}
