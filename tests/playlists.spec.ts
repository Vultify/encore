import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import type { EncoreApi } from '../src/shared/api'
import { makeWav } from './fixtures/audio'
import { importFolder, launchEncore, makeDataDir } from './launch'

let app: ElectronApplication
let page: Page
let musicDir: string
let library: Locator

test.beforeAll(() => {
  musicDir = mkdtempSync(join(tmpdir(), 'encore-playlists-'))
  for (const name of ['Alpha', 'Bravo', 'Charlie']) writeFileSync(join(musicDir, `Band - ${name}.wav`), makeWav(3))
})

test.afterAll(() => {
  rmSync(musicDir, { recursive: true, force: true })
})

async function start(dataDir?: string): Promise<void> {
  const encore = await launchEncore(dataDir)
  app = encore.app
  page = encore.page
  library = page.getByRole('region', { name: 'Library' })
}

async function importSongs(): Promise<void> {
  await importFolder(page, musicDir)
  await page.reload()
}

test.beforeEach(async () => {
  await start()
  await importSongs()
})

test.afterEach(async () => {
  await app.close()
})

const tab = (name: string): Promise<void> => library.getByRole('tab', { name }).click()
const song = (title: string): Locator => library.getByRole('listitem').filter({ hasText: title })
const menuItem = (name: string): Locator => page.getByRole('menu').getByRole('menuitem', { name, exact: true })
const tiles = (): Locator => library.getByRole('list', { name: 'Playlists' }).getByRole('listitem')

// Makes a playlist from the New playlist tile, names it, and goes back to the grid.
async function newPlaylist(name: string): Promise<void> {
  await tab('Playlists')
  await library.getByRole('button', { name: /^New playlist/ }).click()
  await nameDialog(name)
  await expect(library.getByRole('heading', { name })).toBeVisible()
  await library.getByRole('button', { name: 'Playlists' }).click()
}

// Types a name into the New playlist box and presses Enter. The suggested name starts selected.
async function nameDialog(name: string): Promise<void> {
  const field = page.getByRole('dialog', { name: 'New playlist' }).getByRole('textbox', { name: 'Name' })
  await expect(field).toBeFocused()
  await field.fill(name)
  await field.press('Enter')
  await expect(page.getByRole('dialog')).toBeHidden()
}

async function addToPlaylist(title: string, playlist: string): Promise<void> {
  await tab('Local files')
  await song(title).click({ button: 'right' })
  await menuItem(playlist).click()
  await expect(page.getByRole('status').filter({ hasText: `Added to ${playlist}` })).toBeVisible()
}

test('make a playlist, add songs from the right-click menu, and play it in order', async () => {
  await newPlaylist('Road Trip')
  await expect(tiles()).toHaveText([/Liked Songs/, /Road Trip/, /New playlist/])

  await addToPlaylist('Charlie', 'Road Trip')
  await addToPlaylist('Alpha', 'Road Trip')

  // Adding the same song twice is caught.
  await song('Alpha').click({ button: 'right' })
  await menuItem('Road Trip').click()
  await expect(page.getByRole('status').filter({ hasText: 'Already in Road Trip' })).toBeVisible()

  await tab('Playlists')
  await expect(tiles().nth(1)).toContainText('2 songs')
  await library.getByRole('button', { name: /^Road Trip/ }).click()
  const rows = library.getByRole('list', { name: 'Road Trip songs' }).getByRole('listitem')
  await expect(rows).toHaveText([/Charlie/, /Alpha/])
  await page.screenshot({ path: 'test-results/playlist-page.png' })

  await library.getByRole('button', { name: 'Play', exact: true }).click()
  const dock = page.getByRole('region', { name: 'Player' })
  await expect(dock).toContainText('Charlie')
  await dock.getByRole('button', { name: 'Next song' }).click()
  await expect(dock).toContainText('Alpha')
  await expect(dock.getByRole('button', { name: 'Next song' })).toBeDisabled()
})

