import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { parseFile } from 'music-metadata'
import type { EncoreApi } from '../src/shared/api'
import { makeWav } from './fixtures/audio'
import { startLookupServer, type CatalogSong, type LookupServer } from './fixtures/lookup-server'
import { launchEncore, makeDataDir } from './launch'

let app: ElectronApplication
let page: Page
let musicDir: string
let lookup: LookupServer
let library: Locator

const song = (trackId: number, trackName: string, artistName: string, collectionName: string, seconds: number, trackNumber: number): CatalogSong => ({
  trackId,
  trackName,
  artistName,
  collectionName,
  trackNumber,
  releaseDate: '2003-03-25T08:00:00Z',
  trackTimeMillis: seconds * 1000
})

// Shaped like Apple's real answers for these two songs, live versions and remixes included.
const CATALOG = {
  numb: [
    song(1, 'Numb (Live In Texas)', 'LINKIN PARK', 'Live In Texas', 194, 13),
    song(2, 'Numb', 'LINKIN PARK', 'Meteora', 187, 13),
    song(3, 'Numb (Live)', 'LINKIN PARK', 'One More Light: Live', 231, 14),
    song(4, 'Numb', 'LINKIN PARK', 'Meteora (Deluxe Edition)', 187, 13)
  ],
  'uptown funk': [
    song(5, 'Uptown Funk (feat. Bruno Mars) [Dave Audé Remix]', 'Mark Ronson', 'Uptown Funk (feat. Bruno Mars) [Remixes] - EP', 237, 2),
    { ...song(6, 'Uptown Funk (feat. Bruno Mars)', 'Mark Ronson', 'Uptown Special', 270, 4), releaseDate: '2015-01-13T08:00:00Z' }
  ],
  // Like Apple's real search, this skips the original album entirely.
  'welcome home': [
    { ...song(7, 'Welcome Home', 'Coheed and Cambria', '9 (Original Motion Picture Soundtrack)', 375, 9), artistId: 15031628, collectionArtistName: 'Danny Elfman & Deborah Lurie' },
    song(8, 'Welcome Home', '8-Bit Misfits', '8-Bit Versions of Coheed and Cambria', 275, 3),
    { ...song(9, 'Welcome Home', 'Coheed and Cambria', 'Playlist: The Very Best of Coheed and Cambria', 376, 4), artistId: 15031628 }
  ]
}

// The artist's own song list, where the original album does show up.
const COHEED = {
  artistId: 15031628,
  artistName: 'Coheed and Cambria',
  songs: [
    { ...song(10, 'Welcome Home', 'Coheed and Cambria', "Good Apollo I'm Burning Star IV Volume One:  From Fear Through The Eyes Of Madness", 375, 3), artistId: 15031628 },
    { ...song(11, 'Welcome Home (Shawn "Clown" Crahan Remix)', 'Coheed and Cambria', 'Welcome Home (Shawn "Clown" Crahan Remix) - Single', 232, 1), artistId: 15031628 },
    { ...song(12, 'The Suffering', 'Coheed and Cambria', "Good Apollo I'm Burning Star IV Volume One:  From Fear Through The Eyes Of Madness", 224, 4), artistId: 15031628 }
  ]
}

test.beforeAll(async () => {
  lookup = await startLookupServer(CATALOG, [COHEED])
})

test.afterAll(async () => {
  await lookup.close()
})

test.beforeEach(async () => {
  musicDir = mkdtempSync(join(tmpdir(), 'encore-identify-'))
  writeFileSync(join(musicDir, 'Linkin Park - Numb.wav'), makeWav(186))
  writeFileSync(join(musicDir, 'Mark Ronson - Uptown Funk (Lyrics) ft. Bruno Mars.wav'), makeWav(268))
  writeFileSync(join(musicDir, 'Nobody - Unheard Song.wav'), makeWav(60))
  await start()
})

test.afterEach(async () => {
  await app.close()
  rmSync(musicDir, { recursive: true, force: true })
})

