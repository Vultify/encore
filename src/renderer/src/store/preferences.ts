import { useSyncExternalStore } from 'react'
import { DEFAULT_MINI_PLAYER_SHORTCUT, TOP_MIX, type Preferences } from '@shared/api'

const DEFAULTS: Preferences = {
  miniPlayerShortcut: DEFAULT_MINI_PLAYER_SHORTCUT,
  accent: 'album',
  motion: 'system',
  musicFolders: [],
  identifyNewSongs: false,
  startWithWindows: false,
  topMixSize: TOP_MIX.default
}

// What's set on the Settings page. The main process owns it and tells every window about each change.
class PreferenceStore {
  private state = DEFAULTS
  private listeners = new Set<() => void>()

  constructor() {
    const api = window.encore.preferences
    api.get().then((saved) => this.set(saved))
    api.onChange((next) => this.set(next))
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = (): Preferences => this.state

  private set(next: Preferences): void {
    this.state = next
    this.listeners.forEach((listener) => listener())
  }
}

export const preferences = new PreferenceStore()

export const usePreferences = (): Preferences => useSyncExternalStore(preferences.subscribe, preferences.getState)
