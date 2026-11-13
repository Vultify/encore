import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import {
  ACCENT_PRESETS,
  Channels,
  DEFAULT_PREFERENCES,
  DEFAULT_VOLUME,
  MOTION_CHOICES,
  REPEAT_MODES,
  roundMixSize,
  type AccentChoice,
  type MotionChoice,
  type PlayerPreferences,
  type PlayerSession,
  type Preferences
} from '../shared/api'
import { DEFAULT_EQUALIZER, isEqualizerSettings, type EqualizerSettings } from '../shared/equalizer'
import { isAllowedShortcut } from '../shared/shortcut'
import { isId, isIdList, isOneOf, isText, MAX_KEY } from './validate'

export interface WindowState {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

interface Settings {
  window?: WindowState
  player?: PlayerPreferences
  preferences?: Partial<Preferences>
}

// Changes are saved a moment after they stop, so dragging the window doesn't write the file over and over.
const SAVE_DELAY_MS = 500
// A session never lists more songs than this, so a huge library can't make the settings file huge.
const MAX_SESSION_SONGS = 20_000

let settings: Settings = {}
let saveTimer: NodeJS.Timeout | null = null

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

// Reads settings.json once at startup. A missing or damaged file just means starting fresh.
export function loadSettings(): void {
  try {
    settings = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Settings
  } catch {
    settings = {}
  }
}

// Writes to a temporary file first and then swaps it in, so a crash mid-save never leaves a half-written file.
// A failed write only loses this save; the next change tries again.
function save(): void {
  saveTimer = null
  const path = settingsPath()
  try {
    writeFileSync(`${path}.tmp`, JSON.stringify(settings))
    renameSync(`${path}.tmp`, path)
  } catch (error) {
    console.error('Could not save settings', error)
  }
}

function saveSoon(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(save, SAVE_DELAY_MS)
}

// Writes any change still waiting, for when Encore quits.
export function flushSettings(): void {
  if (!saveTimer) return
  clearTimeout(saveTimer)
  save()
}

const isWhole = (value: unknown): value is number => Number.isInteger(value)

// The file can be edited by hand, so a saved window only counts if every number in it makes sense.
export function windowState(): WindowState | undefined {
  const saved = settings.window
  const valid =
    saved &&
    [saved.x, saved.y, saved.width, saved.height].every(isWhole) &&
    saved.width > 0 &&
    saved.height > 0 &&
    typeof saved.maximized === 'boolean'
  return valid ? saved : undefined
}

export function rememberWindow(state: WindowState): void {
  settings.window = state
  saveSoon()
}

export const isAccentChoice = (value: unknown): value is AccentChoice =>
  value === 'album' || ACCENT_PRESETS.some((preset) => preset.color === value)

export const isMixSize = (value: unknown): value is number => typeof value === 'number' && roundMixSize(value) === value

export const isMotionChoice = (value: unknown): value is MotionChoice => isOneOf(MOTION_CHOICES, value)

const isFolder = (value: unknown): value is string => isText(value) && value.length > 0

// What's set on the Settings page, with anything missing or damaged in the file falling back to the default.
export function preferences(): Preferences {
  const saved = settings.preferences ?? {}
  return {
    miniPlayerShortcut:
      typeof saved.miniPlayerShortcut === 'string' && isAllowedShortcut(saved.miniPlayerShortcut)
        ? saved.miniPlayerShortcut
        : DEFAULT_PREFERENCES.miniPlayerShortcut,
    accent: isAccentChoice(saved.accent) ? saved.accent : DEFAULT_PREFERENCES.accent,
    motion: isMotionChoice(saved.motion) ? saved.motion : DEFAULT_PREFERENCES.motion,
    musicFolders: Array.isArray(saved.musicFolders) ? saved.musicFolders.filter(isFolder) : DEFAULT_PREFERENCES.musicFolders,
    identifyNewSongs: typeof saved.identifyNewSongs === 'boolean' ? saved.identifyNewSongs : DEFAULT_PREFERENCES.identifyNewSongs,
    startWithWindows: typeof saved.startWithWindows === 'boolean' ? saved.startWithWindows : DEFAULT_PREFERENCES.startWithWindows,
    topMixSize: isMixSize(saved.topMixSize) ? saved.topMixSize : DEFAULT_PREFERENCES.topMixSize
  }
}

export function savePreferences(next: Preferences): void {
  settings.preferences = next
  saveSoon()
}

// Checks what the interface sends, since anything crossing into the main process is untrusted.
function validSession(value: unknown): PlayerSession | null {
  const session = value as PlayerSession | null
  if (!session || typeof session !== 'object') return null
  const valid =
    isText(session.sourceKey, MAX_KEY) &&
    isText(session.sourceName) &&
    isIdList(session.sourceIds, MAX_SESSION_SONGS) &&
    isPlayOrder(session.order, session.sourceIds.length) &&
    isWhole(session.cursor) &&
    session.cursor >= -1 &&
    session.cursor < session.order.length &&
    isIdList(session.queuedIds, MAX_SESSION_SONGS) &&
    isId(session.trackId) &&
    typeof session.fromQueue === 'boolean' &&
    typeof session.position === 'number' &&
    Number.isFinite(session.position) &&
    session.position >= 0 &&
    typeof session.shuffle === 'boolean' &&
    isOneOf(REPEAT_MODES, session.repeat)
  return valid ? session : null
}

// A play order lists every position in the source exactly once.
function isPlayOrder(order: unknown, length: number): order is number[] {
  if (!Array.isArray(order) || order.length !== length) return false
  const seen = new Set<number>()
  for (const i of order) {
    if (!isWhole(i) || i < 0 || i >= length || seen.has(i)) return false
    seen.add(i)
  }
  return true
}

// A missing or damaged equalizer, like one from before Encore had it, starts off and flat.
const validEqualizer = (value: unknown): EqualizerSettings => (isEqualizerSettings(value) ? value : DEFAULT_EQUALIZER)

export function registerSettingsHandlers(): void {
  ipcMain.handle(Channels.getPlayerSettings, (): PlayerPreferences => {
    const saved = settings.player
    return saved
      ? { ...saved, equalizer: validEqualizer(saved.equalizer) }
      : { volume: DEFAULT_VOLUME, muted: false, session: null, equalizer: DEFAULT_EQUALIZER }
  })
  ipcMain.on(Channels.savePlayerSettings, (_event, value: unknown) => {
    const preferences = value as PlayerPreferences | null
    if (!preferences || !Number.isFinite(preferences.volume) || typeof preferences.muted !== 'boolean') return
    settings.player = {
      volume: Math.min(1, Math.max(0, preferences.volume)),
      muted: preferences.muted,
      session: validSession(preferences.session),
      equalizer: validEqualizer(preferences.equalizer)
    }
    saveSoon()
  })
}
