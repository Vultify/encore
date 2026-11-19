import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import type { AudioFormat, NewTrack, Track } from '../../shared/api'

// Each entry upgrades the database by one version. Add new ones to the end, never edit old ones.
const MIGRATIONS = [
  `CREATE TABLE tracks (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'local',
    location TEXT NOT NULL,
    location_key TEXT NOT NULL,
    format TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT,
    album TEXT,
    album_artist TEXT,
    track_number INTEGER,
    disc_number INTEGER,
    year INTEGER,
    duration REAL,
    artwork_id TEXT,
    file_size INTEGER,
    file_modified INTEGER,
    added_at INTEGER NOT NULL,
    UNIQUE (source, location_key)
  )`,
  `ALTER TABLE tracks ADD COLUMN liked_at INTEGER;
  CREATE TABLE playlists (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE playlist_entries (
    id INTEGER PRIMARY KEY,
    playlist_id INTEGER NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
    track_id INTEGER NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at INTEGER NOT NULL
  );
  CREATE INDEX playlist_entries_in_order ON playlist_entries (playlist_id, position);`,
  `CREATE TABLE track_matches (
    track_id INTEGER PRIMARY KEY REFERENCES tracks (id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT,
    album TEXT,
    album_artist TEXT,
    track_number INTEGER,
    disc_number INTEGER,
    year INTEGER,
    artwork_id TEXT,
    matched_at INTEGER NOT NULL
  )`,
  `CREATE TABLE plays (
    id INTEGER PRIMARY KEY,
    track_id INTEGER NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
    source_key TEXT,
    played_at INTEGER NOT NULL
  )`,
  // Each listen keeps how long it lasted, and whether that was long enough to count as a play.
  `ALTER TABLE plays ADD COLUMN listened_seconds REAL NOT NULL DEFAULT 0;
  ALTER TABLE plays ADD COLUMN counted INTEGER NOT NULL DEFAULT 1;
  CREATE INDEX plays_by_time ON plays (played_at);`,
  // Songs taken out of the library, so music folder scans don't add them straight back.
  `CREATE TABLE removed_tracks (
    source TEXT NOT NULL DEFAULT 'local',
    location_key TEXT NOT NULL,
    removed_at INTEGER NOT NULL,
    PRIMARY KEY (source, location_key)
  )`
]

// The file details used to tell whether a song changed since it was last read.
export interface FileStamp {
  size: number
  modified: number
}

export interface StoredTrack {
  track: Track
  stamp: FileStamp
}

interface TrackRow {
  id: number
  location: string
  format: string
  title: string
  artist: string | null
  album: string | null
  album_artist: string | null
  track_number: number | null
  disc_number: number | null
  year: number | null
  duration: number | null
  artwork_id: string | null
  file_size: number | null
  file_modified: number | null
  added_at: number
  liked_at: number | null
  // From track_matches, when the song was identified. Null otherwise.
  match_source: string | null
  match_title: string | null
  match_artist: string | null
  match_album: string | null
  match_album_artist: string | null
  match_track_number: number | null
  match_disc_number: number | null
  match_year: number | null
  match_artwork_id: string | null
}

// Windows paths ignore case, so lookups use a lowercased copy.
export const locationKey = (path: string): string => path.toLowerCase()

// Every song read goes through here, so an identified song always shows its match on top of the file's own tags.
const SELECT_TRACKS = `
  SELECT t.*, m.source AS match_source, m.title AS match_title, m.artist AS match_artist, m.album AS match_album,
    m.album_artist AS match_album_artist, m.track_number AS match_track_number, m.disc_number AS match_disc_number,
    m.year AS match_year, m.artwork_id AS match_artwork_id
  FROM tracks t LEFT JOIN track_matches m ON m.track_id = t.id
  WHERE t.source = 'local'`

// A match replaces the file's tags as a set, so an album never mixes the file's track number with the match's.
const toTrack = (row: TrackRow): Track => {
  const matched = row.match_source !== null
  return {
    id: row.id,
    path: row.location,
    format: row.format as AudioFormat,
    title: matched ? row.match_title! : row.title,
    artist: matched ? row.match_artist : row.artist,
    album: matched ? row.match_album : row.album,
    albumArtist: matched ? row.match_album_artist : row.album_artist,
    trackNumber: matched ? row.match_track_number : row.track_number,
    discNumber: matched ? row.match_disc_number : row.disc_number,
    year: matched ? row.match_year : row.year,
    duration: row.duration,
    artworkId: (matched ? row.match_artwork_id : null) ?? row.artwork_id,
    addedAt: row.added_at,
    likedAt: row.liked_at,
    identified: matched
  }
}

let db: DatabaseSync | null = null

function migrate(database: DatabaseSync): void {
  const { user_version: version } = database.prepare('PRAGMA user_version').get() as { user_version: number }
  for (let next = version; next < MIGRATIONS.length; next++) {
    transaction(() => {
      database.exec(MIGRATIONS[next])
      database.exec(`PRAGMA user_version = ${next + 1}`)
    }, database)
  }
}

// Opens library.db in Encore's data folder, creating or upgrading it as needed.
export function openLibrary(): void {
  db = new DatabaseSync(join(app.getPath('userData'), 'library.db'))
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
}

export function closeLibrary(): void {
  db?.close()
  db = null
}

export function library(): DatabaseSync {
  if (!db) throw new Error('The library database is not open')
  return db
}

