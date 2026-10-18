import type { Playlist, Track } from '@shared/api'

// How the Playlists tab names each page it can open.
export const LIKED_KEY = 'liked'
export const playlistKey = (id: number): string => `playlist:${id}`

// "Playlist 1", "Playlist 2"... using the first number not already taken.
export function nextPlaylistName(playlists: Playlist[]): string {
  const taken = new Set(playlists.map((playlist) => playlist.name.toLowerCase()))
  let n = playlists.length + 1
  while (taken.has(`playlist ${n}`)) n += 1
  return `Playlist ${n}`
}

// A playlist's songs in order, skipping any that are no longer in the library.
export function playlistTracks(playlist: Playlist, tracksById: Map<number, Track>): { tracks: Track[]; entryIds: number[] } {
  const tracks: Track[] = []
  const entryIds: number[] = []
  for (const entry of playlist.entries) {
    const track = tracksById.get(entry.trackId)
    if (!track) continue
    tracks.push(track)
    entryIds.push(entry.id)
  }
  return { tracks, entryIds }
}

// Liked songs, most recently liked first.
export const likedTracks = (tracks: Track[]): Track[] =>
  tracks.filter((track) => track.likedAt !== null).sort((a, b) => b.likedAt! - a.likedAt!)

// The cover for a playlist: the first song in it that has one.
export const playlistArtwork = (tracks: Track[]): string | null => tracks.find((track) => track.artworkId)?.artworkId ?? null
