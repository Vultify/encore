import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

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
