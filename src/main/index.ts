import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
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
import { flushSettings, forgetPlayerSession, loadSettings, preferences, registerSettingsHandlers } from './settings'
import { registerPreferenceHandlers, STARTED_HIDDEN_FLAG } from './preferences'
import { importMusic, registerLibraryHandlers, registerPlaylistHandlers } from './library'
import { createFolderWatcher, type FolderWatcher } from './library/watch'
import { registerIdentifyHandlers } from './identify'
import { handleProtocols, registerSchemes } from './protocols'
import { closeLibrary, isDamagedLibrary, openLibrary, setAsideLibrary } from './library/database'
import { log, logFolder, registerLogHandlers } from './log'
import { registerUpdates, type Updates } from './updates'

let mainWindow: BrowserWindow | null = null
let tray: EncoreTray | null = null
let folderWatcher: FolderWatcher | null = null
let updates: Updates | null = null
let quitting = false
// The name a damaged library was kept under when Encore had to start a new one this launch.
let setAsideLibraryName: string | null = null

// Tests point Encore at a throwaway data folder so they never touch the real library.
if (process.env.ENCORE_DATA_DIR) app.setPath('userData', process.env.ENCORE_DATA_DIR)
// The log lives in Encore's own folder, next to the library.
app.setAppLogsPath()

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
  const result = await importMusic(paths, { automatic: true }).catch(() => null)
  if (result && (result.added.length > 0 || result.updated.length > 0)) mainWindow?.webContents.send(Channels.folderImport, result)
}

// A damaged library file is set aside so Encore can start with a new one. Anything else, like a locked file or an
// upgrade that failed, leaves the file alone and returns false, so a fixed version can still open it.
function openLibraryOrRecover(): boolean {
  try {
    openLibrary()
    return true
  } catch (error) {
    log.error('Could not open the library', error)
    if (!isDamagedLibrary(error)) return false
  }
  try {
    setAsideLibraryName = setAsideLibrary()
    // The saved spot points at songs in the old library, whose numbers the new one will hand out again.
    forgetPlayerSession()
    openLibrary()
    log.warn(`Started a new library. The damaged one was kept as ${setAsideLibraryName}`)
    return true
  } catch (error) {
    log.error('Could not start a new library', error)
    return false
  }
}

// Encore never stays running without a window, since launching it again would then do nothing at all.
function failToStart(message: string): void {
  dialog.showErrorBox("Encore couldn't start", `${message}\n\nDetails are in the log in ${logFolder()}`)
  app.exit(1)
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

  app.on('child-process-gone', (_event, details) => log.error('A helper process stopped', details))

  app.whenReady().then(() => {
    log.info(`Encore ${app.getVersion()} starting`)
    loadSettings()
    if (!openLibraryOrRecover()) {
      failToStart(
        setAsideLibraryName
          ? `Your library file was damaged and has been kept as ${setAsideLibraryName} in Encore's folder, but a new library couldn't be started. Your music files are fine.`
          : "Your library couldn't be opened. Your music files are fine, and the library file was left as it is."
      )
      return
    }
    ipcMain.handle(Channels.setAsideLibrary, () => setAsideLibraryName)
    registerLogHandlers(() => mainWindow)
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
    mainWindow.webContents.on('render-process-gone', (_event, details) => log.error('The window stopped', details))
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
  }).catch((error: unknown) => {
    log.error('Encore failed to start', error)
    failToStart('Something went wrong while Encore was opening.')
  })

  // The main window only truly closes while quitting, so finish the quit and clear the tray icon.
  app.on('window-all-closed', () => {
    tray?.destroy()
    app.quit()
  })
}
