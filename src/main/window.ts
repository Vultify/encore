import { join } from 'node:path'
import { BrowserWindow, ipcMain, screen, shell } from 'electron'
import { Channels } from '../shared/api'
import appIcon from '../../resources/icon.png?asset'

// Creates the main window: frameless, dark, and hidden instead of closed so Encore keeps running in the tray.
export function createMainWindow(shouldQuit: () => boolean): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: Math.min(1440, width - 80),
    height: Math.min(900, height - 60),
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    title: 'Encore',
    icon: appIcon,
    backgroundColor: '#08080A',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  win.once('ready-to-show', () => win.show())

  win.on('close', (event) => {
    if (shouldQuit()) return
    event.preventDefault()
    win.hide()
  })

  win.on('maximize', () => win.webContents.send(Channels.maximizedChanged, true))
  win.on('unmaximize', () => win.webContents.send(Channels.maximizedChanged, false))

  // Links open in the default browser, never inside Encore.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // A file dropped outside the drop handler would otherwise replace the app with that file.
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// Wires the custom title bar buttons to the window.
export function registerWindowControls(getWindow: () => BrowserWindow | null): void {
  ipcMain.on(Channels.minimize, () => getWindow()?.minimize())
  ipcMain.on(Channels.closeToTray, () => getWindow()?.hide())
  ipcMain.on(Channels.toggleMaximize, () => {
    const win = getWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle(Channels.isMaximized, () => getWindow()?.isMaximized() ?? false)
}

// Brings the window back from the tray or from behind other windows.
export function revealWindow(win: BrowserWindow | null): void {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}
