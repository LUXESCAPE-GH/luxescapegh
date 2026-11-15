import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'spa-not-found-fallback',
      apply: 'build',
      async closeBundle() {
        const outputDirectory = resolve(process.cwd(), 'dist')
        await copyFile(resolve(outputDirectory, 'index.html'), resolve(outputDirectory, '404.html'))
      },
    },
  ],
})