// Runs a group of changes as one unit: all of them land, or none do.
export function transaction<T>(work: () => T, database: DatabaseSync = library()): T {
  database.exec('BEGIN')
  try {
    const result = work()
    database.exec('COMMIT')
    return result
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export function allTracks(): Track[] {
  const rows = library().prepare(`${SELECT_TRACKS} ORDER BY t.id`).all() as unknown as TrackRow[]
  return rows.map(toTrack)
}

export function trackById(id: number): Track | null {
  const row = library().prepare(`${SELECT_TRACKS} AND t.id = ?`).get(id) as TrackRow | undefined
  return row ? toTrack(row) : null
}

// The file behind a library song, or null for an unknown id.
export function trackFile(id: number): { path: string; format: AudioFormat } | null {
  const row = library().prepare("SELECT location, format FROM tracks WHERE source = 'local' AND id = ?").get(id) as
    | { location: string; format: AudioFormat }
    | undefined
  return row ? { path: row.location, format: row.format } : null
}

// Looks up the songs already in the library by path, with the file details they were read from.
export function storedTracks(paths: string[]): Map<string, StoredTrack> {
  const statement = library().prepare(`${SELECT_TRACKS} AND t.location_key = ?`)
  const found = new Map<string, StoredTrack>()
  for (const path of paths) {
    const row = statement.get(locationKey(path)) as TrackRow | undefined
    if (row) found.set(locationKey(path), { track: toTrack(row), stamp: { size: row.file_size ?? -1, modified: row.file_modified ?? -1 } })
  }
  return found
}

// Inserts new songs and refreshes changed ones in one transaction, then returns them with their ids.
export function saveTracks(entries: { track: NewTrack; stamp: FileStamp }[]): Track[] {
  const database = library()
  const upsert = database.prepare(`
    INSERT INTO tracks (location, location_key, format, title, artist, album, album_artist, track_number,
      disc_number, year, duration, artwork_id, file_size, file_modified, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (source, location_key) DO UPDATE SET
      location = excluded.location, format = excluded.format, title = excluded.title, artist = excluded.artist,
      album = excluded.album, album_artist = excluded.album_artist, track_number = excluded.track_number,
      disc_number = excluded.disc_number, year = excluded.year, duration = excluded.duration,
      artwork_id = excluded.artwork_id, file_size = excluded.file_size, file_modified = excluded.file_modified
    RETURNING id
  `)

  const now = Date.now()
  return transaction(() =>
    entries.flatMap(({ track: t, stamp }) => {
      const { id } = upsert.get(
        t.path, locationKey(t.path), t.format, t.title, t.artist, t.album, t.albumArtist, t.trackNumber,
        t.discNumber, t.year, t.duration, t.artworkId, stamp.size, stamp.modified, now
      ) as { id: number }
      return trackById(id) ?? []
    })
  )
}

// Takes songs out of the library, along with their spots in playlists. The files are never touched, and each one is
// remembered so the music folders don't bring it back.
export function removeTracks(trackIds: number[]): number[] {
  const database = library()
  const remove = database.prepare("DELETE FROM tracks WHERE source = 'local' AND id = ? RETURNING id, location_key")
  const remember = database.prepare('INSERT OR REPLACE INTO removed_tracks (location_key, removed_at) VALUES (?, ?)')
  const now = Date.now()
  return transaction(() =>
    trackIds.flatMap((id) => {
      const row = remove.get(id) as { id: number; location_key: string } | undefined
      if (!row) return []
      remember.run(row.location_key, now)
      return row.id
    })
  )
}

// Which of these paths belong to songs taken out of the library.
export function removedLocations(paths: string[]): Set<string> {
  const statement = library().prepare("SELECT 1 FROM removed_tracks WHERE source = 'local' AND location_key = ?")
  return new Set(paths.map(locationKey).filter((key) => statement.get(key)))
}

// Songs added again by hand are welcome back, so the music folders keep them from then on.
export function forgetRemoved(paths: string[]): void {
  const forget = library().prepare("DELETE FROM removed_tracks WHERE source = 'local' AND location_key = ?")
  transaction(() => paths.forEach((path) => forget.run(locationKey(path))))
}

// Every song's id and file path, for checking which files still exist.
export function trackLocations(): { id: number; location: string }[] {
  return library().prepare("SELECT id, location FROM tracks WHERE source = 'local'").all() as unknown as { id: number; location: string }[]
}

// Likes or unlikes songs and returns them as they are now.
export function setLiked(trackIds: number[], liked: boolean): Track[] {
  const update = library().prepare(
    "UPDATE tracks SET liked_at = CASE WHEN ? THEN coalesce(liked_at, ?) ELSE NULL END WHERE source = 'local' AND id = ? RETURNING id"
  )
  const now = Date.now()
  return transaction(() =>
    trackIds.flatMap((id) => {
      const row = update.get(liked ? 1 : 0, now, id) as { id: number } | undefined
      return (row && trackById(row.id)) ?? []
    })
  )
}

export interface MatchInfo {
  source: string
  sourceId: string
  title: string
  artist: string | null
  album: string | null
  albumArtist: string | null
  trackNumber: number | null
  discNumber: number | null
  year: number | null
  artworkId: string | null
}

// Saves what a song was identified as. The file's own tags stay untouched underneath.
export function saveMatch(trackId: number, match: MatchInfo): Track | null {
  library()
    .prepare(
      `INSERT OR REPLACE INTO track_matches (track_id, source, source_id, title, artist, album, album_artist,
        track_number, disc_number, year, artwork_id, matched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      trackId, match.source, match.sourceId, match.title, match.artist, match.album, match.albumArtist,
      match.trackNumber, match.discNumber, match.year, match.artworkId, Date.now()
    )
  return trackById(trackId)
}

// Forgets a match, so the song shows its file's own tags again.
export function clearMatch(trackId: number): Track | null {
  library().prepare('DELETE FROM track_matches WHERE track_id = ?').run(trackId)
  return trackById(trackId)
}
