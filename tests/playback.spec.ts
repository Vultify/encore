import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { makeMp3, makeWav } from './fixtures/audio'
import { makePng } from './fixtures/png'
import { dropFiles } from './drop'
import { importFolder, launchEncore } from './launch'

let app: ElectronApplication
let page: Page
let musicDir: string
let library: Locator
let dock: Locator

const TITLES = ['Song A', 'Song B', 'Song C', 'Song D', 'Song E', 'Song F']

// Six short songs in list order, plus two with solid red and solid blue covers for the accent color.
test.beforeAll(() => {
  musicDir = mkdtempSync(join(tmpdir(), 'encore-playback-'))
  for (const title of TITLES) writeFileSync(join(musicDir, `Band - ${title}.wav`), makeWav(4))
  writeFileSync(join(musicDir, 'red.mp3'), makeMp3(4, { title: 'Red Song', artist: 'Colors', album: 'Red Album', cover: makePng(64, 64, [210, 30, 40]) }))
  writeFileSync(join(musicDir, 'blue.mp3'), makeMp3(4, { title: 'Blue Song', artist: 'Colors', album: 'Blue Album', cover: makePng(64, 64, [30, 60, 220]) }))
})

test.afterAll(() => {
  rmSync(musicDir, { recursive: true, force: true })
})

test.beforeEach(async () => {
  const encore = await launchEncore()
  app = encore.app
  page = encore.page
  library = page.getByRole('region', { name: 'Library' })
  dock = page.getByRole('region', { name: 'Player' })
  await importFolder(page, musicDir)
  await page.reload()
  await library.getByRole('tab', { name: 'Local files' }).click()
})

test.afterEach(async () => {
  await app.close()
})

const song = (title: string): Locator => library.getByRole('list', { name: 'Local files' }).getByRole('listitem').filter({ hasText: title })
const menuItem = (name: string): Locator => page.getByRole('menu').getByRole('menuitem', { name, exact: true })
const upNext = (): Locator => page.getByRole('complementary', { name: 'Up next' })
const nextFromList = (): Locator => upNext().getByRole('region', { name: 'Next from the list' }).getByRole('listitem')
const yourQueue = (): Locator => upNext().getByRole('region', { name: 'Your queue' }).getByRole('listitem')
const listTitles = async (rows: Locator): Promise<string[]> =>
  (await rows.allTextContents()).map((text) => text.match(/Song [A-F]|Red Song|Blue Song/)![0])

async function openNowPlaying(): Promise<void> {
  await dock.getByRole('button', { name: 'Open Now Playing' }).click()
  await expect(page.getByRole('region', { name: 'Now Playing' }).getByRole('heading')).toBeVisible()
}

test('the Now Playing view: song, where it plays from, Up next, and Escape to close', async () => {
  await song('Song B').dblclick()
  await openNowPlaying()

  const view = page.getByRole('region', { name: 'Now Playing' })
  await expect(view.getByRole('heading')).toHaveText('Song B')
  await expect(view).toContainText('Playing from Local files')
  await expect(view).toContainText('Band')
  // Local files lists Band's songs first, then Colors' albums, Blue before Red.
  expect(await listTitles(nextFromList())).toEqual(['Song C', 'Song D', 'Song E', 'Song F', 'Blue Song', 'Red Song'])

  // The dock slims down to just the controls here.
  await expect(dock.getByRole('button', { name: 'Open Now Playing' })).toHaveCount(0)
  await expect(dock.getByLabel('Seek')).toHaveCount(0)

  // Jumping to a song in Up next plays it.
  await nextFromList().filter({ hasText: 'Song D' }).getByRole('button', { name: 'Play Song D' }).click()
  await expect(view.getByRole('heading')).toHaveText('Song D')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/now-playing.png' })

  await page.keyboard.press('Escape')
  await expect(library).toBeVisible()
  await expect(dock.getByRole('button', { name: 'Open Now Playing' })).toBeVisible()
})

test('Play next and Add to queue line songs up ahead of the list', async () => {
  await song('Song A').dblclick()
  await song('Song E').click({ button: 'right' })
  await menuItem('Add to queue').click()
  await song('Song F').click({ button: 'right' })
  await menuItem('Add to queue').click()
  await song('Song D').click({ button: 'right' })
  await menuItem('Play next').click()
  await expect(page.getByRole('status').filter({ hasText: 'Song D plays next' })).toBeVisible()

  await openNowPlaying()
  expect(await listTitles(yourQueue())).toEqual(['Song D', 'Song E', 'Song F'])

  // Removing one from the queue.
  await yourQueue().filter({ hasText: 'Song F' }).hover()
  await upNext().getByRole('button', { name: 'Remove Song F from the queue' }).click()
  expect(await listTitles(yourQueue())).toEqual(['Song D', 'Song E'])

  // Next plays the queue first, then carries on with the list where it left off.
  await dock.getByRole('button', { name: 'Next song' }).click()
  await expect(page.getByRole('region', { name: 'Now Playing' }).getByRole('heading')).toHaveText('Song D')
  await dock.getByRole('button', { name: 'Next song' }).click()
  await expect(page.getByRole('region', { name: 'Now Playing' }).getByRole('heading')).toHaveText('Song E')
  await dock.getByRole('button', { name: 'Next song' }).click()
  await expect(page.getByRole('region', { name: 'Now Playing' }).getByRole('heading')).toHaveText('Song B')
})

test('clear queue empties only the hand-built queue', async () => {
  await song('Song A').dblclick()
  for (const title of ['Song C', 'Song D']) {
    await song(title).click({ button: 'right' })
    await menuItem('Add to queue').click()
  }
  await openNowPlaying()
  await expect(yourQueue()).toHaveCount(2)
  await upNext().getByRole('button', { name: 'Clear queue' }).click()
  await expect(yourQueue()).toHaveCount(0)
  await expect(nextFromList().first()).toContainText('Song B')
})

