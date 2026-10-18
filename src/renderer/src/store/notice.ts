import { useSyncExternalStore } from 'react'

// The one short message shown in the toast above the dock. Anything in the app can post one.
let message: string | null = null
let persist = false
const listeners = new Set<() => void>()

const emit = (): void => listeners.forEach((listener) => listener())

// Shows a message. Persistent messages stay until replaced or cleared, for work still in progress.
export function notify(text: string, options: { persist?: boolean } = {}): void {
  message = text
  persist = options.persist ?? false
  emit()
}

export function clearNotice(): void {
  message = null
  persist = false
  emit()
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useNotice = (): { message: string | null; persist: boolean } => ({
  message: useSyncExternalStore(subscribe, () => message),
  persist: useSyncExternalStore(subscribe, () => persist)
})
