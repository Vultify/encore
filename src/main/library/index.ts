import { ipcMain, type WebContents } from 'electron'
import { Channels, type Track } from '../../shared/api'
import { findAudioFiles } from './scan'
import { readTrack } from './tags'
import { createFolderCoverLookup } from './fallbacks'

// How many files are read at once, and how often progress is sent to the interface.
const READ_CONCURRENCY = 8
const PROGRESS_INTERVAL_MS = 100

// Finds the songs in the dropped paths and reads them all, reporting progress along the way.
async function importPaths(paths: string[], sender: WebContents): Promise<Track[]> {
  const files = await findAudioFiles(paths)
  const folderCover = createFolderCoverLookup()
  const tracks = new Array<Track>(files.length)
  let next = 0
  let done = 0
  let lastSent = 0

  const report = (force = false): void => {
    const now = Date.now()
    if (!force && now - lastSent < PROGRESS_INTERVAL_MS) return
    lastSent = now
    if (!sender.isDestroyed()) sender.send(Channels.importProgress, { done, total: files.length })
  }

  const worker = async (): Promise<void> => {
    while (next < files.length) {
      const index = next++
      tracks[index] = await readTrack(files[index], folderCover)
      done += 1
      report()
    }
  }

  await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, files.length) }, worker))
  report(true)
  return tracks
}

export function registerLibraryHandlers(): void {
  ipcMain.handle(Channels.importPaths, (event, paths: unknown) => {
    if (!Array.isArray(paths) || !paths.every((p) => typeof p === 'string' && p.length > 0)) return []
    return importPaths(paths, event.sender)
  })
}
