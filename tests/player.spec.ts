/// <reference lib="dom" />
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import type { EncoreApi } from '../src/shared/api'
import { makeMp3, makeWav } from './fixtures/audio'
import { dropFiles } from './drop'
import { launchEncore } from './launch'

let app: ElectronApplication
let page: Page
let musicDir: string
let dock: Locator

// Three short songs that sort as A, B, C, plus a real MP3.
test.beforeAll(() => {
  musicDir = mkdtempSync(join(tmpdir(), 'encore-player-'))
  writeFileSync(join(musicDir, 'Band - Song A.wav'), makeWav(8))
  writeFileSync(join(musicDir, 'Band - Song B.wav'), makeWav(6))
  writeFileSync(join(musicDir, 'Band - Song C.mp3'), makeMp3(5, { title: 'Song C', artist: 'Band' }))
})

test.afterAll(() => {
  rmSync(musicDir, { recursive: true, force: true })
})

test.beforeEach(async () => {
  const encore = await launchEncore()
  app = encore.app
  page = encore.page
  dock = page.getByRole('region', { name: 'Player' })
  await page.evaluate((dir) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths([dir]), musicDir)
  await page.reload()
  await page.getByRole('tab', { name: 'Local files' }).click()
})

test.afterEach(async () => {
  await app.close()
})

