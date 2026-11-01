import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { parseFile } from 'music-metadata'
import type { Track } from '../src/shared/api'
import { writeTags } from '../src/main/library/writeTags'
import { makeMp3 } from './fixtures/audio'

let dir: string

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'encore-write-'))
})

test.afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const song = (path: string, format: Track['format']): Track => ({
  id: 1,
  path,
  format,
  title: 'Numb',
  artist: 'Linkin Park',
  album: 'Meteora',
  albumArtist: 'Linkin Park',
  trackNumber: 13,
  discNumber: 1,
  year: 2003,
  duration: 186,
  artworkId: null,
  addedAt: 0,
  likedAt: null,
  identified: true
})

test('writes tags and a cover into an MP3, replacing the old ones, without changing its length', async () => {
  const path = join(dir, 'numb.mp3')
  writeFileSync(path, makeMp3(5, { title: 'Wrong Title', artist: 'Wrong Artist', album: 'Tribute Album' }))
  const before = await parseFile(path, { duration: true })

  await writeTags(song(path, 'mp3'), resolve('resources/icon.png'))

  const after = await parseFile(path, { duration: true })
  expect(after.common).toMatchObject({ title: 'Numb', artist: 'Linkin Park', album: 'Meteora', albumartist: 'Linkin Park', year: 2003 })
  expect(after.common.track.no).toBe(13)
  expect(after.common.picture?.[0]?.format).toBe('image/png')
  expect(after.format.duration).toBeCloseTo(before.format.duration!, 2)
  expect(readdirSync(dir)).toEqual(['numb.mp3'])
})

test('a file that isn’t really audio is refused and left alone', async () => {
  const path = join(dir, 'broken.mp3')
  writeFileSync(path, 'not really audio')
  await expect(writeTags(song(path, 'mp3'), null)).rejects.toThrow()
  expect(readdirSync(dir)).toEqual(['broken.mp3'])
})
