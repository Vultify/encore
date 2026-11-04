import type { ListeningStats, StatsBucket, Track } from '@shared/api'
import type { Artist } from './library'

export type StatsSpan = 'week' | 'month' | 'year' | 'all'

export interface SpanInfo {
  id: StatsSpan
  label: string
  // Finishes "listened ..." and "Nothing played ...".
  phrase: string
  bucket: StatsBucket
}

export const SPANS: SpanInfo[] = [
  { id: 'week', label: 'Week', phrase: 'in the last 7 days', bucket: 'day' },
  { id: 'month', label: 'Month', phrase: 'in the last 30 days', bucket: 'day' },
  { id: 'year', label: 'Year', phrase: 'in the last 12 months', bucket: 'month' },
  { id: 'all', label: 'All time', phrase: 'all time', bucket: 'month' }
]

export const spanInfo = (span: StatsSpan): SpanInfo => SPANS.find((info) => info.id === span)!

const DAYS: Partial<Record<StatsSpan, number>> = { week: 7, month: 30 }
// The all-time chart shows at least this many months so it never looks bare, and at most this many.
const MIN_MONTHS = 6
const MAX_MONTHS = 24

const pad = (n: number): string => String(n).padStart(2, '0')
const dayKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const monthKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`

// When a span starts, in local time: midnight a week or 30 days back, or the first of the month a year back.
export function spanStart(span: StatsSpan, now = new Date()): number {
  const days = DAYS[span]
  if (days) return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime()
  if (span === 'year') return new Date(now.getFullYear(), now.getMonth() - 11, 1).getTime()
  return 0
}

export interface Bar {
  key: string
  date: Date
  seconds: number
  // Today, or this month.
  current: boolean
}

// Every day or month in the span, quiet ones included, oldest first.
export function chartBars(span: StatsSpan, stats: ListeningStats, now = new Date()): Bar[] {
  const seconds = new Map(stats.buckets.map((bucket) => [bucket.key, bucket.seconds]))
  const days = DAYS[span]
  if (days) {
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i))
      return { key: dayKey(date), date, seconds: seconds.get(dayKey(date)) ?? 0, current: i === days - 1 }
    })
  }

  let months = 12
  if (span === 'all') {
    const first = new Date(stats.firstPlayedAt ?? now.getTime())
    const since = (now.getFullYear() - first.getFullYear()) * 12 + now.getMonth() - first.getMonth() + 1
    months = Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, since))
  }
  return Array.from({ length: months }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    return { key: monthKey(date), date, seconds: seconds.get(monthKey(date)) ?? 0, current: i === months - 1 }
  })
}

export interface SongStat {
  track: Track
  plays: number
  seconds: number
}

// Most played first. Songs played equally often are ordered by how long they were listened to.
export function topSongs(stats: ListeningStats, tracksById: Map<number, Track>): SongStat[] {
  return stats.tracks
    .filter((entry) => entry.plays > 0 && tracksById.has(entry.trackId))
    .map((entry) => ({ track: tracksById.get(entry.trackId)!, plays: entry.plays, seconds: entry.seconds }))
    .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds || a.track.title.localeCompare(b.track.title))
}

export interface ArtistStat {
  artist: Artist
  seconds: number
}

// Artists by how long they were listened to, grouped the same way the Library's Artists tab groups them.
export function topArtists(stats: ListeningStats, artists: Artist[]): ArtistStat[] {
  const artistOf = new Map<number, Artist>()
  for (const artist of artists) for (const track of artist.tracks) artistOf.set(track.id, artist)
  const totals = new Map<Artist, number>()
  for (const entry of stats.tracks) {
    const artist = artistOf.get(entry.trackId)
    if (artist && entry.seconds > 0) totals.set(artist, (totals.get(artist) ?? 0) + entry.seconds)
  }
  return [...totals].map(([artist, seconds]) => ({ artist, seconds })).sort((a, b) => b.seconds - a.seconds || a.artist.name.localeCompare(b.artist.name))
}
