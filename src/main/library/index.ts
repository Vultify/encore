import { stat } from 'node:fs/promises'
import { ipcMain, type WebContents } from 'electron'
import { Channels, type ImportResult, type NewTrack } from '../../shared/api'
import { allTracks, locationKey, saveTracks, storedTracks, type FileStamp } from './database'
import { findAudioFiles } from './scan'
import { readTrack } from './tags'
import { createFolderCoverLookup } from './fallbacks'

// How many files are read at once, and how often progress is sent to the interface.
const READ_CONCURRENCY = 8
const PROGRESS_INTERVAL_MS = 100

const sameStamp = (a: FileStamp, b: FileStamp): boolean => a.size === b.size && a.modified === b.modified

// Finds the songs in the dropped paths, reads only the new or changed ones, and saves them.
async function importPaths(paths: string[], sender: WebContents): Promise<ImportResult> {
  const files = await findAudioFiles(paths)
  const stored = storedTracks(files.map((file) => file.path))

  // Songs already in the library with the same size and modified time are skipped.
  const stamps = await Promise.all(
    files.map(async (file) => {
      const info = await stat(file.path).catch(() => null)
      return info ? { size: info.size, modified: Math.round(info.mtimeMs) } : { size: -1, modified: -1 }
    })
  )
  const toRead = files
    .map((file, i) => ({ file, stamp: stamps[i], existing: stored.get(locationKey(file.path)) }))
    .filter(({ stamp, existing }) => !existing || !sameStamp(existing.stamp, stamp))

  const folderCover = createFolderCoverLookup()
  const read = new Array<{ track: NewTrack; stamp: FileStamp }>(toRead.length)
  let next = 0
  let done = 0
  let lastSent = 0

  const report = (force = false): void => {
    const now = Date.now()
    if (!force && now - lastSent < PROGRESS_INTERVAL_MS) return
    lastSent = now
    if (!sender.isDestroyed()) sender.send(Channels.importProgress, { done, total: toRead.length })
  }

  const worker = async (): Promise<void> => {
    while (next < toRead.length) {
      const index = next++
      const { file, stamp } = toRead[index]
      read[index] = { track: await readTrack(file, folderCover), stamp }
      done += 1
      report()
    }
  }

  await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, toRead.length) }, worker))
  report(true)

  const saved = saveTracks(read)
  const isNew = new Set(toRead.filter(({ existing }) => !existing).map(({ file }) => locationKey(file.path)))
  return {
    found: files.length,
    added: saved.filter((track) => isNew.has(locationKey(track.path))),
    updated: saved.filter((track) => !isNew.has(locationKey(track.path)))
  }
}

export function registerLibraryHandlers(): void {
  ipcMain.handle(Channels.getTracks, () => allTracks())
  ipcMain.handle(Channels.importPaths, (event, paths: unknown) => {
    if (!Array.isArray(paths) || !paths.every((p) => typeof p === 'string' && p.length > 0)) {
      return { found: 0, added: [], updated: [] }
    }
    return importPaths(paths, event.sender)
  })
}
