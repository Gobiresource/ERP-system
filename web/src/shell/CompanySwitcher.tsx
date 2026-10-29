// ХХК солих. Always shows the current company: side menu on computers, toolbar on tablets and phones.
import { ChevronsUpDown } from 'lucide-react'
import type { Company } from '../lib/types'
import { actions, useApp } from '../lib/store'
import { go, parse } from '../lib/router'
import { toast } from '../lib/ui'
import { Menu, MenuItem, usePopover } from '../ui/Popover'

/** ГР for "Говь Ресурс ХХК" */
const mark = (c: Company) => c.name.replace(/\s*ХХК$/, '').split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('')

export function CompanyMark({ company }: { company: Company }) {
  return <span className={`brand__mark hue--${company.hue}`} aria-hidden="true">{mark(company)}</span>
}

export function CompanySwitcher({ variant }: { variant: 'brand' | 'pill' }) {
  const s = useApp()
  const pop = usePopover()
  const current = s.companies.find(c => c.id === s.company)!
  const mine = s.companies.filter(c => s.people.find(p => p.id === s.me)?.companies.includes(c.id))

  const choose = (c: Company) => {
    pop.close()
    if (c.id === s.company) return
    actions.switchCompany(c.id)
    // A project or employee page belongs to one company, so go back to its list
    const r = parse(location.hash)
    if (r.page === 'projects' && r.id) go('projects')
    else if (r.page === 'hr' && r.id && r.id !== 'employees' && r.id !== 'structure') go('hr', 'employees')
    toast(`Компани солигдлоо: ${c.name}.`, { kind: 'info' })
  }

  return (
    <>
      <button
        ref={pop.anchor}
        type="button"
        className={variant === 'brand' ? 'brand' : 'company-pill glass'}
        aria-haspopup="menu"
        aria-expanded={pop.open}
        onClick={pop.toggle}
        title={`ХХК солих. Одоо: ${current.name}`}
      >
        <CompanyMark company={current} />
        {variant === 'brand' ? (
          <span className="brand__text">
            <span className="brand__name">{current.name}</span>
            <span className="brand__hint">Компани солих</span>
          </span>
        ) : (
          <span>{current.name}</span>
        )}
        <ChevronsUpDown className="ico" />
      </button>
      <Menu state={pop} label="ХХК сонгох" placement="bottom-start">
        <p className="menu__label" aria-hidden="true">Таны ажилладаг компаниуд</p>
        {mine.map(c => (
          <MenuItem key={c.id} checked={c.id === s.company} onSelect={() => choose(c)}>
            <span className="row"><CompanyMark company={c} />{c.name}</span>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
