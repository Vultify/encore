import { useSyncExternalStore } from 'react'
import type { UpdateStatus } from '@shared/api'

// Where updating stands. The main process does the checking and downloading and reports every step.
class UpdateStore {
  private state: UpdateStatus = { state: 'off' }
  private listeners = new Set<() => void>()

  constructor() {
    const api = window.encore.updates
    api.status().then((status) => this.set(status))
    api.onStatus((status) => this.set(status))
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = (): UpdateStatus => this.state

  private set(next: UpdateStatus): void {
    this.state = next
    this.listeners.forEach((listener) => listener())
  }
}

export const updates = new UpdateStore()

export const useUpdateStatus = (): UpdateStatus => useSyncExternalStore(updates.subscribe, updates.getState)

// The notice about a new version shows once per version, even across restarts.
const ANNOUNCED_KEY = 'encore.announcedUpdate'

export function shouldAnnounce(version: string): boolean {
  try {
    if (localStorage.getItem(ANNOUNCED_KEY) === version) return false
    localStorage.setItem(ANNOUNCED_KEY, version)
  } catch {
    // Without storage the notice may show again next time, which is harmless.
  }
  return true
}
