/// <reference lib="dom" />
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { makeWav } from './fixtures/audio'
import { importFolder, OFFLINE_ENV, TempDirs } from './launch'

// Checks the app as the installer ships it. Runs only with `npm run test:packaged`, which builds it first, so it never
// tests an old build.
const EXE = join('dist', 'win-unpacked', 'Encore.exe')
const temp = new TempDirs()

test.skip(process.env.npm_lifecycle_event !== 'test:packaged' || !existsSync(EXE), 'Run npm run test:packaged')
test.afterEach(() => temp.removeAll())

test('the packaged app opens, plays a song, and offers Start with Windows and updates', async () => {
  const music = temp.make('encore-packaged-')
  writeFileSync(join(music, 'Band - Tone.wav'), makeWav(4))

  // Installed copies look for new versions on Encore's GitHub Releases.
  const feed = readFileSync(join('dist', 'win-unpacked', 'resources', 'app-update.yml'), 'utf8')
  expect(feed).toMatch(/^provider: github$/m)
  expect(feed).toMatch(/^owner: Vultify$/m)
  expect(feed).toMatch(/^repo: encore$/m)

  // The test copy checks a feed that goes nowhere instead, so it never reaches GitHub.
  const offlineFeed = join(temp.make('encore-feed-'), 'update-config.yml')
  writeFileSync(offlineFeed, 'provider: generic\nurl: http://127.0.0.1:9/\nupdaterCacheDirName: encore-updater-test\n')
  const app = await electron.launch({
    executablePath: EXE,
    env: {
      ...process.env,
      ...OFFLINE_ENV,
      ENCORE_UPDATE_CONFIG: offlineFeed,
      LOCALAPPDATA: temp.make('encore-cache-'),
      ENCORE_DATA_DIR: temp.make('encore-data-')
    }
  })
  try {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(true)

    // fpcalc has to sit outside the app archive, where Windows can run it.
    const fpcalc = join('dist', 'win-unpacked', 'resources', 'app.asar.unpacked', 'resources', 'bin', 'fpcalc.exe')
    expect(existsSync(fpcalc)).toBe(true)

    await importFolder(page, music)
    await page.reload()
    await page.getByRole('tab', { name: 'Local files' }).click()
    await page.getByRole('listitem').filter({ hasText: 'Tone' }).dblclick()
    await expect(page.getByRole('region', { name: 'Player' }).getByRole('button', { name: 'Pause' })).toBeVisible()

    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('switch', { name: 'Start with Windows' })).toBeEnabled()
    await expect(page.getByRole('region', { name: 'About' }).getByRole('button', { name: 'Check now' })).toBeEnabled()
  } finally {
    await app.close()
  }
})
