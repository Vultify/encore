import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import type { EncoreApi } from '../src/shared/api'
import { makeMp3 } from './fixtures/audio'
import { launchEncore } from './launch'

let app: ElectronApplication
let page: Page
let musicDir: string
let library: Locator

// An album with a cover, a compilation folder with two artists and no album artist tag, and one untagged song.
test.beforeAll(() => {
  musicDir = mkdtempSync(join(tmpdir(), 'encore-browse-'))
  const cover = readFileSync('resources/icon.png')
  const nightDrive = { artist: 'The Testers', album: 'Night Drive', year: '2024', cover }

  mkdirSync(join(musicDir, 'Night Drive'))
  writeFileSync(join(musicDir, 'Night Drive', 'b.mp3'), makeMp3(3, { ...nightDrive, title: 'Second Song', track: '2' }))
  writeFileSync(join(musicDir, 'Night Drive', 'a.mp3'), makeMp3(4, { ...nightDrive, title: 'First Song', track: '1' }))

  mkdirSync(join(musicDir, 'Mix'))
  writeFileSync(join(musicDir, 'Mix', '1.mp3'), makeMp3(2, { artist: 'Artist A', album: 'Summer Mix', title: 'Sunny', track: '1' }))
  writeFileSync(join(musicDir, 'Mix', '2.mp3'), makeMp3(2, { artist: 'Artist B', album: 'Summer Mix', title: 'Breezy', track: '2' }))

  writeFileSync(join(musicDir, 'Solo Person - Loose Track.mp3'), makeMp3(2, {}))
})

test.afterAll(() => {
  rmSync(musicDir, { recursive: true, force: true })
})

test.beforeEach(async () => {
  const encore = await launchEncore()
  app = encore.app
  page = encore.page
  library = page.getByRole('region', { name: 'Library' })
  await page.evaluate((dir) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths([dir]), musicDir)
  await page.reload()
})

test.afterEach(async () => {
  await app.close()
})

const dock = (): Locator => page.getByRole('region', { name: 'Player' })

test('albums are grouped, with compilations kept together and untagged songs left out', async () => {
  await library.getByRole('tab', { name: 'Albums' }).click()
  const cards = library.getByRole('list', { name: 'Albums' }).getByRole('listitem')

  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0)).toContainText('Night Drive')
  await expect(cards.nth(0)).toContainText('The Testers')
  await expect(cards.nth(1)).toContainText('Summer Mix')
  await expect(cards.nth(1)).toContainText('Various artists')
  await expect.poll(() => cards.nth(0).locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'test-results/albums.png' })
})

test('an album page lists its songs in track order and goes back to the grid', async () => {
  await library.getByRole('tab', { name: 'Albums' }).click()
  await library.getByRole('button', { name: /^Night Drive/ }).click()

  await expect(library.getByRole('heading', { name: 'Night Drive' })).toBeVisible()
  await expect(library).toContainText('The Testers · 2024 · 2 songs')
  const rows = library.getByRole('list', { name: 'Night Drive songs' }).getByRole('listitem')
  await expect(rows.nth(0)).toContainText('1First Song')
  await expect(rows.nth(1)).toContainText('2Second Song')
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'test-results/album-page.png' })

  await library.getByRole('button', { name: 'Albums' }).click()
  await expect(library.getByRole('list', { name: 'Albums' })).toBeVisible()
})

test('playing an album queues just that album, in order', async () => {
  await library.getByRole('tab', { name: 'Albums' }).click()
  await library.getByRole('listitem').filter({ hasText: 'Night Drive' }).hover()
  await library.getByRole('button', { name: 'Play Night Drive' }).click()

  await expect(dock()).toContainText('First Song')
  await dock().getByRole('button', { name: 'Next song' }).click()
  await expect(dock()).toContainText('Second Song')
  await expect(dock().getByRole('button', { name: 'Next song' })).toBeDisabled()
})

test('artist pages show their albums and songs, and open albums in place', async () => {
  await library.getByRole('tab', { name: 'Artists' }).click()
  const artists = library.getByRole('list', { name: 'Artists' }).getByRole('listitem')
  await expect(artists).toHaveText([/Artist A/, /Artist B/, /Solo Person/, /The Testers/])
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'test-results/artists.png' })

  await library.getByRole('button', { name: /^The Testers/ }).click()
  await expect(library.getByRole('heading', { name: 'The Testers' })).toBeVisible()
  await expect(library.getByRole('list', { name: 'The Testers albums' })).toContainText('Night Drive')
  await expect(library.getByRole('list', { name: 'The Testers songs' }).getByRole('listitem')).toHaveCount(2)

  // The compilation shows up under each artist on it.
  await library.getByRole('button', { name: 'Artists' }).click()
  await library.getByRole('button', { name: /^Artist B/ }).click()
  await expect(library.getByRole('list', { name: 'Artist B albums' })).toContainText('Summer Mix')

  // Opening an album from an artist page comes back to that artist.
  await library.getByRole('button', { name: /^Summer Mix/ }).click()
  await expect(library.getByRole('heading', { name: 'Summer Mix' })).toBeVisible()
  await library.getByRole('button', { name: 'Artist B' }).click()
  await expect(library.getByRole('heading', { name: 'Artist B' })).toBeVisible()
})

test('switching tabs closes an open page', async () => {
  await library.getByRole('tab', { name: 'Albums' }).click()
  await library.getByRole('button', { name: /^Night Drive/ }).click()
  await library.getByRole('tab', { name: 'Playlists' }).click()
  await expect(library.getByRole('list', { name: 'Playlists' })).toContainText('Liked Songs')

  await library.getByRole('tab', { name: 'Albums' }).click()
  await expect(library.getByRole('list', { name: 'Albums' })).toBeVisible()
})
