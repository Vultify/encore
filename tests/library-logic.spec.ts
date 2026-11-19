import { expect, test } from '@playwright/test'
import type { Track } from '../src/shared/api'
import { groupAlbums, groupArtists } from '../src/renderer/src/lib/library'

let nextId = 1
const song = (title: string, artist: string | null, album: string | null, extra: Partial<Track> = {}): Track => ({
  id: nextId++,
  path: `C:\\Music\\${album ?? 'Loose'}\\${title}.mp3`,
  format: 'mp3',
  title,
  artist,
  album,
  albumArtist: null,
  trackNumber: null,
  discNumber: null,
  year: null,
  duration: 200,
  artworkId: null,
  addedAt: 0,
  likedAt: null,
  identified: false,
  ...extra
})

test("an artist's albums are their own plus compilations they sing on, newest first", () => {
  const tracks = [
    song('Numb', 'Linkin Park', 'Meteora', { year: 2003 }),
    song('In the End', 'Linkin Park', 'Hybrid Theory', { year: 2000 }),
    song('Crawling', 'Linkin Park', 'Rock Hits', { albumArtist: 'Various Artists', year: 2010 }),
    song('Halo', 'Beyonce', 'Rock Hits', { albumArtist: 'Various Artists', year: 2010 }),
    song('Untagged', null, null)
  ]
  const artists = groupArtists(tracks, groupAlbums(tracks))

  const linkin = artists.find((artist) => artist.name === 'Linkin Park')
  expect(linkin?.albums.map((album) => album.title)).toEqual(['Rock Hits', 'Meteora', 'Hybrid Theory'])
  expect(artists.find((artist) => artist.name === 'Beyonce')?.albums.map((album) => album.title)).toEqual(['Rock Hits'])
  // Songs with no artist come last, and spelling differences in case still group together.
  expect(artists.at(-1)?.name).toBe('Unknown artist')
  expect(groupArtists([song('A', 'band', 'X'), song('B', 'Band', 'X')], []).map((artist) => artist.tracks.length)).toEqual([2])
})

test('grouping a 30,000 song library stays quick', () => {
  const tracks = Array.from({ length: 30_000 }, (_, i) =>
    song(`Song ${i}`, `Artist ${Math.floor(i / 12)}`, `Album ${Math.floor(i / 12)}`, { trackNumber: (i % 12) + 1 })
  )
  const started = performance.now()
  const albums = groupAlbums(tracks)
  const artists = groupArtists(tracks, albums)
  const took = performance.now() - started
  expect(artists).toHaveLength(2500)
  expect(artists[0].albums).toHaveLength(1)
  expect(took).toBeLessThan(400)
})
