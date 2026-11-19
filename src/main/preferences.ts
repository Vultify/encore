import { app, BrowserWindow, dialog, ipcMain, type WebContents } from 'electron'
import { Channels, type PreferenceChanges, type Preferences } from '../shared/api'
import { isAllowedShortcut } from '../shared/shortcut'
import { pauseMiniPlayerShortcut, setMiniPlayerShortcut } from './miniPlayer'
import { isAccentChoice, isMixSize, isMotionChoice, preferences, savePreferences } from './settings'

// Windows passes this when it starts Encore at sign-in, so Encore opens quietly in the tray.
export const STARTED_HIDDEN_FLAG = '--hidden'

const sameFolder = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

// Starting with Windows is only set up in the installed app, so trying Encore out while developing it never
// leaves a startup entry behind.
const canStartWithWindows = (): boolean => app.isPackaged

interface PreferenceOptions {
  getMainWindow: () => BrowserWindow | null
  // Called after every change, so the rest of the app can follow it.
  onChange: (preferences: Preferences) => void
}

export function registerPreferenceHandlers({ getMainWindow, onChange }: PreferenceOptions): void {
  const fromMainWindow = (sender: WebContents): boolean => sender === getMainWindow()?.webContents

  const change = (next: Preferences): Preferences => {
    savePreferences(next)
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(Channels.preferencesChanged, next)
    onChange(next)
    return next
  }

  ipcMain.handle(Channels.getPreferences, () => preferences())
  ipcMain.handle(Channels.canStartWithWindows, () => canStartWithWindows())

  ipcMain.handle(Channels.updatePreferences, (event, value: unknown) => {
    const current = preferences()
    if (!fromMainWindow(event.sender) || !value || typeof value !== 'object') return current
    const changes = value as PreferenceChanges
    const next = { ...current }
    if (isAccentChoice(changes.accent)) next.accent = changes.accent
    if (isMotionChoice(changes.motion)) next.motion = changes.motion
    if (typeof changes.identifyNewSongs === 'boolean') next.identifyNewSongs = changes.identifyNewSongs
    if (typeof changes.checkForUpdates === 'boolean') next.checkForUpdates = changes.checkForUpdates
    if (isMixSize(changes.topMixSize)) next.topMixSize = changes.topMixSize
    if (typeof changes.startWithWindows === 'boolean') {
      next.startWithWindows = changes.startWithWindows
      if (canStartWithWindows()) app.setLoginItemSettings({ openAtLogin: next.startWithWindows, args: [STARTED_HIDDEN_FLAG] })
    }
    return change(next)
  })

  ipcMain.handle(Channels.setMiniPlayerShortcut, (event, accelerator: unknown) => {
    if (!fromMainWindow(event.sender) || typeof accelerator !== 'string' || !isAllowedShortcut(accelerator)) return false
    if (!setMiniPlayerShortcut(accelerator)) return false
    change({ ...preferences(), miniPlayerShortcut: accelerator })
    return true
  })

  ipcMain.on(Channels.pauseMiniPlayerShortcut, (event, pause: unknown) => {
    if (fromMainWindow(event.sender) && typeof pause === 'boolean') pauseMiniPlayerShortcut(pause)
  })

  ipcMain.handle(Channels.addMusicFolder, async (event) => {
    const win = getMainWindow()
    if (!win || !fromMainWindow(event.sender)) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { title: 'Pick a music folder', properties: ['openDirectory'] })
    const folder = filePaths[0]
    if (canceled || !folder) return null
    const current = preferences()
    if (!current.musicFolders.some((saved) => sameFolder(saved, folder))) {
      change({ ...current, musicFolders: [...current.musicFolders, folder] })
    }
    return folder
  })

  ipcMain.handle(Channels.removeMusicFolder, (event, folder: unknown) => {
    if (!fromMainWindow(event.sender) || typeof folder !== 'string') return
    const current = preferences()
    change({ ...current, musicFolders: current.musicFolders.filter((saved) => !sameFolder(saved, folder)) })
  })
}
