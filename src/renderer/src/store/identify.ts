import { useSyncExternalStore } from 'react'
import type { MatchCandidate } from '@shared/api'
import { library } from './library'
import { notify } from './notice'

export interface ReviewItem {
  trackId: number
  candidates: MatchCandidate[]
  decision: 'pending' | 'applied' | 'skipped'
}

export interface IdentifyState {
  running: boolean
  done: number
  total: number
  items: ReviewItem[]
  // Goes up each time a run starts, so the app knows to open the review page.
  reviewRequest: number
}

const api = (): typeof window.encore.identify => window.encore.identify

// Looks songs up in the background and holds their matches until each one is picked or skipped.
class IdentifyStore {
  private state: IdentifyState = { running: false, done: 0, total: 0, items: [], reviewRequest: 0 }
  private listeners = new Set<() => void>()
  private listening = false

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = (): IdentifyState => this.state

  // Starts looking songs up and asks for the review page. Matches show up there as they arrive.
  async start(trackIds: number[]): Promise<void> {
    if (this.state.running || trackIds.length === 0) return
    this.listen()
    this.update({ running: true, done: 0, total: trackIds.length, items: [], reviewRequest: this.state.reviewRequest + 1 })
    try {
      await api().start(trackIds)
    } catch {
      notify("Couldn't start looking songs up.")
    } finally {
      this.update({ running: false })
    }
  }

  stop(): void {
    if (this.state.running) api().stop()
  }

  // Saves the picked match. The song changes everywhere in the library right away.
  async apply(trackId: number, candidateId: string): Promise<void> {
    const track = await api().apply(trackId, candidateId)
    if (!track) {
      notify("Couldn't save that match. Try identifying the song again.")
      return
    }
    library.replaceTrack(track)
    this.decide(trackId, 'applied')
  }

  skip(trackId: number): void {
    this.decide(trackId, 'skipped')
  }

  // Clears a finished review so the next one starts fresh.
  reset(): void {
    if (!this.state.running) this.update({ done: 0, total: 0, items: [] })
  }

  private decide(trackId: number, decision: ReviewItem['decision']): void {
    this.update({ items: this.state.items.map((item) => (item.trackId === trackId ? { ...item, decision } : item)) })
  }

  private listen(): void {
    if (this.listening) return
    this.listening = true
    api().onResult(({ trackId, candidates }) => {
      this.update({ items: [...this.state.items, { trackId, candidates, decision: 'pending' }] })
    })
    api().onProgress(({ done, total, error }) => {
      this.update({ done, total })
      if (error) notify(error)
    })
  }

  private update(changes: Partial<IdentifyState>): void {
    this.state = { ...this.state, ...changes }
    this.listeners.forEach((listener) => listener())
  }
}

export const identify = new IdentifyStore()

export const useIdentify = (): IdentifyState => useSyncExternalStore(identify.subscribe, identify.getState)

// Songs worth looking up: no album or no cover, not already identified, and with their file in place.
export const needsIdentifying = (tracks: { id: number; album: string | null; artworkId: string | null; identified: boolean }[], missing: ReadonlySet<number>): number[] =>
  tracks.filter((track) => !track.identified && (!track.album || !track.artworkId) && !missing.has(track.id)).map((track) => track.id)
