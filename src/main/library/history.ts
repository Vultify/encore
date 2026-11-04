import type { ListeningStats, StatsBucket } from '../../shared/api'
import { library } from './database'

// Starts a listen and returns its id, or null if the song is no longer in the library.
export function startListen(trackId: number, sourceKey: string | null): number | null {
  const row = library()
    .prepare('INSERT INTO plays (track_id, source_key, played_at, listened_seconds, counted) SELECT id, ?, ?, 0, 0 FROM tracks WHERE id = ? RETURNING id')
    .get(sourceKey, Date.now(), trackId) as { id: number } | undefined
  return row?.id ?? null
}

// Saves how long a listen has lasted so far, and whether it's long enough to count as a play.
export function updateListen(listenId: number, seconds: number, counted: boolean): void {
  library().prepare('UPDATE plays SET listened_seconds = ?, counted = ? WHERE id = ?').run(seconds, counted ? 1 : 0, listenId)
}

const BUCKET_FORMAT: Record<StatsBucket, string> = { day: '%Y-%m-%d', month: '%Y-%m' }

// Listening since the given time: the total, each song's plays and time, and the time per local day or month.
export function listeningStats(since: number, bucket: StatsBucket): ListeningStats {
  const db = library()
  const total = db.prepare('SELECT COALESCE(SUM(listened_seconds), 0) AS seconds FROM plays WHERE played_at >= ?').get(since) as {
    seconds: number
  }
  const tracks = db
    .prepare('SELECT track_id AS trackId, SUM(counted) AS plays, SUM(listened_seconds) AS seconds FROM plays WHERE played_at >= ? GROUP BY track_id')
    .all(since) as unknown as ListeningStats['tracks']
  const buckets = db
    .prepare(
      `SELECT strftime(?, played_at / 1000, 'unixepoch', 'localtime') AS key, SUM(listened_seconds) AS seconds
       FROM plays WHERE played_at >= ? GROUP BY key ORDER BY key`
    )
    .all(BUCKET_FORMAT[bucket], since) as unknown as ListeningStats['buckets']
  const first = db.prepare('SELECT MIN(played_at) AS at FROM plays').get() as { at: number | null }
  return { totalSeconds: total.seconds, tracks, buckets, firstPlayedAt: first.at }
}
