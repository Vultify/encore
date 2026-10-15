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
}

// Windows paths ignore case, so lookups use a lowercased copy.
export const locationKey = (path: string): string => path.toLowerCase()

const toTrack = (row: TrackRow): Track => ({
  id: row.id,
  path: row.location,
  format: row.format as AudioFormat,
  title: row.title,
  artist: row.artist,
  album: row.album,
  albumArtist: row.album_artist,
  trackNumber: row.track_number,
  discNumber: row.disc_number,
  year: row.year,
  duration: row.duration,
  artworkId: row.artwork_id,
  addedAt: row.added_at
})

let db: DatabaseSync | null = null

function migrate(database: DatabaseSync): void {
  const { user_version: version } = database.prepare('PRAGMA user_version').get() as { user_version: number }
  for (let next = version; next < MIGRATIONS.length; next++) {
    database.exec('BEGIN')
    try {
      database.exec(MIGRATIONS[next])
      database.exec(`PRAGMA user_version = ${next + 1}`)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
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

function library(): DatabaseSync {
  if (!db) throw new Error('The library database is not open')
  return db
}

export function allTracks(): Track[] {
  const rows = library().prepare("SELECT * FROM tracks WHERE source = 'local' ORDER BY id").all() as unknown as TrackRow[]
  return rows.map(toTrack)
}

// Looks up the songs already in the library by path, with the file details they were read from.
export function storedTracks(paths: string[]): Map<string, StoredTrack> {
  const statement = library().prepare("SELECT * FROM tracks WHERE source = 'local' AND location_key = ?")
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
    RETURNING *
  `)

  const now = Date.now()
  const saved: Track[] = []
  database.exec('BEGIN')
  try {
    for (const { track: t, stamp } of entries) {
      const row = upsert.get(
        t.path, locationKey(t.path), t.format, t.title, t.artist, t.album, t.albumArtist, t.trackNumber,
        t.discNumber, t.year, t.duration, t.artworkId, stamp.size, stamp.modified, now
      ) as unknown as TrackRow
      saved.push(toTrack(row))
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return saved
}
