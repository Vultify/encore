import { useSyncExternalStore } from 'react'
import type { ImportResult, Playlist, Track } from '@shared/api'
import { songCount } from '@/lib/format'
import { notify } from './notice'

export interface LibraryState {
  tracks: Track[]
  playlists: Playlist[]
  // Songs whose files couldn't be found the last time they were checked.
  missing: ReadonlySet<number>
  // False until the saved library has been read, so screens can wait instead of calling it empty.
  loaded: boolean
}

const api = (): typeof window.encore => window.encore

// The songs and playlists the interface shows. Changes go to the main process first, then land here.
class LibraryStore {
  private state: LibraryState = { tracks: [], playlists: [], missing: new Set(), loaded: false }
  private listeners = new Set<() => void>()
  // Progress messages can arrive after an import has already finished, so they only show while one runs.
  private importing = false

  constructor() {
    api().library.onImportProgress(({ done, total }) => {
      if (this.importing && done < total) notify(`Reading songs ${done.toLocaleString()} of ${total.toLocaleString()}`, { persist: true })
    })
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = (): LibraryState => this.state

  async load(): Promise<void> {
    const [tracks, playlists] = await Promise.all([api().library.getTracks(), api().playlists.list()])
    this.update({ tracks, playlists, loaded: true })
    await this.checkFiles()
  }

  // Reads the music in the given files and folders, saves anything new or changed, and says how it went.
  // Returns null when it failed or found no music, after saying so with the given message.
  async importMusic(paths: string[], nothingFound: string): Promise<ImportResult | null> {
    this.importing = true
    notify('Looking for music', { persist: true })
    const result = await api().library.importPaths(paths).catch(() => null)
    this.importing = false

    if (!result) {
      notify('Something went wrong adding those songs')
      return null
    }
    if (result.found === 0) {
      notify(nothingFound)
      return null
    }
    this.applyImport(result)
    const { added, updated } = result
    notify(
      added.length > 0
        ? `Added ${songCount(added.length)}`
        : updated.length > 0
          ? `Updated ${songCount(updated.length)}`
          : 'Those songs are already in your library'
    )
    return result
  }

  // Looks for songs whose files have moved or been deleted, and for missing ones that came back.
  async checkFiles(): Promise<void> {
    const missing = await api().library.findMissing()
    const changed = missing.length !== this.state.missing.size || missing.some((id) => !this.state.missing.has(id))
    if (changed) this.update({ missing: new Set(missing) })
  }

  markMissing(trackId: number): void {
    if (this.state.missing.has(trackId)) return
    this.update({ missing: new Set([...this.state.missing, trackId]) })
  }

  // Takes songs out of the library and every playlist. The files stay where they are.
  async removeTracks(trackIds: number[]): Promise<void> {
    const removed = new Set(await api().library.removeTracks(trackIds))
    const playlists = await api().playlists.list()
    this.update({
      tracks: this.state.tracks.filter((track) => !removed.has(track.id)),
      playlists,
      missing: new Set([...this.state.missing].filter((id) => !removed.has(id)))
    })
  }

  applyImport({ added, updated }: ImportResult): void {
    if (added.length === 0 && updated.length === 0) return
    this.replaceTracks(updated, added)
    // A song just read from disk is clearly there, even if it was missing before.
    const found = new Set(updated.map((track) => track.id))
    if ([...this.state.missing].some((id) => found.has(id))) {
      this.update({ missing: new Set([...this.state.missing].filter((id) => !found.has(id))) })
    }
  }

  async setLiked(trackIds: number[], liked: boolean): Promise<void> {
    this.replaceTracks(await api().library.setLiked(trackIds, liked))
  }

  async createPlaylist(name: string, trackIds: number[] = []): Promise<Playlist> {
    const { created, playlists } = await api().playlists.create(name, trackIds)
    this.update({ playlists })
    return created
  }

  async renamePlaylist(playlistId: number, name: string): Promise<void> {
    this.update({ playlists: await api().playlists.rename(playlistId, name) })
  }

  async removePlaylist(playlistId: number): Promise<void> {
    this.update({ playlists: await api().playlists.remove(playlistId) })
  }

  // Moves in the interface right away so dragging feels instant, then saves.
  async reorderPlaylists(playlistIds: number[]): Promise<void> {
    const byId = new Map(this.state.playlists.map((playlist) => [playlist.id, playlist]))
    this.update({ playlists: playlistIds.flatMap((id) => byId.get(id) ?? []) })
    this.update({ playlists: await api().playlists.reorder(playlistIds) })
  }

  async addToPlaylist(playlistId: number, trackIds: number[]): Promise<void> {
    this.update({ playlists: await api().playlists.addTracks(playlistId, trackIds) })
  }

  async removeFromPlaylist(playlistId: number, entryIds: number[]): Promise<void> {
    this.update({ playlists: await api().playlists.removeEntries(playlistId, entryIds) })
  }

  async moveEntry(playlistId: number, entryId: number, toIndex: number): Promise<void> {
    this.update({
      playlists: this.state.playlists.map((playlist) => {
        if (playlist.id !== playlistId) return playlist
        const entries = playlist.entries.filter((entry) => entry.id !== entryId)
        const moved = playlist.entries.find((entry) => entry.id === entryId)
        if (moved) entries.splice(toIndex, 0, moved)
        return { ...playlist, entries }
      })
    })
    this.update({ playlists: await api().playlists.moveEntry(playlistId, entryId, toIndex) })
  }

  // Writes identified songs' tags into their files, swaps in the songs as they now read from disk, and says how it went.
  async saveToFiles(trackIds: number[]): Promise<void> {
    const { saved, failed } = await api().library.saveToFiles(trackIds)
    this.replaceTracks(saved)

    if (failed.length === 0) {
      notify(saved.length === 1 ? `Saved the tags into ${saved[0].title}'s file` : `Saved the tags into ${saved.length} files`)
    } else if (saved.length === 0 && failed.length === 1) {
      notify(`Couldn't save ${failed[0].title}. ${failed[0].reason}`)
    } else {
      notify(`Saved ${saved.length} of ${saved.length + failed.length}. Couldn't save ${failed[0].title}: ${failed[0].reason}`)
    }
  }

  // Puts back a song's own tags after it was identified as something else.
  async restoreTags(trackId: number): Promise<void> {
    const track = await api().identify.restore(trackId)
    if (track) this.replaceTrack(track)
  }

  // For a song changed somewhere else, like a match picked while identifying.
  replaceTrack(track: Track): void {
    this.replaceTracks([track])
  }

  // Swaps in changed songs by id and appends new ones.
  private replaceTracks(changed: Track[], added: Track[] = []): void {
    const byId = new Map(changed.map((track) => [track.id, track]))
    this.update({ tracks: [...this.state.tracks.map((track) => byId.get(track.id) ?? track), ...added] })
  }

  private update(changes: Partial<LibraryState>): void {
    this.state = { ...this.state, ...changes }
    this.listeners.forEach((listener) => listener())
  }
}

export const library = new LibraryStore()

export const useLibrary = (): LibraryState => useSyncExternalStore(library.subscribe, library.getState)
