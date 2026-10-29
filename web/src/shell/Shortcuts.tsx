import { Sheet } from '../ui/Sheet'
import { close } from '../lib/ui'
import { modKey } from './Toolbar'
import { NAV } from './nav'

const ROWS: [string, string[]][] = [
  ['Хайх', [`${modKey} K`, '/']],
  ['Үүсгэх', ['N']],
  ['Шинэ ажил', ['T']],
  ['Төвлөрөл эхлүүлэх', ['F']],
  ['Хаах', ['Esc']],
  ['Энэ жагсаалт', ['?']],
]

export function Shortcuts() {
  return (
    <Sheet kind="drawer" label="Гарын товчлол" onClose={close}>
      <h2 className="sheet__title">Гарын товчлол</h2>
      <p className="muted" style={{ marginTop: 6 }}>Монгол гарын байрлалтай үед ч ажиллана.</p>
      <dl className="keys">
        {ROWS.map(([label, keys]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{keys.map(k => <kbd key={k}>{k}</kbd>)}</dd>
          </div>
        ))}
      </dl>
      <h3 className="keys__head">Хуудас солих: эхлээд G, дараа нь</h3>
      <dl className="keys">
        {NAV.map(n => (
          <div key={n.page}>
            <dt>{n.label}</dt>
            <dd><kbd>G</kbd><kbd>{n.key}</kbd></dd>
          </div>
        ))}
      </dl>
    </Sheet>
  )
}
