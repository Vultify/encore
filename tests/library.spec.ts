/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { dropFiles as drop } from './drop'
import { launchEncore, makeDataDir } from './launch'
import type { EncoreApi, ImportResult } from '../src/shared/api'
import { makeMp3, makeWav } from './fixtures/audio'

let app: ElectronApplication
let page: Page
let dataDir: string
let musicDir: string
let cover: Buffer

// A small music folder: a tagged album with a cover, an untagged WAV, broken files, and files Encore should skip.
test.beforeAll(() => {
  musicDir = mkdtempSync(join(tmpdir(), 'encore-music-'))
  cover = readFileSync('resources/icon.png')
  const album = { artist: 'The Testers', album: 'Night Drive', year: '2024', cover }

  mkdirSync(join(musicDir, 'Album', 'Disc 2'), { recursive: true })
  writeFileSync(join(musicDir, 'Album', '02 Second.mp3'), makeMp3(184, { ...album, title: 'Second Song', track: '2/2' }))
  writeFileSync(join(musicDir, 'Album', '01 First.mp3'), makeMp3(3, { ...album, title: 'First Song', track: '1/2' }))
  writeFileSync(join(musicDir, 'Album', 'Disc 2', '03 Live.m4a'), '')
  writeFileSync(join(musicDir, 'Loose.wav'), makeWav(2))

  // Untagged downloads named "Artist - Title", in a folder with its own cover image.
  mkdirSync(join(musicDir, 'Downloads'))
  writeFileSync(join(musicDir, 'Downloads', 'Real Friends - Late Nights In My Car.mp3'), makeMp3(2, {}))
  writeFileSync(join(musicDir, 'Downloads', '07. Artist Two – Song Name (Official Video).mp3'), makeMp3(2, {}))
  writeFileSync(join(musicDir, 'Downloads', 'folder.png'), cover)
  writeFileSync(join(musicDir, 'Broken.FLAC'), 'not really audio')
  writeFileSync(join(musicDir, 'cover.jpg'), '')
  writeFileSync(join(musicDir, 'notes.txt'), '')
})

test.afterAll(() => {
  rmSync(musicDir, { recursive: true, force: true })
})

// Every test starts with an empty library.
test.beforeEach(async () => {
  const encore = await launchEncore()
  app = encore.app
  page = encore.page
  dataDir = encore.dataDir
})

test.afterEach(async () => {
  await app.close()
})

const songs = (...names: string[]): string[] => names.map((name) => join(musicDir, name))

const dropFiles = (paths: string[], events?: string[]): Promise<void> => drop(page, paths, events)

const importPaths = (paths: string[]): Promise<ImportResult> =>
  page.evaluate((list) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths(list), paths)

test('shows the drop overlay while files are dragged over the window', async () => {
  await dropFiles(songs('Loose.wav'), ['dragenter', 'dragover'])
  await expect(page.getByText('Drop to add to your library')).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/drop-overlay.png' })

  await page.evaluate(() => {
    document.body.dispatchEvent(new DragEvent('dragleave', { bubbles: true, dataTransfer: new DataTransfer() }))
  })
  await expect(page.getByText('Drop to add to your library')).toBeHidden()
})

