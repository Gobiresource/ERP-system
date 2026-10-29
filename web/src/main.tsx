import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/golos-text'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import { App } from './App'
import { startGlint } from './lib/glint'
import { startHotkeys } from './shell/hotkeys'

startGlint()
startHotkeys()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
