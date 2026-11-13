import { ipcRenderer, type IpcRendererEvent } from 'electron'

// Subscribes to a message from the main process and returns a function that unsubscribes.
export function listen<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}
