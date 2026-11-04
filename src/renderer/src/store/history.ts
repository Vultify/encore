import { useSyncExternalStore } from 'react'

// Counts up each time listening is saved, so the stats on Home know when to look again.
class HistoryStore {
  private version = 0
  private listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getVersion = (): number => this.version

  changed(): void {
    this.version += 1
    this.listeners.forEach((listener) => listener())
  }
}

export const history = new HistoryStore()

export const useHistoryVersion = (): number => useSyncExternalStore(history.subscribe, history.getVersion)
