import { useSyncExternalStore } from 'react'
import { MAX_IDS_PER_REQUEST, type MatchCandidate, type Track } from '@shared/api'
import { library } from './library'
import { notify } from './notice'
import { preferences } from './preferences'

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
  // Songs asked for while a run was going. They're looked up as soon as it finishes.
  private waiting = new Set<number>()
  // A big run goes to the main process in batches. These keep one progress count across them, and stop the rest
  // when it's stopped or can't go on.
  private batchStart = 0
  private runTotal = 0
  private cancelled = false

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = (): IdentifyState => this.state

  // Starts looking songs up and, unless told not to, asks for the review page. Matches show up there as they arrive.
  // Matches still waiting for a decision are kept, and songs asked for during a run wait their turn.
  async start(trackIds: number[], { review = true } = {}): Promise<void> {
    const waitingForReview = new Set(this.state.items.filter((item) => item.decision === 'pending').map((item) => item.trackId))
    const fresh = trackIds.filter((id) => !waitingForReview.has(id))
    if (review && trackIds.length > 0) this.update({ reviewRequest: this.state.reviewRequest + 1 })
    if (fresh.length === 0) return
    if (this.state.running) {
      fresh.forEach((id) => this.waiting.add(id))
      return
    }

    // A new review keeps only the matches still waiting. Ones already decided had their summary.
    this.update({ items: this.state.items.filter((item) => item.decision === 'pending') })
    await this.run(fresh)
  }

  // Looks songs up, then any asked for meanwhile, all as part of the same review.
  private async run(trackIds: number[]): Promise<void> {
    this.listen()
    this.cancelled = false
    this.runTotal = trackIds.length
    this.update({ running: true, done: 0, total: trackIds.length })
    try {
      for (let start = 0; start < trackIds.length && !this.cancelled; start += MAX_IDS_PER_REQUEST) {
        this.batchStart = start
        await api().start(trackIds.slice(start, start + MAX_IDS_PER_REQUEST))
      }
    } catch {
      notify("Couldn't start looking songs up.")
    } finally {
      this.update({ running: false })
    }
    if (this.waiting.size > 0) {
      const next = [...this.waiting]
      this.waiting.clear()
      await this.run(next)
    }
  }

  // With "Identify new songs automatically" on, looks up just-added songs that are missing an album or cover,
  // quietly. Their matches wait in Local files for review.
  identifyNewSongs(added: Track[]): void {
    if (!preferences.getState().identifyNewSongs) return
    void this.start(needsIdentifying(added, library.getState().missing), { review: false })
  }

  // Stopping also drops songs that were waiting to be looked up next.
  stop(): void {
    this.waiting.clear()
    this.cancelled = true
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
    api().onProgress(({ done, error }) => {
      this.update({ done: this.batchStart + done, total: this.runTotal })
      if (error) {
        this.cancelled = true
        notify(error)
      }
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
