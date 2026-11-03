import { join } from 'node:path'
import { BrowserWindow, globalShortcut, ipcMain, screen, type WebContents } from 'electron'
import { Channels, type NowPlaying } from '../shared/api'

const PILL = { width: 500, height: 78 }
// Room around the pill for its glow and shadow, which the window's edge would otherwise cut off.
const MARGIN = 48
const SIZE = { width: PILL.width + MARGIN * 2, height: PILL.height + MARGIN * 2 }
// How far the pill floats above the taskbar.
const LIFT = 20

let win: BrowserWindow | null = null
let changed = (): void => {}
// The shortcut Encore holds right now, or null if another app already had the one picked. It's let go for a
// moment while a new one is being recorded.
let claimed: string | null = null
let paused = false

export const miniPlayerContents = (): WebContents | null => (win && !win.isDestroyed() ? win.webContents : null)

export const isMiniPlayerOpen = (): boolean => Boolean(win && !win.isDestroyed() && win.isVisible())

// A see-through, always-on-top window just big enough for the pill. It never takes focus, so pressing its
// buttons doesn't pull you out of the app you're working in.
function createWindow(): BrowserWindow {
  const created = new BrowserWindow({
    ...SIZE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    title: 'Encore mini player',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })
  created.setIgnoreMouseEvents(true, { forward: true })
  created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  created.webContents.on('will-navigate', (event) => event.preventDefault())
  created.on('closed', () => {
    win = null
    changed()
  })

  if (process.env.ELECTRON_RENDERER_URL) created.loadURL(`${process.env.ELECTRON_RENDERER_URL}/mini.html`)
  else created.loadFile(join(__dirname, '../renderer/mini.html'))
  return created
}

// Bottom center of the screen the pointer is on, just above the taskbar.
function place(target: BrowserWindow): void {
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  target.setBounds({
    ...SIZE,
    x: Math.round(area.x + (area.width - SIZE.width) / 2),
    y: area.y + area.height - LIFT - PILL.height - MARGIN
  })
}

export function showMiniPlayer(): void {
  if (isMiniPlayerOpen()) return
  if (!win) {
    win = createWindow()
    const created = win
    place(created)
    created.once('ready-to-show', () => {
      created.showInactive()
      changed()
    })
    return
  }
  place(win)
  win.showInactive()
  changed()
}

export function hideMiniPlayer(): void {
  if (!isMiniPlayerOpen()) return
  // The pointer may be on the pill as it goes, so clicks start out passing through again next time it shows.
  win!.setIgnoreMouseEvents(true, { forward: true })
  win!.hide()
  changed()
}

export function toggleMiniPlayer(): void {
  if (isMiniPlayerOpen()) hideMiniPlayer()
  else showMiniPlayer()
}

export function sendToMiniPlayer(now: NowPlaying | null): void {
  miniPlayerContents()?.send(Channels.nowPlayingChanged, now)
}

// Swaps the global shortcut for a new one. If another app already uses the new one, the old one stays and this
// returns false.
export function setMiniPlayerShortcut(accelerator: string): boolean {
  if (accelerator === claimed && !paused) return true
  if (!globalShortcut.register(accelerator, toggleMiniPlayer)) return false
  if (claimed && !paused && claimed !== accelerator) globalShortcut.unregister(claimed)
  claimed = accelerator
  paused = false
  return true
}

// While a new shortcut is recorded, the current one is let go so pressing its keys reaches the recorder too.
export function pauseMiniPlayerShortcut(pause: boolean): void {
  if (!claimed || pause === paused) return
  paused = pause
  if (pause) globalShortcut.unregister(claimed)
  else if (!globalShortcut.register(claimed, toggleMiniPlayer)) claimed = null
}

export function releaseMiniPlayerShortcut(): void {
  if (claimed && !paused) globalShortcut.unregister(claimed)
  claimed = null
  paused = false
}

interface MiniPlayerOptions {
  getMainWindow: () => BrowserWindow | null
  openEncore: () => void
  shortcut: string
  // Called whenever the mini player opens or closes, so the tray menu can show it.
  onChange: () => void
}

export function registerMiniPlayer({ getMainWindow, openEncore, shortcut, onChange }: MiniPlayerOptions): void {
  changed = onChange

  ipcMain.on(Channels.popOut, (event) => {
    const main = getMainWindow()
    if (event.sender !== main?.webContents) return
    showMiniPlayer()
    main.hide()
  })
  ipcMain.on(Channels.openEncore, (event) => {
    if (event.sender !== miniPlayerContents()) return
    hideMiniPlayer()
    openEncore()
  })
  ipcMain.on(Channels.miniInteractive, (event, interactive: unknown) => {
    if (event.sender !== miniPlayerContents() || typeof interactive !== 'boolean') return
    win!.setIgnoreMouseEvents(!interactive, { forward: true })
  })

  // Another app may already own the shortcut. The tray and the dock button still open the mini player then.
  if (!setMiniPlayerShortcut(shortcut)) console.warn(`Couldn't claim ${shortcut} for the mini player; another app is using it.`)
}
