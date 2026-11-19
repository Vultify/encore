import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { saveArtwork } from './artwork'

export interface NameGuess {
  artist: string | null
  title: string
  trackNumber: number | null
}

// Video site leftovers like "(Official Video)" or "[Lyrics]" that aren't part of the real title.
const JUNK = /\s*[([][^)\]]*\b(official|video|audio|lyrics?|visualizer|hd|hq|4k)\b[^)\]]*[)\]]/gi
const LEADING_TRACK = /^(\d{1,2})(?:\s*[.\-_)]\s*|\s+)(?=\S)/
// A hyphen, en dash, or em dash between spaces.
const ARTIST_SEPARATOR = /\s+[-\u2013\u2014]\s+/

// Guesses artist, title, and track number from names like "03 - Artist - Title (Official Video)".
export function guessFromName(name: string): NameGuess {
  let rest = name.replace(JUNK, '').replace(/_/g, ' ').trim()
  let trackNumber: number | null = null

  const track = rest.match(LEADING_TRACK)
  if (track) {
    trackNumber = Number(track[1]) || null
    rest = rest.slice(track[0].length)
  }

  const split = rest.match(ARTIST_SEPARATOR)
  if (split?.index) {
    const artist = rest.slice(0, split.index).trim()
    const title = rest.slice(split.index + split[0].length).trim()
    if (artist && title) return { artist, title, trackNumber }
  }

  return { artist: null, title: rest || name, trackNumber }
}

const COVER_NAMES = ['cover', 'folder', 'front', 'album', 'albumart']
const COVER_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}
const MAX_COVER_BYTES = 20 * 1024 * 1024

// Finds and saves the cover image sitting in a folder, if it has one.
async function findFolderCover(folder: string): Promise<string | null> {
  const names = await readdir(folder).catch(() => [])
  const match = names
    .map((name) => ({ name, base: name.slice(0, -extname(name).length).toLowerCase(), type: COVER_TYPES[extname(name).toLowerCase()] }))
    .filter((file) => file.type && COVER_NAMES.includes(file.base))
    .sort((a, b) => COVER_NAMES.indexOf(a.base) - COVER_NAMES.indexOf(b.base))[0]
  if (!match) return null

  const path = join(folder, match.name)
  const info = await stat(path).catch(() => null)
  if (!info || info.size > MAX_COVER_BYTES) return null
  const data = await readFile(path).catch(() => null)
  return data ? saveArtwork(data, match.type) : null
}

// One lookup per import, so a folder full of songs is only searched once.
export function createFolderCoverLookup(): (folder: string) => Promise<string | null> {
  const found = new Map<string, Promise<string | null>>()
  return (folder) => {
    const key = folder.toLowerCase()
    if (!found.has(key)) found.set(key, findFolderCover(folder))
    return found.get(key)!
  }
}
