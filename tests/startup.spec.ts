/// <reference lib="dom" />
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type ElectronApplication } from '@playwright/test'
import type { EncoreApi } from '../src/shared/api'
import { makeWav } from './fixtures/audio'
import { importFolder, launchEncore, makeDataDir, TempDirs } from './launch'

let app: ElectronApplication | undefined
const temp = new TempDirs()

test.afterEach(async () => {
  await app?.close()
  app = undefined
  temp.removeAll()
})

test('a damaged library file is set aside and Encore opens with a new one', async () => {
  const dataDir = temp.keep(makeDataDir())
  writeFileSync(join(dataDir, 'library.db'), 'this is not a database, just leftover bytes')
  const music = temp.make('encore-music-')
  writeFileSync(join(music, 'Band - Fresh.wav'), makeWav(2))

  const encore = await launchEncore(dataDir)
  app = encore.app
  const notice = encore.page.getByRole('status').filter({ hasText: 'Your library file was damaged' })
  await expect(notice).toBeVisible()
  await expect(notice).toContainText('library.damaged-')
  await encore.page.screenshot({ path: 'test-results/library-set-aside.png' })

  // The old file is kept, and the new library works.
  expect(readdirSync(dataDir).some((name) => /^library\.damaged-.*\.db$/.test(name))).toBe(true)
  await importFolder(encore.page, music)
  const titles = await encore.page.evaluate(async () =>
    (await (window as unknown as { encore: EncoreApi }).encore.library.getTracks()).map((track) => track.title)
  )
  expect(titles).toEqual(['Fresh'])

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
