import { Fragment, type ReactNode } from 'react'

/** Page title, split into letters for the entrance animation. Screen readers get the plain text. */
export function Title({ text }: { text: string }) {
  return (
    <h1 className="head__title" id="page-title" tabIndex={-1}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(' ').map((w, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            <span className="word">
              {[...w].map((c, j) => <span className="ch" key={j}>{c}</span>)}
            </span>
          </Fragment>
        ))}
      </span>
    </h1>
  )
}

export interface StatItem {
  label: string
  value: number | string
  /** Small text after the value, e.g. "/ 8" or "цаг" */
  unit?: string
  /** Shows the value in red (e.g. overdue work) */
  alert?: boolean
  /** Change against the previous period, e.g. "+25%"; `good` colours it green or red */
  delta?: { text: string; good: boolean | null }
}

export function PageHead({ title, sub, stats, actions, lead }: { title: string; sub?: ReactNode; stats?: StatItem[]; actions?: ReactNode; lead?: ReactNode }) {
  return (
    <header className="head">
      <div className="head__lead">
        {lead}
        <div className="head__text">
          <Title text={title} />
          {sub && <p className="head__sub">{sub}</p>}
        </div>
      </div>
      {stats && (
        <dl className="head__stats">
          {stats.map(s => (
            <div className={`stat${s.alert ? ' is-alert' : ''}`} key={s.label}>
              <dt className="stat__label">{s.label}</dt>
              <dd className="stat__value">
                <span data-count={typeof s.value === 'number' ? s.value : undefined}>{s.value}</span>
                {s.unit && <small>{s.unit}</small>}
                {s.delta && (
                  <span className={`delta delta--${s.delta.good === null ? 'plain' : s.delta.good ? 'up' : 'down'}`}>
                    {s.delta.text}<span className="sr-only"> өмнөх үеэс</span>
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className="head__actions">{actions}</div>}
    </header>
  )
}
