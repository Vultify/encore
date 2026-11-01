import { stat } from 'node:fs/promises'
import { ipcMain, type WebContents } from 'electron'
import { Channels, type ImportResult, type NewTrack, type Playlist } from '../../shared/api'
import { allTracks, locationKey, removeTracks, saveTracks, setLiked, storedTracks, trackLocations, type FileStamp } from './database'
import {
  addTracks,
  allPlaylists,
  createPlaylist,
  moveEntry,
  removeEntries,
  removePlaylist,
  renamePlaylist,
  reorderPlaylists
} from './playlists'
import { findAudioFiles } from './scan'
import { readTrack } from './tags'
import { createFolderCoverLookup } from './fallbacks'

// How many files are read at once, and how often progress is sent to the interface.
const READ_CONCURRENCY = 8
const PROGRESS_INTERVAL_MS = 100
const STAT_BATCH = 64

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

// Checks for what the interface sends, since anything crossing into the main process is untrusted.
const isId = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0
const isIdList = (value: unknown): value is number[] => Array.isArray(value) && value.length <= 10_000 && value.every(isId)
const isName = (value: unknown): value is string => typeof value === 'string' && value.length <= 1000
const isIndex = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0

export function registerLibraryHandlers(): void {
  ipcMain.handle(Channels.getTracks, () => allTracks())
  ipcMain.handle(Channels.importPaths, (event, paths: unknown) => {
    if (!Array.isArray(paths) || !paths.every((p) => typeof p === 'string' && p.length > 0)) {
      return { found: 0, added: [], updated: [] }
    }
    return importPaths(paths, event.sender)
  })
  ipcMain.handle(Channels.setLiked, (_event, trackIds: unknown, liked: unknown) =>
    isIdList(trackIds) && typeof liked === 'boolean' ? setLiked(trackIds, liked) : []
  )
  ipcMain.handle(Channels.removeTracks, (_event, trackIds: unknown) => (isIdList(trackIds) ? removeTracks(trackIds) : []))
  ipcMain.handle(Channels.findMissing, () => findMissing())
}

// Checks every song's file, a batch at a time so a big library doesn't open thousands of handles at once.
async function findMissing(): Promise<number[]> {
  const songs = trackLocations()
  const missing: number[] = []
  for (let start = 0; start < songs.length; start += STAT_BATCH) {
    const batch = songs.slice(start, start + STAT_BATCH)
    const found = await Promise.all(batch.map(({ location }) => stat(location).then((info) => info.isFile(), () => false)))
    batch.forEach(({ id }, i) => {
      if (!found[i]) missing.push(id)
    })
  }
  return missing
}

// Each handler checks its input, makes the change, and answers with every playlist as it is now.
export function registerPlaylistHandlers(): void {
  const answer = (valid: boolean, change: () => void): Playlist[] => {
    if (valid) change()
    return allPlaylists()
  }

  ipcMain.handle(Channels.listPlaylists, () => allPlaylists())
  ipcMain.handle(Channels.createPlaylist, (_event, name: unknown, trackIds: unknown = []) => {
    if (!isName(name) || !isIdList(trackIds)) throw new Error('Invalid playlist')
    const id = createPlaylist(name, trackIds)
    const playlists = allPlaylists()
    return { created: playlists.find((playlist) => playlist.id === id)!, playlists }
  })
  ipcMain.handle(Channels.renamePlaylist, (_event, id: unknown, name: unknown) =>
    answer(isId(id) && isName(name), () => renamePlaylist(id as number, name as string))
  )
  ipcMain.handle(Channels.removePlaylist, (_event, id: unknown) => answer(isId(id), () => removePlaylist(id as number)))
  ipcMain.handle(Channels.reorderPlaylists, (_event, ids: unknown) => answer(isIdList(ids), () => reorderPlaylists(ids as number[])))
  ipcMain.handle(Channels.addToPlaylist, (_event, id: unknown, trackIds: unknown) =>
    answer(isId(id) && isIdList(trackIds), () => addTracks(id as number, trackIds as number[]))
  )
  ipcMain.handle(Channels.removeFromPlaylist, (_event, id: unknown, entryIds: unknown) =>
    answer(isId(id) && isIdList(entryIds), () => removeEntries(id as number, entryIds as number[]))
  )
  ipcMain.handle(Channels.movePlaylistEntry, (_event, id: unknown, entryId: unknown, toIndex: unknown) =>
    answer(isId(id) && isId(entryId) && isIndex(toIndex), () => moveEntry(id as number, entryId as number, toIndex as number))
  )
}
