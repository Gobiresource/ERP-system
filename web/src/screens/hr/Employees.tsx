// Employee list: search, status and department filters, sortable columns, Excel export. A row opens the employee.
import { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, CircleDot, Download, Network, Search, UserPlus, X } from 'lucide-react'
import type { EmpStatus, Employee } from '../../lib/types'
import { useApp } from '../../lib/store'
import { go } from '../../lib/router'
import { usePageEnter } from '../../lib/motion'
import { ALERT_DAYS, CONTRACT, EMP_STATUS, EMP_STATUSES, current, dots, fileScore, fullName } from '../../lib/hr'
import { hrView } from '../../lib/access'
import { collator, daysFromToday, short } from '../../lib/format'
import { downloadCsv } from '../../lib/insights'
import { PageHead } from '../../ui/PageHead'
import { Empty } from '../../ui/bits'
import { Menu, MenuItem, usePopover } from '../../ui/Popover'
import { EmpAvatar, EmpStatusPill, HrNav } from '../Hr'

type StatusFilter = 'current' | 'all' | EmpStatus
type SortKey = 'name' | 'hired' | 'contract' | 'files'
const STATUS_LABEL = (f: StatusFilter) => (f === 'current' ? 'Одоо ажиллаж буй' : f === 'all' ? 'Бүх төлөв' : EMP_STATUS[f])

