/// <reference lib="dom" />
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { thumbnailUrl, type EncoreApi } from '../src/shared/api'
import { makeMp3 } from './fixtures/audio'
import { importFolder, launchEncore, makeDataDir, TempDirs } from './launch'

let app: ElectronApplication | undefined
const temp = new TempDirs()

test.afterEach(async () => {
  await app?.close()
  app = undefined
  temp.removeAll()
})

// How wide the image at a URL is once the window loads it.
const widthOf = (page: Page, url: string): Promise<number> =>
  page.evaluate(async (src) => (await createImageBitmap(await (await fetch(src)).blob())).width, url)

test('covers shown small load a light copy, made once and kept', async () => {
  const dataDir = temp.keep(makeDataDir())
  const encore = await launchEncore(dataDir)
  app = encore.app
  const { page } = encore

  const big = await app.evaluate(
    ({ nativeImage }, path) => nativeImage.createFromPath(path).resize({ width: 1000 }).toPNG().toString('base64'),
    resolve('resources/icon.png')
  )
  const music = temp.make('encore-art-')
  writeFileSync(join(music, 'big.mp3'), makeMp3(2, { title: 'Big Cover', artist: 'Band', album: 'Large', cover: Buffer.from(big, 'base64') }))

  await importFolder(page, music)
  const [track] = await page.evaluate(() => (window as unknown as { encore: EncoreApi }).encore.library.getTracks())
  expect(track.artworkId).toBeTruthy()

  expect(await widthOf(page, thumbnailUrl(track.artworkId!))).toBe(320)
  // The cover is a PNG, so its small copy stays one and keeps any see-through parts.
  expect(track.artworkId).toMatch(/\.png$/)
  expect(readdirSync(join(dataDir, 'artwork', 'thumbs'))).toEqual([track.artworkId!])
  // Asked for again, the same copy is used.
  expect(await widthOf(page, thumbnailUrl(track.artworkId!))).toBe(320)
  expect(readdirSync(join(dataDir, 'artwork', 'thumbs'))).toHaveLength(1)

  await page.reload()
  await page.getByRole('tab', { name: 'Local files' }).click()
  const row = page.getByRole('list', { name: 'Local files' }).getByRole('listitem').filter({ hasText: 'Big Cover' })
  await expect(row.locator('img')).toHaveAttribute('src', thumbnailUrl(track.artworkId!))
})

test('a cover that is already small is served as it is', async () => {
  const encore = await launchEncore()
  app = encore.app
  const music = temp.make('encore-art-')
  writeFileSync(join(music, 'small.mp3'), makeMp3(2, { title: 'Small Cover', artist: 'Band', album: 'Tiny', cover: readFileSync('resources/icon.png') }))
  await importFolder(encore.page, music)
  const [track] = await encore.page.evaluate(() => (window as unknown as { encore: EncoreApi }).encore.library.getTracks())
  expect(await widthOf(encore.page, thumbnailUrl(track.artworkId!))).toBe(256)
})
