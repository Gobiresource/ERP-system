// Wave wallpaper. Colours come from the data-wall tokens (styles/tokens.css); solid wallpapers hide the waves.
import { useId } from 'react'

const stop = (v: string) => ({ stopColor: `var(${v})` })

/** The waves, lines and bubbles. Also drawn small in the wallpaper picker (Settings). */
export function WaveArt() {
  const id = useId()
  const u = (n: string) => `${id}-${n}`
  return (
    <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={u('a')} x1="1" y1="0" x2="0.35" y2="0.5"><stop offset="0" style={stop('--wa1')} /><stop offset="1" style={stop('--wa2')} /></linearGradient>
        <linearGradient id={u('b')} x1="0" y1="0.6" x2="1" y2="0.2"><stop offset="0" style={stop('--wb1')} /><stop offset="1" style={stop('--wb2')} /></linearGradient>
        <linearGradient id={u('c')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={stop('--wc1')} /><stop offset="1" style={stop('--wc2')} /></linearGradient>
        <linearGradient id={u('d')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={stop('--wd1')} /><stop offset="1" style={stop('--wd2')} /></linearGradient>
        <radialGradient id={u('bub')} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".55" stopColor="#fff" stopOpacity=".06" />
          <stop offset=".92" stopColor="#fff" stopOpacity=".16" />
          <stop offset="1" stopColor="#fff" stopOpacity=".42" />
        </radialGradient>
      </defs>
      <path fill={`url(#${u('a')})`} d="M1600 0H520c180 120 340 250 560 300 210 48 370 0 520 90z" />
      <path fill={`url(#${u('b')})`} d="M0 470c260-80 520 0 760-40 280-46 480-230 840-280v280c-270 40-490 220-760 270-270 50-540-60-840 60z" />
      <path fill={`url(#${u('c')})`} d="M0 770c330-110 590 0 880-40 290-40 480-170 720-210v480H0z" />
      <path fill={`url(#${u('d')})`} d="M0 880c230-70 470 0 700 120H0z" />
      <g fill="none" stroke="#fff" strokeWidth="1.6" style={{ opacity: 'calc(var(--wline, 0) * .7)' }}>
        <path d="M-20 450c270-80 540 2 780-38 280-46 480-230 860-280" />
        <path d="M-20 750c350-110 610 2 900-38 290-40 480-170 740-210" />
      </g>
      <g fill={`url(#${u('bub')})`} stroke="#fff" strokeOpacity=".35" style={{ opacity: 'var(--wbub, 0)' }}>
        <circle cx="1240" cy="230" r="70" />
        <circle cx="300" cy="640" r="46" />
        <circle cx="980" cy="830" r="90" />
        <circle cx="1490" cy="700" r="34" />
        <circle cx="140" cy="300" r="26" />
      </g>
    </svg>
  )
}

export function Wallpaper() {
  return (
    <div className="wall" aria-hidden="true">
      <WaveArt />
    </div>
  )
}
