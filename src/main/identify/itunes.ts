import { net } from 'electron'
import type { MatchCandidate } from '../../shared/api'

// Tests point this at a local stand-in so they never depend on Apple's servers.
const SEARCH_URL = process.env.ENCORE_LOOKUP_URL ?? 'https://itunes.apple.com/search'
// Apple allows roughly 20 searches a minute, so one every 3 seconds stays well inside that.
const REQUEST_GAP_MS = Number(process.env.ENCORE_LOOKUP_GAP_MS ?? 3000)
const BUSY_RETRY_MS = 15_000
const RESULTS_PER_SEARCH = 15
const SONGS_PER_ARTIST = 200
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const REMEMBERED_CANDIDATES = 4000

interface ItunesTrack {
  kind?: string
  trackId?: number
  trackName?: string
  artistId?: number
  artistName?: string
  collectionName?: string
  collectionArtistName?: string
  trackNumber?: number
  discNumber?: number
  releaseDate?: string
  trackTimeMillis?: number
  artworkUrl100?: string
}

// A candidate plus where its cover lives and who made it in Apple's catalog. These stay in the main process.
export interface FoundCandidate extends MatchCandidate {
  coverUrl: string | null
  thumbnailUrl: string | null
  artistId: number | null
}

export class LookupError extends Error {}

// Every candidate handed to the interface is remembered here, so a pick can only ever be one Encore found itself.
const found = new Map<string, FoundCandidate>()

export const foundCandidate = (id: string): FoundCandidate | undefined => found.get(id)

const remember = (candidate: FoundCandidate): void => {
  found.delete(candidate.id)
  found.set(candidate.id, candidate)
  if (found.size > REMEMBERED_CANDIDATES) found.delete(found.keys().next().value!)
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

let lastRequest = 0
async function waitTurn(): Promise<void> {
  const wait = lastRequest + REQUEST_GAP_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequest = Date.now()
}

// Apple's cover links end in a size like 100x100bb.jpg, and any size can be asked for.
const coverAt = (url: string | undefined, size: number): string | null =>
  url ? url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`) : null

function toCandidate(track: Required<Pick<ItunesTrack, 'trackId' | 'trackName' | 'artistName'>> & ItunesTrack): FoundCandidate {
  const year = Number(track.releaseDate?.slice(0, 4))
  return {
    id: `itunes-${track.trackId}`,
    title: track.trackName,
    artist: track.artistName,
    album: track.collectionName ?? null,
    albumArtist: track.collectionArtistName ?? null,
    trackNumber: track.trackNumber || null,
    discNumber: track.discNumber || null,
    year: Number.isFinite(year) && year > 0 ? year : null,
    duration: track.trackTimeMillis ? track.trackTimeMillis / 1000 : null,
    score: 0,
    coverUrl: coverAt(track.artworkUrl100, 600),
    thumbnailUrl: coverAt(track.artworkUrl100, 300),
    artistId: track.artistId ?? null
  }
}

async function request(url: URL): Promise<Response> {
  await waitTurn()
  try {
    return await net.fetch(url.toString())
  } catch {
    throw new LookupError("Couldn't reach Apple's music search. Check your internet connection.")
  }
}

// Asks Apple's catalog one question, at a polite pace. If Apple says to slow down, waits once and tries again.
async function ask(endpoint: 'search' | 'lookup', params: Record<string, string>): Promise<ItunesTrack[]> {
  const url = new URL(endpoint, SEARCH_URL)
  url.search = new URLSearchParams(params).toString()
  let response = await request(url)
  if (response.status === 403 || response.status === 429) {
    await sleep(BUSY_RETRY_MS)
    response = await request(url)
  }
  if (!response.ok) throw new LookupError("Apple's music search isn't answering right now. Try again in a few minutes.")
  const body = (await response.json().catch(() => ({}))) as { results?: ItunesTrack[] }
  return body.results ?? []
}

function songsFrom(results: ItunesTrack[]): FoundCandidate[] {
  const candidates = results
    .filter((track): track is Required<Pick<ItunesTrack, 'trackId' | 'trackName' | 'artistName'>> & ItunesTrack =>
      track.kind === 'song' && Boolean(track.trackId && track.trackName && track.artistName)
    )
    .map(toCandidate)
  candidates.forEach(remember)
  return candidates
}

// Searches Apple's music catalog for songs matching the words.
export async function searchSongs(term: string): Promise<FoundCandidate[]> {
  return songsFrom(await ask('search', { term, media: 'music', entity: 'song', limit: String(RESULTS_PER_SEARCH) }))
}

// An artist's songs, up to 200 of them. Apple's song search skips some albums, often explicit ones, that show up here.
export async function artistSongs(artistId: number): Promise<FoundCandidate[]> {
  return songsFrom(await ask('lookup', { id: String(artistId), entity: 'song', limit: String(SONGS_PER_ARTIST) }))
}

// Finds an artist's catalog number by name, for when a song search turned up nothing by them.
export async function findArtistId(name: string, sameArtist: (candidate: string) => boolean): Promise<number | null> {
  const artists = await ask('search', { term: name, media: 'music', entity: 'musicArtist', limit: '5' })
  return artists.find((artist) => artist.artistId && artist.artistName && sameArtist(artist.artistName))?.artistId ?? null
}

// Covers only ever come from Apple's image servers, or from the stand-in search during tests.
function isAllowedImage(url: string): boolean {
  try {
    const target = new URL(url)
    if (target.protocol === 'https:' && target.hostname.endsWith('.mzstatic.com')) return true
    return target.origin === new URL(SEARCH_URL).origin
  } catch {
    return false
  }
}

export async function fetchImage(url: string): Promise<{ data: Uint8Array<ArrayBuffer>; type: string } | null> {
  if (!isAllowedImage(url)) return null
  const response = await net.fetch(url).catch(() => null)
  const type = response?.headers.get('content-type')?.split(';')[0].trim() ?? ''
  if (!response?.ok || !type.startsWith('image/')) return null
  const data = new Uint8Array(await response.arrayBuffer())
  return data.length > 0 && data.length <= MAX_IMAGE_BYTES ? { data, type } : null
}
