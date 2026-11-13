import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { makeTune } from './fixtures/audio'
import { startLookupServer, type LookupServer } from './fixtures/lookup-server'
import { importFolder, launchEncore } from './launch'

let app: ElectronApplication
let page: Page
let musicDir: string
let lookup: LookupServer
let library: Locator

const id = (n: number): string => `0000000${n}-0000-4000-8000-00000000000${n}`.slice(-36)
const LINKIN = [{ name: 'Linkin Park' }]

// Shaped like AcoustID's real answer for "Numb": the album, the single, a compilation, a live bootleg, and a video set.
const NUMB_BY_SOUND = {
  status: 'ok',
  results: [
    {
      score: 0.98,
      recordings: [
        {
          id: id(1),
          title: 'Numb',
          artists: LINKIN,
          duration: 20,
          releasegroups: [
            {
              id: id(2),
              title: 'Meteora',
              type: 'Album',
              artists: LINKIN,
              releases: [
                { id: id(3), date: { year: 2014 }, mediums: [{ position: 2, tracks: [{ position: 6 }] }] },
                { id: id(4), date: { year: 2003 }, mediums: [{ position: 1, tracks: [{ position: 13 }] }] }
              ]
            },
            { id: id(5), title: 'Numb', type: 'Single', artists: LINKIN, releases: [{ id: id(6), date: { year: 2003 } }] },
            { id: id(7), title: 'Greatest Hits', type: 'Album', secondarytypes: ['Compilation'], artists: LINKIN, releases: [] },
            { id: id(8), title: 'Live in Colorado', type: 'Album', secondarytypes: ['Live'], artists: LINKIN, releases: [] },
            { id: id(9), title: 'Meteora Collection', type: 'Other', artists: LINKIN, releases: [] }
          ]
        }
      ]
    }
  ]
}

test.beforeAll(async () => {
  // Only songs found by sound live in the sound answer. The name search knows just Numb by Linkin Park.
  lookup = await startLookupServer(
    {
      'linkin park numb': [
        { trackId: 1, trackName: 'Numb', artistName: 'Linkin Park', collectionName: 'Meteora', trackNumber: 13, releaseDate: '2003-03-25T08:00:00Z', trackTimeMillis: 20_000 }
      ]
    },
    [],
    NUMB_BY_SOUND
  )
})

test.afterAll(async () => {
  await lookup.close()
})

test.beforeEach(async () => {
  musicDir = mkdtempSync(join(tmpdir(), 'encore-sound-'))
  lookup.soundLookups.length = 0
})

test.afterEach(async () => {
  await app.close()
  rmSync(musicDir, { recursive: true, force: true })
})

async function start(files: Record<string, Buffer>, key = 'test-key'): Promise<void> {
  for (const [name, data] of Object.entries(files)) writeFileSync(join(musicDir, name), data)
  const encore = await launchEncore(undefined, {
    ENCORE_LOOKUP_URL: lookup.url,
    ENCORE_ACOUSTID_URL: lookup.acoustidUrl,
    ENCORE_COVERART_URL: lookup.coverArtUrl,
    ENCORE_ACOUSTID_KEY: key
  })
  app = encore.app
  page = encore.page
  library = page.getByRole('region', { name: 'Library' })
  await importFolder(page, musicDir)
  await page.reload()
  await library.getByRole('tab', { name: 'Local files' }).click()
}

const row = (title: string): Locator => library.getByRole('list', { name: 'Local files' }).getByRole('listitem').filter({ hasText: title })
const matches = (): Locator => library.getByRole('list', { name: 'Matches' }).getByRole('button')

async function identify(title: string): Promise<void> {
  await row(title).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: 'Identify song', exact: true }).click()
}

test('a song with a meaningless name is recognized by its sound, clearly marked as maybe wrong', async () => {
  await start({ 'track01.wav': makeTune(20) })
  await identify('track01')

  await expect(library.getByRole('note')).toContainText('Found by listening')
  await expect(matches().nth(0)).toHaveAccessibleName('Numb by Linkin Park, on Meteora')
  await expect(matches().nth(0)).toContainText('Closest by sound')
  await expect(matches().nth(0)).toContainText('Meteora · 2003')
  await expect(library.getByRole('list', { name: 'Matches' })).not.toContainText('Meteora Collection')
  await expect.poll(() => matches().nth(0).locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/sound-match.png' })

  // Only the fingerprint and the key went to AcoustID, never the audio itself.
  expect(lookup.soundLookups).toHaveLength(1)
  const sent = lookup.soundLookups[0]
  expect(Object.keys(sent).sort()).toEqual(['client', 'duration', 'fingerprint', 'format', 'meta'])
  expect(sent.client).toBe('test-key')
  expect(Number(sent.duration)).toBe(20)
  expect(sent.fingerprint.length).toBeGreaterThan(20)

  await library.getByRole('button', { name: 'Use this match' }).click()
  await library.getByRole('button', { name: 'Back to Local files' }).click()
  await expect(row('Numb')).toContainText('Linkin Park · Meteora')
  await expect.poll(() => row('Numb').locator('img').first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
})

test('a song found by name never needs to be listened to', async () => {
  await start({ 'Linkin Park - Numb.wav': makeTune(20) })
  await identify('Numb')
  await expect(matches().nth(0)).toContainText('Best match')
  await expect(library.getByRole('note')).toHaveCount(0)
  expect(lookup.soundLookups).toHaveLength(0)
})

test('without a key, sound matching stays off', async () => {
  await start({ 'track01.wav': makeTune(20) }, '')
  await identify('track01')
  await expect(library.getByText('No matches found')).toBeVisible()
  expect(lookup.soundLookups).toHaveLength(0)
})

test('a key AcoustID rejects stops the run with a message saying where to fix it', async () => {
  await start({ 'track01.wav': makeTune(20) }, 'bad-key')
  await identify('track01')
  const message = page.getByRole('status').filter({ hasText: "Encore's AcoustID key isn't working" })
  await expect(message).toBeVisible()
  await expect(message).toContainText('MAIN_VITE_ACOUSTID_KEY in the .env file')
})
