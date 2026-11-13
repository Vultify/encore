import { contextBridge, ipcRenderer } from 'electron'
import { Channels, type MiniEncoreApi } from '../shared/api'
import { listen } from './listen'

// The mini player only shows what's playing and passes presses back, so that's all it gets, plus the accent color
// and the preferences it follows. Nothing here can change the library or touch files.
const api: MiniEncoreApi = {
  mini: {
    current: () => ipcRenderer.invoke(Channels.getNowPlaying),
    onNowPlaying: (listener) => listen(Channels.nowPlayingChanged, listener),
    send: (command) => ipcRenderer.send(Channels.remoteCommand, command),
    openEncore: () => ipcRenderer.send(Channels.openEncore),
    setInteractive: (interactive) => ipcRenderer.send(Channels.miniInteractive, interactive)
  },
  library: {
    accentColor: (artworkId) => ipcRenderer.invoke(Channels.accentColor, artworkId)
  },
  preferences: {
    get: () => ipcRenderer.invoke(Channels.getPreferences),
    onChange: (listener) => listen(Channels.preferencesChanged, listener)
  }
}

contextBridge.exposeInMainWorld('encore', api)
