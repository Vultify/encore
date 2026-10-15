import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { Channels, type EncoreApi } from '../shared/api'

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
  }
}

contextBridge.exposeInMainWorld('encore', api)
