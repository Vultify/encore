import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
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
  },
  library: {
    pathForFile: (file) => webUtils.getPathForFile(file),
    scanPaths: (paths) => ipcRenderer.invoke(Channels.scanPaths, paths)
  }
}

contextBridge.exposeInMainWorld('encore', api)
