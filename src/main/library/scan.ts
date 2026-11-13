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

// Folders Windows keeps on every drive. The Recycle Bin holds deleted songs, which mustn't come back.
const SYSTEM_FOLDERS = new Set(['$recycle.bin', 'recycler', 'system volume information'])

export const isSystemFolder = (name: string): boolean => SYSTEM_FOLDERS.has(name.toLowerCase())

// Lists a folder one level at a time, so a subfolder that can't be opened is skipped instead of hiding everything
// else. Links and junctions aren't followed.
async function walk(folder: string, files: AudioFile[]): Promise<void> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) {
      if (!isSystemFolder(entry.name)) await walk(path, files)
      continue
    }
    const format = entry.isFile() ? formatOf(entry.name) : null
    if (format) files.push({ path, format })
  }
}

// Collects every supported music file under one dropped path, going into subfolders.
async function collect(path: string): Promise<AudioFile[]> {
  const info = await stat(path).catch(() => null)
  if (!info) return []

  if (info.isFile()) {
    const format = formatOf(path)
    return format ? [{ path, format }] : []
  }

  const files: AudioFile[] = []
  if (info.isDirectory()) await walk(path, files)
  return files
}

// Finds the music in dropped files and folders, skipping duplicates, sorted by path.
export async function findAudioFiles(paths: string[]): Promise<AudioFile[]> {
  const found = (await Promise.all(paths.map(collect))).flat()
  const unique = [...new Map(found.map((file) => [file.path.toLowerCase(), file])).values()]
  return unique.sort((a, b) => a.path.localeCompare(b.path))
}
