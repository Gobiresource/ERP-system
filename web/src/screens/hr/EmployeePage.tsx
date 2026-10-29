// One employee: general details, employment history and the personal file
import { useRef, useState } from 'react'
import { ChevronLeft, CircleDashed, FileCheck2, FileClock, FileX2, Pencil, TriangleAlert, Upload, UserRound, X } from 'lucide-react'
import type { DocType, Employee } from '../../lib/types'
import { actions, useApp } from '../../lib/store'
import { open, toast } from '../../lib/ui'
import { usePageEnter } from '../../lib/motion'
import { ALERT_DAYS, CONTRACT, EMP_STATUS, MOVE, MOVE_HUE, ageOn, alertsOf, dots, fileScore, fileState, hrScoped, readRegNo, tenure, whenEnds, type FileState } from '../../lib/hr'
import { addDays, daysFromToday, short, today, ymd } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Seg } from '../../ui/Seg'
import { Empty } from '../../ui/bits'
import { EmpAvatar, EmpStatusPill } from '../Hr'

type Tab = 'general' | 'history' | 'file'

export default function EmployeePage({ id }: { id: string }) {
  const s = useApp()
  const hr = hrScoped(s)
  const e = hr.employee(id)
  const ref = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>('general')
  usePageEnter(ref)

  if (!e) {
    return (
      <div ref={ref}>
        <PageHead title="Ажилтан олдсонгүй" />
        <div className="card glass">
          <Empty icon={<UserRound className="ico" />} title="Энэ компанид уг ажилтан алга" text="Өөр компани сонгосон эсвэл бүртгэл устсан байж магадгүй.">
            <a className="btn btn--glass" href="#hr-employees">Бүх ажилтан</a>
          </Empty>
        </div>
      </div>
    )
  }

  const pos = hr.position(e.position)
  const dept = hr.dept(e.dept)
  const f = fileScore(e, hr.docTypes)
  const end = e.contract.end ? daysFromToday(e.contract.end) : null
  const alerts = alertsOf([e], hr.docTypes)
  const user = s.people.find(p => p.id === e.user)

  return (
    <div ref={ref}>
      <div className="emp-head">
        <PageHead
          title={short(e)}
          sub={[pos?.name, dept?.name].filter(Boolean).join(', ')}
          lead={
            <>
              <a className="ibtn ibtn--glass head__back" href="#hr-employees" aria-label="Бүх ажилтан руу буцах"><ChevronLeft className="ico" /></a>
              <span className="head__icon"><EmpAvatar e={e} size="xl" /></span>
            </>
          }
          stats={[
            { label: 'Ажилласан', value: tenure(e.hired) },
            { label: 'Хувийн хэрэг', value: f.done, unit: `/ ${f.total}` },
            e.contract.end
              ? { label: 'Гэрээ дуусах', value: dots(e.contract.end), alert: end !== null && end <= ALERT_DAYS && e.status !== 'left' }
              : { label: 'Хөдөлмөрийн гэрээ', value: CONTRACT.open },
          ]}
          actions={<a className="btn btn--glass" href={`#hr-${e.id}-edit`}><Pencil className="ico" />Засах</a>}
        />
      </div>

      <div className="emp-strip" data-enter>
        <EmpStatusPill status={e.status} />
        <span className="badge tnum">{e.code}</span>
        {user && (
          <button type="button" className="emp-user" onClick={() => open({ kind: 'person', id: user.id })}>
            Системийн хэрэглэгч
          </button>
        )}
      </div>

      {alerts.length > 0 && e.status !== 'left' && (
        <div className="emp-alerts" role="note" data-enter>
          {alerts.map(a => (
            <p key={`${a.kind}-${a.what}`} className={a.days < 0 ? 'is-late' : undefined}>
              <TriangleAlert className="ico" />
              <span><b>{a.what}</b> {whenEnds(a.days).toLowerCase()} ({dots(a.date)})</span>
            </p>
          ))}
        </div>
      )}

      <div className="emp-tabs" data-enter>
        <Seg label="Ажилтны мэдээлэл" value={tab} onChange={setTab}
          options={[{ value: 'general', label: 'Ерөнхий' }, { value: 'history', label: 'Түүх' }, { value: 'file', label: `Хувийн хэрэг ${f.done}/${f.total}` }]} />
      </div>

      {tab === 'general' && <General e={e} />}
      {tab === 'history' && <History e={e} />}
      {tab === 'file' && <PersonalFile e={e} types={hr.docTypes} />}
    </div>
  )
}

