import { join } from 'node:path'
import { BrowserWindow, ipcMain, screen, shell, type Rectangle } from 'electron'
import { Channels } from '../shared/api'
import { rememberWindow, windowState } from './settings'
import appIcon from '../../resources/icon.png?asset'

const MIN_WIDTH = 960
const MIN_HEIGHT = 640
// A saved spot only counts if at least this much of the window would land on a screen that's still connected.
const MIN_VISIBLE = { width: 200, height: 100 }

// Where the window was last time, if that spot is still on a connected screen. A screen that was unplugged
// since, or a resolution change, falls back to the default size in the middle of the main screen.
function savedBounds(): (Rectangle & { maximized: boolean }) | null {
  const saved = windowState()
  if (!saved) return null
  const area = screen.getDisplayMatching(saved).workArea
  const visibleWidth = Math.min(saved.x + saved.width, area.x + area.width) - Math.max(saved.x, area.x)
  const visibleHeight = Math.min(saved.y + saved.height, area.y + area.height) - Math.max(saved.y, area.y)
  return visibleWidth >= MIN_VISIBLE.width && visibleHeight >= MIN_VISIBLE.height ? saved : null
}

// Creates the main window: frameless, dark, and hidden instead of closed so Encore keeps running in the tray.
// It opens where it was last time.
export function createMainWindow(shouldQuit: () => boolean): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const saved = savedBounds()

  const win = new BrowserWindow({
    ...(saved
      ? { x: saved.x, y: saved.y, width: Math.max(MIN_WIDTH, saved.width), height: Math.max(MIN_HEIGHT, saved.height) }
      : { width: Math.min(1440, width - 80), height: Math.min(900, height - 60) }),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    title: 'Encore',
    icon: appIcon,
    backgroundColor: '#08080A',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      // Music keeps playing at full speed, with its progress and next song on time, while the window is hidden.
      backgroundThrottling: false
    }
  })

  if (saved?.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())

  // The size it would go back to when un-maximized is the one worth remembering.
  const remember = (): void => rememberWindow({ ...win.getNormalBounds(), maximized: win.isMaximized() })
  win.on('resize', remember)
  win.on('move', remember)

  win.on('close', (event) => {
    if (shouldQuit()) return
    event.preventDefault()
    win.hide()
  })

  win.on('maximize', () => {
    remember()
    win.webContents.send(Channels.maximizedChanged, true)
  })
  win.on('unmaximize', () => {
    remember()
    win.webContents.send(Channels.maximizedChanged, false)
  })

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
