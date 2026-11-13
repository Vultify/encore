/// <reference lib="dom" />
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { makeMp3 } from './fixtures/audio'
import { importFolder, launchEncore, makeDataDir, TempDirs } from './launch'

let app: ElectronApplication
let page: Page
const temp = new TempDirs()

test.afterEach(async () => {
  await app?.close()
  temp.removeAll()
})

// Two albums by two artists. Six-second songs count as played after three seconds of listening, so tests listen
// for four, since the dock rounds the time it shows.
function makeAlbums(): string {
  const dir = temp.make('encore-home-')
  writeFileSync(join(dir, '01 Opening.mp3'), makeMp3(6, { title: 'Opening', artist: 'Band', album: 'First Album', track: '1' }))
  writeFileSync(join(dir, '02 Middle.mp3'), makeMp3(6, { title: 'Middle', artist: 'Band', album: 'First Album', track: '2' }))
  writeFileSync(join(dir, '03 Arrival.mp3'), makeMp3(6, { title: 'Arrival', artist: 'Other Band', album: 'Second Album', track: '1' }))
  return dir
}

async function open(dataDir?: string, music?: string): Promise<void> {
  ;({ app, page } = await launchEncore(dataDir))
  if (music) {
    await importFolder(page, music)
    await page.reload()
  }
  await nav('Home')
}

const nav = (name: string): Promise<void> => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name }).click()
const home = (): Locator => page.getByRole('region', { name: 'Home' })
const card = (name: string): Locator => home().getByRole('region', { name })
const dock = (): Locator => page.getByRole('region', { name: 'Player' })

const elapsed = async (): Promise<number> => {
  const [m, s] = (await dock().getByText(/\d+:\d\d \//).textContent())!.split(' /')[0].split(':').map(Number)
  return m * 60 + s
}

// Plays a song from Local files for at least the given number of seconds, then pauses it.
async function listen(title: string, seconds: number): Promise<void> {
  await nav('Library')
  await page.getByRole('tab', { name: 'Local files' }).click()
  await page.getByRole('list', { name: 'Local files' }).getByRole('listitem').filter({ hasText: title }).dblclick()
  await expect(dock()).toContainText(title)
  await expect.poll(elapsed, { timeout: 8000 }).toBeGreaterThanOrEqual(seconds)
  await dock().getByRole('button', { name: 'Pause' }).click()
  await nav('Home')
}

test('with no music yet, Home says where music comes from and links to Settings', async () => {
  await open()
  await expect(home().getByRole('heading', { name: /^Good (morning|afternoon|evening)$/ })).toBeVisible()
  await expect(home()).toContainText('Your music lives here')
  await home().getByRole('button', { name: 'Add a music folder' }).click()
  await expect(page.getByRole('region', { name: 'Settings' })).toBeVisible()
})

test('before anything is played, Home explains that stats grow with listening', async () => {
  await open(undefined, makeAlbums())
  await expect(home()).toContainText('Your stats grow as you listen')
  await expect(home().getByRole('radiogroup', { name: 'Time span' })).toHaveCount(0)
  await home().getByRole('button', { name: 'Go to your library' }).click()
  await expect(page.getByRole('region', { name: 'Library' })).toBeVisible()
})

test('listening fills in the time, top songs, top artists, and the mix, and it all stays after a restart', async () => {
  const dataDir = makeDataDir()
  temp.keep(dataDir)
  await open(dataDir, makeAlbums())

  // Played past halfway: one play. Skipped after a second: listening time, but no play.
  await listen('Middle', 4)
  await listen('Arrival', 1)

  await expect(card('Listening time').locator('span').filter({ hasText: /^\d+s$/ })).toBeVisible()
  await expect(card('Listening time')).toContainText('listened in the last 30 days')
  await expect(card('Listening time').getByRole('list', { name: 'Listening time by day' }).getByRole('listitem')).toHaveCount(30)

  const songs = card('Top songs').getByRole('listitem')
  await expect(songs).toHaveCount(1)
  await expect(songs.first()).toContainText('Middle')
  await expect(songs.first()).toContainText('1 play')

  const artists = card('Top artists').getByRole('listitem')
  await expect(artists).toHaveCount(2)
  await expect(artists.first()).toContainText('Band')

  await expect(card('Your Top 25')).toContainText('1 song so far')
  await card('Your Top 25').getByRole('button', { name: 'Show the songs' }).click()
  await expect(card('Your Top 25').getByRole('list', { name: 'Your Top 25' })).toContainText('Middle')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/home-stats.png' })
  await app.close()

  await open(dataDir)
  await expect(card('Top songs').getByRole('listitem').first()).toContainText('Middle')
  await expect(card('Top artists').getByRole('listitem')).toHaveCount(2)
})

test('the time span switch changes the chart, and the mix plays and shuffles', async () => {
  await open(undefined, makeAlbums())
  await listen('Opening', 4)

  const spans = home().getByRole('radiogroup', { name: 'Time span' })
  await expect(spans.getByRole('radio', { name: 'Month' })).toHaveAttribute('aria-checked', 'true')
  const bars = card('Listening time').getByRole('listitem')
  for (const [span, count, phrase] of [['Week', 7, 'in the last 7 days'], ['Year', 12, 'in the last 12 months'], ['All time', 6, 'all time']] as const) {
    await spans.getByRole('radio', { name: span }).click()
    await expect(card('Listening time')).toContainText(`listened ${phrase}`)
    await expect(bars).toHaveCount(count)
    await expect(card('Top songs')).toContainText('Opening')
  }

  // The span stays picked after visiting another view.
  await nav('Library')
  await nav('Home')
  await expect(spans.getByRole('radio', { name: 'All time' })).toHaveAttribute('aria-checked', 'true')

  await card('Your Top 25').getByRole('button', { name: 'Play', exact: true }).click()
  await expect(dock()).toContainText('Opening')
  await expect(dock().getByRole('button', { name: 'Pause' })).toBeVisible()
  await dock().getByRole('button', { name: 'Pause' }).click()

  await card('Your Top 25').getByRole('button', { name: 'Shuffle', exact: true }).click()
  await expect(dock().getByRole('button', { name: 'Shuffle' })).toHaveAttribute('aria-pressed', 'true')
  await expect(dock().getByRole('button', { name: 'Pause' })).toBeVisible()
})

test('liking a song in the mix shows the heart right away', async () => {
  await open(undefined, makeAlbums())
  await listen('Opening', 4)

  const mix = card('Your Top 25')
  await mix.getByRole('button', { name: 'Show the songs' }).click()
  const row = mix.getByRole('list', { name: 'Your Top 25' }).getByRole('listitem').filter({ hasText: 'Opening' })
  await expect(row.getByRole('img', { name: 'Liked' })).toHaveCount(0)
  await row.click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: 'Like', exact: true }).click()
  await expect(row.getByRole('img', { name: 'Liked' })).toBeVisible()
})

test('the mix size is set in Settings and rounds to the nearest five', async () => {
  await open(undefined, makeAlbums())
  await listen('Opening', 4)

  await nav('Settings')
  const size = page.getByRole('region', { name: 'Settings' }).getByRole('spinbutton', { name: 'Top songs mix size' })
  await expect(size).toHaveValue('25')
  await size.fill('12')
  await size.press('Enter')
  await expect(size).toHaveValue('10')
  await size.fill('500')
  await size.blur()
  await expect(size).toHaveValue('100')
  await size.fill('23')
  await size.press('Enter')
  await expect(size).toHaveValue('25')
  await size.fill('12')
  await size.press('Enter')

  await nav('Home')
  await expect(card('Your Top 10')).toBeVisible()
})
