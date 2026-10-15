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

// Starts Encore against a throwaway data folder, so tests never touch the real library or clash with a running copy.
// A folder created here is removed when the app closes. A folder passed in belongs to the caller.
export async function launchEncore(dataDir?: string): Promise<Encore> {
  const dir = dataDir ?? makeDataDir()
  const app = await electron.launch({ args: ['.'], env: { ...process.env, ENCORE_DATA_DIR: dir } })
  if (!dataDir) app.on('close', () => rmSync(dir, { recursive: true, force: true }))

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page, dataDir: dir }
}
