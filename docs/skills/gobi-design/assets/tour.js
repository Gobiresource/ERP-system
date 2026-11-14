// A guided tour over a real page: one element is lit, the rest of the screen goes dark, and a card beside the element
// says what it does. Алгасах or Esc ends the tour at any step. A step with `click: true` lets a press through to the
// lit element and goes on once the element has done its own work; any other step keeps hands off it, so nothing is
// saved by accident. Needs tokens.css and components.css (the .tour rules). No library.
//
//   startTour([
//     { at: '.new-task', title: 'Шинэ ажил', text: 'Ажил нэмэхдээ энэ товчийг дарна.', click: true },
//     { at: ['#title', 'form input'], title: 'Нэр', text: 'Юу хийхээ товч бичнэ.', before: () => openForm() },
//   ], { title: 'Ажил нэмэх', onEnd: finished => {} })
//
// `at` is a selector or a list of them: the first with an element on screen is lit; with none, the card stands in the
// middle of a dark screen. `before` gets the page ready for the step (opens a window, picks a tab); write it so that
// it works coming from either side, since Буцах runs it too. The layer lies in the browser's top layer (a popover),
// inside the open <dialog> when there is one: a modal window lets nothing outside it be pressed.
function startTour(steps, opts = {}) {
  const L = { skip: 'Алгасах', back: 'Буцах', next: 'Үргэлжлүүлэх', done: 'Дуусгах', press: 'Гэрэлтсэн хэсэг дээр дарна уу.', ...opts.labels }
  const PAD = 8, M = 12
  const root = document.createElement('div')
  root.className = 'tour'
  root.setAttribute('popover', 'manual')
  // The ring (its shadow is the dark), four unseen panels round the lit element, one over it, and the card
  for (const cls of ['tour__ring', '', '', '', '', '', 'tour__card glass glass--thick']) root.append(Object.assign(document.createElement('div'), { className: cls }))
  const [ring, above, below, before, after, cover, card] = root.children
  card.setAttribute('role', 'dialog')
  card.setAttribute('aria-labelledby', 'tour-t')
  card.setAttribute('aria-describedby', 'tour-x')
  let at = -1, raf = 0, target = null, seen = null, host = null

  const find = sel => {
    for (const s of [].concat(sel ?? [])) for (const el of document.querySelectorAll(s)) { const r = el.getBoundingClientRect(); if (r.width && r.height) return el }
    return null
  }
  const box = (el, x, y, w, h) => Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, w)}px`, height: `${Math.max(0, h)}px` })
  const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text })
  const button = (cls, text, run) => { const b = el('button', `btn btn--sm ${cls}`, text); b.type = 'button'; b.onclick = run; return b }
  // A suffix stays on the line of its word: «Ээлжийн амралт»-ыг
  const joined = text => text.replace(/([»\p{L}\d])-(?=\p{L})/gu, '$1-⁠')

  function end(finished) {
    cancelAnimationFrame(raf)
    document.removeEventListener('keydown', onKey, true)
    document.removeEventListener('click', onClick, true)
    root.remove()
    opts.onEnd?.(finished)
  }
  function go(to) {
    if (to >= steps.length) return end(true)
    if (to < 0) return
    at = to
    seen = null
    const s = steps[at]
    s.before?.()
    const count = el('p', 'tour__count', `${opts.title ? `${opts.title}, ` : ''}${at + 1} / ${steps.length}`)
    const title = el('h2', 'tour__title', joined(s.title))
    const text = el('p', 'tour__text', joined(s.text))
    title.id = 'tour-t'
    text.id = 'tour-x'
    const btns = el('div', 'tour__btns')
    btns.append(button('btn--ghost tour__skip', L.skip, () => end(false)))
    if (at > 0) btns.append(button('btn--glass', L.back, () => go(at - 1)))
    const main = button('btn--accent', at === steps.length - 1 ? L.done : L.next, () => go(at + 1))
    btns.append(main)
    card.replaceChildren(count, title, text, ...(s.click ? [el('p', 'tour__hint', L.press)] : []), btns)
    main.focus({ preventScroll: true })
  }
  // On every frame: pages scroll and windows move while they open
  function tick() {
    raf = requestAnimationFrame(tick)
    const windows = document.querySelectorAll('dialog[open]')
    const h = windows[windows.length - 1] ?? document.body
    if (h !== host) {
      host = h
      h.append(root)
      root.showPopover?.()
      card.querySelector('.btn--accent')?.focus({ preventScroll: true })
    }
    const s = steps[at], vw = innerWidth, vh = innerHeight
    target = find(s.at)
    let b = null
    if (target) {
      const r0 = target.getBoundingClientRect()
      if (target !== seen && (r0.top < 80 || r0.bottom > vh - 80)) target.scrollIntoView({ block: r0.height > vh - 160 ? 'start' : 'center', inline: 'nearest' })
      seen = target
      const r = target.getBoundingClientRect()
      b = { x: Math.round(r.left) - PAD, y: Math.round(r.top) - PAD, w: Math.round(r.width) + PAD * 2, h: Math.round(r.height) + PAD * 2 }
      if (b.w >= vw && b.h >= vh) b = null // the whole screen cannot be told from the rest of it
    }
    if (b) {
      box(ring, b.x, b.y, b.w, b.h)
      ring.style.borderRadius = `${Math.min(parseFloat(getComputedStyle(target).borderTopLeftRadius) || 6, 28) + 4}px`
      box(above, 0, 0, vw, b.y)
      box(below, 0, b.y + b.h, vw, vh - b.y - b.h)
      box(before, 0, b.y, b.x, b.h)
      box(after, b.x + b.w, b.y, vw - b.x - b.w, b.h)
      box(cover, b.x, b.y, s.click ? 0 : b.w, b.h)
    } else {
      // Nothing to light: a ring of no size in the middle, so its shadow darkens the whole screen
      box(ring, vw / 2, vh / 2, 0, 0)
      box(above, 0, 0, vw, vh)
      for (const p of [below, before, after, cover]) box(p, 0, 0, 0, 0)
    }
    // The card: under the element, else over it, else over the half of the screen the element is not in
    const cw = card.offsetWidth, ch = card.offsetHeight
    let left = (vw - cw) / 2, top = (vh - ch) / 2
    if (b) {
      left = b.x + b.w / 2 - cw / 2
      top = b.y + b.h + M + ch <= vh - M ? b.y + b.h + M : b.y - M - ch >= M ? b.y - M - ch : b.y + b.h / 2 < vh / 2 ? vh - ch - M : M
    }
    card.style.left = `${Math.round(Math.max(M, Math.min(left, vw - cw - M)))}px`
    card.style.top = `${Math.round(Math.max(M, Math.min(top, vh - ch - M)))}px`
  }
  // A press on the lit element goes on, after the element has done its own work
  function onClick(e) {
    if (steps[at]?.click && target?.contains(e.target)) setTimeout(() => go(at + 1), 0)
  }
  // Esc ends the tour; Tab stays on the card, and on the lit element when it is to be pressed
  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      end(false)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const lit = steps[at].click && target?.matches('a[href], button, input, select, textarea, [tabindex]') ? [target] : []
      const stops = [...lit, ...card.querySelectorAll('button')]
      stops[(stops.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus()
    }
  }
  document.addEventListener('keydown', onKey, true)
  document.addEventListener('click', onClick, true)
  go(0)
  tick()
  return { end: () => end(false) }
}
