import type { FoundCandidate } from './candidates'
import { durationScore } from './match'

// The parts of an AcoustID lookup answer Encore uses. AcoustID links each fingerprint match to MusicBrainz
// recordings, and each recording to the release groups (albums, singles, compilations) it appears on.
interface Artist {
  name: string
  joinphrase?: string
}

interface Release {
  id: string
  date?: { year?: number; month?: number; day?: number }
  mediums?: { position?: number; tracks?: { position?: number }[] }[]
}

interface ReleaseGroup {
  id: string
  title?: string
  type?: string
  secondarytypes?: string[]
  artists?: Artist[]
  releases?: Release[]
}

interface Recording {
  id: string
  title?: string
  duration?: number
  artists?: Artist[]
  releasegroups?: ReleaseGroup[]
}

export interface AcoustIdAnswer {
  status?: string
  results?: { score: number; recordings?: Recording[] }[]
}

const MAX_CANDIDATES = 4
const MIN_SCORE = 0.5

// Original albums first. Singles and EPs next, then releases that gather songs from elsewhere or are a
// different performance of them.
const TYPE_ADJUSTMENT: Record<string, number> = { album: 0, single: -0.05, ep: -0.05 }
const OTHER_TYPE = -0.4
const SECONDARY_ADJUSTMENT: Record<string, number> = {
  compilation: -0.15,
  soundtrack: -0.15,
  'mixtape/street': -0.1,
  live: -0.3,
  remix: -0.3,
  'dj-mix': -0.3,
  demo: -0.3
}

// "Linkin Park", or "Jay-Z & Linkin Park" with MusicBrainz's own joining words.
const artistNames = (artists: Artist[] | undefined): string | null =>
  artists?.length ? artists.map((artist, i) => artist.name + (i < artists.length - 1 ? (artist.joinphrase ?? ', ') : '')).join('') : null

const releaseSortKey = (release: Release): number =>
  (release.date?.year ?? 9999) * 10_000 + (release.date?.month ?? 12) * 100 + (release.date?.day ?? 31)

// The earliest release of an album is the original one. Its year, disc, and track number are the ones to use.
function originalRelease(group: ReleaseGroup): Release | undefined {
  const releases = [...(group.releases ?? [])].sort((a, b) => releaseSortKey(a) - releaseSortKey(b))
  return releases.find((release) => release.mediums?.[0]?.tracks?.length) ?? releases[0]
}

function typeAdjustment(group: ReleaseGroup): number {
  const type = TYPE_ADJUSTMENT[group.type?.toLowerCase() ?? ''] ?? OTHER_TYPE
  const secondary = (group.secondarytypes ?? []).reduce((total, kind) => total + (SECONDARY_ADJUSTMENT[kind.toLowerCase()] ?? -0.1), 0)
  return type + secondary
}

// Turns an AcoustID answer into the few most likely releases, best first, one per album.
// coverArtBase is the Cover Art Archive's address, which tests point at a stand-in.
export function candidatesFromAcoustId(answer: AcoustIdAnswer, songLength: number | null, coverArtBase: string): FoundCandidate[] {
  // Ranked on the full score, so an album still beats a single when both fit perfectly. The shown score is capped at 1.
  const byGroup = new Map<string, { rank: number; candidate: FoundCandidate }>()

  for (const result of answer.results ?? []) {
    for (const recording of result.recordings ?? []) {
      if (!recording.title || !recording.artists?.length) continue
      for (const group of recording.releasegroups ?? []) {
        const rank = result.score + typeAdjustment(group) + durationScore(songLength, recording.duration ?? null) - 0.05
        if (rank < MIN_SCORE) continue
        const existing = byGroup.get(group.id)
        if (existing && existing.rank >= rank) continue

        const release = originalRelease(group)
        const medium = release?.mediums?.[0]
        const candidate: FoundCandidate = {
          id: `mb-${group.id}-${recording.id}`,
          title: recording.title,
          artist: artistNames(recording.artists)!,
          album: group.title ?? null,
          albumArtist: artistNames(group.artists),
          trackNumber: medium?.tracks?.[0]?.position ?? null,
          discNumber: medium?.position ?? null,
          year: release?.date?.year ?? null,
          duration: recording.duration ?? null,
          score: Math.round(Math.min(1, rank) * 100) / 100,
          bySound: true,
          coverUrl: `${coverArtBase}/release-group/${group.id}/front-500`,
          thumbnailUrl: `${coverArtBase}/release-group/${group.id}/front-250`,
          artistId: null
        }
        byGroup.set(group.id, { rank, candidate })
      }
    }
  }

  return [...byGroup.values()]
    .sort((a, b) => b.rank - a.rank)
    .slice(0, MAX_CANDIDATES)
    .map(({ candidate }) => candidate)
}
