import { app, type BrowserWindow } from 'electron'
import type { PlayerCommand } from '../shared/api'
import { createMainWindow, registerWindowControls, revealWindow } from './window'
import { createTray, type EncoreTray } from './tray'
import { onNowPlaying, registerRemote, sendCommand } from './remote'
import { flushSettings, loadSettings, registerSettingsHandlers } from './settings'
import { registerLibraryHandlers, registerPlaylistHandlers } from './library'
import { registerIdentifyHandlers } from './identify'
import { handleProtocols, registerSchemes } from './protocols'
import { closeLibrary, openLibrary } from './library/database'

let mainWindow: BrowserWindow | null = null
let tray: EncoreTray | null = null
let quitting = false

// Tests point Encore at a throwaway data folder so they never touch the real library.
if (process.env.ENCORE_DATA_DIR) app.setPath('userData', process.env.ENCORE_DATA_DIR)

registerSchemes()

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
    flushSettings()
    closeLibrary()
  })

  app.whenReady().then(() => {
    loadSettings()
    openLibrary()
    handleProtocols()
    registerWindowControls(() => mainWindow)
    registerSettingsHandlers()
    registerRemote(() => mainWindow)
    registerLibraryHandlers()
    registerPlaylistHandlers()
    registerIdentifyHandlers()
    mainWindow = createMainWindow(() => quitting)

    const command = (name: PlayerCommand) => () => sendCommand(mainWindow, name)
    tray = createTray({
      show: () => revealWindow(mainWindow),
      toggle: command('toggle'),
      next: command('next'),
      previous: command('previous'),
      quit: () => app.quit()
    })
    onNowPlaying((now) => tray?.update(now))
  })

  // The window only truly closes while quitting, so finish the quit and clear the tray icon.
  app.on('window-all-closed', () => {
    tray?.destroy()
    app.quit()
  })
}
