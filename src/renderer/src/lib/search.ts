import type { Playlist, Track } from '@shared/api'
import { normalize } from '@shared/text'
import type { Album, Artist } from './library'

const words = (text: string): string[] => (text ? text.split(' ') : [])

// How well a piece of text matches the search, from 0 (no match) to 100 (exact).
// Every search word has to match the start of some word in the text, so "lin park" finds "Linkin Park".
function scoreText(query: string, queryWords: string[], text: string | null): number {
  if (!text) return 0
  const target = normalize(text)
  if (target === query) return 100
  // Starting with the search as whole words ("Numb (Live)") beats starting with part of a word ("Numbers").
  if (target.startsWith(`${query} `)) return 90
  if (target.startsWith(query)) return 85
  const targetWords = words(target)
  if (!queryWords.every((word) => targetWords.some((candidate) => candidate.startsWith(word)))) return 0
  // Fewer extra words ranks higher, so "Comfortably Numb" beats "Numb Me Out Tonight Remix".
  return 70 - Math.min(targetWords.length - queryWords.length, 20)
}

// Songs match on title, artist, or album, or on a mix of them, like "numb linkin".
function scoreTrack(query: string, queryWords: string[], track: Track): number {
  const best = Math.max(
    scoreText(query, queryWords, track.title),
    scoreText(query, queryWords, track.artist) * 0.8,
    scoreText(query, queryWords, track.album) * 0.6
  )
  if (best > 0) return best
  const mixed = [track.title, track.artist, track.album].filter(Boolean).join(' ')
  return scoreText(query, queryWords, mixed) > 0 ? 30 : 0
}

// Keeps the items that match, best first, ties in their original order.
function rank<T>(items: T[], score: (item: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index, score: score(item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item)
}

export interface SearchResults {
  songs: Track[]
  artists: Artist[]
  albums: Album[]
  playlists: Playlist[]
}

export interface Searchable {
  tracks: Track[]
  artists: Artist[]
  albums: Album[]
  playlists: Playlist[]
}

export function searchLibrary(rawQuery: string, { tracks, artists, albums, playlists }: Searchable): SearchResults {
  const query = normalize(rawQuery)
  const queryWords = words(query)
  if (queryWords.length === 0) return { songs: [], artists: [], albums: [], playlists: [] }

  return {
    songs: rank(tracks, (track) => scoreTrack(query, queryWords, track)),
    artists: rank(artists, (artist) => scoreText(query, queryWords, artist.name)),
    albums: rank(albums, (album) => Math.max(scoreText(query, queryWords, album.title), scoreText(query, queryWords, album.artist) * 0.7)),
    playlists: rank(playlists, (playlist) => scoreText(query, queryWords, playlist.name))
  }
}