function Tile({ label, children, wide }: { label: string; children?: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'is-wide' : undefined}>
      <dt>{label}</dt>
      <dd>{children || <span className="muted">Бөглөөгүй</span>}</dd>
    </div>
  )
}

function General({ e }: { e: Employee }) {
  const hr = hrScoped(useApp())
  const reg = readRegNo(e.regNo)
  const prob = e.probationEnd ? daysFromToday(e.probationEnd) : null
  return (
    <div className="emp-grid">
      <section className="card glass" aria-labelledby="eg-p" data-enter>
        <div className="card__head"><h2 className="card__title" id="eg-p">Хувийн мэдээлэл</h2></div>
        <dl className="meta">
          <Tile label="Ургийн овог">{e.clan}</Tile>
          <Tile label="Эцэг/эхийн нэр">{e.family}</Tile>
          <Tile label="Нэр">{e.given}</Tile>
          <Tile label="Регистрийн дугаар"><span className="tnum">{e.regNo}</span></Tile>
          <Tile label="Төрсөн огноо">{reg && <span className="tnum">{dots(ymd(reg.birth))}</span>}</Tile>
          <Tile label="Нас, хүйс">{reg && `${ageOn(reg.birth)} нас, ${reg.male ? 'эрэгтэй' : 'эмэгтэй'}`}</Tile>
          <Tile label="Утас"><span className="tnum">{e.phone}</span></Tile>
          <Tile label="Имэйл">{e.email}</Tile>
          <Tile label="Хаяг" wide>{e.address}</Tile>
          <Tile label="Боловсрол">{e.education}</Tile>
          <Tile label="Мэргэжил">{e.profession}</Tile>
        </dl>
      </section>
      <div className="emp-col">
        <section className="card glass" aria-labelledby="eg-w" data-enter>
          <div className="card__head"><h2 className="card__title" id="eg-w">Ажлын мэдээлэл</h2></div>
          <dl className="meta">
            <Tile label="Ажилтны код"><span className="tnum">{e.code}</span></Tile>
            <Tile label="Төлөв">{EMP_STATUS[e.status]}</Tile>
            <Tile label="Хэлтэс">{hr.dept(e.dept)?.name}</Tile>
            <Tile label="Албан тушаал">{hr.position(e.position)?.name}</Tile>
            <Tile label="Ажилд орсон огноо"><span className="tnum">{dots(e.hired)}</span></Tile>
            <Tile label="Туршилтын хугацаа">
              {e.probationEnd ? <span className="tnum">{dots(e.probationEnd)}{prob !== null && prob >= 0 ? ` хүртэл` : ''}</span> : e.moves.some(m => m.kind === 'confirmed') ? 'Дууссан' : e.status === 'probation' ? null : 'Туршилтгүй'}
            </Tile>
          </dl>
        </section>
        <section className="card glass" aria-labelledby="eg-c" data-enter>
          <div className="card__head"><h2 className="card__title" id="eg-c">Хөдөлмөрийн гэрээ</h2></div>
          <dl className="meta">
            <Tile label="Төрөл">{CONTRACT[e.contract.kind]}</Tile>
            <Tile label="Дугаар"><span className="tnum">{e.contract.no}</span></Tile>
            <Tile label="Эхэлсэн огноо"><span className="tnum">{dots(e.contract.start)}</span></Tile>
            <Tile label="Дуусах огноо">{e.contract.end ? <span className="tnum">{dots(e.contract.end)}</span> : CONTRACT.open}</Tile>
          </dl>
        </section>
        <section className="card glass" aria-labelledby="eg-e" data-enter>
          <div className="card__head"><h2 className="card__title" id="eg-e">Яаралтай үед холбоо барих хүн</h2></div>
          {e.contact ? (
            <dl className="meta">
              <Tile label="Нэр">{e.contact.name}</Tile>
              <Tile label="Хамаарал">{e.contact.relation}</Tile>
              <Tile label="Утас" wide><span className="tnum">{e.contact.phone}</span></Tile>
            </dl>
          ) : <p className="muted">Бөглөөгүй</p>}
        </section>
      </div>
    </div>
  )
}

