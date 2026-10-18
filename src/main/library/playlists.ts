import { PLAYLIST_NAME_MAX, type Playlist } from '../../shared/api'
import { library, transaction } from './database'

interface PlaylistRow {
  id: number
  name: string
  created_at: number
  updated_at: number
}

interface EntryRow {
  id: number
  playlist_id: number
  track_id: number
  added_at: number
}

// Trims a name and keeps it to a sensible length. Blank names fall back to a default.
export const cleanName = (name: string): string => name.trim().slice(0, PLAYLIST_NAME_MAX) || 'Untitled playlist'

export function allPlaylists(): Playlist[] {
  const database = library()
  const rows = database.prepare('SELECT * FROM playlists ORDER BY position, id').all() as unknown as PlaylistRow[]
  const entries = database
    .prepare('SELECT id, playlist_id, track_id, added_at FROM playlist_entries ORDER BY playlist_id, position')
    .all() as unknown as EntryRow[]

  const byPlaylist = new Map<number, Playlist['entries']>()
  for (const entry of entries) {
    const list = byPlaylist.get(entry.playlist_id) ?? []
    list.push({ id: entry.id, trackId: entry.track_id, addedAt: entry.added_at })
    byPlaylist.set(entry.playlist_id, list)
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    entries: byPlaylist.get(row.id) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

const touch = (playlistId: number): void => {
  library().prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(Date.now(), playlistId)
}

// Appends songs to the end of a playlist, skipping ids that aren't in the library.
function appendTracks(playlistId: number, trackIds: number[]): void {
  const database = library()
  const { next } = database
    .prepare('SELECT coalesce(max(position) + 1, 0) AS next FROM playlist_entries WHERE playlist_id = ?')
    .get(playlistId) as { next: number }
  const insert = database.prepare(`
    INSERT INTO playlist_entries (playlist_id, track_id, position, added_at)
    SELECT ?, id, ?, ? FROM tracks WHERE id = ?
  `)
  const now = Date.now()
  trackIds.forEach((trackId, i) => insert.run(playlistId, next + i, now, trackId))
  touch(playlistId)
}

// Rewrites positions as 0, 1, 2... in the given order.
function renumberEntries(playlistId: number, entryIds: number[]): void {
  const update = library().prepare('UPDATE playlist_entries SET position = ? WHERE id = ? AND playlist_id = ?')
  entryIds.forEach((entryId, position) => update.run(position, entryId, playlistId))
}

export function createPlaylist(name: string, trackIds: number[] = []): number {
  return transaction(() => {
    const database = library()
    const now = Date.now()
    const { next } = database.prepare('SELECT coalesce(max(position) + 1, 0) AS next FROM playlists').get() as { next: number }
    const { id } = database
      .prepare('INSERT INTO playlists (name, position, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING id')
      .get(cleanName(name), next, now, now) as { id: number }
    if (trackIds.length > 0) appendTracks(id, trackIds)
    return id
  })
}

export function renamePlaylist(playlistId: number, name: string): void {
  library().prepare('UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?').run(cleanName(name), Date.now(), playlistId)
}

// Deletes the playlist and its entries. The songs themselves stay in the library.
export function removePlaylist(playlistId: number): void {
  library().prepare('DELETE FROM playlists WHERE id = ?').run(playlistId)
}

// Puts playlists in the given order. Any left out keep their place after the ones given.
export function reorderPlaylists(playlistIds: number[]): void {
  transaction(() => {
    const rest = allPlaylists().map((playlist) => playlist.id).filter((id) => !playlistIds.includes(id))
    const update = library().prepare('UPDATE playlists SET position = ? WHERE id = ?')
    ;[...playlistIds, ...rest].forEach((id, position) => update.run(position, id))
  })
}

export function addTracks(playlistId: number, trackIds: number[]): void {
  transaction(() => appendTracks(playlistId, trackIds))
}

export function removeEntries(playlistId: number, entryIds: number[]): void {
  transaction(() => {
    const remove = library().prepare('DELETE FROM playlist_entries WHERE id = ? AND playlist_id = ?')
    entryIds.forEach((entryId) => remove.run(entryId, playlistId))
    const remaining = allPlaylists().find((playlist) => playlist.id === playlistId)?.entries ?? []
    renumberEntries(playlistId, remaining.map((entry) => entry.id))
    touch(playlistId)
  })
}

// Moves one entry to a new index, shifting the others to make room.
export function moveEntry(playlistId: number, entryId: number, toIndex: number): void {
  transaction(() => {
    const ids = (allPlaylists().find((playlist) => playlist.id === playlistId)?.entries ?? []).map((entry) => entry.id)
    const from = ids.indexOf(entryId)
    if (from === -1) return
    ids.splice(from, 1)
    ids.splice(Math.max(0, Math.min(toIndex, ids.length)), 0, entryId)
    renumberEntries(playlistId, ids)
    touch(playlistId)
  })
}
