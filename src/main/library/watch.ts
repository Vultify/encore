import { watch, type FSWatcher } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { AUDIO_FORMATS, type AudioFormat } from '../../shared/api'
import { isSystemFolder } from './scan'

// A song being downloaded or copied fires many changes in a row, so files are only read once things go quiet.
const SETTLE_MS = 2000

const isSong = (path: string): boolean => AUDIO_FORMATS.includes(extname(path).slice(1).toLowerCase() as AudioFormat)

// When a whole album folder is moved in at once, only the folder shows up as a change, not the songs inside it.
// So changed folders are handed over too, and the import looks inside them.
async function songsOrFolders(paths: string[]): Promise<string[]> {
  const kept = await Promise.all(
    paths.map(async (path) => (isSong(path) || (await stat(path).then((info) => info.isDirectory(), () => false)) ? path : null))
  )
  return kept.filter((path): path is string => path !== null)
}

export interface FolderWatcher {
  // Watches exactly these folders, starting new ones and stopping ones no longer listed.
  watch: (folders: string[]) => void
  close: () => void
}

// Watches music folders, subfolders included, and hands over the song files and folders that appear or change in them.
export function createFolderWatcher(onSongs: (paths: string[]) => void): FolderWatcher {
  const watchers = new Map<string, FSWatcher>()
  const changed = new Set<string>()
  let timer: NodeJS.Timeout | null = null

  const settle = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      timer = null
      const batch = [...changed]
      changed.clear()
      const paths = await songsOrFolders(batch)
      if (paths.length > 0) onSongs(paths)
    }, SETTLE_MS)
  }

  const stop = (folder: string): void => {
    watchers.get(folder)?.close()
    watchers.delete(folder)
  }

  return {
    watch(folders) {
      for (const folder of watchers.keys()) if (!folders.includes(folder)) stop(folder)
      for (const folder of folders) {
        if (watchers.has(folder)) continue
        try {
          const watcher = watch(folder, { recursive: true }, (_event, name) => {
            // A song deleted on a watched drive lands in its Recycle Bin, which isn't music to add.
            if (!name || name.split(/[\\/]/).some(isSystemFolder)) return
            changed.add(join(folder, name))
            settle()
          })
          // A folder that's deleted or on a drive that's unplugged stops being watched until Encore opens again.
          watcher.on('error', () => stop(folder))
          watchers.set(folder, watcher)
        } catch {
          // The folder isn't there right now.
        }
      }
    },
    close() {
      for (const folder of [...watchers.keys()]) stop(folder)
      if (timer) clearTimeout(timer)
    }
  }
}
