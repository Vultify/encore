import { useSyncExternalStore } from 'react'
import { mediaUrl, type Track } from '@shared/api'

export interface PlayerState {
  queue: Track[]
  index: number
  track: Track | null
  playing: boolean
  position: number
  duration: number
  volume: number
  muted: boolean
  // The last song that failed to play, so the interface can say so.
  failed: Track | null
}

// Going back within this many seconds of a song's start skips to the previous song instead of restarting.
const RESTART_THRESHOLD = 3

// One audio element for the whole app. Components read its state through usePlayer.
class Player {
  private audio = new Audio()
  private listeners = new Set<() => void>()
  private queueSource: string | null = null
  private state: PlayerState = {
    queue: [],
    index: -1,
    track: null,
    playing: false,
    position: 0,
    duration: 0,
    volume: 0.8,
    muted: false,
    failed: null
  }

  constructor() {
    this.applyVolume()
    this.audio.preload = 'auto'
    this.audio.addEventListener('play', () => this.update({ playing: true }))
    this.audio.addEventListener('pause', () => this.update({ playing: false }))
    this.audio.addEventListener('timeupdate', () => this.update({ position: this.audio.currentTime }))
    this.audio.addEventListener('durationchange', () => {
      if (Number.isFinite(this.audio.duration)) this.update({ duration: this.audio.duration })
    })
    this.audio.addEventListener('ended', () => this.advance())
    this.audio.addEventListener('error', () => {
      if (!this.state.track) return
      this.update({ failed: this.state.track })
      this.advance()
    })
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = (): PlayerState => this.state

  // Plays queue[index] and keeps the rest of the queue for next and previous.
  // The source names the list it came from, so the queue can follow that list when it changes.
  playQueue(queue: Track[], index: number, source: string): void {
    this.queueSource = source
    this.update({ queue })
    this.load(index, true)
  }

  // Swaps in the latest version of the list the queue came from, keeping the current song playing.
  syncQueue(source: string, queue: Track[]): void {
    if (source !== this.queueSource || queue === this.state.queue) return
    const index = queue.findIndex((track) => track.id === this.state.track?.id)
    if (index === -1) return
    this.update({ queue, index, track: queue[index] })
  }

  // Drops removed songs from the queue. A removed song that's playing finishes, then the queue carries on after it.
  forget(trackIds: number[]): void {
    const gone = new Set(trackIds)
    const { queue, index, track } = this.state
    const kept = queue.filter((candidate) => !gone.has(candidate.id))
    const newIndex =
      track && gone.has(track.id)
        ? queue.slice(0, index).filter((candidate) => !gone.has(candidate.id)).length - 1
        : kept.findIndex((candidate) => candidate.id === track?.id)
    this.update({ queue: kept, index: newIndex })
  }

  toggle(): void {
    if (!this.state.track) return
    if (this.audio.paused) this.resume()
    else this.audio.pause()
  }

  next(): void {
    if (this.state.index < this.state.queue.length - 1) this.load(this.state.index + 1, true)
  }

  previous(): void {
    if (this.audio.currentTime > RESTART_THRESHOLD || this.state.index <= 0) this.seek(0)
    else this.load(this.state.index - 1, true)
  }

  seek(seconds: number): void {
    if (!this.state.track) return
    const max = this.state.duration || this.audio.duration || 0
    this.audio.currentTime = Math.min(Math.max(0, seconds), max)
    this.update({ position: this.audio.currentTime })
  }

  setVolume(volume: number): void {
    this.update({ volume: Math.min(Math.max(0, volume), 1), muted: false })
    this.applyVolume()
  }

  toggleMute(): void {
    this.update({ muted: !this.state.muted })
    this.applyVolume()
  }

  private load(index: number, autoplay: boolean): void {
    const track = this.state.queue[index]
    if (!track) return
    this.audio.src = mediaUrl(track.id)
    this.update({ index, track, position: 0, duration: track.duration ?? 0 })
    if (autoplay) this.resume()
  }

  // Moves on when a song ends or fails. At the end of the queue it stops on the last song.
  private advance(): void {
    if (this.state.index < this.state.queue.length - 1) {
      this.load(this.state.index + 1, true)
    } else {
      this.audio.pause()
      this.update({ playing: false })
    }
  }

  private resume(): void {
    // play() rejects when a newer load interrupts it, which is expected when skipping quickly.
    this.audio.play().catch(() => {})
  }

  // Volume feels more even to the ear on a curve than in a straight line.
  private applyVolume(): void {
    this.audio.volume = this.state.muted ? 0 : this.state.volume ** 2
  }

  private update(changes: Partial<PlayerState>): void {
    this.state = { ...this.state, ...changes }
    this.listeners.forEach((listener) => listener())
  }
}

export const player = new Player()

export const usePlayer = (): PlayerState => useSyncExternalStore(player.subscribe, player.getState)
