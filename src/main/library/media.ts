import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import type { AudioFormat } from '../../shared/api'
import { isId } from '../validate'
import { trackFile } from './database'

const CONTENT_TYPES: Record<AudioFormat, string> = {
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  wav: 'audio/wav',
  m4a: 'audio/mp4'
}

// Reads "bytes=start-end" from a Range header. Returns null when there's no usable range.
function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/)
  if (!match || (!match[1] && !match[2])) return null

  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  return start <= end && start < size ? { start, end } : null
}

// The player reads songs through the equalizer, which only hears sound the page is allowed to read.
const OPEN_TO_PAGE = { 'Access-Control-Allow-Origin': '*' }

// Streams encore-media://track/<id>, answering range requests so the player can seek.
export async function serveMedia(request: Request): Promise<Response> {
  const id = Number(new URL(request.url).pathname.slice(1))
  const file = isId(id) ? trackFile(id) : null
  const info = file ? await stat(file.path).catch(() => null) : null
  if (!file || !info?.isFile()) return new Response(null, { status: 404, headers: OPEN_TO_PAGE })

  const size = info.size
  const headers = { ...OPEN_TO_PAGE, 'Content-Type': CONTENT_TYPES[file.format], 'Accept-Ranges': 'bytes' }
  const rangeHeader = request.headers.get('Range')
  const range = parseRange(rangeHeader, size)

  if (rangeHeader && !range) {
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } })
  }

  const { start, end } = range ?? { start: 0, end: size - 1 }
  const body = Readable.toWeb(createReadStream(file.path, { start, end })) as ReadableStream
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      ...headers,
      'Content-Length': String(end - start + 1),
      ...(range && { 'Content-Range': `bytes ${start}-${end}/${size}` })
    }
  })
}
