// The person's own menu: settings, shortcuts, light/dark, demo data, signing out.
import { ChevronDown, Keyboard, LogOut, RotateCcw, Settings } from 'lucide-react'
import { actions, getState, scoped, useApp } from '../lib/store'
import { open, signOut, toast } from '../lib/ui'
import { go } from '../lib/router'
import { applyAppearance } from '../lib/theme'
import type { ThemeSetting } from '../lib/types'
import { short } from '../lib/format'
import { Avatar } from '../ui/bits'
import { Menu, MenuItem, usePopover } from '../ui/Popover'

export function setTheme(theme: ThemeSetting) {
  const settings = { ...getState().settings, theme }
  applyAppearance(settings, true)
  actions.setSettings({ theme })
}

export function AccountMenu({ variant }: { variant: 'side' | 'toolbar' }) {
  const s = useApp()
  const { me } = scoped(s)
  const pop = usePopover()
  const pick = (fn: () => void) => () => { pop.close(); fn() }

  return (
    <>
      {variant === 'side' ? (
        <button ref={pop.anchor} type="button" className="side__me" aria-haspopup="menu" aria-expanded={pop.open} onClick={pop.toggle}>
          <Avatar person={me} size="md" />
          <span className="who">
            <b>{short(me)}</b>
            <small>{me.role}</small>
          </span>
          <ChevronDown className="ico" />
        </button>
      ) : (
        <button ref={pop.anchor} type="button" className="tbtn tbtn--me" aria-haspopup="menu" aria-expanded={pop.open} onClick={pop.toggle} aria-label={`${short(me)}, хувийн цэс`}>
          <Avatar person={me} size="md" />
        </button>
      )}
      <Menu state={pop} label="Хувийн цэс" placement={variant === 'side' ? 'top-start' : 'bottom-end'}>
        <MenuItem icon={<Settings className="ico" />} onSelect={pick(() => go('preferences'))}>Тохиргоо</MenuItem>
        <MenuItem icon={<Keyboard className="ico" />} onSelect={pick(() => open({ kind: 'shortcuts' }))}>Гарын товчлол</MenuItem>
        <hr />
        <MenuItem checked={s.settings.theme === 'light'} onSelect={pick(() => setTheme('light'))}>Цайвар</MenuItem>
        <MenuItem checked={s.settings.theme === 'dark'} onSelect={pick(() => setTheme('dark'))}>Бараан</MenuItem>
        <MenuItem checked={s.settings.theme === 'system'} onSelect={pick(() => setTheme('system'))}>Автомат</MenuItem>
        <hr />
        <MenuItem danger icon={<RotateCcw className="ico" />} onSelect={pick(() => toast('Жишээ өгөгдөл сэргээгдлээ.', { undo: actions.reset() }))}>
          Жишээ өгөгдлийг сэргээх
        </MenuItem>
        <hr />
        <MenuItem icon={<LogOut className="ico" />} onSelect={pick(signOut)}>Гарах</MenuItem>
      </Menu>
    </>
  )
}
