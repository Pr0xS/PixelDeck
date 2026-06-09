import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ExportApp } from './pages/ExportApp.tsx'
import { loadGoogleFonts } from '@/utils/fonts'

declare global {
  interface Window {
    __EXPORT_CONFIG__?: unknown
  }
}

// Load Google Fonts for the editor (not needed in headless export)
if (!window.__EXPORT_CONFIG__) {
  loadGoogleFonts()
}

// If the CLI injected __EXPORT_CONFIG__ before page load, run in headless export mode.
// Otherwise render the full editor UI.
const isExportMode = !!window.__EXPORT_CONFIG__

createRoot(document.getElementById('root')!).render(
  isExportMode
    ? <ExportApp />
    : (
      <StrictMode>
        <App />
      </StrictMode>
    )
)
