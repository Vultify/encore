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

// Six Linkin Park songs across two albums, plus songs that test accents and close matches.
test.beforeAll(() => {
  musicDir = mkdtempSync(join(tmpdir(), 'encore-search-'))
  const cover = readFileSync('resources/icon.png')
  const songs: [string, string, string][] = [
    ['Numb', 'Linkin Park', 'Meteora'],
    ['Faint', 'Linkin Park', 'Meteora'],
    ['Somewhere I Belong', 'Linkin Park', 'Meteora'],
    ['In the End', 'Linkin Park', 'Hybrid Theory'],
    ['Crawling', 'Linkin Park', 'Hybrid Theory'],
    ['Papercut', 'Linkin Park', 'Hybrid Theory'],
    ['Halo', 'Beyoncé', 'I Am... Sasha Fierce'],
    ['Numbers', 'Other Band', 'Counting']
  ]
  songs.forEach(([title, artist, album], i) => {
    const folder = join(musicDir, album.replace(/\W+/g, ' ').trim())
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, `${i}.mp3`), makeMp3(2, { title, artist, album, track: String(i + 1), cover }))
  })
})

test.afterAll(() => {
  rmSync(musicDir, { recursive: true, force: true })
})

test.beforeEach(async () => {
  const encore = await launchEncore()
  app = encore.app
  page = encore.page
  await page.evaluate(async (dir) => {
    const { encore } = window as unknown as { encore: EncoreApi }
    await encore.library.importPaths([dir])
    await encore.playlists.create('Workout Mix')
  }, musicDir)
  await page.reload()
})

test.afterEach(async () => {
  await app.close()
})

const searchPanel = (): Locator => page.getByRole('region', { name: 'Search' })
const searchBox = (): Locator => page.getByRole('searchbox')

async function search(text: string): Promise<void> {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Search' }).click()
  await searchBox().fill(text)
}

test('a loose search finds the artist and their songs, five at a time', async () => {
  await search('lin park')
  await expect(searchPanel().getByRole('list', { name: 'Artist results' })).toHaveText([/Linkin Park/])
  const songs = searchPanel().getByRole('list', { name: 'Song results' }).getByRole('listitem')
  await expect(songs).toHaveCount(5)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/search.png' })

  await searchPanel().getByRole('button', { name: 'Show all 6 songs' }).click()
  await expect(songs).toHaveCount(6)
  await searchPanel().getByRole('button', { name: 'Show less' }).click()
  await expect(songs).toHaveCount(5)
})

test('playing a song from the results keeps Encore calm instead of redrawing nonstop', async () => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  // How busy the window's renderer has been since the last call, in percent of one core.
  const busy = (): Promise<number> =>
    app.evaluate(({ app }) => Math.max(...app.getAppMetrics().filter((metric) => metric.type === 'Tab').map((metric) => metric.cpu.percentCPUUsage)))

  await search('lin park')
  await searchPanel().getByRole('list', { name: 'Song results' }).getByRole('listitem').first().dblclick()
  await expect(page.getByRole('region', { name: 'Player' }).getByRole('button', { name: 'Pause' })).toBeVisible()
  await busy()
  await page.waitForTimeout(1500)
  expect(await busy()).toBeLessThan(50)
  expect(errors.filter((text) => text.includes('Maximum update depth'))).toEqual([])
})

test('accents and album names match too', async () => {
  await search('beyonce')
  await expect(searchPanel().getByRole('list', { name: 'Song results' })).toContainText('Halo')

  await searchBox().fill('sasha')
  await expect(searchPanel().getByRole('list', { name: 'Album results' })).toContainText('I Am... Sasha Fierce')
})

test('an exact title comes first', async () => {
  await search('numb')
  await expect(searchPanel().getByRole('list', { name: 'Song results' }).getByRole('listitem')).toHaveText([/^.*Numb.*Linkin Park/, /Numbers/])
})

test('results open their page in the library', async () => {
  const library = page.getByRole('region', { name: 'Library' })

  await search('meteora')
  await searchPanel().getByRole('button', { name: /^Meteora/ }).click()
  await expect(library.getByRole('heading', { name: 'Meteora' })).toBeVisible()
  await expect(library.getByRole('tab', { name: 'Albums' })).toHaveAttribute('aria-selected', 'true')

  await search('linkin')
  await searchPanel().getByRole('button', { name: /^Linkin Park/ }).click()
  await expect(library.getByRole('heading', { name: 'Linkin Park' })).toBeVisible()

  await search('workout')
  await searchPanel().getByRole('button', { name: /^Workout Mix/ }).click()
  await expect(library.getByRole('heading', { name: 'Workout Mix' })).toBeVisible()

  // Going back from a page opened by search lands on that tab's grid.
  await library.getByRole('button', { name: 'Playlists' }).click()
  await expect(library.getByRole('list', { name: 'Playlists' })).toBeVisible()
})

test('play straight from the results', async () => {
  await search('hybrid')
  await searchPanel().getByRole('list', { name: 'Album results' }).getByRole('listitem').filter({ hasText: 'Hybrid Theory' }).hover()
  await searchPanel().getByRole('button', { name: 'Play Hybrid Theory' }).click()
  await expect(page.getByRole('region', { name: 'Player' })).toContainText('In the End')
})

test('no matches, Escape to clear, and the search is kept when coming back', async () => {
  await search('zzzz')
  await expect(searchPanel().getByText('No matches')).toBeVisible()

  await searchBox().press('Escape')
  await expect(searchBox()).toHaveValue('')
  await expect(searchPanel().getByText('Search your music')).toBeVisible()

  await searchBox().fill('faint')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Library' }).click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Search' }).click()
  await expect(searchBox()).toHaveValue('faint')
  await expect(searchPanel().getByRole('list', { name: 'Song results' })).toContainText('Faint')
})

test('Ctrl + F opens search from anywhere, ready to type', async () => {
  await page.locator('body').click({ position: { x: 5, y: 300 } })
  await page.keyboard.press('Control+f')
  await expect(searchBox()).toBeFocused()

  // Pressing it again while already on search puts the cursor back in the box.
  await searchBox().blur()
  await page.keyboard.press('Control+f')
  await expect(searchBox()).toBeFocused()
})

test('the clear button empties the box and keeps the cursor in it', async () => {
  await search('numb')
  await searchPanel().getByRole('button', { name: 'Clear search' }).click()
  await expect(searchBox()).toHaveValue('')
  await expect(searchBox()).toBeFocused()
  await expect(searchPanel().getByRole('button', { name: 'Clear search' })).toBeHidden()
})

test('tall results never squeeze the title bar', async () => {
  const titleBarHeight = () => page.getByRole('navigation', { name: 'Main' }).evaluate((nav) => nav.parentElement!.getBoundingClientRect().height)
  const before = await titleBarHeight()
  await search('lin park')
  await searchPanel().getByRole('button', { name: 'Show all 6 songs' }).click()
  expect(await titleBarHeight()).toBe(before)
})
