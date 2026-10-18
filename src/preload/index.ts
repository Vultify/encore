import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { Channels, type EncoreApi, type ImportProgress } from '../shared/api'

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
    setLiked: (trackIds, liked) => ipcRenderer.invoke(Channels.setLiked, trackIds, liked)
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
  }
}

contextBridge.exposeInMainWorld('encore', api)
