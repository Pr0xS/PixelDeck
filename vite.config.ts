import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// GitHub Pages deploys to /PixelDeck/ — set GITHUB_PAGES=true in the deploy workflow.
const base = process.env.GITHUB_PAGES === 'true' ? '/PixelDeck/' : '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
