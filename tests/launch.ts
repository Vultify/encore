import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import type { EncoreApi } from '../src/shared/api'

export interface Encore {
  app: ElectronApplication
  page: Page
  dataDir: string
}

export const makeDataDir = (): string => mkdtempSync(join(tmpdir(), 'encore-data-'))

// Adds a folder of songs to the library, the same way dropping it in would.
export async function importFolder(page: Page, dir: string): Promise<void> {
  await page.evaluate((path) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths([path]), dir)
}

// Temporary folders a test makes or keeps, removed together once it's done.
export class TempDirs {
  private dirs: string[] = []

  make(prefix: string): string {
    return this.keep(mkdtempSync(join(tmpdir(), prefix)))
  }

  keep(dir: string): string {
    this.dirs.push(dir)
    return dir
  }

  removeAll(): void {
    for (const dir of this.dirs) rmSync(dir, { recursive: true, force: true })
    this.dirs = []
  }
}

// Song lookups go nowhere unless a test sets up its own stand-in, so no test ever reaches Apple's servers,
// AcoustID, or the Cover Art Archive. Matching by sound is off unless a test supplies a key.
export const OFFLINE_ENV = {
  ENCORE_LOOKUP_URL: 'http://127.0.0.1:9/search',
  ENCORE_ACOUSTID_URL: 'http://127.0.0.1:9/v2/lookup',
  ENCORE_COVERART_URL: 'http://127.0.0.1:9',
  ENCORE_ACOUSTID_KEY: '',
  ENCORE_LOOKUP_GAP_MS: '0'
}

// Starts Encore against a throwaway data folder, so tests never touch the real library or clash with a running copy.
// A folder created here is removed when the app closes. A folder passed in belongs to the caller.
export async function launchEncore(dataDir?: string, env: Record<string, string> = {}, args: string[] = []): Promise<Encore> {
  const dir = dataDir ?? makeDataDir()
  const app = await electron.launch({
    args: ['.', ...args],
    env: { ...process.env, ...OFFLINE_ENV, ...env, ENCORE_DATA_DIR: dir }
  })
  if (!dataDir) app.on('close', () => rmSync(dir, { recursive: true, force: true }))

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page, dataDir: dir }
}
