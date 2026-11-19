/// <reference lib="dom" />
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import type { EncoreApi } from '../src/shared/api'
import { makeWav } from './fixtures/audio'
import { launchEncore, makeDataDir, TempDirs } from './launch'

let app: ElectronApplication | undefined
const temp = new TempDirs()

test.afterEach(async () => {
  await app?.close()
  app = undefined
  temp.removeAll()
})

test('a damaged library file is set aside and Encore opens with a new one', async () => {
  const dataDir = temp.keep(makeDataDir())
  const music = temp.make('encore-music-')
  writeFileSync(join(music, 'Band - Fresh.wav'), makeWav(2))
  writeFileSync(join(dataDir, 'library.db'), 'this is not a database, just leftover bytes')
  // A music folder to read back in, and a saved spot pointing at a song from the old library.
  writeFileSync(
    join(dataDir, 'settings.json'),
    JSON.stringify({
      preferences: { musicFolders: [music] },
      player: {
        volume: 0.8,
        muted: false,
        session: { sourceKey: 'local-files', sourceName: 'Local files', sourceIds: [1], order: [0], cursor: 0, queuedIds: [], trackId: 1, fromQueue: false, position: 60, shuffle: false, repeat: 'off' }
      }
    })
  )

  const encore = await launchEncore(dataDir)
  app = encore.app
  // The folder is read back in first, and the notice comes after, so it isn't replaced by "Added 1 song".
  const notice = encore.page.getByRole('status').filter({ hasText: 'Your library file was damaged' })
  await expect(notice).toBeVisible()
  await expect(notice).toContainText('library.damaged-')
  await encore.page.screenshot({ path: 'test-results/library-set-aside.png' })

  // The old file is kept, the new library has the folder's song, and the old saved spot is gone.
  expect(readdirSync(dataDir).some((name) => /^library\.damaged-.*\.db$/.test(name))).toBe(true)
  const { titles, session } = await encore.page.evaluate(async () => {
    const { encore } = window as unknown as { encore: EncoreApi }
    return { titles: (await encore.library.getTracks()).map((track) => track.title), session: (await encore.settings.getPlayer()).session }
  })
  expect(titles).toEqual(['Fresh'])
  expect(session).toBeNull()

  // It stays until dismissed, then fades out.
  await notice.getByRole('button', { name: 'Got it' }).click()
  await expect(notice).toHaveAttribute('data-visible', 'false')
})

test('Encore keeps a local log, and Settings opens its folder', async () => {
  const dataDir = temp.keep(makeDataDir())
  const encore = await launchEncore(dataDir)
  app = encore.app
  const logFile = join(dataDir, 'logs', 'encore.log')
  await expect.poll(() => existsSync(logFile)).toBe(true)
  expect(readFileSync(logFile, 'utf8')).toMatch(/INFO Encore \d+\.\d+\.\d+ starting/)

  const opened = await app.evaluate(({ shell }) => {
    const paths: string[] = []
    shell.openPath = (async (path: string) => {
      paths.push(path)
      return ''
    }) as typeof shell.openPath
    ;(globalThis as unknown as { openedPaths: string[] }).openedPaths = paths
    return true
  })
  expect(opened).toBe(true)
  await encore.page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click()
  await encore.page.getByRole('region', { name: 'About' }).getByRole('button', { name: 'Error log' }).click()
  await expect
    .poll(() => app!.evaluate(() => (globalThis as unknown as { openedPaths: string[] }).openedPaths))
    .toEqual([join(dataDir, 'logs')])
})