function History({ e }: { e: Employee }) {
  return (
    <section className="card glass" aria-labelledby="eh-t" data-enter>
      <div className="card__head"><h2 className="card__title" id="eh-t">Ажлын түүх</h2></div>
      <ol className="etime">
        {e.moves.map(m => (
          <li key={m.id} className={`hue--${MOVE_HUE[m.kind]}`}>
            <span className="etime__date tnum">{dots(m.date)}</span>
            <span className="etime__dot" aria-hidden="true" />
            <div className="etime__body">
              <p><b>{MOVE[m.kind]}</b>{m.order && <span className="badge tnum">Тушаал {m.order}</span>}</p>
              {m.note && <p className="etime__note">{m.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

const FILE_ICON: Record<FileState, typeof FileCheck2> = { ok: FileCheck2, soon: FileClock, expired: FileX2, missing: CircleDashed }

function PersonalFile({ e, types }: { e: Employee; types: DocType[] }) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<DocType | null>(null)
  const f = fileScore(e, types)
  const sorted = [...types.filter(t => t.required), ...types.filter(t => !t.required)]

  const pick = (t: DocType) => {
    setPending(t)
    input.current?.click()
  }
  const chosen = (file?: File) => {
    if (!file || !pending) return
    const old = e.files.find(x => x.type === pending.id)
    actions.setFile(e.id, { type: pending.id, file: file.name, added: today(), expires: pending.expires ? (old?.expires && daysFromToday(old.expires) > ALERT_DAYS ? old.expires : ymd(addDays(new Date(), 365))) : undefined })
    toast('Файл нэмэгдлээ.')
    if (input.current) input.current.value = ''
  }

  return (
    <section className="card glass" aria-labelledby="ef-t" data-enter>
      <div className="card__head">
        <div>
          <h2 className="card__title" id="ef-t">Хувийн хэрэг</h2>
          <p className="card__sub">Заавал бүрдүүлэх {f.total} баримтаас {f.done} нь бүрдсэн. PDF, JPG, PNG файл, 20 MB хүртэл.</p>
        </div>
        <span className="efiles efiles--lg" aria-hidden="true"><span className="efiles__bar"><i style={{ transform: `scaleX(${f.done / Math.max(1, f.total)})` }} /></span></span>
      </div>
      <input ref={input} type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={ev => chosen(ev.target.files?.[0])} />
      <ul className="efile-list">
        {sorted.map(t => {
          const item = e.files.find(x => x.type === t.id)
          const st = fileState(item)
          const Icon = FILE_ICON[st.state]
          return (
            <li key={t.id} className={`efile is-${st.state}`}>
              <span className="efile__icon"><Icon className="ico" /></span>
              <span className="efile__main">
                <b>{t.name}{!t.required && <small> (заавал биш)</small>}</b>
                <small>
                  {!item ? 'Бүрдээгүй'
                    : st.state === 'ok' ? `${item.file}, ${dots(item.added)}`
                    : whenEnds(st.days!)}
                </small>
              </span>
              {t.expires && item && (
                <label className="efile__exp">
                  <span>Хүчинтэй хугацаа</span>
                  <input type="date" value={item.expires ?? ''} onChange={ev => ev.target.value && actions.setFile(e.id, { ...item, expires: ev.target.value })} />
                </label>
              )}
              <span className="efile__acts">
                <button type="button" className="btn btn--glass btn--sm" onClick={() => pick(t)}>
                  <Upload className="ico" />{item ? 'Солих' : 'Хавсаргах'}<span className="sr-only">: {t.name}</span>
                </button>
                {item ? (
                  <button type="button" className="ibtn ibtn--sm" aria-label={`${t.name}: хасах`}
                    onClick={() => toast(`${t.name} хасагдлаа.`, { undo: actions.removeFile(e.id, t.id) })}>
                    <X className="ico" />
                  </button>
                ) : <span className="ibtn ibtn--sm efile__nox" aria-hidden="true" />}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
