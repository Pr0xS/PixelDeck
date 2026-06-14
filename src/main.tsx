import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
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

// Lazy-load ExportApp so its rendering path (Playwright headless only) is a
// separate chunk and doesn't bloat the editor bundle.
// eslint-disable-next-line react-refresh/only-export-components
const ExportApp = lazy(() =>
  import('./pages/ExportApp.tsx').then((m) => ({ default: m.ExportApp })),
)

createRoot(document.getElementById('root')!).render(
  isExportMode
    ? <Suspense><ExportApp /></Suspense>
    : (
      <StrictMode>
        <App />
      </StrictMode>
    )
)
