/// <reference lib="dom" />
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import type { Rectangle } from 'electron'
import type { NowPlaying } from '../src/shared/api'
import { makeMp3, makeWav } from './fixtures/audio'
import { makePng } from './fixtures/png'
import { type Encore, importFolder, launchEncore, makeDataDir, TempDirs } from './launch'

let musicDir: string
let encore: Encore | null
// Data folders a test keeps across restarts, removed once Encore has closed.
const temp = new TempDirs()

test.beforeAll(() => {
  musicDir = mkdtempSync(join(tmpdir(), 'encore-desktop-'))
  writeFileSync(join(musicDir, 'Band - Song A.wav'), makeWav(8))
  writeFileSync(join(musicDir, 'Band - Song B.wav'), makeWav(6))
  writeFileSync(join(musicDir, 'Band - Song C.mp3'), makeMp3(5, { title: 'Song C', artist: 'Band', cover: makePng(40, 40, [200, 40, 60]) }))
})

test.afterAll(() => {
  rmSync(musicDir, { recursive: true, force: true })
})

test.afterEach(async () => {
  await encore?.app.close()
  encore = null
  temp.removeAll()
})

const dock = (page: Page): Locator => page.getByRole('region', { name: 'Player' })
const song = (page: Page, title: string): Locator => page.getByRole('listitem').filter({ hasText: title })

const elapsed = async (page: Page): Promise<number> => {
  const [m, s] = (await dock(page).getByText(/\d+:\d\d \//).textContent())!.split(' /')[0].split(':').map(Number)
  return m * 60 + s
}

// Opens Encore on the test songs. Importing only needs doing once per data folder.
async function open(dataDir?: string, importSongs = true): Promise<Page> {
  await encore?.app.close()
  encore = await launchEncore(dataDir)
  const { page } = encore
  if (importSongs) {
    await importFolder(page, musicDir)
    await page.reload()
  }
  await page.getByRole('tab', { name: 'Local files' }).click()
  return page
}

const app = (): ElectronApplication => encore!.app

const hideWindow = (): Promise<void> => app().evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide())
const windowVisible = (): Promise<boolean> => app().evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())
const windowBounds = (): Promise<Rectangle> => app().evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())
const setWindowBounds = (bounds: Rectangle): Promise<void> =>
  app().evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0].setBounds(value), bounds)

// What the tray was last told is playing, caught on its way into the main process.
async function watchNowPlaying(): Promise<() => Promise<NowPlaying | undefined>> {
  await app().evaluate(({ ipcMain }) => {
    ipcMain.on('player:now-playing', (_event, now) => {
      ;(globalThis as { lastNowPlaying?: unknown }).lastNowPlaying = now
    })
  })
  return () => app().evaluate(() => (globalThis as { lastNowPlaying?: NowPlaying }).lastNowPlaying)
}

const sendCommand = (command: string): Promise<void> =>
  app().evaluate(({ BrowserWindow }, name) => BrowserWindow.getAllWindows()[0].webContents.send('player:command', name), command)

test('music keeps playing, and moves on to the next song, while Encore is in the tray', async () => {
  const page = await open()
  await song(page, 'Song A').dblclick()
  await expect(dock(page)).toContainText('/ 0:08')
  await dock(page).getByLabel('Seek').fill('7')

  await hideWindow()
  expect(await windowVisible()).toBe(false)
  await expect(dock(page)).toContainText('Song B', { timeout: 6000 })
  await expect.poll(() => elapsed(page), { timeout: 4000 }).toBeGreaterThanOrEqual(1)
  expect(await windowVisible()).toBe(false)
})

