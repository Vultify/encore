import type { MatchCandidate } from '../../shared/api'
import { normalize } from '../../shared/text'

// What's known about the song being identified.
export interface SongClues {
  title: string
  artist: string | null
  duration: number | null
}

const MAX_CANDIDATES = 4
const MIN_SCORE = 0.55

// Leftovers from video sites that aren't part of the song's name.
const VIDEO_JUNK = /\s*[([][^)\]]*\b(official|video|audio|lyrics?|visuali[sz]er|hd|hq|4k)\b[^)\]]*[)\]]/gi
// "ft. Bruno Mars", "feat. Bruno Mars", "featuring Bruno Mars" through the end of the text.
const FEATURING = /\s+(?:ft|feat|featuring)\b\.?.*$/i

// Versions of a song that are a different recording from the one being identified, unless its own title says so.
const VARIANT = /\b(live|remix|mix|karaoke|tribute|instrumental|acoustic|cover|demo|sped up|slowed|reverb|8 bit|lullaby|orchestral|a ?cappella|extended|re recorded)\b/
// Albums made of covers or knock-offs rather than the original recording.
const KNOCKOFF_ALBUM = /\b(karaoke|tribute|lullaby|8 bit|kidz bop|in the style of|made famous|workout|fitness|relaxing|piano covers?)\b/
const SPECIAL_EDITION = /\b(deluxe|expanded|anniversary|edition)\b/
// Albums that gather songs from elsewhere. Same recording, but the original album is the better pick.
const COMPILATION = /\b(soundtrack|motion picture|playlist|best of|very best|greatest hits|hits|collection|anthology|essentials?)\b/
// A best match scoring under this is worth a second, deeper look through the artist's own songs.
const CONFIDENT = 0.95

// The title with bracketed extras and featured artists taken off: "Uptown Funk (feat. Bruno Mars)" becomes "uptown funk".
export function coreTitle(title: string): string {
  return normalize(title.replace(/[([][^)\]]*[)\]]/g, ' ').replace(FEATURING, ''))
}

// What to type into the music search: artist and title, without video junk or featured artists.
export function searchTerm({ title, artist }: SongClues): string {
  const cleanTitle = title.replace(VIDEO_JUNK, '').replace(FEATURING, '').trim()
  return [artist, cleanTitle].filter(Boolean).join(' ')
}

const words = (text: string): Set<string> => new Set(text.split(' ').filter(Boolean))

function overlap(a: string, b: string): number {
  const left = words(a)
  const right = words(b)
  if (left.size === 0 || right.size === 0) return 0
  const shared = [...left].filter((word) => right.has(word)).length
  return shared / new Set([...left, ...right]).size
}

function titleScore(local: string, candidate: string): number {
  const a = coreTitle(local)
  const b = coreTitle(candidate)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.75
  const shared = overlap(a, b)
  return shared >= 0.5 ? shared * 0.7 : 0
}

// No artist to compare gets a middling score, so the title and length decide.
function artistScore(local: string | null, candidate: MatchCandidate): number {
  if (!local) return 0.5
  const a = normalize(local)
  const b = normalize(candidate.artist)
  if (a === b) return 1
  if (` ${b} `.includes(` ${a} `) || ` ${a} `.includes(` ${b} `)) return 0.85
  if (normalize(candidate.title).includes(a)) return 0.6
  return overlap(a, b) * 0.7
}

// Lengths within a couple of seconds are almost certainly the same recording. Far apart means a different version.
export function durationScore(local: number | null, candidate: number | null): number {
  if (local === null || candidate === null) return 0.05
  const gap = Math.abs(local - candidate)
  if (gap <= 2) return 0.15
  if (gap <= 6) return 0.1
  if (gap <= 15) return 0
  if (gap <= 40) return -0.15
  return -0.3
}

function penalties(song: SongClues, candidate: MatchCandidate): number {
  const mine = normalize(song.title)
  const theirs = `${normalize(candidate.title)} ${normalize(candidate.album ?? '')}`
  const variant = theirs.match(VARIANT)?.[0]
  const album = normalize(candidate.album ?? '')

  let total = 0
  if (variant && !mine.includes(variant)) total += 0.5
  if (KNOCKOFF_ALBUM.test(album)) total += 0.5
  // An album credited to someone else, like "Various Artists" or a film composer, is a compilation or soundtrack.
  if (candidate.albumArtist && normalize(candidate.albumArtist) !== normalize(candidate.artist)) total += 0.15
  if (COMPILATION.test(album)) total += 0.05
  if (/ (single|ep)$/.test(album)) total += 0.05
  if (SPECIAL_EDITION.test(album)) total += 0.03
  return total
}

export function scoreCandidate(song: SongClues, candidate: MatchCandidate): number {
  const title = titleScore(song.title, candidate.title)
  const artist = artistScore(song.artist, candidate)
  // Same name, different artist: a different song, like XXXTENTACION's "NUMB" for Linkin Park's "Numb".
  if (title === 0 || artist === 0) return 0
  const score = title * 0.55 + artist * 0.3 + durationScore(song.duration, candidate.duration) - penalties(song, candidate)
  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100
}

// Scores every result, drops weak ones and repeats of the same album track, and keeps the best few.
export function rankCandidates<T extends MatchCandidate>(song: SongClues, candidates: T[]): T[] {
  const seen = new Set<string>()
  return candidates
    .map((candidate, index) => ({ candidate: { ...candidate, score: scoreCandidate(song, candidate) }, index }))
    .filter(({ candidate }) => candidate.score >= MIN_SCORE)
    .sort((a, b) => b.candidate.score - a.candidate.score || a.index - b.index)
    .map(({ candidate }) => candidate)
    .filter((candidate) => {
      const key = `${coreTitle(candidate.title)}|${normalize(candidate.album ?? '')}|${candidate.trackNumber}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_CANDIDATES)
}

export const sameArtist = (local: string, other: string): boolean => normalize(local) === normalize(other)

// A release that's the artist's own album, not a compilation, soundtrack, single, or EP.
export function looksOriginal(candidate: MatchCandidate): boolean {
  const album = normalize(candidate.album ?? '')
  const creditedToSomeoneElse = candidate.albumArtist !== null && !sameArtist(candidate.albumArtist, candidate.artist)
  return Boolean(album) && !creditedToSomeoneElse && !COMPILATION.test(album) && !/ (single|ep)$/.test(album)
}

// Apple's song search misses some albums. When the best result is a compilation or not a near-perfect fit,
// the artist's own song list is worth checking too.
export const needsDeeperLook = (ranked: MatchCandidate[]): boolean =>
  ranked.length === 0 || ranked[0].score < CONFIDENT || !looksOriginal(ranked[0])

// Keeps the spelling from the song's own tags when it's the same artist, so "Linkin Park" doesn't turn into "LINKIN PARK".
export function preferLocalSpelling(local: string | null, matched: string): string {
  return local && normalize(local) === normalize(matched) ? local : matched
}
