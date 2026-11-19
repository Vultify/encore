/// <reference lib="dom" />
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { MAX_IDS_PER_REQUEST, type EncoreApi, type PlayerPreferences, type PlayerSession } from '../src/shared/api'
import { startLookupServer, type LookupServer } from './fixtures/lookup-server'
import { launchEncore, makeDataDir, TempDirs } from './launch'

let app: ElectronApplication | undefined
let lookup: LookupServer | undefined
const temp = new TempDirs()

test.afterEach(async () => {
  await app?.close()
  app = undefined
  await lookup?.close()
  lookup = undefined
  temp.removeAll()
})

test('identifying more songs than one request can carry looks them all up in one review', async () => {
  test.setTimeout(180_000)
  const count = MAX_IDS_PER_REQUEST + 1
  const dataDir = temp.keep(makeDataDir())
  const music = temp.make('encore-big-')

  // Opening Encore once creates the library. Then the songs go straight into it, which is far quicker than reading
  // ten thousand files. Each one points at a real, empty file so none show as missing.
  ;({ app } = await launchEncore(dataDir))
  await app.close()
  app = undefined
  const db = new DatabaseSync(join(dataDir, 'library.db'))
  const insert = db.prepare("INSERT INTO tracks (location, location_key, format, title, added_at) VALUES (?, ?, 'mp3', ?, 0)")
  db.exec('BEGIN')
  for (let i = 0; i < count; i++) {
    const path = join(music, `song-${i}.mp3`)
    writeFileSync(path, '')
    insert.run(path, path.toLowerCase(), `Song ${i}`)
  }
  db.exec('COMMIT')
  db.close()

  lookup = await startLookupServer({})
  const encore = await launchEncore(dataDir, { ENCORE_LOOKUP_URL: lookup.url })
  app = encore.app
  const library = encore.page.getByRole('region', { name: 'Library' })
  await library.getByRole('tab', { name: 'Local files' }).click()
  await library.getByRole('button', { name: 'Identify songs' }).click()

  await expect.poll(() => lookup!.terms.length, { timeout: 150_000 }).toBe(count)
})

const session = (songs: number): PlayerSession => ({
  sourceKey: 'local-files',
  sourceName: 'Local files',
  sourceIds: Array.from({ length: songs }, (_, i) => i + 1),
  order: Array.from({ length: songs }, (_, i) => i),
  cursor: 0,
  queuedIds: [],
  trackId: 1,
  fromQueue: false,
  position: 12,
  shuffle: false,
  repeat: 'off'
})

test("a big library's last song is remembered, and a session that can't be saved keeps the last good one", async () => {
  const encore = await launchEncore()
  app = encore.app
  const save = (preferences: PlayerPreferences): Promise<PlayerPreferences> =>
    encore.page.evaluate(async (value) => {
      const { encore } = window as unknown as { encore: EncoreApi }
      encore.settings.savePlayer(value)
      return encore.settings.getPlayer()
    }, preferences)
  const base = await encore.page.evaluate(() => (window as unknown as { encore: EncoreApi }).encore.settings.getPlayer())

  const big = await save({ ...base, session: session(25_000) })
  expect(big.session?.sourceIds).toHaveLength(25_000)

  // A broken session, like a cursor past the end, leaves the saved one alone.
  const broken = await save({ ...base, session: { ...session(3), cursor: 99 } })
  expect(broken.session?.sourceIds).toHaveLength(25_000)

  // Nothing playing is still saved as nothing playing.
  const cleared = await save({ ...base, session: null })
  expect(cleared.session).toBeNull()
})
