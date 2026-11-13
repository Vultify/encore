import { useSyncExternalStore } from 'react'
import { mediaUrl, type PlayerSession, type Track } from '@shared/api'
import { clampGain, DEFAULT_EQUALIZER, equalizerGains, type EqChoice, type EqualizerSettings } from '@shared/equalizer'
import { EqualizerChain } from './equalizer'

export type RepeatMode = 'off' | 'all' | 'one'

// A song added with Play next or Add to queue. The key tells two copies of the same song apart.
export interface QueuedTrack {
  key: number
  track: Track
}

export interface PlayerState {
  track: Track | null
  // What the current song was played from, like an album or playlist name.
  sourceName: string
  playing: boolean
  position: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  // Songs added by hand, in the order they'll play. They come before the rest of the source.
  queued: QueuedTrack[]
  // The rest of the source after the current song, in play order.
  upcoming: Track[]
  hasNext: boolean
  // The last song that failed to play, so the interface can say so.
  failed: Track | null
  equalizer: EqualizerSettings
}

// Going back within this many seconds of a song's start skips to the previous song instead of restarting.
const RESTART_THRESHOLD = 3

const REPEAT_CYCLE: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' }

// Fisher-Yates: every order is equally likely.
function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const inOrder = (length: number): number[] => Array.from({ length }, (_, i) => i)

// One audio element for the whole app. Components read its state through usePlayer.
class Player {
  private audio = new Audio()
  private equalizerChain = new EqualizerChain(this.audio)
  private listeners = new Set<() => void>()

  // The list the songs came from, in its own order, and the key that names it.
  private source: Track[] = []
  private sourceKey: string | null = null
  // Play order as positions in the source, and where in that order the current song sits.
  private order: number[] = []
  private cursor = -1
  // True while a song from the hand-built queue is playing rather than one from the source.
  private playingQueued = false
  private nextQueueKey = 1
  // Where a restored song should start, applied once the file's length is known and seeking is possible.
  private startAt: number | null = null

  private state: PlayerState = {
    track: null,
    sourceName: '',
    playing: false,
    position: 0,
    duration: 0,
    volume: 0.8,
    muted: false,
    shuffle: false,
    repeat: 'off',
    queued: [],
    upcoming: [],
    hasNext: false,
    failed: null,
    equalizer: DEFAULT_EQUALIZER
  }

