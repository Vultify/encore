import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { Channels, type EncoreApi, type ImportProgress } from '../shared/api'

// Subscribes to a message from the main process and returns a function that unsubscribes.
function listen<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: EncoreApi = {
  window: {
    minimize: () => ipcRenderer.send(Channels.minimize),
    toggleMaximize: () => ipcRenderer.send(Channels.toggleMaximize),
    closeToTray: () => ipcRenderer.send(Channels.closeToTray),
    isMaximized: () => ipcRenderer.invoke(Channels.isMaximized),
    onMaximizedChange: (listener) => {
      const handler = (_event: IpcRendererEvent, maximized: boolean): void => listener(maximized)
      ipcRenderer.on(Channels.maximizedChanged, handler)
      return () => ipcRenderer.removeListener(Channels.maximizedChanged, handler)
    }
  },
  library: {
    pathForFile: (file) => webUtils.getPathForFile(file),
    getTracks: () => ipcRenderer.invoke(Channels.getTracks),
    importPaths: (paths) => ipcRenderer.invoke(Channels.importPaths, paths),
    onImportProgress: (listener) => {
      const handler = (_event: IpcRendererEvent, progress: ImportProgress): void => listener(progress)
      ipcRenderer.on(Channels.importProgress, handler)
      return () => ipcRenderer.removeListener(Channels.importProgress, handler)
    },
    setLiked: (trackIds, liked) => ipcRenderer.invoke(Channels.setLiked, trackIds, liked),
    removeTracks: (trackIds) => ipcRenderer.invoke(Channels.removeTracks, trackIds),
    findMissing: () => ipcRenderer.invoke(Channels.findMissing),
    accentColor: (artworkId) => ipcRenderer.invoke(Channels.accentColor, artworkId),
    saveToFiles: (trackIds) => ipcRenderer.invoke(Channels.saveToFiles, trackIds)
  },
  playlists: {
    list: () => ipcRenderer.invoke(Channels.listPlaylists),
    create: (name, trackIds) => ipcRenderer.invoke(Channels.createPlaylist, name, trackIds),
    rename: (playlistId, name) => ipcRenderer.invoke(Channels.renamePlaylist, playlistId, name),
    remove: (playlistId) => ipcRenderer.invoke(Channels.removePlaylist, playlistId),
    reorder: (playlistIds) => ipcRenderer.invoke(Channels.reorderPlaylists, playlistIds),
    addTracks: (playlistId, trackIds) => ipcRenderer.invoke(Channels.addToPlaylist, playlistId, trackIds),
    removeEntries: (playlistId, entryIds) => ipcRenderer.invoke(Channels.removeFromPlaylist, playlistId, entryIds),
    moveEntry: (playlistId, entryId, toIndex) => ipcRenderer.invoke(Channels.movePlaylistEntry, playlistId, entryId, toIndex)
  },
  identify: {
    start: (trackIds) => ipcRenderer.invoke(Channels.identifyStart, trackIds),
    stop: () => ipcRenderer.send(Channels.identifyStop),
    onResult: (listener) => listen(Channels.identifyResult, listener),
    onProgress: (listener) => listen(Channels.identifyProgress, listener),
    apply: (trackId, candidateId) => ipcRenderer.invoke(Channels.identifyApply, trackId, candidateId),
    restore: (trackId) => ipcRenderer.invoke(Channels.identifyRestore, trackId)
  },
  remote: {
    report: (nowPlaying) => ipcRenderer.send(Channels.nowPlaying, nowPlaying),
    onCommand: (listener) => listen(Channels.playerCommand, listener)
  },
  settings: {
    getPlayer: () => ipcRenderer.invoke(Channels.getPlayerSettings),
    savePlayer: (preferences) => ipcRenderer.send(Channels.savePlayerSettings, preferences)
  }
}

contextBridge.exposeInMainWorld('encore', api)
