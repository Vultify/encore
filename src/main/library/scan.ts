import { readdir, stat } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { ipcMain } from 'electron'
import { AUDIO_FORMATS, Channels, type AudioFormat, type LocalFile } from '../../shared/api'

function formatOf(path: string): AudioFormat | null {
  const ext = extname(path).slice(1).toLowerCase() as AudioFormat
  return AUDIO_FORMATS.includes(ext) ? ext : null
}

function toLocalFile(path: string, format: AudioFormat): LocalFile {
  return {
    path,
    name: basename(path, extname(path)),
    folder: dirname(path),
    format
  }
}

// Collects every supported music file under one dropped path, going into subfolders.
async function collect(path: string): Promise<LocalFile[]> {
  const info = await stat(path).catch(() => null)
  if (!info) return []

  if (info.isFile()) {
    const format = formatOf(path)
    return format ? [toLocalFile(path, format)] : []
  }

  if (!info.isDirectory()) return []

  const entries = await readdir(path, { recursive: true, withFileTypes: true }).catch(() => [])
  const files: LocalFile[] = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const format = formatOf(entry.name)
    if (format) files.push(toLocalFile(join(entry.parentPath, entry.name), format))
  }
  return files
}

// Scans dropped files and folders, skipping duplicates, sorted by folder then name.
export async function scanPaths(paths: string[]): Promise<LocalFile[]> {
  const found = (await Promise.all(paths.map(collect))).flat()
  const unique = [...new Map(found.map((file) => [file.path.toLowerCase(), file])).values()]
  return unique.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name))
}

export function registerLibraryHandlers(): void {
  ipcMain.handle(Channels.scanPaths, (_event, paths: unknown) => {
    if (!Array.isArray(paths) || !paths.every((p) => typeof p === 'string' && p.length > 0)) return []
    return scanPaths(paths)
  })
}
