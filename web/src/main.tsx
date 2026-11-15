import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/golos-text'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import { App } from './App'
import Down from './screens/Down'
import { boot } from './lib/sync'
import { resume } from './lib/ui'
import { startGlint } from './lib/glint'
import { startHotkeys } from './shell/hotkeys'

startGlint()
startHotkeys()
// First whether a server is behind the app, and who is signed in there (lib/sync.ts); then the first screen
boot().then(({ mode, me }) => {
  if (mode === 'server') resume(me)
  createRoot(document.getElementById('root')!).render(<StrictMode>{mode === 'down' ? <Down /> : <App />}</StrictMode>)
})