const elapsed = async (): Promise<number> => {
  const [m, s] = (await dock.getByText(/\d+:\d\d \//).textContent())!.split(' /')[0].split(':').map(Number)
  return m * 60 + s
}

const playButton = (title: string): Locator => page.getByRole('button', { name: `Play ${title}` })

test('plays a song from the list and shows it in the dock and on the stage', async () => {
  await expect(dock.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()

  await page.getByRole('listitem').filter({ hasText: 'Song A' }).hover()
  await playButton('Song A').click()

  await expect(dock).toContainText('Song A')
  await expect(dock).toContainText('Band')
  await expect(page.getByRole('region', { name: 'Now playing' }).getByRole('heading')).toHaveText('Song A')
  await expect(dock.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(dock).toContainText('/ 0:08')
  await expect.poll(elapsed, { timeout: 4000 }).toBeGreaterThanOrEqual(1)
  await page.screenshot({ path: 'test-results/playing.png' })
})

test('pause and play from the dock and with the space bar', async () => {
  await page.getByRole('listitem').filter({ hasText: 'Song A' }).dblclick()
  await expect(dock.getByRole('button', { name: 'Pause' })).toBeVisible()

  await dock.getByRole('button', { name: 'Pause' }).click()
  await expect(dock.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  const pausedAt = await elapsed()
  await page.waitForTimeout(1200)
  expect(await elapsed()).toBe(pausedAt)

  await page.locator('body').focus()
  await page.keyboard.press('Space')
  await expect(dock.getByRole('button', { name: 'Pause' })).toBeVisible()
})

test('next and previous move through the list', async () => {
  await page.getByRole('listitem').filter({ hasText: 'Song A' }).dblclick()
  await dock.getByRole('button', { name: 'Next song' }).click()
  await expect(dock).toContainText('Song B')

  await dock.getByRole('button', { name: 'Next song' }).click()
  await expect(dock).toContainText('Song C')
  await expect(dock.getByRole('button', { name: 'Next song' })).toBeDisabled()
  await expect.poll(elapsed, { timeout: 4000 }).toBeGreaterThanOrEqual(1)

  // Early in a song, previous goes back a song. MP3 decoding is proven by Song C reaching 1 second.
  await dock.getByRole('button', { name: 'Previous song' }).click()
  await expect(dock).toContainText('Song B')
})

test('songs added while playing join the queue', async () => {
  await page.getByRole('listitem').filter({ hasText: 'Song C' }).dblclick()
  await expect(dock).toContainText('Song C')
  await expect(dock.getByRole('button', { name: 'Next song' })).toBeDisabled()

  const addedDir = mkdtempSync(join(tmpdir(), 'encore-added-'))
  try {
    writeFileSync(join(addedDir, 'Band - Song D.wav'), makeWav(3))
    await dropFiles(page, [join(addedDir, 'Band - Song D.wav')])
    await expect(page.getByRole('listitem').filter({ hasText: 'Song D' })).toBeVisible()

    await dock.getByRole('button', { name: 'Next song' }).click()
    await expect(dock).toContainText('Song D')
  } finally {
    rmSync(addedDir, { recursive: true, force: true })
  }
})

test('previous restarts the song after the first few seconds', async () => {
  await page.getByRole('listitem').filter({ hasText: 'Song B' }).dblclick()
  await dock.getByLabel('Seek').fill('4')
  await expect.poll(elapsed).toBeGreaterThanOrEqual(4)

  await dock.getByRole('button', { name: 'Previous song' }).click()
  await expect(dock).toContainText('Song B')
  await expect.poll(elapsed).toBeLessThan(2)
})

test('seeking near the end plays on into the next song', async () => {
  await page.getByRole('listitem').filter({ hasText: 'Song A' }).dblclick()
  await expect(dock).toContainText('/ 0:08')

  await dock.getByLabel('Seek').fill('7')
  await expect.poll(elapsed).toBeGreaterThanOrEqual(7)
  await expect(dock).toContainText('Song B', { timeout: 5000 })
  await expect(page.getByRole('listitem').filter({ hasText: 'Song B' })).toHaveAttribute('aria-current', 'true')
})

test('volume slider and mute', async () => {
  await page.getByRole('listitem').filter({ hasText: 'Song A' }).dblclick()
  const slider = dock.getByLabel('Volume')

  await dock.getByRole('button', { name: 'Mute' }).hover()
  await expect(slider).toBeVisible()
  await slider.fill('0.5')
  await expect(slider).toHaveValue('0.5')

  await dock.getByRole('button', { name: 'Mute' }).click()
  await expect(dock.getByRole('button', { name: 'Unmute' })).toBeVisible()
  await expect(slider).toHaveValue('0')
  await page.screenshot({ path: 'test-results/volume.png' })

  await dock.getByRole('button', { name: 'Unmute' }).click()
  await expect(slider).toHaveValue('0.5')
})

test('a song whose file is gone is caught before it plays', async () => {
  const goneDir = mkdtempSync(join(tmpdir(), 'encore-gone-'))
  writeFileSync(join(goneDir, 'Ghost - Vanished.wav'), makeWav(3))
  await page.evaluate((dir) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths([dir]), goneDir)
  rmSync(goneDir, { recursive: true, force: true })
  await page.reload()
  await page.getByRole('tab', { name: 'Local files' }).click()

  await page.getByRole('listitem').filter({ hasText: 'Vanished' }).dblclick()
  await expect(page.getByRole('status').filter({ hasText: "Can't find the file for Vanished" })).toBeVisible()
})

test('the media scheme streams library songs in ranges and nothing else', async () => {
  const fetchStatus = (url: string, range?: string) =>
    app.evaluate(
      async ({ net }, { url, range }) => {
        const response = await net.fetch(url, { headers: range ? { Range: range } : {} })
        const body = await response.arrayBuffer()
        return { status: response.status, range: response.headers.get('Content-Range'), length: body.byteLength }
      },
      { url, range }
    )

  const wavSize = 44 + 8000 * 2 * 8
  expect(await fetchStatus('encore-media://track/1')).toEqual({ status: 200, range: null, length: wavSize })
  expect(await fetchStatus('encore-media://track/1', 'bytes=100-199')).toEqual({ status: 206, range: `bytes 100-199/${wavSize}`, length: 100 })
  expect(await fetchStatus('encore-media://track/1', `bytes=${wavSize}-`)).toMatchObject({ status: 416 })
  expect(await fetchStatus('encore-media://track/999')).toMatchObject({ status: 404 })
  expect(await fetchStatus('encore-media://track/..%2F..%2Fsecret')).toMatchObject({ status: 404 })
})
