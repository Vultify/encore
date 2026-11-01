import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import type { EncoreApi } from '../src/shared/api'
import { makeWav } from './fixtures/audio'
import { dropFiles } from './drop'
import { launchEncore, makeDataDir } from './launch'

let app: ElectronApplication
let page: Page
let musicDir: string
let library: Locator

// Each test gets its own copies, since some of them delete files.
test.beforeEach(async () => {
  musicDir = mkdtempSync(join(tmpdir(), 'encore-manage-'))
  for (const name of ['Alpha', 'Bravo', 'Charlie']) writeFileSync(join(musicDir, `Band - ${name}.wav`), makeWav(4))
  await start()
  await page.evaluate((dir) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths([dir]), musicDir)
  await page.reload()
  await library.getByRole('tab', { name: 'Local files' }).click()
})

test.afterEach(async () => {
  await app.close()
  rmSync(musicDir, { recursive: true, force: true })
})

async function start(dataDir?: string): Promise<void> {
  const encore = await launchEncore(dataDir)
  app = encore.app
  page = encore.page
  library = page.getByRole('region', { name: 'Library' })
}

const song = (title: string): Locator => library.getByRole('listitem').filter({ hasText: title })
const menuItem = (name: string): Locator => page.getByRole('menu').getByRole('menuitem', { name, exact: true })
const songPath = (title: string): string => join(musicDir, `Band - ${title}.wav`)

async function removeFromLibrary(title: string): Promise<Locator> {
  await song(title).click({ button: 'right' })
  await menuItem('Remove from library').click()
  return page.getByRole('alertdialog', { name: `Remove ${title} from your library?` })
}

test('remove from library takes the song out of Encore and its playlists, but leaves the file', async () => {
  await page.evaluate(async () => {
    const { encore } = window as unknown as { encore: EncoreApi }
    const alpha = (await encore.library.getTracks()).find((track) => track.title === 'Alpha')!
    await encore.playlists.create('Keep', [alpha.id])
    await encore.library.setLiked([alpha.id], true)
  })
  await page.reload()
  await library.getByRole('tab', { name: 'Local files' }).click()

  // Cancel leaves everything alone.
  const dialog = await removeFromLibrary('Alpha')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/remove-dialog.png' })
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(song('Alpha')).toBeVisible()

  await (await removeFromLibrary('Alpha')).getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Removed Alpha from your library' })).toBeVisible()
  await expect(library.getByRole('listitem')).toHaveText([/Bravo/, /Charlie/])
  expect(existsSync(songPath('Alpha'))).toBe(true)

  await library.getByRole('tab', { name: 'Playlists' }).click()
  const tiles = library.getByRole('list', { name: 'Playlists' }).getByRole('listitem')
  await expect(tiles.nth(0)).toContainText('Liked Songs')
  await expect(tiles.nth(0)).toContainText('0 songs')
  await expect(tiles.nth(1)).toContainText('Keep')
  await expect(tiles.nth(1)).toContainText('0 songs')
})

test('removing the playing song lets it finish, then the queue carries on', async () => {
  await song('Alpha').dblclick()
  const dock = page.getByRole('region', { name: 'Player' })
  await expect(dock).toContainText('Alpha')

  await (await removeFromLibrary('Alpha')).getByRole('button', { name: 'Remove' }).click()
  await expect(dock).toContainText('Alpha')
  await expect(dock.getByRole('button', { name: 'Pause' })).toBeVisible()

  await dock.getByRole('button', { name: 'Next song' }).click()
  await expect(dock).toContainText('Bravo')
})

test('a song whose file was deleted shows as missing and can be removed', async () => {
  const dataDir = makeDataDir()
  try {
    // Import into a data folder that survives a restart, delete a file while Encore is closed, then reopen.
    await app.close()
    await start(dataDir)
    await page.evaluate((dir) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths([dir]), musicDir)
    await app.close()
    rmSync(songPath('Bravo'))
    await start(dataDir)
    await library.getByRole('tab', { name: 'Local files' }).click()

    await expect(song('Bravo')).toHaveAttribute('data-missing', 'true')
    await expect(song('Bravo')).toContainText('File not found')
    await expect(song('Alpha')).not.toHaveAttribute('data-missing', 'true')
    await page.screenshot({ path: 'test-results/missing-file.png' })

    await song('Bravo').dblclick()
    await expect(page.getByRole('status').filter({ hasText: "Can't find the file for Bravo" })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Player' })).toContainText('Not playing')

    await (await removeFromLibrary('Bravo')).getByRole('button', { name: 'Remove' }).click()
    await expect(library.getByRole('listitem')).toHaveText([/Alpha/, /Charlie/])
  } finally {
    await app.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test('a file deleted while Encore is open is marked missing when it fails to play', async () => {
  rmSync(songPath('Charlie'))
  await song('Charlie').dblclick()
  await expect(page.getByRole('status').filter({ hasText: "Couldn't play Charlie" })).toBeVisible()
  await expect(song('Charlie')).toHaveAttribute('data-missing', 'true')
})

test('putting a missing file back and adding it again brings the song back to normal', async () => {
  rmSync(songPath('Alpha'))
  await song('Alpha').dblclick()
  await expect(song('Alpha')).toHaveAttribute('data-missing', 'true')

  writeFileSync(songPath('Alpha'), makeWav(5))
  await dropFiles(page, [songPath('Alpha')])
  await expect(page.getByRole('status').filter({ hasText: 'Updated 1 song' })).toBeVisible()
  await expect(song('Alpha')).not.toHaveAttribute('data-missing', 'true')
  await expect(song('Alpha')).toContainText('wav')
})
