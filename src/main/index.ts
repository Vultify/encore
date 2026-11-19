import { app, type BrowserWindow } from 'electron'
import { Channels, type PlayerCommand } from '../shared/api'
import { createMainWindow, registerWindowControls, revealWindow } from './window'
import { createTray, type EncoreTray } from './tray'
import type { TrayState } from './trayMenu'
import {
  isMiniPlayerOpen,
  miniPlayerContents,
  registerMiniPlayer,
  releaseMiniPlayerShortcut,
  sendToMiniPlayer,
  toggleMiniPlayer
} from './miniPlayer'
import { nowPlaying, onNowPlaying, registerRemote, sendCommand } from './remote'
import { flushSettings, loadSettings, preferences, registerSettingsHandlers } from './settings'
import { registerPreferenceHandlers, STARTED_HIDDEN_FLAG } from './preferences'
import { importMusic, registerLibraryHandlers, registerPlaylistHandlers } from './library'
import { createFolderWatcher, type FolderWatcher } from './library/watch'
import { registerIdentifyHandlers } from './identify'
import { handleProtocols, registerSchemes } from './protocols'
import { closeLibrary, openLibrary } from './library/database'
import { registerUpdates, type Updates } from './updates'

let mainWindow: BrowserWindow | null = null
let tray: EncoreTray | null = null
let folderWatcher: FolderWatcher | null = null
let updates: Updates | null = null
let quitting = false

// Tests point Encore at a throwaway data folder so they never touch the real library.
if (process.env.ENCORE_DATA_DIR) app.setPath('userData', process.env.ENCORE_DATA_DIR)

registerSchemes()

const trayState = (): TrayState => ({
  now: nowPlaying(),
  miniPlayerOpen: isMiniPlayerOpen(),
  shortcut: preferences().miniPlayerShortcut,
  update: updates?.status() ?? { state: 'off' }
})
const refreshTray = (): void => tray?.update(trayState())

// Reads songs that appeared in a music folder while Encore is open, and hands any new or changed ones to the window.
async function importFromFolders(paths: string[]): Promise<void> {
  const result = await importMusic(paths).catch(() => null)
  if (result && (result.added.length > 0 || result.updated.length > 0)) mainWindow?.webContents.send(Channels.folderImport, result)
}

// Only one Encore runs at a time. Launching it again brings the open one forward.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setAppUserModelId('com.vultify.encore')

  app.on('second-instance', () => revealWindow(mainWindow))
  app.on('before-quit', () => {
    quitting = true
  })
  app.on('will-quit', () => {
    folderWatcher?.close()
    releaseMiniPlayerShortcut()
    flushSettings()
    closeLibrary()
  })

  app.whenReady().then(() => {
    loadSettings()
    openLibrary()
    handleProtocols()
    registerWindowControls(() => mainWindow)
    registerSettingsHandlers()
    registerRemote(() => mainWindow, miniPlayerContents)
    registerMiniPlayer({
      getMainWindow: () => mainWindow,
      openEncore: () => revealWindow(mainWindow),
      shortcut: preferences().miniPlayerShortcut,
      onChange: refreshTray
    })
    registerPreferenceHandlers({
      getMainWindow: () => mainWindow,
      onChange: (next) => {
        folderWatcher?.watch(next.musicFolders)
        updates?.setAutomatic(next.checkForUpdates)
        refreshTray()
      }
    })
    updates = registerUpdates({ getMainWindow: () => mainWindow, onChange: refreshTray })
    updates.setAutomatic(preferences().checkForUpdates)
    registerLibraryHandlers()
    registerPlaylistHandlers()
    registerIdentifyHandlers()
    mainWindow = createMainWindow(() => quitting, process.argv.includes(STARTED_HIDDEN_FLAG))
    folderWatcher = createFolderWatcher(importFromFolders)
    folderWatcher.watch(preferences().musicFolders)

    const command = (name: PlayerCommand) => () => sendCommand(mainWindow, name)
    tray = createTray({
      show: () => revealWindow(mainWindow),
      toggleMiniPlayer,
      toggle: command('toggle'),
      next: command('next'),
      previous: command('previous'),
      showUpdate: () => {
        revealWindow(mainWindow)
        mainWindow?.webContents.send(Channels.showUpdate)
      },
      installUpdate: () => updates?.install(),
      quit: () => app.quit()
    }, trayState())
    onNowPlaying((now) => {
      refreshTray()
      sendToMiniPlayer(now)
    })
  })

  // The main window only truly closes while quitting, so finish the quit and clear the tray icon.
  app.on('window-all-closed', () => {
    tray?.destroy()
    app.quit()
  })
}