test('shuffle mixes up what comes next, and turning it off goes back to list order', async () => {
  await song('Song A').dblclick()
  await openNowPlaying()
  const listOrder = await listTitles(nextFromList())

  await dock.getByRole('button', { name: 'Shuffle' }).click()
  await expect(dock.getByRole('button', { name: 'Shuffle' })).toHaveAttribute('aria-pressed', 'true')
  const shuffled = await listTitles(nextFromList())
  // The same songs still come, just mixed up, and the playing song isn't repeated among them.
  expect([...shuffled].sort()).toEqual([...listOrder].sort())
  expect(shuffled).not.toContain('Song A')
  await expect(page.getByRole('region', { name: 'Now Playing' }).getByRole('heading')).toHaveText('Song A')

  await dock.getByRole('button', { name: 'Shuffle' }).click()
  expect(await listTitles(nextFromList())).toEqual(listOrder)
})

test('with shuffle on, liking a song leaves Up next in the same order', async () => {
  await song('Song A').dblclick()
  await dock.getByRole('button', { name: 'Shuffle' }).click()
  await openNowPlaying()
  const before = await listTitles(nextFromList())
  await page.keyboard.press('Escape')

  // Liking rebuilds the list on screen, which the player follows.
  await dock.getByRole('button', { name: 'Like' }).click()
  await expect(dock.getByRole('button', { name: 'Remove from Liked Songs' })).toBeVisible()
  await openNowPlaying()
  expect(await listTitles(nextFromList())).toEqual(before)
})

test('repeat all wraps from the last song back to the first', async () => {
  // Red Song is last in Local files.
  await song('Red Song').dblclick()
  await expect(dock).toContainText('Red Song')
  await expect(dock.getByRole('button', { name: 'Next song' })).toBeDisabled()

  await dock.getByRole('button', { name: 'Repeat off' }).click()
  await expect(dock.getByRole('button', { name: 'Repeat all' })).toHaveAttribute('aria-pressed', 'true')
  await expect(dock.getByRole('button', { name: 'Next song' })).toBeEnabled()

  await dock.getByRole('button', { name: 'Next song' }).click()
  await expect(dock).toContainText('Song A')
})

test('repeat one replays the song when it ends, but Next still moves on', async () => {
  await song('Song A').dblclick()
  await dock.getByRole('button', { name: 'Repeat off' }).click()
  await dock.getByRole('button', { name: 'Repeat all' }).click()
  await expect(dock.getByRole('button', { name: 'Repeat one' })).toHaveAttribute('aria-pressed', 'true')

  // Jump near the end and let it finish: the same song starts again.
  await dock.getByLabel('Seek').fill('3.5')
  await page.waitForTimeout(1500)
  await expect(dock).toContainText('Song A')
  await expect(dock).toContainText('0:0')
  const time = await dock.getByText(/\d+:\d\d \//).textContent()
  expect(Number(time!.split(':')[1].slice(0, 2))).toBeLessThan(3)

  await dock.getByRole('button', { name: 'Next song' }).click()
  await expect(dock).toContainText('Song B')

  // One more press turns repeat back off.
  await dock.getByRole('button', { name: 'Repeat one' }).click()
  await expect(dock.getByRole('button', { name: 'Repeat off' })).toHaveAttribute('aria-pressed', 'false')
})

test('changing a song’s tags while it plays updates the dock, the stage, and Now Playing', async () => {
  const changingDir = mkdtempSync(join(tmpdir(), 'encore-retag-'))
  const file = join(changingDir, 'retag.mp3')
  try {
    writeFileSync(file, makeMp3(6, { title: 'Before', artist: 'Old Artist' }))
    await importFolder(page, changingDir)
    await page.reload()
    await library.getByRole('tab', { name: 'Local files' }).click()
    await song('Before').dblclick()
    await expect(dock).toContainText('Old Artist')

    // Retag the file and add it again, the same way a real re-read happens.
    writeFileSync(file, makeMp3(6, { title: 'After', artist: 'New Artist', album: 'New Album' }))
    await dropFiles(page, [file])
    await expect(page.getByRole('status').filter({ hasText: 'Updated 1 song' })).toBeVisible()

    await expect(dock).toContainText('After')
    await expect(dock).toContainText('New Artist')
    await expect(page.getByRole('region', { name: 'Now playing' })).toContainText('New Artist · New Album')
    await openNowPlaying()
    await expect(page.getByRole('region', { name: 'Now Playing' }).getByRole('heading')).toHaveText('After')
  } finally {
    rmSync(changingDir, { recursive: true, force: true })
  }
})

test('the accent color follows the playing cover, and goes back to teal without one', async () => {
  const accent = (): Promise<string> => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))
  expect(await accent()).toBe('')

  await song('Red Song').dblclick()
  await expect.poll(accent).toMatch(/^#[0-9a-f]{6}$/)
  const red = await accent()
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(red.slice(i, i + 2), 16))
  expect(r).toBeGreaterThan(g * 2)
  expect(r).toBeGreaterThan(b * 2)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'test-results/accent-red.png' })

  await song('Blue Song').dblclick()
  await expect.poll(async () => {
    const blue = await accent()
    return parseInt(blue.slice(5, 7), 16) > parseInt(blue.slice(1, 3), 16)
  }).toBe(true)

  // A song without a cover brings back the resting teal.
  await song('Song A').dblclick()
  await expect.poll(accent).toBe('')
})
