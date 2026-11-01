import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import '../styles/tokens.css'
import '../styles/global.css'
import { MiniPlayer } from './MiniPlayer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MiniPlayer />
  </StrictMode>
)
