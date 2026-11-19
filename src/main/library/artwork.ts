import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, nativeImage, net } from 'electron'
import { ARTWORK_ID } from '../../shared/api'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp'
}

// Images already on disk this session, so every song on an album doesn't rewrite the same cover.
const saved = new Set<string>()

const artworkDir = (): string => join(app.getPath('userData'), 'artwork')

// Where a saved cover lives on disk, for writing it into a song file.
export const artworkPath = (id: string): string => join(artworkDir(), id)

// Serves encore-art://local/<id> from the artwork folder. Anything that isn't a valid id gets a 404.
// The interface may read the image itself, not just show it, so it can hand the cover to the Windows media overlay.
export async function serveArtwork(request: Request): Promise<Response> {
  const id = new URL(request.url).pathname.slice(1)
  if (!ARTWORK_ID.test(id)) return new Response(null, { status: 404 })
  const file = await net.fetch(pathToFileURL(join(artworkDir(), id)).toString())
  const headers = new Headers(file.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  return new Response(file.body, { status: file.status, headers })
}

// Small copies are this wide, enough for a 150 px tile on a high-DPI screen.
const THUMBNAIL_WIDTH = 320
const thumbnailDir = (): string => join(artworkDir(), 'thumbs')
// The file each cover's small copy is served from, worked out once per cover per session.
const thumbnails = new Map<string, Promise<string>>()

// Makes the small copy of a cover the first time it's asked for and keeps it on disk. Covers already small, or in a
// format Windows can't resize, are served as they are.
async function thumbnailFor(id: string): Promise<string> {
  const original = artworkPath(id)
  const thumbnail = join(thumbnailDir(), id.replace(/\.\w+$/, '.jpg'))
  if (existsSync(thumbnail)) return thumbnail
  const image = nativeImage.createFromPath(original)
  if (image.isEmpty() || image.getSize().width <= THUMBNAIL_WIDTH) return original
  try {
    await mkdir(thumbnailDir(), { recursive: true })
    await writeFile(`${thumbnail}.tmp`, image.resize({ width: THUMBNAIL_WIDTH, quality: 'good' }).toJPEG(85))
    await rename(`${thumbnail}.tmp`, thumbnail)
    return thumbnail
  } catch {
    return original
  }
}

export async function serveThumbnail(request: Request): Promise<Response> {
  const id = new URL(request.url).pathname.slice(1)
  if (!ARTWORK_ID.test(id)) return new Response(null, { status: 404 })
  if (!thumbnails.has(id)) thumbnails.set(id, thumbnailFor(id))
  const file = await net.fetch(pathToFileURL(await thumbnails.get(id)!).toString())
  return new Response(file.body, { status: file.status, headers: file.headers })
}

// Saves a cover image named by its content hash and returns that name as the artwork id.
export async function saveArtwork(data: Uint8Array, mimeType: string): Promise<string | null> {
  const ext = EXTENSIONS[mimeType.toLowerCase()]
  if (!ext || data.length === 0) return null

  const id = `${createHash('sha1').update(data).digest('hex')}.${ext}`
  if (saved.has(id)) return id

  await mkdir(artworkDir(), { recursive: true })
  try {
    await writeFile(join(artworkDir(), id), data, { flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') return null
  }
  saved.add(id)
  return id
}
