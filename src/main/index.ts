import { app, type BrowserWindow, type Tray } from 'electron'
import { createMainWindow, registerWindowControls, revealWindow } from './window'
import { createTray } from './tray'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

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
    registerWindowControls(() => mainWindow)
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
