// Structure and headcount: departments, their positions, how many places each has and how many are taken
import { useRef } from 'react'
import { Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Department } from '../../lib/types'
import { actions, useApp } from '../../lib/store'
import { open, toast } from '../../lib/ui'
import { usePageEnter } from '../../lib/motion'
import { current } from '../../lib/hr'
import { hrView } from '../../lib/access'
import { short } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Menu, MenuItem, usePopover } from '../../ui/Popover'
import { Ring } from '../../ui/charts'
import { HrNav } from '../Hr'

export default function Structure() {
  const hr = hrView(useApp())
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const quota = hr.positions.reduce((n, p) => n + p.quota, 0)
  const filled = hr.positions.reduce((n, p) => n + Math.min(p.quota, hr.filled.get(p.id) ?? 0), 0)

  return (
    <div ref={ref}>
      <HrNav at="structure" />
      <PageHead
        title="Бүтэц, орон тоо"
        sub={`${hr.departments.length} хэлтэс, ${hr.positions.length} албан тушаал байна.`}
        stats={[
          { label: 'Орон тоо', value: quota },
          { label: 'Бүрдсэн', value: filled },
          { label: 'Сул', value: quota - filled },
          { label: 'Бүрдэлт', value: quota ? Math.round((100 * filled) / quota) : 0, unit: '%' },
        ]}
        actions={hr.access.hrEdit && <button type="button" className="btn btn--accent" onClick={() => open({ kind: 'dept' })}><Plus className="ico" />Хэлтэс нэмэх</button>}
      />
      <div className="dgrid">
        {hr.departments.map(d => <DeptCard key={d.id} d={d} />)}
      </div>
    </div>
  )
}

function DeptCard({ d }: { d: Department }) {
  const hr = hrView(useApp())
  const pop = usePopover()
  const list = hr.positions.filter(p => p.dept === d.id)
  const q = list.reduce((n, p) => n + p.quota, 0)
  const f = list.reduce((n, p) => n + Math.min(p.quota, hr.filled.get(p.id) ?? 0), 0)
  const people = list.reduce((n, p) => n + (hr.filled.get(p.id) ?? 0), 0)
  const head = hr.employees.find(e => e.id === d.head && current(e))
  const edit = hr.access.hrEdit
  const remove = () => {
    pop.close()
    toast(`${d.name} хэлтэс устгагдлаа.`, { undo: actions.removeDept(d.id) })
  }

  return (
    <section className="card glass dcard" aria-labelledby={`dc-${d.id}`} data-enter>
      <div className="card__head">
        <div className="dcard__id">
          <Ring value={q ? f / q : 0} size={44} width={6}><b className="tnum">{f}</b></Ring>
          <div>
            <h2 className="card__title" id={`dc-${d.id}`}>{d.name} <span className="badge">{d.code}</span></h2>
            <p className="card__sub">{q} орон тооноос {f} нь бүрдсэн</p>
            <p className="dcard__boss">Хэлтсийн дарга: {head ? <b>{short(head)}</b> : 'сонгоогүй'}</p>
          </div>
        </div>
        {edit && (
          <button ref={pop.anchor} type="button" className="ibtn ibtn--sm" aria-label={`${d.name}: үйлдэл`} aria-haspopup="menu" aria-expanded={pop.open} onClick={pop.toggle}>
            <Ellipsis className="ico" />
          </button>
        )}
        <Menu state={pop} label="Хэлтсийн үйлдэл">
          <MenuItem icon={<Pencil className="ico" />} onSelect={() => { pop.close(); open({ kind: 'dept', id: d.id }) }}>Хэлтэс засах</MenuItem>
          <MenuItem danger icon={<Trash2 className="ico" />} onSelect={remove} disabled={people > 0 ? 'Энэ хэлтэст ажилтан байгаа тул устгах боломжгүй.' : undefined}>Хэлтэс устгах</MenuItem>
        </Menu>
      </div>
      {list.length === 0 ? (
        <p className="muted dcard__none">Албан тушаал алга.</p>
      ) : (
        <table className="ptable">
          <caption className="sr-only">{d.name}: албан тушаал, орон тоо</caption>
          <thead>
            <tr>
              <th scope="col">Албан тушаал</th>
              <th scope="col" className="num">Орон тоо</th>
              <th scope="col" className="num">Бүрдсэн</th>
              <th scope="col" className="num">Сул</th>
              <th scope="col"><span className="sr-only">Засах</span></th>
            </tr>
          </thead>
          <tbody>
            {list.map(p => {
              const n = hr.filled.get(p.id) ?? 0
              const free = p.quota - n
              return (
                <tr key={p.id}>
                  <th scope="row">{p.name}</th>
                  <td className="num tnum">{p.quota}</td>
                  <td className="num tnum">{n}</td>
                  <td className="num tnum">{free > 0 ? <span className="ptable__free">{free}</span> : free < 0 ? <span className="ptable__over" title="Орон тооноос хэтэрсэн">+{-free}</span> : <span className="muted">0</span>}</td>
                  <td className="ptable__act">
                    {edit && <button type="button" className="ibtn ibtn--sm" aria-label={`${p.name}: засах`} onClick={() => open({ kind: 'position', id: p.id })}><Pencil className="ico" /></button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {edit && (
        <button type="button" className="btn btn--ghost btn--sm dcard__add" onClick={() => open({ kind: 'position', dept: d.id })}>
          <Plus className="ico" />Албан тушаал нэмэх
        </button>
      )}
    </section>
  )
}