test('new playlist straight from a song', async () => {
  await tab('Local files')
  await song('Bravo').click({ button: 'right' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/song-menu.png' })
  await menuItem('New playlist').click()

  // The box suggests a name, and typing replaces it.
  const field = page.getByRole('dialog', { name: 'New playlist' }).getByRole('textbox', { name: 'Name' })
  await expect(field).toHaveValue('Playlist 1')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/name-dialog.png' })
  await nameDialog('Gym')
  await expect(page.getByRole('status').filter({ hasText: 'Added to Gym' })).toBeVisible()

  await tab('Playlists')
  await expect(tiles().nth(1)).toContainText('Gym')
  await expect(tiles().nth(1)).toContainText('1 song')
})

test('cancelling the name box makes nothing', async () => {
  await tab('Playlists')
  await library.getByRole('button', { name: /^New playlist/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await tab('Local files')
  await song('Alpha').click({ button: 'right' })
  await menuItem('New playlist').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  await tab('Playlists')
  await expect(tiles()).toHaveText([/Liked Songs/, /New playlist/])
})

test('the ⋯ button opens the same menu as right-click', async () => {
  await tab('Local files')
  await song('Charlie').hover()
  await song('Charlie').getByRole('button', { name: 'More options for Charlie' }).click()
  await expect(page.getByRole('menu', { name: 'Charlie options' })).toBeVisible()
  await expect(menuItem('Play next')).toBeFocused()

  // The arrow keys move through the menu, past the divider, to Like.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(menuItem('Like')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(song('Charlie').getByRole('img', { name: 'Liked' })).toBeVisible()
})

test('drag songs into a new order, and remove one', async () => {
  await newPlaylist('Mix')
  for (const title of ['Alpha', 'Bravo', 'Charlie']) await addToPlaylist(title, 'Mix')

  await tab('Playlists')
  await library.getByRole('button', { name: /^Mix/ }).click()
  const rows = library.getByRole('list', { name: 'Mix songs' }).getByRole('listitem')
  await expect(rows).toHaveText([/Alpha/, /Bravo/, /Charlie/])

  // Drag Charlie onto the top half of Alpha, so it lands first.
  await rows.nth(2).dragTo(rows.nth(0), { targetPosition: { x: 200, y: 5 } })
  await expect(rows).toHaveText([/Charlie/, /Alpha/, /Bravo/])

  await rows.nth(1).click({ button: 'right' })
  await menuItem('Remove from this playlist').click()
  await expect(rows).toHaveText([/Charlie/, /Bravo/])

  // The new order is saved, not just shown.
  const saved = await page.evaluate(() => (window as unknown as { encore: EncoreApi }).encore.playlists.list())
  expect(saved[0].entries).toHaveLength(2)
})

test('drag playlists into a new order', async () => {
  await newPlaylist('First')
  await newPlaylist('Second')
  await expect(tiles()).toHaveText([/Liked Songs/, /First/, /Second/, /New playlist/])

  await tiles().nth(2).dragTo(tiles().nth(1), { targetPosition: { x: 5, y: 40 } })
  await expect(tiles()).toHaveText([/Liked Songs/, /Second/, /First/, /New playlist/])
})

test('rename and delete a playlist, keeping its songs in the library', async () => {
  await newPlaylist('Old Name')
  await addToPlaylist('Alpha', 'Old Name')
  await tab('Playlists')
  await library.getByRole('button', { name: /^Old Name/ }).click()

  await library.getByRole('button', { name: 'Rename playlist' }).click()
  const field = library.getByRole('textbox', { name: 'Playlist name' })
  await field.fill('Scrapped')
  await field.press('Escape')
  await expect(library.getByRole('heading', { name: 'Old Name' })).toBeVisible()

  await library.getByRole('button', { name: 'Rename playlist' }).click()
  await field.fill('New Name')
  await field.press('Enter')
  await expect(library.getByRole('heading', { name: 'New Name' })).toBeVisible()

  await library.getByRole('button', { name: 'Delete playlist' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Delete New Name?' })
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/delete-playlist.png' })
  await dialog.getByRole('button', { name: 'Delete playlist' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Deleted New Name' })).toBeVisible()
  await expect(tiles()).toHaveText([/Liked Songs/, /New playlist/])
  await tab('Local files')
  await expect(song('Alpha')).toBeVisible()
})

test('like songs from the dock and the menu, and find them in Liked Songs', async () => {
  await tab('Local files')
  await song('Bravo').dblclick()
  const dock = page.getByRole('region', { name: 'Player' })
  await dock.getByRole('button', { name: 'Like' }).click()
  await expect(dock.getByRole('button', { name: 'Remove from Liked Songs' })).toHaveAttribute('aria-pressed', 'true')
  await expect(song('Bravo').getByRole('img', { name: 'Liked' })).toBeVisible()

  await song('Charlie').click({ button: 'right' })
  await menuItem('Like').click()

  await tab('Playlists')
  await expect(tiles().nth(0)).toContainText('2 songs')
  await library.getByRole('button', { name: /^Liked Songs/ }).click()
  await expect(library.getByRole('list', { name: 'Liked Songs' }).getByRole('listitem')).toHaveText([/Charlie/, /Bravo/])

  // Unliking from the menu takes it off the list.
  await song('Charlie').click({ button: 'right' })
  await menuItem('Remove from Liked Songs').click()
  await expect(library.getByRole('list', { name: 'Liked Songs' }).getByRole('listitem')).toHaveText([/Bravo/])
})

test('playlists and likes are still there after Encore restarts', async () => {
  const dataDir = makeDataDir()
  try {
    await app.close()
    await start(dataDir)
    await importSongs()
    await newPlaylist('Keeper')
    await addToPlaylist('Bravo', 'Keeper')
    await song('Alpha').click({ button: 'right' })
    await menuItem('Like').click()
    await app.close()

    await start(dataDir)
    await tab('Playlists')
    await expect(tiles()).toHaveText([/Liked Songs.*1 song/, /Keeper.*1 song/, /New playlist/])
  } finally {
    await app.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})
