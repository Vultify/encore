import { history } from '@/store/history'
import { player } from './player'

// A song counts as played after 30 seconds of listening, or half of it if it's shorter than a minute.
const COUNT_AFTER_SECONDS = 30
// Listening is saved this often while a song plays, and whenever it pauses, changes, or Encore closes.
const SAVE_EVERY_SECONDS = 15
// The player moves along a fraction of a second at a time. A bigger jump is a seek, which isn't listening.
const LONGEST_STEP = 2
// Going back to the very start, by picking the song again or with repeat one, is a new listen.
const START_SECONDS = 1

interface Listen {
  trackId: number
  sourceKey: string | null
  // Made the first time the listen is saved, so songs skipped straight away leave nothing behind.
  id: Promise<number | null> | null
  seconds: number
  saved: number
  counted: boolean
}

// Keeps track of how long each song is actually listened to, for the stats on Home. Paused time and the
// parts skipped over don't count.
export function connectHistory(): () => void {
  let listen: Listen | null = null
  let lastPosition = 0

  const save = (current: Listen): void => {
    current.saved = current.seconds
    current.id ??= window.encore.library.startListen(current.trackId, current.sourceKey)
    const seconds = Math.round(current.seconds * 10) / 10
    const { counted } = current
    void current.id.then((id) => {
      if (id === null) return
      window.encore.library.updateListen(id, seconds, counted)
      history.changed()
    })
  }

  const finish = (): void => {
    if (listen && listen.seconds > listen.saved) save(listen)
    listen = null
  }

  const unsubscribe = player.subscribe(() => {
    const { track, playing, position, duration } = player.getState()
    const step = position - lastPosition
    lastPosition = position

    if (!track || track.id !== listen?.trackId || (position < START_SECONDS && step < -START_SECONDS)) finish()
    if (!track) return
    if (!playing) {
      if (listen && listen.seconds > listen.saved) save(listen)
      return
    }

    listen ??= { trackId: track.id, sourceKey: player.currentSourceKey(), id: null, seconds: 0, saved: 0, counted: false }
    if (step > 0 && step <= LONGEST_STEP) listen.seconds += step

    const needed = duration > 0 ? Math.min(COUNT_AFTER_SECONDS, duration / 2) : COUNT_AFTER_SECONDS
    if (!listen.counted && listen.seconds >= needed) {
      listen.counted = true
      save(listen)
    } else if (listen.seconds - listen.saved >= SAVE_EVERY_SECONDS) {
      save(listen)
    }
  })

  window.addEventListener('beforeunload', finish)
  return () => {
    unsubscribe()
    window.removeEventListener('beforeunload', finish)
    finish()
  }
}
