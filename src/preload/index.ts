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
    }
  }
}

contextBridge.exposeInMainWorld('encore', api)
