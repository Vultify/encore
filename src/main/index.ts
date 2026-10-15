import { app, type BrowserWindow, type Tray } from 'electron'
import { createMainWindow, registerWindowControls, revealWindow } from './window'
import { createTray } from './tray'
import { registerLibraryHandlers } from './library'
import { handleArtworkProtocol, registerArtworkScheme } from './library/artwork'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

// Tests point Encore at a throwaway data folder so they never touch the real library.
if (process.env.ENCORE_DATA_DIR) app.setPath('userData', process.env.ENCORE_DATA_DIR)

registerArtworkScheme()

// Only one Encore runs at a time. Launching it again brings the open one forward.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setAppUserModelId('com.vultify.encore')

  app.on('second-instance', () => revealWindow(mainWindow))
  app.on('before-quit', () => {
    quitting = true
  })

  app.whenReady().then(() => {
    handleArtworkProtocol()
    registerWindowControls(() => mainWindow)
    registerLibraryHandlers()
    mainWindow = createMainWindow(() => quitting)
    tray = createTray({
      show: () => revealWindow(mainWindow),
      quit: () => app.quit()
    })
  })

  // The window only truly closes while quitting, so finish the quit and clear the tray icon.
  app.on('window-all-closed', () => {
    tray?.destroy()
    app.quit()
  })
}