test('dropped songs show their tags and cover art in Local files', async () => {
  await dropFiles(songs('Album/02 Second.mp3', 'Album/01 First.mp3', 'Loose.wav', 'cover.jpg'))

  await expect(page.getByRole('status').filter({ hasText: 'Added 3 songs' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Local files' })).toHaveAttribute('aria-selected', 'true')

  // Album songs come first in track order, the untagged file last.
  const rows = page.getByRole('list', { name: 'Local files' }).getByRole('listitem')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('First Song')
  await expect(rows.nth(0)).toContainText('The Testers · Night Drive')
  await expect(rows.nth(0)).toContainText('0:03')
  await expect(rows.nth(1)).toContainText('Second Song')
  await expect(rows.nth(1)).toContainText('3:04')
  await expect(rows.nth(2)).toContainText('Loose')
  await expect(rows.nth(2)).toContainText('Unknown artist')
  await expect(rows.nth(2)).toContainText('0:02')

  // The cover loads through the artwork scheme. The untagged song shows the music icon instead.
  const cover = rows.nth(0).locator('img')
  await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await expect(rows.nth(2).locator('img')).toHaveCount(0)

  await page.waitForTimeout(900)
  await page.screenshot({ path: 'test-results/local-files.png' })

  await dropFiles(songs('Loose.wav'))
  await expect(page.getByRole('status').filter({ hasText: 'already in your library' })).toBeVisible()
  await expect(rows).toHaveCount(3)
})

test('dropping only non-music files says nothing was found', async () => {
  await dropFiles(songs('notes.txt'))
  await expect(page.getByRole('status').filter({ hasText: 'No MP3, FLAC, WAV, or M4A files' })).toBeVisible()
})

test('importing a folder reads every song in every subfolder', async () => {
  const { found, added, updated } = await importPaths([musicDir, musicDir])
  expect(found).toBe(7)
  expect(updated).toEqual([])
  const byFile = Object.fromEntries(added.map((track) => [track.path.slice(musicDir.length + 1), track]))
  expect(Object.keys(byFile).sort()).toEqual([
    'Album\\01 First.mp3',
    'Album\\02 Second.mp3',
    'Album\\Disc 2\\03 Live.m4a',
    'Broken.FLAC',
    'Downloads\\07. Artist Two – Song Name (Official Video).mp3',
    'Downloads\\Real Friends - Late Nights In My Car.mp3',
    'Loose.wav'
  ])

  expect(byFile['Album\\01 First.mp3']).toMatchObject({
    format: 'mp3',
    title: 'First Song',
    artist: 'The Testers',
    album: 'Night Drive',
    trackNumber: 1,
    year: 2024
  })

  // Both album songs share one saved cover file.
  const artworkId = byFile['Album\\01 First.mp3'].artworkId
  expect(artworkId).toMatch(/^[a-f0-9]{40}\.png$/)
  expect(byFile['Album\\02 Second.mp3'].artworkId).toBe(artworkId)
  expect(existsSync(join(dataDir, 'artwork', artworkId!))).toBe(true)

  // Files that can't be read still come back, titled by their file names.
  expect(byFile['Broken.FLAC']).toMatchObject({ format: 'flac', title: 'Broken', artist: null, duration: null })
  expect(byFile['Album\\Disc 2\\03 Live.m4a']).toMatchObject({ title: 'Live', trackNumber: 3 })
  expect(byFile['Loose.wav'].artworkId).toBeNull()
})

test('untagged songs get artist and title from the file name and the cover from their folder', async () => {
  const {
    added: [video, plain]
  } = await importPaths([join(musicDir, 'Downloads')])

  expect(plain).toMatchObject({ artist: 'Real Friends', title: 'Late Nights In My Car', trackNumber: null })
  expect(video).toMatchObject({ artist: 'Artist Two', title: 'Song Name', trackNumber: 7 })
  expect(plain.artworkId).toMatch(/^[a-f0-9]{40}\.png$/)
  expect(video.artworkId).toBe(plain.artworkId)
})

test('the library is still there after Encore restarts', async () => {
  const savedDir = makeDataDir()
  try {
    await app.close()
    for (const round of ['first', 'second']) {
      const encore = await launchEncore(savedDir)
      app = encore.app
      page = encore.page

      if (round === 'first') await dropFiles(songs('Album/01 First.mp3', 'Album/02 Second.mp3', 'Loose.wav'))
      await page.getByRole('tab', { name: 'Local files' }).click()
      const rows = page.getByRole('list', { name: 'Local files' }).getByRole('listitem')
      await expect(rows).toHaveCount(3)
      await expect(rows.nth(0)).toContainText('First Song')
      await expect.poll(() => rows.nth(0).locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

      if (round === 'first') await app.close()
    }
  } finally {
    await app.close()
    rmSync(savedDir, { recursive: true, force: true })
  }
})

test('importing again skips unchanged songs and re-reads changed ones', async () => {
  const changingDir = mkdtempSync(join(tmpdir(), 'encore-changing-'))
  const song = join(changingDir, 'Changing.mp3')
  try {
    writeFileSync(song, makeMp3(2, { title: 'Old Title', artist: 'Someone' }))
    const first = await importPaths([changingDir])
    expect(first.added).toHaveLength(1)

    const again = await importPaths([changingDir])
    expect(again).toMatchObject({ found: 1, added: [], updated: [] })

    // A retagged file has a new size and modified time, so it's read again and keeps its id.
    writeFileSync(song, makeMp3(2, { title: 'New Title', artist: 'Someone' }))
    utimesSync(song, new Date(), new Date(Date.now() + 5000))
    const changed = await importPaths([changingDir])
    expect(changed.added).toEqual([])
    expect(changed.updated).toHaveLength(1)
    expect(changed.updated[0]).toMatchObject({ id: first.added[0].id, title: 'New Title' })
  } finally {
    rmSync(changingDir, { recursive: true, force: true })
  }
})

test('the artwork scheme only serves artwork files', async () => {
  const status = (url: string): Promise<number> => app.evaluate(({ net }, u) => net.fetch(u).then((r) => r.status), url)
  expect(await status('encore-art://local/..%2F..%2FLocal%20State')).toBe(404)
  expect(await status('encore-art://local/not-an-id.png')).toBe(404)
})

test('the window stays on Encore when a drop misses the handler', async () => {
  const url = page.url()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(`location.href = 'file:///C:/'`))
  await page.waitForTimeout(300)
  expect(page.url()).toBe(url)
})
