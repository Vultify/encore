import type { Track } from '@shared/api'
import { formatDuration, songCount } from './format'

export interface Album {
  key: string
  title: string
  artist: string
  year: number | null
  artworkId: string | null
  tracks: Track[]
}

export interface Artist {
  key: string
  name: string
  artworkId: string | null
  albums: Album[]
  tracks: Track[]
}

export const UNKNOWN_ARTIST = 'Unknown artist'
const VARIOUS_ARTISTS = 'Various artists'

// Missing values sort after everything else.
const LAST = String.fromCharCode(0xffff)
const text = (value: string | null): string => value?.toLocaleLowerCase() ?? LAST
const folderOf = (path: string): string => path.slice(0, Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))).toLowerCase()
const compare = (a: string, b: string): number => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })

// Disc and track order, then title for untagged songs.
export function byTrackNumber(a: Track, b: Track): number {
  return (
    (a.discNumber ?? 1) - (b.discNumber ?? 1) ||
    (a.trackNumber ?? Infinity) - (b.trackNumber ?? Infinity) ||
    compare(a.title, b.title)
  )
}

// Library order: by artist, then album, then track number, with untagged songs last.
export function byAlbum(a: Track, b: Track): number {
  return (
    text(a.albumArtist ?? a.artist).localeCompare(text(b.albumArtist ?? b.artist)) ||
    text(a.album).localeCompare(text(b.album)) ||
    byTrackNumber(a, b)
  )
}

const firstArtwork = (tracks: Track[]): string | null => tracks.find((track) => track.artworkId)?.artworkId ?? null

// Groups tagged songs into albums. An album artist tag keeps an album together; without one, the folder does,
// so a compilation doesn't split into one album per artist.
export function groupAlbums(tracks: Track[]): Album[] {
  const groups = new Map<string, Track[]>()
  for (const track of tracks) {
    if (!track.album) continue
    const owner = track.albumArtist ? `artist:${track.albumArtist.toLowerCase()}` : `folder:${folderOf(track.path)}`
    const key = `${track.album.toLowerCase()}|${owner}`
    const group = groups.get(key)
    if (group) group.push(track)
    else groups.set(key, [track])
  }

  const albums = [...groups].map(([key, songs]): Album => {
    const sorted = [...songs].sort(byTrackNumber)
    const artists = new Set(sorted.map((track) => track.artist ?? UNKNOWN_ARTIST))
    const years = sorted.map((track) => track.year).filter((year): year is number => year !== null)
    return {
      key,
      title: sorted[0].album!,
      artist: sorted[0].albumArtist ?? (artists.size === 1 ? [...artists][0] : VARIOUS_ARTISTS),
      year: years.length > 0 ? Math.max(...years) : null,
      artworkId: firstArtwork(sorted),
      tracks: sorted
    }
  })

  return albums.sort((a, b) => compare(a.artist, b.artist) || compare(a.title, b.title))
}

// Groups songs by artist, with each artist's albums newest first.
export function groupArtists(tracks: Track[], albums: Album[]): Artist[] {
  const artistKey = (track: Track): string => (track.artist ?? UNKNOWN_ARTIST).toLowerCase()
  const groups = new Map<string, Track[]>()
  for (const track of tracks) {
    const key = artistKey(track)
    const group = groups.get(key)
    if (group) group.push(track)
    else groups.set(key, [track])
  }

  // An artist's albums are the ones credited to them, plus any they sing on, found in one pass over the albums.
  const albumsByArtist = new Map<string, Set<Album>>()
  for (const album of albums) {
    for (const key of [album.artist.toLowerCase(), ...album.tracks.map(artistKey)]) {
      const theirs = albumsByArtist.get(key)
      if (theirs) theirs.add(album)
      else albumsByArtist.set(key, new Set([album]))
    }
  }

  const artists = [...groups].map(([key, songs]): Artist => {
    const theirAlbums = [...(albumsByArtist.get(key) ?? [])].sort(
      (a, b) => (b.year ?? 0) - (a.year ?? 0) || compare(a.title, b.title)
    )
    return {
      key,
      name: songs[0].artist ?? UNKNOWN_ARTIST,
      artworkId: theirAlbums.find((album) => album.artworkId)?.artworkId ?? firstArtwork(songs),
      albums: theirAlbums,
      tracks: [...songs].sort(byAlbum)
    }
  })

  // Unknown artist goes last.
  return artists.sort((a, b) => Number(a.name === UNKNOWN_ARTIST) - Number(b.name === UNKNOWN_ARTIST) || compare(a.name, b.name))
}

// "8 songs · 33 min", or with hours for long collections.
export function collectionSummary(tracks: Track[]): string {
  const seconds = tracks.reduce((total, track) => total + (track.duration ?? 0), 0)
  const minutes = Math.round(seconds / 60)
  const length = minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : minutes > 0 ? `${minutes} min` : formatDuration(seconds)
  return `${songCount(tracks.length)} · ${length}`
}
