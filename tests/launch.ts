import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

export interface Encore {
  app: ElectronApplication
  page: Page
  dataDir: string
}

export const makeDataDir = (): string => mkdtempSync(join(tmpdir(), 'encore-data-'))

// Song lookups go nowhere unless a test sets up its own stand-in, so no test ever reaches Apple's servers.
const NO_LOOKUPS = 'http://127.0.0.1:9/search'

// Starts Encore against a throwaway data folder, so tests never touch the real library or clash with a running copy.
// A folder created here is removed when the app closes. A folder passed in belongs to the caller.
export async function launchEncore(dataDir?: string, env: Record<string, string> = {}): Promise<Encore> {
  const dir = dataDir ?? makeDataDir()
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, ENCORE_LOOKUP_URL: NO_LOOKUPS, ENCORE_LOOKUP_GAP_MS: '0', ...env, ENCORE_DATA_DIR: dir }
  })
  if (!dataDir) app.on('close', () => rmSync(dir, { recursive: true, force: true }))

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page, dataDir: dir }
}