test('the tray hears what is playing and its buttons control the player', async () => {
  const page = await open()
  const lastReport = await watchNowPlaying()

  await song(page, 'Song C').dblclick()
  await expect.poll(lastReport).toMatchObject({ title: 'Song C', artist: 'Band', playing: true, hasNext: false })

  await sendCommand('toggle')
  await expect(dock(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect.poll(lastReport).toMatchObject({ title: 'Song C', playing: false })

  await sendCommand('previous')
  await expect(dock(page)).toContainText('Song B')
  await expect.poll(lastReport).toMatchObject({ title: 'Song B', hasNext: true })

  await sendCommand('next')
  await expect(dock(page)).toContainText('Song C')
})

test('the Windows media overlay shows the song, its cover, and whether it plays', async () => {
  const page = await open()
  const session = (): Promise<{ title?: string; artist?: string; artwork?: string; state: string }> =>
    page.evaluate(() => ({
      title: navigator.mediaSession.metadata?.title,
      artist: navigator.mediaSession.metadata?.artist,
      artwork: navigator.mediaSession.metadata?.artwork[0]?.src,
      state: navigator.mediaSession.playbackState
    }))

  expect((await session()).state).toBe('none')
  await song(page, 'Song C').dblclick()
  await expect.poll(session).toMatchObject({ title: 'Song C', artist: 'Band', state: 'playing' })
  await expect.poll(async () => (await session()).artwork ?? '').toMatch(/^blob:/)

  await dock(page).getByRole('button', { name: 'Pause' }).click()
  await expect.poll(async () => (await session()).state).toBe('paused')
})

// An album without an album artist tag is kept together by its folder, so its key holds the whole folder path.
test('an album with a long name in a long folder still reopens where listening left off', async () => {
  const dataDir = temp.keep(makeDataDir())
  const parent = temp.make('encore-desktop-')
  const albumDir = join(parent, 'Various Artists - Original Motion Picture Soundtrack [Deluxe]')
  mkdirSync(albumDir)
  const album = 'The Complete Original Motion Picture Soundtrack, Deluxe Anniversary Edition with Bonus Tracks and Alternate Takes'
  writeFileSync(join(albumDir, '01 Main Theme.mp3'), makeMp3(6, { title: 'Main Theme', artist: 'Orchestra', album, track: '1' }))

  encore = await launchEncore(dataDir)
  let page = encore.page
  await importFolder(page, albumDir)
  await page.reload()
  const library = page.getByRole('region', { name: 'Library' })
  await library.getByRole('tab', { name: 'Albums' }).click()
  await library.getByRole('button', { name: /^The Complete Original/ }).click()
  await library.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(dock(page)).toContainText('Main Theme')
  await dock(page).getByRole('button', { name: 'Pause' }).click()

  page = await open(dataDir, false)
  await expect(dock(page)).toContainText('Main Theme')
  await expect(dock(page).getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
})

test('reopens where listening left off, at the same size and spot', async () => {
  const dataDir = temp.keep(makeDataDir())
  let page = await open(dataDir)
  await song(page, 'Song A').dblclick()
  await expect(dock(page)).toContainText('/ 0:08')
  await song(page, 'Song C').click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: 'Add to queue', exact: true }).click()
  await dock(page).getByLabel('Seek').fill('4')
  await dock(page).getByRole('button', { name: 'Pause' }).click()
  await dock(page).getByRole('button', { name: 'Mute' }).hover()
  await dock(page).getByLabel('Volume').fill('0.5')
  await dock(page).getByRole('button', { name: 'Repeat off' }).click()
  await setWindowBounds({ x: 120, y: 90, width: 1100, height: 720 })

  page = await open(dataDir, false)
  await expect(dock(page)).toContainText('Song A')
  await expect(dock(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  expect(await elapsed(page)).toBe(4)
  await dock(page).getByRole('button', { name: 'Mute' }).hover()
  await expect(dock(page).getByLabel('Volume')).toHaveValue('0.5')
  await expect(dock(page).getByRole('button', { name: 'Repeat all' })).toHaveAttribute('aria-pressed', 'true')

  // Windows can round a window's size by a pixel at some display scales.
  const bounds = await windowBounds()
  for (const [key, value] of Object.entries({ x: 120, y: 90, width: 1100, height: 720 })) {
    expect(Math.abs(bounds[key as keyof Rectangle] - value)).toBeLessThanOrEqual(2)
  }

  // Playing picks up from the saved spot, with the queued song and the rest of the list still lined up.
  await dock(page).getByRole('button', { name: 'Play', exact: true }).click()
  await expect(dock(page).getByRole('button', { name: 'Pause' })).toBeVisible()
  expect(await elapsed(page)).toBeGreaterThanOrEqual(4)
  await dock(page).getByRole('button', { name: 'Next' }).click()
  await expect(dock(page)).toContainText('Song C')
  await dock(page).getByRole('button', { name: 'Next' }).click()
  await expect(dock(page)).toContainText('Song B')
})

test('a window spot on a screen that is gone, or a damaged settings file, falls back to the default', async () => {
  const dataDir = temp.keep(makeDataDir())
  writeFileSync(join(dataDir, 'settings.json'), JSON.stringify({ window: { x: -20000, y: -20000, width: 1100, height: 720, maximized: false } }))
  await open(dataDir)
  expect((await windowBounds()).x).toBeGreaterThan(-20000)

  writeFileSync(join(dataDir, 'settings.json'), '{ not json')
  const page = await open(dataDir, false)
  await expect(song(page, 'Song A')).toBeVisible()
})
