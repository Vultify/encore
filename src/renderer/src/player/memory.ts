import { library } from '../store/library'
import { player } from './player'

// While music plays, where it's at is saved at most this often. Quitting saves right away.
const SAVE_EVERY_MS = 5000

// Puts back the saved volume, equalizer, and listening session when Encore opens, then keeps them saved as they change.
// The session waits for the library, since it's saved as song ids.
export function rememberPlayer(libraryLoaded: Promise<void>): () => void {
  let stopped = false
  let timer: number | undefined
  let stopWatching = (): void => {}

  const save = (): void => {
    window.clearTimeout(timer)
    timer = undefined
    const { volume, muted, equalizer } = player.getState()
    window.encore.settings.savePlayer({ volume, muted, session: player.snapshot(), equalizer })
  }
  const saveSoon = (): void => {
    timer ??= window.setTimeout(save, SAVE_EVERY_MS)
  }

  void (async () => {
    const saved = await window.encore.settings.getPlayer().catch(() => null)
    if (stopped) return
    if (saved) {
      player.setSound(saved.volume, saved.muted)
      player.setEqualizer(saved.equalizer)
    }
    await libraryLoaded.catch(() => {})
    if (stopped) return
    if (saved?.session) {
      const { tracks, missing } = library.getState()
      player.restore(saved.session, tracks.filter((track) => !missing.has(track.id)))
    }
    // Watching starts only now, so the saved session can't be overwritten before it's been put back.
    stopWatching = player.subscribe(saveSoon)
    window.addEventListener('beforeunload', save)
  })()

  return () => {
    stopped = true
    stopWatching()
    window.removeEventListener('beforeunload', save)
    window.clearTimeout(timer)
  }
}
