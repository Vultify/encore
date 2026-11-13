import { ipcMain, type BrowserWindow, type WebContents } from 'electron'
import { Channels, type NowPlaying, type PlayerCommand } from '../shared/api'

// The player lives in the main window. This passes its "now playing" summary out to the tray and the mini player,
// and passes their presses and volume changes back in.

let latest: NowPlaying | null = null
const listeners = new Set<(now: NowPlaying | null) => void>()

export const nowPlaying = (): NowPlaying | null => latest

export function onNowPlaying(listener: (now: NowPlaying | null) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const PRESSES: unknown[] = ['toggle', 'next', 'previous', 'toggleMute']

const isSeconds = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const isVolume = (value: unknown): value is number => isSeconds(value) && value <= 1

const isCommand = (value: unknown): value is PlayerCommand =>
  PRESSES.includes(value) || (typeof value === 'object' && value !== null && isVolume((value as { volume: unknown }).volume))

function isNowPlaying(value: unknown): value is NowPlaying {
  const now = value as NowPlaying
  return (
    Boolean(now) &&
    (now.trackId === null || Number.isInteger(now.trackId)) &&
    typeof now.title === 'string' &&
    now.title.length <= 1000 &&
    (now.artist === null || (typeof now.artist === 'string' && now.artist.length <= 1000)) &&
    (now.artworkId === null || typeof now.artworkId === 'string') &&
    typeof now.playing === 'boolean' &&
    typeof now.hasNext === 'boolean' &&
    isSeconds(now.position) &&
    isSeconds(now.duration) &&
    isVolume(now.volume) &&
    typeof now.muted === 'boolean'
  )
}

// Only a known press, or a volume with nothing else in it, is passed on.
export function sendCommand(win: BrowserWindow | null, command: unknown): void {
  if (!win || win.isDestroyed() || !isCommand(command)) return
  win.webContents.send(Channels.playerCommand, typeof command === 'string' ? command : { volume: command.volume })
}

// Only the main window, where the player lives, may report what's playing. Only the mini player may send presses.
export function registerRemote(getMainWindow: () => BrowserWindow | null, getMiniPlayer: () => WebContents | null): void {
  ipcMain.on(Channels.nowPlaying, (event, value: unknown) => {
    if (event.sender !== getMainWindow()?.webContents || !isNowPlaying(value)) return
    latest = value
    listeners.forEach((listener) => listener(latest))
  })
  ipcMain.handle(Channels.getNowPlaying, () => latest)
  ipcMain.on(Channels.remoteCommand, (event, command: unknown) => {
    if (event.sender === getMiniPlayer()) sendCommand(getMainWindow(), command)
  })
}
