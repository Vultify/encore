import { copyFile, rename, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { parseFile } from 'music-metadata'
import { File, Picture, PictureType, TagTypes } from 'node-taglib-sharp'
import type { AudioFormat, Track } from '../../shared/api'

// The main tag each format carries. Writing makes sure it exists, then updates every tag in the file through it.
const MAIN_TAG: Record<AudioFormat, TagTypes> = {
  mp3: TagTypes.Id3v2,
  m4a: TagTypes.Apple,
  flac: TagTypes.Xiph,
  wav: TagTypes.Id3v2
}

// The rewritten copy has to play for the same length as the original, within this many seconds.
const LENGTH_TOLERANCE = 0.5

export class WriteError extends Error {}

const sameText = (a: string | undefined, b: string | null): boolean => (a ?? '').trim() === (b ?? '').trim()

// Writes a song's title, artist, album, numbers, year, and cover into its file. It works on a copy in the same
// folder, checks the copy still plays for the same length and reads back the new tags, and only then swaps it in.
// If anything goes wrong, the copy is deleted and the original is never touched. The audio itself is never changed.
export async function writeTags(track: Track, coverPath: string | null): Promise<void> {
  // Same folder keeps the final swap a simple rename, and the same extension tells the tag reader the format.
  const copy = join(dirname(track.path), `.encore-saving-${basename(track.path)}`)

  try {
    const original = await parseFile(track.path, { duration: true, skipCovers: true })
    await copyFile(track.path, copy)

    const file = File.createFromPath(copy)
    try {
      file.getTag(MAIN_TAG[track.format], true)
      const tag = file.tag
      tag.title = track.title
      tag.performers = track.artist ? [track.artist] : []
      tag.album = track.album ?? ''
      tag.albumArtists = track.albumArtist ? [track.albumArtist] : []
      tag.track = track.trackNumber ?? 0
      tag.disc = track.discNumber ?? 0
      tag.year = track.year ?? 0
      if (coverPath) {
        const cover = Picture.fromPath(coverPath)
        cover.type = PictureType.FrontCover
        tag.pictures = [cover]
      }
      file.save()
    } finally {
      file.dispose()
    }

    const saved = await parseFile(copy, { duration: true, skipCovers: true })
    const lengthBefore = original.format.duration ?? 0
    const lengthAfter = saved.format.duration ?? 0
    if (Math.abs(lengthAfter - lengthBefore) > LENGTH_TOLERANCE) {
      throw new WriteError("The saved copy didn't play the same length as the original, so it wasn't used.")
    }
    if (!sameText(saved.common.title, track.title) || !sameText(saved.common.artist, track.artist) || !sameText(saved.common.album, track.album)) {
      throw new WriteError("The new tags didn't read back correctly, so the file wasn't changed.")
    }

    await rename(copy, track.path)
  } catch (error) {
    await rm(copy, { force: true })
    if (error instanceof WriteError) throw error
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
      throw new WriteError('The file is in use or read-only. If Encore is playing it, play another song and try again.')
    }
    if (code === 'ENOENT') throw new WriteError("The file isn't where it used to be.")
    throw new WriteError("Couldn't save the tags. The file wasn't changed.")
  }
}
