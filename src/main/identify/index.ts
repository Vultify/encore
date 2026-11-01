import { ipcMain, type WebContents } from 'electron'
import { CANDIDATE_ID, Channels, type IdentifyProgress, type IdentifyResult, type MatchCandidate, type Track } from '../../shared/api'
import { clearMatch, saveMatch, trackById } from '../library/database'
import { saveArtwork } from '../library/artwork'
import { fetchImage, foundCandidate, LookupError, type FoundCandidate } from './candidates'
import { artistSongs, findArtistId, searchSongs } from './itunes'
import { matchBySound } from './acoustid'
import { needsDeeperLook, preferLocalSpelling, rankCandidates, sameArtist, searchTerm, type SongClues } from './match'

const isId = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0

// The run in progress, if any. Only one runs at a time, and stopping it ends it after the current song.
let current: { stopped: boolean } | null = null

// The interface only needs what it shows. Cover links and catalog numbers stay here.
const forInterface = ({ coverUrl: _cover, thumbnailUrl: _thumbnail, artistId: _artist, ...candidate }: FoundCandidate): MatchCandidate =>
  candidate

// An artist's songs, fetched once per run however many of their songs are being identified.
type ArtistCatalogs = Map<string, Promise<FoundCandidate[]>>

// Searches by artist and title. If that turns up only compilations or nothing quite right, also checks
// the artist's own song list, where albums the search skips still show up.
async function findByName(clues: SongClues, catalogs: ArtistCatalogs): Promise<FoundCandidate[]> {
  const searched = await searchSongs(searchTerm(clues))
  const ranked = rankCandidates(clues, searched)
  const artist = clues.artist
  if (!artist || !needsDeeperLook(ranked)) return ranked

  const key = artist.toLowerCase()
  if (!catalogs.has(key)) {
    catalogs.set(
      key,
      (async () => {
        const artistId =
          searched.find((candidate) => candidate.artistId && sameArtist(artist, candidate.artist))?.artistId ??
          (await findArtistId(artist, (name) => sameArtist(artist, name)))
        return artistId ? artistSongs(artistId) : []
      })()
    )
  }
  const catalog = await catalogs.get(key)!
  const known = new Set(searched.map((candidate) => candidate.id))
  return rankCandidates(clues, [...searched, ...catalog.filter((candidate) => !known.has(candidate.id))])
}

// Searches by name first. When the name gives nothing to go on, like a file called "track01" with no artist,
// or the search finds nothing, Encore listens to the song and matches it by sound instead.
async function findMatches(path: string, clues: SongClues, catalogs: ArtistCatalogs): Promise<FoundCandidate[]> {
  const byName = await findByName(clues, catalogs)
  if (byName.length > 0 && clues.artist) return byName
  const bySound = await matchBySound(path, clues.duration)
  return bySound.length > 0 ? bySound : byName
}

// Looks each song up in turn, sending its best matches as soon as they're ready.
async function identify(trackIds: number[], sender: WebContents): Promise<void> {
  if (current) throw new Error('Songs are already being identified')
  const run = { stopped: false }
  current = run

  const send = (channel: string, payload: IdentifyResult | IdentifyProgress): void => {
    if (!sender.isDestroyed()) sender.send(channel, payload)
  }

  const total = trackIds.length
  const catalogs: ArtistCatalogs = new Map()
  let done = 0
  try {
    for (const trackId of trackIds) {
      if (run.stopped) break
      const track = trackById(trackId)
      let candidates: FoundCandidate[] = []
      if (track) {
        try {
          candidates = await findMatches(track.path, { title: track.title, artist: track.artist, duration: track.duration }, catalogs)
        } catch (error) {
          send(Channels.identifyProgress, { done, total, error: error instanceof LookupError ? error.message : "Couldn't look songs up." })
          return
        }
      }
      if (run.stopped) break
      done += 1
      send(Channels.identifyResult, { trackId, candidates: candidates.map(forInterface) })
      send(Channels.identifyProgress, { done, total })
    }
  } finally {
    if (current === run) current = null
  }
}

// Saves a picked match with its cover. The album artist falls back to the artist so songs from one album
// group together even when they sit in different folders.
async function apply(trackId: number, candidateId: string): Promise<Track | null> {
  const candidate = foundCandidate(candidateId)
  const track = trackById(trackId)
  if (!candidate || !track) return null

  const image = candidate.coverUrl ? await fetchImage(candidate.coverUrl) : null
  const artworkId = image ? await saveArtwork(image.data, image.type) : null
  const artist = preferLocalSpelling(track.artist, candidate.artist)

  return saveMatch(trackId, {
    source: 'itunes',
    sourceId: candidate.id,
    title: candidate.title,
    artist,
    album: candidate.album,
    albumArtist: candidate.albumArtist ? preferLocalSpelling(track.artist, candidate.albumArtist) : artist,
    trackNumber: candidate.trackNumber,
    discNumber: candidate.discNumber,
    year: candidate.year,
    artworkId
  })
}

// Serves encore-art://preview/<candidate id>: a match's cover, fetched here so the page never loads outside images.
export async function servePreview(request: Request): Promise<Response> {
  const id = new URL(request.url).pathname.slice(1)
  const candidate = CANDIDATE_ID.test(id) ? foundCandidate(id) : undefined
  const image = candidate?.thumbnailUrl ? await fetchImage(candidate.thumbnailUrl) : null
  if (!image) return new Response(null, { status: 404 })
  return new Response(image.data, { headers: { 'Content-Type': image.type, 'Cache-Control': 'max-age=86400' } })
}

export function registerIdentifyHandlers(): void {
  ipcMain.handle(Channels.identifyStart, (event, trackIds: unknown) => {
    if (!Array.isArray(trackIds) || trackIds.length === 0 || trackIds.length > 10_000 || !trackIds.every(isId)) return
    return identify(trackIds, event.sender)
  })
  ipcMain.on(Channels.identifyStop, () => {
    if (current) current.stopped = true
  })
  ipcMain.handle(Channels.identifyApply, (_event, trackId: unknown, candidateId: unknown) =>
    isId(trackId) && typeof candidateId === 'string' && CANDIDATE_ID.test(candidateId) ? apply(trackId, candidateId) : null
  )
  ipcMain.handle(Channels.identifyRestore, (_event, trackId: unknown) => (isId(trackId) ? clearMatch(trackId) : null))
}
