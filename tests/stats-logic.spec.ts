import { expect, test } from '@playwright/test'
import { roundMixSize, type ListeningStats, type Track } from '../src/shared/api'
import { formatListening } from '../src/renderer/src/lib/format'
import type { Artist } from '../src/renderer/src/lib/library'
import { chartBars, spanStart, topArtists, topSongs } from '../src/renderer/src/lib/stats'

const NOW = new Date(2026, 10, 3, 15, 30) // November 3, 2026, mid-afternoon, local time

const track = (id: number, title: string): Track => ({
  id,
  path: `C:\\Music\\${title}.mp3`,
  format: 'mp3',
  title,
  artist: 'Band',
  album: null,
  albumArtist: null,
  trackNumber: null,
  discNumber: null,
  year: null,
  duration: 200,
  artworkId: null,
  addedAt: 0,
  likedAt: null,
  identified: false
})

const stats = (tracks: ListeningStats['tracks'], buckets: ListeningStats['buckets'] = [], firstPlayedAt: number | null = NOW.getTime()): ListeningStats => ({
  totalSeconds: tracks.reduce((total, entry) => total + entry.seconds, 0),
  tracks,
  buckets,
  firstPlayedAt
})

test('spans start at local midnight a week or 30 days back, or the first of the month a year back', () => {
  expect(new Date(spanStart('week', NOW))).toEqual(new Date(2026, 9, 28))
  expect(new Date(spanStart('month', NOW))).toEqual(new Date(2026, 9, 5))
  expect(new Date(spanStart('year', NOW))).toEqual(new Date(2025, 11, 1))
  expect(spanStart('all', NOW)).toBe(0)
})

test('the chart has a bar for every day or month, quiet ones included, ending on today', () => {
  const week = chartBars('week', stats([], [{ key: '2026-11-03', seconds: 600 }, { key: '2026-10-30', seconds: 120 }]), NOW)
  expect(week.map((bar) => bar.key)).toEqual(['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'])
  expect(week.map((bar) => bar.seconds)).toEqual([0, 0, 120, 0, 0, 0, 600])
  expect(week.map((bar) => bar.current)).toEqual([false, false, false, false, false, false, true])

  expect(chartBars('month', stats([]), NOW)).toHaveLength(30)
  const year = chartBars('year', stats([], [{ key: '2026-11', seconds: 3600 }]), NOW)
  expect(year).toHaveLength(12)
  expect(year[0].key).toBe('2025-12')
  expect(year[11]).toMatchObject({ key: '2026-11', seconds: 3600, current: true })
})

test('the all-time chart shows at least six months and at most two years', () => {
  expect(chartBars('all', stats([], [], NOW.getTime()), NOW)).toHaveLength(6)
  expect(chartBars('all', stats([], [], new Date(2025, 10, 1).getTime()), NOW)).toHaveLength(13)
  const long = chartBars('all', stats([], [], new Date(2020, 0, 1).getTime()), NOW)
  expect(long).toHaveLength(24)
  expect(long[23].key).toBe('2026-11')
})

test('top songs are the most played, with listening time breaking ties, and unplayed or removed songs left out', () => {
  const tracksById = new Map([1, 2, 3, 4].map((id) => [id, track(id, `Song ${id}`)]))
  const ranked = topSongs(
    stats([
      { trackId: 1, plays: 2, seconds: 300 },
      { trackId: 2, plays: 5, seconds: 900 },
      { trackId: 3, plays: 2, seconds: 400 },
      { trackId: 4, plays: 0, seconds: 20 },
      { trackId: 99, plays: 9, seconds: 2000 }
    ]),
    tracksById
  )
  expect(ranked.map((song) => song.track.title)).toEqual(['Song 2', 'Song 3', 'Song 1'])
})

test('top artists add up listening time across their songs, skipped songs included', () => {
  const a = track(1, 'One')
  const b = track(2, 'Two')
  const c = track(3, 'Three')
  const artists: Artist[] = [
    { key: 'band', name: 'Band', artworkId: null, albums: [], tracks: [a, b] },
    { key: 'other', name: 'Other', artworkId: null, albums: [], tracks: [c] }
  ]
  const ranked = topArtists(
    stats([
      { trackId: 1, plays: 1, seconds: 200 },
      { trackId: 2, plays: 0, seconds: 150 },
      { trackId: 3, plays: 4, seconds: 300 }
    ]),
    artists
  )
  expect(ranked.map((entry) => [entry.artist.name, entry.seconds])).toEqual([
    ['Band', 350],
    ['Other', 300]
  ])
})

test('listening time reads the way people say it', () => {
  expect(formatListening(0)).toBe('0m')
  expect(formatListening(0.4)).toBe('0m')
  expect(formatListening(25.7)).toBe('25s')
  expect(formatListening(45 * 60)).toBe('45m')
  expect(formatListening(2 * 3600)).toBe('2h')
  expect(formatListening(12 * 3600 + 40 * 60 + 30)).toBe('12h 40m')
})

test('the mix size rounds to the nearest five and stays between 5 and 100', () => {
  expect(roundMixSize(23)).toBe(25)
  expect(roundMixSize(22)).toBe(20)
  expect(roundMixSize(12)).toBe(10)
  expect(roundMixSize(1)).toBe(5)
  expect(roundMixSize(500)).toBe(100)
  expect(roundMixSize(Number.NaN, 30)).toBe(30)
})
