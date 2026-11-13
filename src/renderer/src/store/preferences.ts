import { useSyncExternalStore } from 'react'
import { DEFAULT_PREFERENCES, type Preferences } from '@shared/api'

// What's set on the Settings page. The main process owns it and tells every window about each change.
class PreferenceStore {
  private state = DEFAULT_PREFERENCES
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
