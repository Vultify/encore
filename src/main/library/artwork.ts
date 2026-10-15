import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, net } from 'electron'
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

// Serves encore-art://local/<id> from the artwork folder. Anything that isn't a valid id gets a 404.
export function serveArtwork(request: Request): Promise<Response> | Response {
  const id = new URL(request.url).pathname.slice(1)
  if (!ARTWORK_ID.test(id)) return new Response(null, { status: 404 })
  return net.fetch(pathToFileURL(join(artworkDir(), id)).toString())
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
