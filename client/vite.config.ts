import path from 'node:path'
import { readFileSync } from 'node:fs'
import { dependencies } from './package.json'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'font-licenses',
      generateBundle() {
        const licenses = Object.keys(dependencies)
          .filter((name) => name.startsWith('@fontsource'))
          .map(
            (name) =>
              name +
              '\n' +
              readFileSync(
                path.resolve(__dirname, 'node_modules', name, 'LICENSE'),
                'utf8'
              )
          )
        this.emitFile({
          type: 'asset',
          fileName: 'font-licenses.txt',
          source: licenses.join('\n\n')
        })
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
