import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DesktopNoteWindow } from './desktop-note/DesktopNoteWindow.tsx'

const isDesktopNoteWindow =
  new URLSearchParams(window.location.search).get('window') === 'desktop-note'

if (isDesktopNoteWindow) document.documentElement.classList.add('desktop-note-document')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDesktopNoteWindow ? <DesktopNoteWindow /> : <App />}
  </StrictMode>,
)