async function start(dataDir?: string, lookupUrl = lookup.url): Promise<void> {
  const encore = await launchEncore(dataDir, { ENCORE_LOOKUP_URL: lookupUrl })
  app = encore.app
  page = encore.page
  library = page.getByRole('region', { name: 'Library' })
  await page.evaluate((dir) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths([dir]), musicDir)
  await page.reload()
  await library.getByRole('tab', { name: 'Local files' }).click()
}

const banner = (): Locator => library.getByRole('region', { name: 'Identify songs' })
const row = (title: string): Locator => library.getByRole('list', { name: 'Local files' }).getByRole('listitem').filter({ hasText: title })
const matches = (): Locator => library.getByRole('list', { name: 'Matches' }).getByRole('button')
const menuItem = (name: string): Locator => page.getByRole('menu').getByRole('menuitem', { name, exact: true })

test('identify songs: pick the best match, skip what has none, and the library updates', async () => {
  await expect(banner()).toContainText('3 songs are missing an album or cover.')
  await banner().getByRole('button', { name: 'Identify songs' }).click()

  // Numb: the album version is first and picked, and the live versions aren't offered.
  await expect(library.getByRole('heading', { name: 'Review matches' })).toBeVisible()
  await expect(library.getByRole('region', { name: 'Your song' })).toContainText('Numb')
  await expect(matches()).toHaveCount(2)
  await expect(matches().nth(0)).toHaveAccessibleName('Numb by LINKIN PARK, on Meteora')
  await expect(matches().nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect(matches().nth(0)).toContainText('Best match')
  await expect(matches().nth(0)).toContainText('same length')
  await expect(library.getByRole('list', { name: 'Matches' })).not.toContainText('Live')
  await expect.poll(() => matches().nth(0).locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/identify-review.png' })
  await library.getByRole('button', { name: 'Use this match' }).click()

  // Uptown Funk: searched without the "(Lyrics)" and "ft." clutter, and the original beats the remix.
  await expect(library.getByRole('region', { name: 'Your song' })).toContainText('Uptown Funk')
  expect(lookup.terms).toContain('Mark Ronson Uptown Funk')
  await expect(matches().nth(0)).toContainText('Uptown Special')
  await library.getByRole('button', { name: 'Use this match' }).click()

  // A song nothing matches can only be skipped.
  await expect(library.getByRole('region', { name: 'Your song' })).toContainText('Unheard Song')
  await expect(library.getByText('No matches found')).toBeVisible()
  await expect(library.getByRole('button', { name: 'Use this match' })).toHaveCount(0)
  await library.getByRole('button', { name: 'Skip' }).click()

  await expect(library.getByText('All done. 2 songs updated, 1 skipped.')).toBeVisible()
  await library.getByRole('button', { name: 'Back to Local files' }).click()

  // The library shows the matches, with covers, and keeps the artist spelled the way the file had it.
  await expect(row('Numb')).toContainText('Linkin Park · Meteora')
  await expect.poll(() => row('Numb').locator('img').first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await expect(row('Uptown Funk')).toContainText('Uptown Funk (feat. Bruno Mars)')
  await expect(banner()).toContainText('1 song is missing an album or cover.')

  await library.getByRole('tab', { name: 'Albums' }).click()
  await expect(library.getByRole('list', { name: 'Albums' }).getByRole('listitem')).toHaveText([/Meteora.*Linkin Park/, /Uptown Special.*Mark Ronson/])
})

test('a song the search skips is found through the artist’s own songs', async () => {
  writeFileSync(join(musicDir, 'Coheed and Cambria - Welcome Home (Lyrics).wav'), makeWav(375))
  await page.evaluate((dir) => (window as unknown as { encore: EncoreApi }).encore.library.importPaths([dir]), musicDir)
  await page.reload()
  await library.getByRole('tab', { name: 'Local files' }).click()

  // A clean match like Numb doesn't need the extra lookup.
  await row('Numb').click({ button: 'right' })
  await menuItem('Identify song').click()
  await expect(matches().nth(0)).toContainText('Meteora')
  expect(lookup.artistLookups).not.toContain(15031628)
  await library.getByRole('button', { name: 'Skip' }).click()
  await library.getByRole('button', { name: 'Back to Local files' }).click()

  // Welcome Home's search finds only a soundtrack and a best-of, so Encore checks the band's own songs.
  await row('Welcome Home').click({ button: 'right' })
  await menuItem('Identify song').click()
  await expect(matches().nth(0)).toHaveAccessibleName(
    "Welcome Home by Coheed and Cambria, on Good Apollo I'm Burning Star IV Volume One:  From Fear Through The Eyes Of Madness"
  )
  await expect(matches().nth(0)).toContainText('Best match')
  expect(lookup.artistLookups).toContain(15031628)
  await expect(library.getByRole('list', { name: 'Matches' })).not.toContainText('8-Bit')
  await expect(library.getByRole('list', { name: 'Matches' })).not.toContainText('Remix')

  await library.getByRole('button', { name: 'Use this match' }).click()
  await library.getByRole('button', { name: 'Back to Local files' }).click()
  await expect(row('Welcome Home')).toContainText("Good Apollo I'm Burning Star IV")
})

test('identify one song from its menu, then restore its original tags', async () => {
  await row('Numb').click({ button: 'right' })
  await menuItem('Identify song').click()
  await expect(library.getByRole('region', { name: 'Your song' })).toContainText('Numb')
  await library.getByRole('button', { name: 'Use this match' }).click()
  await library.getByRole('button', { name: 'Back to Local files' }).click()
  await expect(row('Numb')).toContainText('Meteora')

  await row('Numb').click({ button: 'right' })
  await menuItem('Restore original tags').click()
  await expect(row('Numb')).not.toContainText('Meteora')
  await expect(row('Numb')).toContainText('Linkin Park')
})

test('picking a different match than the best one', async () => {
  await row('Numb').click({ button: 'right' })
  await menuItem('Identify song').click()
  await matches().nth(1).click()
  await expect(matches().nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(matches().nth(0)).toHaveAttribute('aria-pressed', 'false')
  await library.getByRole('button', { name: 'Use this match' }).click()
  await library.getByRole('button', { name: 'Back to Local files' }).click()
  await expect(row('Numb')).toContainText('Meteora (Deluxe Edition)')
})

test('a match survives a restart and the file being read again', async () => {
  const dataDir = makeDataDir()
  try {
    await app.close()
    await start(dataDir)
    await row('Numb').click({ button: 'right' })
    await menuItem('Identify song').click()
    await library.getByRole('button', { name: 'Use this match' }).click()
    await expect(library.getByText('All done. 1 song updated.')).toBeVisible()
    await app.close()

    // The file changes on disk, so starting again reads its tags again. The match stays on top.
    writeFileSync(join(musicDir, 'Linkin Park - Numb.wav'), makeWav(187))
    await start(dataDir)
    const numb = await page.evaluate(async () =>
      (await (window as unknown as { encore: EncoreApi }).encore.library.getTracks()).find((track) => track.path.endsWith('Numb.wav'))
    )
    expect(numb?.duration).toBe(187)
    await expect(row('Numb')).toContainText('Linkin Park · Meteora')
  } finally {
    await app.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test('no internet: a clear message, and nothing changes', async () => {
  await app.close()
  await start(undefined, 'http://127.0.0.1:9/search')
  await banner().getByRole('button', { name: 'Identify songs' }).click()
  await expect(page.getByRole('status').filter({ hasText: "Couldn't reach Apple's music search" })).toBeVisible()
  await expect(library.getByText('Nothing was looked up.')).toBeVisible()
})

// Identifies Numb through the song menu and picks the best match.
async function identifyNumb(): Promise<void> {
  await row('Numb').click({ button: 'right' })
  await menuItem('Identify song').click()
  await library.getByRole('button', { name: 'Use this match' }).click()
  await expect(library.getByText('All done. 1 song updated.')).toBeVisible()
}

test('save tags to file writes the match into the song file, and the music is untouched', async () => {
  const file = join(musicDir, 'Linkin Park - Numb.wav')
  const before = await parseFile(file, { duration: true })
  await identifyNumb()
  await library.getByRole('button', { name: 'Back to Local files' }).click()

  await row('Numb').click({ button: 'right' })
  await menuItem('Save tags to file').click()
  const dialog = page.getByRole('alertdialog', { name: "Save Numb's tags into its file?" })
  await expect(dialog).toContainText("The music itself isn't changed")
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/save-to-file.png' })
  await dialog.getByRole('button', { name: 'Save to file' }).click()
  await expect(page.getByRole('status').filter({ hasText: "Saved the tags into Numb's file" })).toBeVisible()

  // The file itself now carries the match, cover included, and plays exactly as long as before.
  const after = await parseFile(file, { duration: true })
  expect(after.common).toMatchObject({ title: 'Numb', artist: 'Linkin Park', album: 'Meteora', year: 2003 })
  expect(after.common.track.no).toBe(13)
  expect(after.common.picture?.[0]?.data.length).toBeGreaterThan(0)
  expect(after.format.duration).toBeCloseTo(before.format.duration!, 1)
  expect(readdirSync(musicDir).filter((name) => name.startsWith('.encore-saving'))).toEqual([])

  // Encore now reads those tags from the file, so the song is no longer an overlay to restore.
  await expect(row('Numb')).toContainText('Linkin Park · Meteora')
  await row('Numb').click({ button: 'right' })
  await expect(menuItem('Restore original tags')).toHaveCount(0)
})

test('the review page can save all its picks to their files at once', async () => {
  await banner().getByRole('button', { name: 'Identify songs' }).click()
  await library.getByRole('button', { name: 'Use this match' }).click()
  await library.getByRole('button', { name: 'Use this match' }).click()
  await library.getByRole('button', { name: 'Skip' }).click()

  await library.getByRole('button', { name: 'Save to the files too' }).click()
  await page.getByRole('alertdialog', { name: 'Save the tags into 2 files?' }).getByRole('button', { name: 'Save to files' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved the tags into 2 files' })).toBeVisible()
  await expect(library.getByRole('button', { name: 'Save to the files too' })).toHaveCount(0)

  const funk = await parseFile(join(musicDir, 'Mark Ronson - Uptown Funk (Lyrics) ft. Bruno Mars.wav'))
  expect(funk.common).toMatchObject({ title: 'Uptown Funk (feat. Bruno Mars)', artist: 'Mark Ronson', album: 'Uptown Special' })
})

test('a file that can’t be written is left exactly as it was', async () => {
  const file = join(musicDir, 'Linkin Park - Numb.wav')
  await identifyNumb()
  await library.getByRole('button', { name: 'Back to Local files' }).click()
  const original = readFileSync(file)
  chmodSync(file, 0o444)
  try {
    await row('Numb').click({ button: 'right' })
    await menuItem('Save tags to file').click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Save to file' }).click()
    await expect(page.getByRole('status').filter({ hasText: "Couldn't save Numb. The file is in use or read-only." })).toBeVisible()

    expect(readFileSync(file).equals(original)).toBe(true)
    expect(readdirSync(musicDir).filter((name) => name.startsWith('.encore-saving'))).toEqual([])
    // The match is still there, ready to try again.
    await row('Numb').click({ button: 'right' })
    await expect(menuItem('Restore original tags')).toBeVisible()
  } finally {
    chmodSync(file, 0o666)
  }
})

test('the interface can only pick matches Encore found itself', async () => {
  const result = await page.evaluate(async () => {
    const { encore } = window as unknown as { encore: EncoreApi }
    const [track] = await encore.library.getTracks()
    return {
      unknown: await encore.identify.apply(track.id, 'itunes-999999'),
      malformed: await encore.identify.apply(track.id, '../../etc'),
      preview: (await fetch('encore-art://preview/itunes-999999').catch(() => null))?.status ?? 'blocked'
    }
  })
  expect(result.unknown).toBeNull()
  expect(result.malformed).toBeNull()
  expect([404, 'blocked']).toContain(result.preview)
})
