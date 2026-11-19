import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { Channels, type EncoreApi } from '../shared/api'
import { listen } from './listen'

// Everything the main window can ask of the main process. The mini player has its own, much smaller set in mini.ts.
const api: EncoreApi = {
  window: {
    minimize: () => ipcRenderer.send(Channels.minimize),
    toggleMaximize: () => ipcRenderer.send(Channels.toggleMaximize),
    closeToTray: () => ipcRenderer.send(Channels.closeToTray),
    isMaximized: () => ipcRenderer.invoke(Channels.isMaximized),
    onMaximizedChange: (listener) => listen(Channels.maximizedChanged, listener),
    popOut: () => ipcRenderer.send(Channels.popOut)
  },
  library: {
    pathForFile: (file) => webUtils.getPathForFile(file),
    getTracks: () => ipcRenderer.invoke(Channels.getTracks),
    importPaths: (paths) => ipcRenderer.invoke(Channels.importPaths, paths),
    onImportProgress: (listener) => listen(Channels.importProgress, listener),
    setLiked: (trackIds, liked) => ipcRenderer.invoke(Channels.setLiked, trackIds, liked),
    removeTracks: (trackIds) => ipcRenderer.invoke(Channels.removeTracks, trackIds),
    findMissing: () => ipcRenderer.invoke(Channels.findMissing),
    accentColor: (artworkId) => ipcRenderer.invoke(Channels.accentColor, artworkId),
    saveToFiles: (trackIds) => ipcRenderer.invoke(Channels.saveToFiles, trackIds),
    scanMusicFolders: () => ipcRenderer.invoke(Channels.scanMusicFolders),
    startListen: (trackId, sourceKey) => ipcRenderer.invoke(Channels.startListen, trackId, sourceKey),
    updateListen: (listenId, seconds, counted) => ipcRenderer.send(Channels.updateListen, listenId, seconds, counted),
    listeningStats: (since, bucket) => ipcRenderer.invoke(Channels.listeningStats, since, bucket),
    onFolderImport: (listener) => listen(Channels.folderImport, listener)
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
  },
  preferences: {
    get: () => ipcRenderer.invoke(Channels.getPreferences),
    onChange: (listener) => listen(Channels.preferencesChanged, listener),
    update: (changes) => ipcRenderer.invoke(Channels.updatePreferences, changes),
    setMiniPlayerShortcut: (accelerator) => ipcRenderer.invoke(Channels.setMiniPlayerShortcut, accelerator),
    pauseMiniPlayerShortcut: (pause) => ipcRenderer.send(Channels.pauseMiniPlayerShortcut, pause),
    addMusicFolder: () => ipcRenderer.invoke(Channels.addMusicFolder),
    removeMusicFolder: (path) => ipcRenderer.invoke(Channels.removeMusicFolder, path),
    canStartWithWindows: () => ipcRenderer.invoke(Channels.canStartWithWindows)
  },
  updates: {
    status: () => ipcRenderer.invoke(Channels.updateStatus),
    onStatus: (listener) => listen(Channels.updateStatusChanged, listener),
    check: () => ipcRenderer.send(Channels.checkForUpdate),
    download: () => ipcRenderer.send(Channels.downloadUpdate),
    install: () => ipcRenderer.send(Channels.installUpdate),
    onShowUpdate: (listener) => listen(Channels.showUpdate, listener)
  }
}

contextBridge.exposeInMainWorld('encore', api)
