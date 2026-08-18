import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Allow serving data/sample/*.json, which lives outside this Vite project's root.
const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
})
