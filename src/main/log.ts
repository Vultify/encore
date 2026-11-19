import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { app, ipcMain, shell, type BrowserWindow } from 'electron'
import { Channels } from '../shared/api'

// A small log of what went wrong, kept on this computer only, so a bug report has something to go on.
// Once it passes this size it starts over, keeping the previous log beside it.
const MAX_LOG_BYTES = 1024 * 1024

export const logFolder = (): string => app.getPath('logs')
const logPath = (): string => join(logFolder(), 'encore.log')

const describe = (detail: unknown): string => {
  if (detail instanceof Error) return detail.stack ?? `${detail.name}: ${detail.message}`
  if (detail === undefined) return ''
  return typeof detail === 'string' ? detail : JSON.stringify(detail)
}

function write(level: 'info' | 'warn' | 'error', message: string, detail?: unknown): void {
  const extra = describe(detail)
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}${extra ? ` ${extra}` : ''}\n`
  try {
    mkdirSync(logFolder(), { recursive: true })
    const path = logPath()
    try {
      if (statSync(path).size > MAX_LOG_BYTES) renameSync(path, join(logFolder(), 'encore.old.log'))
    } catch {
      // No log yet.
    }
    appendFileSync(path, line)
  } catch {
    // Logging must never be the thing that breaks Encore.
  }
}

export const log = {
  info: (message: string, detail?: unknown): void => write('info', message, detail),
  warn: (message: string, detail?: unknown): void => write('warn', message, detail),
  error: (message: string, detail?: unknown): void => write('error', message, detail)
}

export function registerLogHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.on(Channels.openLogFolder, (event) => {
    if (event.sender !== getMainWindow()?.webContents) return
    mkdirSync(logFolder(), { recursive: true })
    void shell.openPath(logFolder())
  })
}
