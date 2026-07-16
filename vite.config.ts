import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { execSync } from 'child_process'
import { createRequire } from 'module'

// GitHub Pages deploys to /PixelDeck/ — set GITHUB_PAGES=true in the deploy workflow.
const base = process.env.GITHUB_PAGES === 'true' ? '/PixelDeck/' : '/'

const require = createRequire(import.meta.url)
const pkg = require('./package.json') as { version: string }

function getGitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_HASH__: JSON.stringify(getGitHash()),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // The main chunk includes Konva + react-konva (~400kB), which is unavoidable
    // for a canvas editor. All other code-splitting opportunities have been taken.
    chunkSizeWarningLimit: 800,
  },
})
