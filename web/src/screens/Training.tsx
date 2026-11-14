// Сургалт: what the ХХК's people learn from. «Материал» holds the lessons its people add (a text with pictures, videos
// and files); «ERP заавар» lists the guided tours that teach the ERP on its real screens (lib/tours.ts, shell/Tour.tsx).
// The user's request, docs/decisions.md, 2026-11-14.
import { useRef, useState } from 'react'
import { Check, ChevronLeft, Download, FileText, GraduationCap, Image, Info, ListChecks, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import '../styles/screens/training.css'
import type { BoardFile, Lesson } from '../lib/types'
import { actions, useApp } from '../lib/store'
import { go } from '../lib/router'
import { open, startTour, toast } from '../lib/ui'
import { usePageEnter } from '../lib/motion'
import { dateDots, short } from '../lib/format'
import { getFile, saveBlob, useFileUrl } from '../lib/files'
import { fileSize } from '../lib/draft'
import { LESSON_KIND, blocksOf, isImage, isVideo, kindOf, teaches, topicsOf, type LessonKind } from '../lib/training'
import { TOURS } from '../lib/tours'
import { PageHead } from '../ui/PageHead'
import { SubNav } from '../ui/SubNav'
import { Empty } from '../ui/bits'
import { Tool, Viewer } from '../dialogs/Viewer'

export default function Training({ id }: { id?: string }) {
  if (id === 'erp') return <Tours />
  if (id) return <LessonPage key={id} id={id} />
  return <Lessons />
}

const TABS = [['', 'Материал'], ['erp', 'ERP заавар']] as const
const TrainNav = ({ at }: { at: (typeof TABS)[number][0] }) => <SubNav label="Сургалт" base="training" tabs={TABS} at={at} />

const KIND_ICON: Record<LessonKind, typeof Play> = { video: Play, image: Image, file: FileText, text: ListChecks }
const KIND_HUE: Record<LessonKind, string> = { video: 'purple', image: 'teal', file: 'orange', text: 'blue' }
const MISSING = 'Файл олдсонгүй. Өөр төхөөрөмж эсвэл хөтөч дээр нэмсэн байж магадгүй.'

/** The ХХК's lessons, the latest first, with a filter by topic */
function Lessons() {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const all = s.lessons.filter(l => l.company === s.company)
  const topics = topicsOf(all)
  const [picked, setTopic] = useState<string | null>(null)
  // The topic's last lesson was removed: everything shows again
  const topic = picked && topics.includes(picked) ? picked : null
  const shown = topic ? all.filter(l => l.topic === topic) : all
  const can = teaches(s, s.me, s.company)
  const add = () => open({ kind: 'lessonForm' })

  return (
    <div ref={ref}>
      <TrainNav at="" />
      <PageHead
        title="Сургалт"
        sub="Ажлын заавар, зураг, бичлэгийг эндээс үзэж суралцана."
        actions={can && <button type="button" className="btn btn--accent" onClick={add}><Plus className="ico" />Материал нэмэх</button>}
      />
      {can && (
        <p className="sbar" data-enter>
          <Info className="ico" />
          <span>Туршилтын хувилбарт оруулсан материал зөвхөн энэ хөтөч дээр хадгалагдана. Сервертэй болоход бүх ажилтанд харагдана.</span>
        </p>
      )}
      {topics.length > 1 && (
        <div className="tr-topics" role="group" aria-label="Сэдвээр шүүх" data-enter>
          <button type="button" className="kchip" aria-pressed={!topic} onClick={() => setTopic(null)}>Бүгд<span className="kchip__n">{all.length}</span></button>
          {topics.map(t => (
            <button key={t} type="button" className="kchip" aria-pressed={topic === t} onClick={() => setTopic(t)}>
              {t}<span className="kchip__n">{all.filter(l => l.topic === t).length}</span>
            </button>
          ))}
        </div>
      )}
      {shown.length ? (
        <ul className="boards__grid tr-grid" data-enter>
          {shown.map(l => <LessonTile key={l.id} l={l} />)}
        </ul>
      ) : (
        <section className="card glass" data-enter>
          <Empty icon={<GraduationCap className="ico" />} title="Материал алга"
            text={can ? 'Ажилтнууддаа үзүүлэх заавар, зураг, бичлэгээ нэмнэ үү.' : 'Хүний нөөцийн ажилтан материал нэмэхэд энд харагдана.'}>
            {can && <button type="button" className="btn btn--glass" onClick={add}><Plus className="ico" />Материал нэмэх</button>}
          </Empty>
        </section>
      )}
    </div>
  )
}

function LessonTile({ l }: { l: Lesson }) {
  const kind = kindOf(l)
  const pic = l.files.find(isImage)
  const Icon = KIND_ICON[kind]
  return (
    <li className="btile">
      <a className="btile__link glass" href={`#training-${l.id}`}>
        {pic && kind === 'image' ? <PicThumb f={pic} /> : <span className={`tr-thumb hue--${KIND_HUE[kind]}`} aria-hidden="true"><Icon className="ico" /></span>}
        <span className="btile__name">{l.title}</span>
        <span className="btile__meta">{l.topic}, {LESSON_KIND[kind].toLowerCase()}</span>
      </a>
    </li>
  )
}

/** A lesson's first picture as its tile; the icon while it loads or when the file is not on this device */
function PicThumb({ f }: { f: BoardFile }) {
  const url = useFileUrl(f.id)
  return url
    ? <img className="tr-thumb tr-thumb--pic" src={url} alt="" draggable={false} />
    : <span className={`tr-thumb hue--${KIND_HUE.image}`} aria-hidden="true"><Image className="ico" /></span>
}

/** One lesson: its videos, its text, its pictures and its other files */
function LessonPage({ id }: { id: string }) {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const [view, setView] = useState<BoardFile | null>(null)
  const l = s.lessons.find(x => x.id === id && x.company === s.company)
  const back = (
    <a className="ibtn ibtn--glass head__back" href="#training" aria-label="Бүх материал руу буцах"><ChevronLeft className="ico" /></a>
  )
  if (!l) {
    return (
      <div ref={ref}>
        <PageHead title="Материал олдсонгүй" lead={back} />
        <section className="card glass" data-enter>
          <Empty icon={<GraduationCap className="ico" />} title="Энэ материал алга" text="Устгагдсан эсвэл өөр ХХК-ийнх байж магадгүй.">
            <a className="btn btn--glass" href="#training">Сургалт руу буцах</a>
          </Empty>
        </section>
      </div>
    )
  }
  const by = s.people.find(p => p.id === l.by)
  const videos = l.files.filter(isVideo)
  const pics = l.files.filter(isImage)
  const others = l.files.filter(f => !isVideo(f) && !isImage(f))
  const blocks = blocksOf(l.text)
  const can = teaches(s, s.me, l.company)
  const remove = () => {
    const undo = actions.removeLesson(l.id)
    if (!undo) return
    go('training')
    toast(`«${l.title}» материал устгагдлаа.`, { undo })
  }
  const save = (f: BoardFile) => getFile(f.id).then(b => (b ? saveBlob(f.name, b) : toast(MISSING, { kind: 'warn' })))

  return (
    <div ref={ref}>
      <PageHead
        title={l.title}
        sub={[l.topic, by && short(by), dateDots(new Date(l.added))].filter(Boolean).join(', ')}
        lead={back}
        actions={can && (
          <>
            <button type="button" className="btn btn--glass" onClick={() => open({ kind: 'lessonForm', id: l.id })}><Pencil className="ico" />Засах</button>
            <button type="button" className="btn btn--glass" onClick={remove}><Trash2 className="ico" />Устгах</button>
          </>
        )}
      />
      <div className="tr-lesson">
        {videos.map(f => <Video key={f.id} f={f} />)}
        {blocks.length > 0 && (
          <section className="card glass tr-text" aria-labelledby="trl-text" data-enter>
            <h2 className="card__title" id="trl-text">Заавар</h2>
            {blocks.map((b, i) => b.kind === 'p'
              ? <p key={i}>{b.lines[0]}</p>
              : b.kind === 'ol'
                ? <ol key={i}>{b.lines.map((x, j) => <li key={j}>{x}</li>)}</ol>
                : <ul key={i}>{b.lines.map((x, j) => <li key={j}>{x}</li>)}</ul>)}
          </section>
        )}
        {pics.length > 0 && (
          <section className="card glass" aria-labelledby="trl-pics" data-enter>
            <h2 className="card__title" id="trl-pics">Зураг</h2>
            <ul className="tr-pics">
              {pics.map(f => <li key={f.id}><Pic f={f} onOpen={() => setView(f)} /></li>)}
            </ul>
          </section>
        )}
        {others.length > 0 && (
          <section className="card glass" aria-labelledby="trl-files" data-enter>
            <h2 className="card__title" id="trl-files">Файл</h2>
            <ul className="tr-files">
              {others.map(f => (
                <li key={f.id}>
                  <button type="button" className="tr-file" onClick={() => setView(f)}>
                    <span className="lead"><FileText className="ico" /></span>
                    <span><b>{f.name}</b><small>{fileSize(f.size)}</small></span>
                  </button>
                  <button type="button" className="ibtn ibtn--sm" aria-label={`${f.name} татах`} title="Татах" onClick={() => save(f)}><Download className="ico" /></button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {view && (
        <Viewer name={view.name} sub={fileSize(view.size)} load={() => getFile(view.id)} onClose={() => setView(null)}
          tools={<Tool icon={Download} label="Татах" onClick={() => save(view)} />} />
      )}
    </div>
  )
}

/** Plays where it stands, from the file store */
function Video({ f }: { f: BoardFile }) {
  const url = useFileUrl(f.id)
  return (
    <figure className="card glass tr-video" data-enter>
      {url
        ? <video controls preload="metadata" playsInline src={url} aria-label={f.name} />
        : <p className="tr-wait" role="status">{url === undefined ? 'Нээж байна…' : MISSING}</p>}
      <figcaption>{f.name}, {fileSize(f.size)}</figcaption>
    </figure>
  )
}

function Pic({ f, onOpen }: { f: BoardFile; onOpen: () => void }) {
  const url = useFileUrl(f.id)
  if (!url) return <p className="tr-wait" role="status">{url === undefined ? 'Нээж байна…' : `${f.name}: ${MISSING}`}</p>
  return (
    <button type="button" className="tr-pic" onClick={onOpen} aria-label={`${f.name}: томруулж харах`}>
      <img src={url} alt="" loading="lazy" draggable={false} />
    </button>
  )
}

/** The guided tours within the person's rights, by section; one press starts a tour on the real screens */
function Tours() {
  const s = useApp()
  const ref = useRef<HTMLDivElement>(null)
  usePageEnter(ref)
  const done = s.toursDone[s.me] ?? []
  const mine = TOURS.filter(t => !t.can || t.can(s))
  const groups = [...new Set(mine.map(t => t.group))]
  return (
    <div ref={ref}>
      <TrainNav at="erp" />
      <PageHead
        title="ERP заавар"
        sub="Системийг жинхэнэ дэлгэц дээр нь алхам алхмаар заана. Хүссэн үедээ «Алгасах» товчийг дарж гарна."
        stats={[{ label: 'Үзсэн заавар', value: mine.filter(t => done.includes(t.id)).length, unit: `/ ${mine.length}` }]}
      />
      {groups.map((g, i) => (
        <section className="boards" key={g} aria-labelledby={`trg-${i}`} data-enter>
          <h2 className="boards__h" id={`trg-${i}`}>{g}</h2>
          <ul className="tr-tours">
            {mine.filter(t => t.group === g).map(t => (
              <li key={t.id}>
                <button type="button" className="tr-tour glass" data-tour-start={t.id} onClick={() => startTour(t.id)}>
                  <span className="lead"><t.icon className="ico" /></span>
                  <span className="tr-tour__text"><b>{t.title}</b><small>{t.sub}</small></span>
                  <span className={`tr-tour__meta${done.includes(t.id) ? ' is-done' : ''}`}>
                    {done.includes(t.id) ? <><Check className="ico" />Үзсэн</> : `${t.steps.length} алхам`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
