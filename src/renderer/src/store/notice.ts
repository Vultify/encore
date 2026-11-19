import { useSyncExternalStore } from 'react'

export interface NoticeAction {
  label: string
  run: () => void
}

export interface Notice {
  text: string
  // Keeps it up until replaced or cleared, for work still in progress.
  persist: boolean
  action?: NoticeAction
}

// The one short message shown in the toast above the dock. Anything in the app can post one.
let notice: Notice | null = null
const listeners = new Set<() => void>()

const emit = (): void => listeners.forEach((listener) => listener())

export function notify(text: string, options: { persist?: boolean; action?: NoticeAction } = {}): void {
  notice = { text, persist: options.persist ?? false, action: options.action }
  emit()
}

export function clearNotice(): void {
  notice = null
  emit()
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useNotice = (): Notice | null => useSyncExternalStore(subscribe, () => notice)
