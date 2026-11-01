import { ipcMain, type BrowserWindow } from 'electron'
import { Channels, type NowPlaying, type PlayerCommand } from '../shared/api'

// The player lives in the main window. This passes its "now playing" summary out to the tray (and later the mini
// player), and passes their play, pause, next, and previous presses back in.

let latest: NowPlaying | null = null
const listeners = new Set<(now: NowPlaying | null) => void>()

export const nowPlaying = (): NowPlaying | null => latest

export function onNowPlaying(listener: (now: NowPlaying | null) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const COMMANDS: PlayerCommand[] = ['toggle', 'next', 'previous']

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
    typeof now.hasNext === 'boolean'
  )
}

export function sendCommand(win: BrowserWindow | null, command: PlayerCommand): void {
  if (win && !win.isDestroyed() && COMMANDS.includes(command)) win.webContents.send(Channels.playerCommand, command)
}

// Only the main window, where the player lives, may report what's playing.
export function registerRemote(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.on(Channels.nowPlaying, (event, value: unknown) => {
    if (event.sender !== getMainWindow()?.webContents || !isNowPlaying(value)) return
    latest = value
    listeners.forEach((listener) => listener(latest))
  })
}
