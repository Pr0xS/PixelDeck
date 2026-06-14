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
  server: {
    proxy: {
      '/api/ai-proxy/openrouter': {
        target: 'https://openrouter.ai',
        changeOrigin: true,
        rewrite: (proxyPath) => proxyPath.replace(/^\/api\/ai-proxy\/openrouter/, '/api/v1'),
      },
      '/api/ai-proxy/opencode': {
        target: 'https://opencode.ai',
        changeOrigin: true,
        rewrite: (proxyPath) => proxyPath.replace(/^\/api\/ai-proxy\/opencode/, '/zen/go/v1'),
      },
      '/api/ai-proxy/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (proxyPath) => proxyPath.replace(/^\/api\/ai-proxy\/openai/, '/v1'),
      },
      '/api/ai-proxy/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (proxyPath) => proxyPath.replace(/^\/api\/ai-proxy\/anthropic/, '/v1'),
      },
      '/api/ai-proxy/google': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (proxyPath) => proxyPath.replace(/^\/api\/ai-proxy\/google/, '/v1beta'),
      },
    },
  },
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
