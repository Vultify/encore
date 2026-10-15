import { readdir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { AUDIO_FORMATS, type AudioFormat } from '../../shared/api'

export interface AudioFile {
  path: string
  format: AudioFormat
}

function formatOf(path: string): AudioFormat | null {
  const ext = extname(path).slice(1).toLowerCase() as AudioFormat
  return AUDIO_FORMATS.includes(ext) ? ext : null
}

// Collects every supported music file under one dropped path, going into subfolders.
async function collect(path: string): Promise<AudioFile[]> {
  const info = await stat(path).catch(() => null)
  if (!info) return []

  if (info.isFile()) {
    const format = formatOf(path)
    return format ? [{ path, format }] : []
  }

  if (!info.isDirectory()) return []

  const entries = await readdir(path, { recursive: true, withFileTypes: true }).catch(() => [])
  const files: AudioFile[] = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const format = formatOf(entry.name)
    if (format) files.push({ path: join(entry.parentPath, entry.name), format })
  }
  return files
}

// Finds the music in dropped files and folders, skipping duplicates, sorted by path.
export async function findAudioFiles(paths: string[]): Promise<AudioFile[]> {
  const found = (await Promise.all(paths.map(collect))).flat()
  const unique = [...new Map(found.map((file) => [file.path.toLowerCase(), file])).values()]
  return unique.sort((a, b) => a.path.localeCompare(b.path))
}