  constructor() {
    this.applyVolume()
    this.audio.preload = 'auto'
    // Songs are fetched as readable by the page, or the equalizer would only hear silence.
    this.audio.crossOrigin = 'anonymous'
    this.audio.addEventListener('play', () => {
      this.equalizerChain.setPlaying(true)
      this.update({ playing: true })
    })
    this.audio.addEventListener('pause', () => {
      this.equalizerChain.setPlaying(false)
      this.update({ playing: false })
    })
    this.audio.addEventListener('timeupdate', () => this.update({ position: this.audio.currentTime }))
    this.audio.addEventListener('loadedmetadata', () => {
      if (this.startAt !== null) this.audio.currentTime = this.startAt
      this.startAt = null
    })
    this.audio.addEventListener('durationchange', () => {
      if (Number.isFinite(this.audio.duration)) this.update({ duration: this.audio.duration })
    })
    this.audio.addEventListener('ended', () => this.advance(false))
    this.audio.addEventListener('error', () => {
      if (!this.state.track) return
      this.update({ failed: this.state.track })
      this.advance(true)
    })
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = (): PlayerState => this.state

  // Plays tracks[index] and keeps the list for what comes next. The key names the list so the queue can follow
  // it when it changes; the name is what "Playing from" shows. With shuffle on, the rest of the list is shuffled.
  playQueue(tracks: Track[], index: number, sourceKey: string, sourceName: string): void {
    if (!tracks[index]) return
    this.source = tracks
    this.sourceKey = sourceKey
    this.order = this.state.shuffle ? [index, ...shuffled(inOrder(tracks.length).filter((i) => i !== index))] : inOrder(tracks.length)
    this.update({ sourceName })
    this.playFromSource(this.state.shuffle ? 0 : index)
  }

  // Turns shuffle on and starts the list from a random song.
  playShuffled(tracks: Track[], sourceKey: string, sourceName: string): void {
    if (tracks.length === 0) return
    this.update({ shuffle: true })
    this.playQueue(tracks, Math.floor(Math.random() * tracks.length), sourceKey, sourceName)
  }

  // Swaps in the latest version of the list the songs came from, keeping the current song playing.
  // New songs join what's still to come; with shuffle on, they're mixed in at random.
  syncQueue(sourceKey: string, tracks: Track[]): void {
    if (sourceKey !== this.sourceKey || tracks === this.source) return
    const newIndex = new Map(tracks.map((track, i) => [track.id, i]))
    const mapped = this.order.map((i) => newIndex.get(this.source[i].id)).filter((i): i is number => i !== undefined)
    const currentId = this.currentSourceTrack()?.id
    const played = this.order.slice(0, this.cursor + 1).map((i) => newIndex.get(this.source[i].id)).filter((i): i is number => i !== undefined)
    const known = new Set(mapped)
    const added = inOrder(tracks.length).filter((i) => !known.has(i))

    this.source = tracks
    if (this.state.shuffle) {
      const rest = [...mapped.slice(played.length), ...added]
      this.order = [...played, ...shuffled(rest)]
      this.cursor = played.length - 1
    } else {
      this.order = inOrder(tracks.length)
      this.cursor = currentId === undefined ? -1 : (newIndex.get(currentId) ?? played.length - 1)
    }
    // A song whose tags changed shows the new ones right away.
    const fresh = this.currentSourceTrack()
    this.publish(!this.playingQueued && fresh && fresh.id === this.state.track?.id ? { track: fresh } : {})
  }

  // Swaps in the library's latest copy of every song the player holds, so a song identified, re-read,
  // or liked while it's playing shows the change in the dock, Up next, and everywhere else right away.
  refresh(tracks: Track[]): void {
    const byId = new Map(tracks.map((track) => [track.id, track]))
    const fresh = (track: Track): Track => byId.get(track.id) ?? track
    const { track, queued } = this.state
    const changed =
      (track !== null && fresh(track) !== track) ||
      this.source.some((song) => fresh(song) !== song) ||
      queued.some((item) => fresh(item.track) !== item.track)
    if (!changed) return

    this.source = this.source.map(fresh)
    this.publish({ track: track && fresh(track), queued: queued.map((item) => ({ ...item, track: fresh(item.track) })) })
  }

  // Drops removed songs from the source and the queue. A removed song that's playing finishes,
  // then playback carries on with whatever was after it.
  forget(trackIds: number[]): void {
    const gone = new Set(trackIds)
    const keep = (i: number): boolean => !gone.has(this.source[i].id)
    const kept = this.source.filter((track) => !gone.has(track.id))
    const newIndex = new Map(kept.map((track, i) => [track.id, i]))
    // Whether or not the current song was removed, the next one to play is right after the kept songs up to it.
    const before = this.order.slice(0, this.cursor + 1).filter(keep).length

    this.order = this.order.filter(keep).map((i) => newIndex.get(this.source[i].id)!)
    this.source = kept
    this.cursor = before - 1
    this.publish({ queued: this.state.queued.filter((item) => !gone.has(item.track.id)) })
  }

  // Puts songs right after the current one, ahead of anything already queued.
  playNext(tracks: Track[]): void {
    this.enqueue(tracks, true)
  }

  // Puts songs at the end of the hand-built queue, still ahead of the rest of the source.
  addToQueue(tracks: Track[]): void {
    this.enqueue(tracks, false)
  }

  removeFromQueue(key: number): void {
    this.publish({ queued: this.state.queued.filter((item) => item.key !== key) })
  }

  clearQueue(): void {
    this.publish({ queued: [] })
  }

  // Jumps to a song in Up next. A queued song plays and leaves the queue; a source song moves playback there.
  jumpToQueued(key: number): void {
    const item = this.state.queued.find((candidate) => candidate.key === key)
    if (!item) return
    this.publish({ queued: this.state.queued.filter((candidate) => candidate.key !== key) })
    this.playQueued(item.track)
  }

  jumpToUpcoming(offset: number): void {
    const target = this.cursor + 1 + offset
    if (target < this.order.length) this.playFromSource(target)
  }

  play(): void {
    if (this.state.track && this.audio.paused) this.resume()
  }

  pause(): void {
    this.audio.pause()
  }

  toggle(): void {
    if (this.audio.paused) this.play()
    else this.pause()
  }

  next(): void {
    this.advance(true)
  }

  previous(): void {
    if (!this.state.track) return
    if (this.audio.currentTime > RESTART_THRESHOLD) return this.seek(0)
    // From a queued song, back goes to the source song it interrupted.
    if (this.playingQueued && this.currentSourceTrack()) return this.playFromSource(this.cursor)
    if (this.cursor > 0) return this.playFromSource(this.cursor - 1)
    if (this.state.repeat === 'all' && this.order.length > 0) return this.playFromSource(this.order.length - 1)
    this.seek(0)
  }

  seek(seconds: number): void {
    if (!this.state.track) return
    const max = this.state.duration || this.audio.duration || 0
    this.startAt = null
    this.audio.currentTime = Math.min(Math.max(0, seconds), max)
    this.update({ position: this.audio.currentTime })
  }

  setVolume(volume: number): void {
    this.update({ volume: Math.min(Math.max(0, volume), 1), muted: false })
    this.applyVolume()
  }

  // Puts back a saved volume and mute together, without the unmuting that moving the slider does.
  setSound(volume: number, muted: boolean): void {
    this.update({ volume: Math.min(Math.max(0, volume), 1), muted })
    this.applyVolume()
  }

  toggleMute(): void {
    this.update({ muted: !this.state.muted })
    this.applyVolume()
  }

  // Shuffling keeps the current song playing and mixes up only what comes after it.
  // Turning it off goes back to the list's own order from wherever the current song sits.
  toggleShuffle(): void {
    const shuffle = !this.state.shuffle
    const current = this.cursor >= 0 ? this.order[this.cursor] : null
    if (shuffle) {
      const others = shuffled(inOrder(this.source.length).filter((i) => i !== current))
      this.order = current === null ? others : [current, ...others]
      this.cursor = current === null ? -1 : 0
    } else {
      this.order = inOrder(this.source.length)
      this.cursor = current ?? -1
    }
    this.publish({ shuffle })
  }

  cycleRepeat(): void {
    this.publish({ repeat: REPEAT_CYCLE[this.state.repeat] })
  }

  setEqualizer(equalizer: EqualizerSettings): void {
    this.update({ equalizer })
    this.equalizerChain.apply(equalizer)
  }

  // Off keeps the preset and levels for when it's turned back on.
  setEqualizerOn(enabled: boolean): void {
    this.setEqualizer({ ...this.state.equalizer, enabled })
  }

  // Picking a preset turns the equalizer on, since hearing it is the point of picking one.
  chooseEqualizerPreset(preset: EqChoice): void {
    this.setEqualizer({ ...this.state.equalizer, enabled: true, preset })
  }

  // Moving a band makes the levels Custom, starting from wherever the current preset had them.
  setEqualizerBand(band: number, gain: number): void {
    const custom = equalizerGains(this.state.equalizer)
    if (!(band in custom)) return
    custom[band] = clampGain(gain)
    this.setEqualizer({ enabled: true, preset: 'custom', custom })
  }

  // The list the current song is playing from, or null for a song added by hand to the queue.
  currentSourceKey(): string | null {
    return this.playingQueued ? null : this.sourceKey
  }

  // Where listening stands, so Encore can pick it up again next time it opens.
  snapshot(): PlayerSession | null {
    const { track } = this.state
    if (!track) return null
    return {
      sourceKey: this.sourceKey ?? '',
      sourceName: this.state.sourceName,
      sourceIds: this.source.map((song) => song.id),
      order: this.order,
      cursor: this.cursor,
      queuedIds: this.state.queued.map((item) => item.track.id),
      trackId: track.id,
      fromQueue: this.playingQueued,
      position: Math.round(this.state.position * 10) / 10,
      shuffle: this.state.shuffle,
      repeat: this.state.repeat
    }
  }

  // Loads a saved session paused where it left off. Songs that are no longer playable are left out of it.
  restore(session: PlayerSession, tracks: Track[]): void {
    const byId = new Map(tracks.map((track) => [track.id, track]))
    const track = byId.get(session.trackId)
    if (this.state.track || !track) return

    // Positions in the saved source, mapped to where those songs sit once the unplayable ones are gone.
    const kept = new Map<number, number>()
    const source: Track[] = []
    session.sourceIds.forEach((id, i) => {
      const song = byId.get(id)
      if (!song) return
      kept.set(i, source.length)
      source.push(song)
    })
    const keptOrder = session.order.filter((i) => kept.has(i))
    const before = session.order.slice(0, session.cursor + 1).filter((i) => kept.has(i)).length

    this.source = source
    this.sourceKey = session.sourceKey || null
    this.order = keptOrder.map((i) => kept.get(i)!)
    this.cursor = before - 1
    this.playingQueued = session.fromQueue
    const queued = session.queuedIds.flatMap((id) => {
      const song = byId.get(id)
      return song ? [{ key: this.nextQueueKey++, track: song }] : []
    })

    const position = Math.min(session.position, track.duration ?? session.position)
    this.audio.src = mediaUrl(track.id)
    this.startAt = position
    this.publish({
      track,
      sourceName: session.sourceName,
      position,
      duration: track.duration ?? 0,
      queued,
      shuffle: session.shuffle,
      repeat: session.repeat
    })
  }

  // Stops the song for good and lets go of the file, so this player can be thrown away.
  dispose(): void {
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.equalizerChain.close()
  }

  private currentSourceTrack(): Track | undefined {
    return this.cursor >= 0 ? this.source[this.order[this.cursor]] : undefined
  }

  private enqueue(tracks: Track[], first: boolean): void {
    if (tracks.length === 0) return
    const items = tracks.map((track) => ({ key: this.nextQueueKey++, track }))
    // With nothing playing, the first song starts right away.
    if (!this.state.track) {
      const [start, ...rest] = items
      this.publish({ queued: rest })
      return this.playQueued(start.track)
    }
    this.publish({ queued: first ? [...items, ...this.state.queued] : [...this.state.queued, ...items] })
  }

  // Moves on when a song ends, fails, or Next is pressed. Repeat one replays the song only when it ends by itself.
  private advance(manual: boolean): void {
    const { queued, repeat } = this.state
    if (!manual && repeat === 'one' && this.state.track) {
      this.audio.currentTime = 0
      return this.resume()
    }
    if (queued.length > 0) {
      const [first, ...rest] = queued
      this.publish({ queued: rest })
      return this.playQueued(first.track)
    }
    if (this.cursor < this.order.length - 1) return this.playFromSource(this.cursor + 1)
    if (repeat === 'all' && this.order.length > 0) {
      // Each lap around a shuffled list gets a fresh order.
      if (this.state.shuffle) this.order = shuffled(this.order)
      return this.playFromSource(0)
    }
    if (!manual) {
      this.audio.pause()
      this.update({ playing: false })
    }
  }

  private playFromSource(cursor: number): void {
    const track = this.source[this.order[cursor]]
    if (!track) return
    this.cursor = cursor
    this.playingQueued = false
    this.load(track)
  }

  private playQueued(track: Track): void {
    this.playingQueued = true
    this.load(track)
  }

  private load(track: Track): void {
    this.startAt = null
    this.audio.src = mediaUrl(track.id)
    this.publish({ track, position: 0, duration: track.duration ?? 0 })
    this.resume()
  }

  private resume(): void {
    // play() rejects when a newer load interrupts it, which is expected when skipping quickly.
    this.audio.play().catch(() => {})
  }

  // Volume feels more even to the ear on a curve than in a straight line.
  private applyVolume(): void {
    this.audio.volume = this.state.muted ? 0 : this.state.volume ** 2
  }

  // Updates state and recomputes what's coming up, for changes that touch the order or the queue.
  private publish(changes: Partial<PlayerState>): void {
    const queued = changes.queued ?? this.state.queued
    const repeat = changes.repeat ?? this.state.repeat
    const upcoming = this.order.slice(this.cursor + 1).map((i) => this.source[i])
    this.update({
      ...changes,
      upcoming,
      hasNext: queued.length > 0 || upcoming.length > 0 || (repeat === 'all' && this.order.length > 0)
    })
  }

  private update(changes: Partial<PlayerState>): void {
    this.state = { ...this.state, ...changes }
    this.listeners.forEach((listener) => listener())
  }
}

export const player = new Player()

// While developing, an edited player file is swapped in without a restart. The old player stops its song first,
// or it would keep playing where no button can reach it.
import.meta.hot?.dispose(() => player.dispose())

export const usePlayer = (): PlayerState => useSyncExternalStore(player.subscribe, player.getState)
