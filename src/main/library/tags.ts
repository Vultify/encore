import { basename, dirname, extname } from 'node:path'
import { parseFile, selectCover } from 'music-metadata'
import type { NewTrack } from '../../shared/api'
import type { AudioFile } from './scan'
import { saveArtwork } from './artwork'
import { guessFromName } from './fallbacks'

const clean = (value: string | undefined): string | null => value?.trim() || null
const positive = (value: number | null | undefined): number | null => (value && value > 0 ? value : null)

// Reads one song's tags and cover. Anything missing is filled from the file name and the folder's cover image.
export async function readTrack(
  { path, format }: AudioFile,
  folderCover: (folder: string) => Promise<string | null>
): Promise<NewTrack> {
  const fileTitle = basename(path, extname(path))
  const track: NewTrack = {
    path,
    format,
    title: fileTitle,
    artist: null,
    album: null,
    albumArtist: null,
    trackNumber: null,
    discNumber: null,
    year: null,
    duration: null,
    artworkId: null
  }

  try {
    const { common, format: audio } = await parseFile(path)
    const cover = selectCover(common.picture)

    // Some files, including some iTunes purchases, fill in only the "sort as" fields, so those are the backup.
    track.title = clean(common.title) ?? clean(common.titlesort) ?? fileTitle
    track.artist = clean(common.artist) ?? clean(common.artists?.join(', ')) ?? clean(common.artistsort)
    track.album = clean(common.album) ?? clean(common.albumsort)
    track.albumArtist = clean(common.albumartist) ?? clean(common.albumartistsort)
    track.trackNumber = positive(common.track.no)
    track.discNumber = positive(common.disk.no)
    track.year = positive(common.year)
    track.duration = positive(audio.duration)
    track.artworkId = cover ? await saveArtwork(cover.data, cover.format) : null
  } catch {
    // Damaged or unusual files keep the file name fallback.
  }

  // Without an artist tag, the title is usually "Artist - Title", whether it came from the tag or the file name.
  if (!track.artist) {
    const guess = guessFromName(track.title)
    track.artist = guess.artist
    track.title = guess.title
    track.trackNumber ??= guess.trackNumber
  }

  // A missing track number can still come from a file name like "02 Stand Steady".
  track.trackNumber ??= guessFromName(fileTitle).trackNumber
  track.artworkId ??= await folderCover(dirname(path))
  return track
}
