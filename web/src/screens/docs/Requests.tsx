// Requests for documents: my own, and for those who keep the office (Бичиг хэрэг хөтлөх), those that came to it.
import { useRef, useState } from 'react'
import { FileDown, Inbox, Printer, Send } from 'lucide-react'
import type { DocRequest } from '../../lib/types'
import { scoped, useApp } from '../../lib/store'
import { open } from '../../lib/ui'
import { usePageEnter } from '../../lib/motion'
import { isOpen } from '../../lib/docs'
import { docView } from '../../lib/access'
import { daysFromToday, dueLabel, short } from '../../lib/format'
import { PageHead } from '../../ui/PageHead'
import { Seg } from '../../ui/Seg'
import { Avatar, Empty } from '../../ui/bits'
import { DocsNav, ReqPill, Steps } from '../Docs'

type Tab = 'mine' | 'office'

export default function Requests() {
  const s = useApp()
  const sc = scoped(s)
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const keeps = docView(s).edit(s.company)
  const [pick, setTab] = useState<Tab>('mine')
  const tab = keeps ? pick : 'mine'
  const all = s.requests.filter(r => r.company === s.company)
  const newest = (a: DocRequest, b: DocRequest) => b.steps[0].at.localeCompare(a.steps[0].at)
  const mine = all.filter(r => r.by === s.me).sort(newest)
  // The office sees open requests first, the most urgent on top
  const office = [...all].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || (isOpen(a) ? a.need.localeCompare(b.need) : newest(a, b)))
  const waiting = all.filter(r => r.status === 'sent').length
  const list = tab === 'mine' ? mine : office

  return (
    <div ref={ref}>
      <DocsNav at="requests" />
      <PageHead
        title="Хүсэлт"
        sub="Бичиг хэргээс бичиг баримт хүсэх, хүсэлтийнхээ явцыг харах."
        actions={<button type="button" className="btn btn--accent" onClick={() => open({ kind: 'docRequest' })}><Send className="ico" />Бичиг баримт хүсэх</button>}
      />
      {keeps && (
        <div className="rtabs" data-enter>
          <Seg label="Хүсэлт" value={tab} onChange={setTab} options={[
            { value: 'mine', label: 'Миний хүсэлт' },
            { value: 'office', label: <>Ирсэн хүсэлт{waiting > 0 && <><span className="rtabs__count" aria-hidden="true">{waiting}</span><span className="sr-only">({waiting} шинэ)</span></>}</> },
          ]} />
        </div>
      )}
      <section className="card glass rlist" aria-label={tab === 'mine' ? 'Миний хүсэлт' : 'Ирсэн хүсэлт'} data-enter>
        {list.length ? (
          <ul>
            {list.map(r => {
              const who = sc.person(r.by)
              const late = isOpen(r) && daysFromToday(r.need) < 0
              return (
                <li key={r.id}>
                  <button type="button" className="rrow" onClick={() => open({ kind: 'request', id: r.id, office: tab === 'office' })}>
                    {tab === 'office' && who ? <Avatar person={who} size="md" /> : (
                      <span className="rrow__ico" aria-hidden="true">{r.paper ? <Printer className="ico" /> : <FileDown className="ico" />}</span>
                    )}
                    <span className="rrow__text">
                      <b>{tab === 'office' && who ? short(who) : r.what}</b>
                      <small>{tab === 'office' ? `${r.what}, ${r.purpose}` : r.purpose}</small>
                    </span>
                    <span className="rrow__form">{r.paper ? `Цаасаар, ${r.copies} хувь` : 'Цахимаар'}</span>
                    <span className={`rrow__need tnum${late ? ' is-late' : ''}`}>{late ? 'Хугацаа хэтэрсэн' : isOpen(r) ? dueLabel(r.need) : ''}</span>
                    <span className="rrow__state"><Steps r={r} /><ReqPill r={r} /></span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : tab === 'mine' ? (
          <Empty icon={<Send className="ico" />} title="Хүсэлт алга" text="Ажлын газрын тодорхойлолт гэх мэт бичиг баримтаа бичиг хэргээс хүсэж болно." />
        ) : (
          <Empty icon={<Inbox className="ico" />} title="Ирсэн хүсэлт алга" />
        )}
      </section>
    </div>
  )
}
