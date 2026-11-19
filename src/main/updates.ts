import { app, ipcMain, type BrowserWindow, type WebContents } from 'electron'
import { autoUpdater } from 'electron-updater'
import { Channels, type UpdateStatus } from '../shared/api'

// Tests hand Encore an update config pointing at their own stand-in server, which also works while developing.
// What a test downloads is never installed on quit, so closing a test can't replace the real installed Encore.
const TEST_CONFIG = process.env.ENCORE_UPDATE_CONFIG

// The first check waits a little, so it never slows down opening Encore.
const FIRST_CHECK_DELAY_MS = TEST_CONFIG ? 500 : 10_000
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000

export interface Updates {
  status: () => UpdateStatus
  // Starts or stops the checks Encore makes by itself, following the setting.
  setAutomatic: (on: boolean) => void
  install: () => void
}

interface UpdateOptions {
  getMainWindow: () => BrowserWindow | null
  // Called whenever the status changes, so the tray can follow it.
  onChange: (status: UpdateStatus) => void
}

// Encore looks for a newer version on GitHub Releases and downloads it only when asked. A downloaded update
// installs when Encore restarts for it, or the next time Encore quits.
export function registerUpdates({ getMainWindow, onChange }: UpdateOptions): Updates {
  const active = app.isPackaged || Boolean(TEST_CONFIG)
  let status: UpdateStatus = { state: active ? 'idle' : 'off' }
  let timer: NodeJS.Timeout | null = null
  let checkedOnce = false
  let automatic = false

  const set = (next: UpdateStatus): void => {
    status = next
    getMainWindow()?.webContents.send(Channels.updateStatusChanged, next)
    onChange(next)
  }

  autoUpdater.autoDownload = false
  autoUpdater.disableWebInstaller = true
  autoUpdater.autoInstallOnAppQuit = !TEST_CONFIG
  if (TEST_CONFIG) {
    autoUpdater.updateConfigPath = TEST_CONFIG
    autoUpdater.forceDevUpdateConfig = true
  }
  // Failures already show in Settings; this keeps the updater from also throwing them as unhandled errors.
  autoUpdater.on('error', () => {})
  autoUpdater.on('download-progress', ({ percent }) => {
    const rounded = Math.floor(percent)
    if (status.state === 'downloading' && rounded !== status.percent) set({ ...status, percent: rounded })
  })

  // Checks started by Encore itself stay quiet: no "Checking" in Settings, and a failure keeps an update already found.
  const check = async (asked: boolean): Promise<void> => {
    if (!active || status.state === 'checking' || status.state === 'downloading' || status.state === 'ready') return
    checkedOnce = true
    const before = status
    if (asked) set({ state: 'checking' })
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result?.isUpdateAvailable) set({ state: 'available', version: result.updateInfo.version })
      else set({ state: 'current' })
    } catch {
      set(!asked && before.state === 'available' ? before : { state: 'error' })
    }
  }

  const download = async (): Promise<void> => {
    if (status.state !== 'available') return
    const { version } = status
    set({ state: 'downloading', version, percent: 0 })
    try {
      await autoUpdater.downloadUpdate()
      set({ state: 'ready', version })
    } catch {
      set({ state: 'available', version, error: "The download didn't finish. Check your internet connection and try again." })
    }
  }

  const install = (): void => {
    // Silent, then Encore opens again on its own once the new version is in.
    if (status.state === 'ready') autoUpdater.quitAndInstall(true, true)
  }

  const scheduleCheck = (delay: number): void => {
    timer = setTimeout(() => {
      void check(false)
      scheduleCheck(CHECK_EVERY_MS)
    }, delay)
  }

  // Every settings change passes through here, so only flipping this one moves the schedule.
  const setAutomatic = (on: boolean): void => {
    if (on === automatic) return
    automatic = on
    if (timer) clearTimeout(timer)
    timer = null
    if (on && active) scheduleCheck(checkedOnce ? CHECK_EVERY_MS : FIRST_CHECK_DELAY_MS)
  }

  const fromMainWindow = (sender: WebContents): boolean => sender === getMainWindow()?.webContents
  ipcMain.handle(Channels.updateStatus, () => status)
  ipcMain.on(Channels.checkForUpdate, (event) => {
    if (fromMainWindow(event.sender)) void check(true)
  })
  ipcMain.on(Channels.downloadUpdate, (event) => {
    if (fromMainWindow(event.sender)) void download()
  })
  ipcMain.on(Channels.installUpdate, (event) => {
    if (fromMainWindow(event.sender)) install()
  })

  return { status: () => status, setAutomatic, install }
}