export default function Employees() {
  const s = useApp()
  const hr = hrView(s)
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('current')
  const [dept, setDept] = useState('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 })
  const statusPop = usePopover()
  const deptPop = usePopover()

  const score = useMemo(() => new Map(hr.employees.map(e => [e.id, fileScore(e, hr.docTypes)])), [hr])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/\s+/g, '')
    const list = hr.employees.filter(e =>
      (status === 'all' || (status === 'current' ? current(e) : e.status === status)) &&
      (dept === 'all' || e.dept === dept) &&
      (!t || [e.given, e.family, fullName(e), e.code, e.regNo, e.phone].some(x => x.toLowerCase().replace(/\s+/g, '').includes(t))))
    const val = (e: Employee) => {
      if (sort.key === 'hired') return e.hired
      if (sort.key === 'contract') return e.contract.end ?? '9999'
      if (sort.key === 'files') { const f = score.get(e.id)!; return f.done / Math.max(1, f.total) }
      return ''
    }
    return list.sort((a, b) => {
      const x = val(a)
      const y = val(b)
      const c = sort.key === 'name' ? collator.compare(a.given, b.given) : typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y))
      return c * sort.dir
    })
  }, [hr, q, status, dept, sort, score])

  const filtered = q !== '' || status !== 'current' || dept !== 'all'
  const clear = () => { setQ(''); setStatus('current'); setDept('all') }
  const staff = hr.employees.filter(current).length

  const exportCsv = () => downloadCsv('ajiltan.csv', [
    ['Код', 'Ургийн овог', 'Эцэг/эхийн нэр', 'Нэр', 'Регистрийн дугаар', 'Хэлтэс', 'Албан тушаал', 'Төлөв', 'Ажилд орсон', 'Гэрээ', 'Гэрээ дуусах', 'Утас', 'Имэйл', 'Хувийн хэрэг'],
    ...shown.map(e => {
      const f = score.get(e.id)!
      return [e.code, e.clan ?? '', e.family, e.given, e.regNo, hr.dept(e.dept)?.name ?? '', hr.position(e.position)?.name ?? '', EMP_STATUS[e.status],
        dots(e.hired), CONTRACT[e.contract.kind], e.contract.end ? dots(e.contract.end) : '', e.phone, e.email ?? '', `${f.done}/${f.total}`]
    }),
  ])

  const head = (key: SortKey, label: string, className = '') => (
    <th scope="col" className={className} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="etable__sort" onClick={() => setSort(sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: 1 })}>
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="ico" /> : <ArrowDown className="ico" />)}
      </button>
    </th>
  )

  return (
    <div ref={ref}>
      <HrNav at="employees" />
      <PageHead
        title="Ажилтан"
        sub={hr.access.hr === 'all' ? `Энэ компанид ${staff} ажилтан ажиллаж байна.` : `Таны хариуцсан ${staff} ажилтан.`}
        actions={
          <>
            <button type="button" className="btn btn--glass" onClick={exportCsv}><Download className="ico" />Excel-ээр татах</button>
            {hr.access.hrEdit && <a className="btn btn--accent" href="#hr-new"><UserPlus className="ico" />Ажилтан нэмэх</a>}
          </>
        }
      />

      <div className="tk-bar glass" role="search" aria-label="Ажилтан шүүх" data-enter>
        <div className="tk-bar__chips">
          <button ref={statusPop.anchor} type="button" className={`tk-chip${status !== 'current' ? ' is-on' : ''}`} aria-haspopup="menu" aria-expanded={statusPop.open} onClick={statusPop.toggle}>
            <CircleDot className="ico" />
            {STATUS_LABEL(status)}
            <ChevronDown className="ico caret" />
          </button>
          <button ref={deptPop.anchor} type="button" className={`tk-chip${dept !== 'all' ? ' is-on' : ''}`} aria-haspopup="menu" aria-expanded={deptPop.open} onClick={deptPop.toggle}>
            <Network className="ico" />
            <span className="tk-chip__label">{dept === 'all' ? 'Бүх хэлтэс' : hr.dept(dept)?.name}</span>
            <ChevronDown className="ico caret" />
          </button>
        </div>
        <label className="tk-find">
          <Search className="ico" />
          <span className="sr-only">Нэр, код, РД, утсаар хайх</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Нэр, код, РД, утсаар хайх" />
        </label>
        {filtered && (
          <button type="button" className="btn btn--glass btn--sm" onClick={clear}><X className="ico" />Шүүлтүүр арилгах</button>
        )}
      </div>

      <Menu state={statusPop} label="Төлвөөр шүүх" placement="bottom-start">
        {(['current', ...EMP_STATUSES, 'all'] as StatusFilter[]).map(f => (
          <MenuItem key={f} checked={status === f} onSelect={() => { statusPop.close(); setStatus(f) }}>
            <span className="row" style={{ gap: 10 }}>
              {STATUS_LABEL(f)}
              <small className="muted tnum">{hr.employees.filter(e => (f === 'all' ? true : f === 'current' ? current(e) : e.status === f)).length}</small>
            </span>
          </MenuItem>
        ))}
      </Menu>
      <Menu state={deptPop} label="Хэлтсээр шүүх" placement="bottom-start">
        <MenuItem checked={dept === 'all'} onSelect={() => { deptPop.close(); setDept('all') }}>Бүх хэлтэс</MenuItem>
        {hr.departments.map(d => (
          <MenuItem key={d.id} checked={dept === d.id} onSelect={() => { deptPop.close(); setDept(d.id) }}>{d.name}</MenuItem>
        ))}
      </Menu>

      {hr.employees.length === 0 ? (
        <div className="card glass">
          <Empty title="Бүртгэлтэй ажилтан алга" text="Ажилтан бүрийн хувийн мэдээлэл, албан тушаал, гэрээ нэг дор хадгалагдана.">
            {hr.access.hrEdit && <a className="btn btn--accent" href="#hr-new"><UserPlus className="ico" />Ажилтан нэмэх</a>}
          </Empty>
        </div>
      ) : shown.length === 0 ? (
        <div className="card glass">
          <Empty icon={<Search className="ico" />} title="Тохирох ажилтан олдсонгүй" text="Шүүлтүүр эсвэл хайлтаа өөрчилнө үү.">
            <button type="button" className="btn btn--glass" onClick={clear}>Шүүлтүүр арилгах</button>
          </Empty>
        </div>
      ) : (
        <section className="card glass etable-card" aria-labelledby="et-t" data-enter>
          <div className="card__head">
            <div>
              <h2 className="card__title" id="et-t">Жагсаалт</h2>
              <p className="card__sub">{shown.length} ажилтан</p>
            </div>
          </div>
          <div className="etable-wrap">
            <table className="etable">
              <caption className="sr-only">Ажилтны жагсаалт. Баганын нэр дээр дарж эрэмбэлнэ.</caption>
              <thead>
                <tr>
                  {head('name', 'Ажилтан')}
                  <th scope="col" className="hide-md">Хэлтэс</th>
                  <th scope="col" className="hide-sm">Албан тушаал</th>
                  <th scope="col">Төлөв</th>
                  {head('hired', 'Ажилд орсон', 'num hide-md')}
                  {head('contract', 'Гэрээ дуусах', 'num hide-md')}
                  {head('files', 'Хувийн хэрэг', 'num')}
                </tr>
              </thead>
              <tbody>
                {shown.map(e => {
                  const f = score.get(e.id)!
                  const end = e.contract.end ? daysFromToday(e.contract.end) : null
                  const pos = hr.position(e.position)?.name
                  return (
                    <tr key={e.id} onClick={ev => { if (!(ev.target as HTMLElement).closest('a')) go('hr', e.id) }}>
                      <th scope="row">
                        <span className="etable__who">
                          <EmpAvatar e={e} size="sm" />
                          <span>
                            <a href={`#hr-${e.id}`}>{short(e)}</a>
                            <small>{e.code}<span className="show-sm">, {pos}</span></small>
                          </span>
                        </span>
                      </th>
                      <td className="hide-md">{hr.dept(e.dept)?.name}</td>
                      <td className="hide-sm">{pos}</td>
                      <td><EmpStatusPill status={e.status} /></td>
                      <td className="num tnum hide-md">{dots(e.hired)}</td>
                      <td className={`num tnum hide-md${end !== null && end <= ALERT_DAYS && current(e) ? ' is-warn' : ''}`}>
                        {e.contract.end ? dots(e.contract.end) : <span className="muted">{CONTRACT.open}</span>}
                      </td>
                      <td className="num">
                        <span className={`efiles${f.done < f.total ? ' is-short' : ''}`}>
                          <span className="tnum">{f.done}/{f.total}</span>
                          <span className="efiles__bar" aria-hidden="true"><i style={{ transform: `scaleX(${f.done / Math.max(1, f.total)})` }} /></span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
