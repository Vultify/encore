import { expect, test } from '@playwright/test'
import type { Track } from '../src/shared/api'
import { normalize, searchLibrary } from '../src/renderer/src/lib/search'

let nextId = 1
const song = (title: string, artist: string | null = null, album: string | null = null): Track => ({
  id: nextId++,
  path: `C:\\Music\\${title}.mp3`,
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
  likedAt: null
})

const library = (tracks: Track[]) => ({ tracks, artists: [], albums: [], playlists: [] })
const titles = (query: string, tracks: Track[]): string[] => searchLibrary(query, library(tracks)).songs.map((track) => track.title)

test('normalize drops case, accents, and punctuation', () => {
  expect(normalize("  Beyoncé's  HALO! ")).toBe('beyonce s halo')
  expect(normalize('AC/DC')).toBe('ac dc')
})

test('every word has to match the start of a word', () => {
  const tracks = [song('In the End', 'Linkin Park'), song('Parkway Drive', 'Someone'), song('Blinking', 'Park Band')]
  expect(titles('lin park', tracks)).toEqual(['In the End'])
  expect(titles('ink', tracks)).toEqual([])
})

test('exact matches rank first, then whole-word starts, then partial starts, then the rest', () => {
  const tracks = [song('Numbers', 'Band'), song('Numb (Live)', 'Linkin Park'), song('Numb', 'Linkin Park'), song('Comfortably Numb', 'Pink Floyd')]
  expect(titles('numb', tracks)).toEqual(['Numb', 'Numb (Live)', 'Numbers', 'Comfortably Numb'])
})

test('title matches beat artist matches, which beat album matches', () => {
  const tracks = [song('Other', 'Band', 'Halo'), song('Song', 'Halo'), song('Halo', 'Beyonce')]
  expect(titles('halo', tracks)).toEqual(['Halo', 'Song', 'Other'])
})

test('words can mix title and artist', () => {
  const tracks = [song('Numb', 'Linkin Park'), song('Numb', 'U2')]
  expect(titles('numb linkin', tracks)).toEqual(['Numb'])
})

test('an empty or blank search finds nothing', () => {
  const tracks = [song('Numb', 'Linkin Park')]
  expect(titles('', tracks)).toEqual([])
  expect(titles('   !!  ', tracks)).toEqual([])
})
