import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

export default defineConfig({
  main: {},
  // The main window and the mini player get separate preloads. Sandboxed windows can't load shared chunks, so each
  // preload is built as one standalone file.
  preload: {
    build: {
      isolatedEntries: true,
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          mini: resolve('src/preload/mini.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()],
    define: { __APP_VERSION__: JSON.stringify(version) },
    // The main window and the mini player are separate pages.
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          mini: resolve('src/renderer/mini.html')
        }
      }
    }
  }
})
