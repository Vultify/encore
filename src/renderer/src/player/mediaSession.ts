import { artworkUrl, type Track } from '@shared/api'
import { player } from './player'

// The overlay moves its own progress bar along, so it only hears about the position when it jumps by more than this.
const DRIFT_SECONDS = 1.5

// The overlay only takes cover art from web, data, or blob addresses, so the private art address is turned into a blob one.
async function artworkFor(track: Track): Promise<string | null> {
  if (!track.artworkId) return null
  try {
    const response = await fetch(artworkUrl(track.artworkId))
    return response.ok ? URL.createObjectURL(await response.blob()) : null
  } catch {
    return null
  }
}

// Shows the playing song in the Windows media overlay and lets the keyboard's media keys control Encore.
export function connectMediaSession(): () => void {
  const session = navigator.mediaSession
  let shown: Track | null = null
  let artwork: string | null = null
  let reported = { trackId: -1, playing: false, duration: 0, position: 0, at: 0 }

  const showSong = async (track: Track | null): Promise<void> => {
    const metadata = (art: string | null): MediaMetadata | null =>
      track
        ? new MediaMetadata({
            title: track.title,
            artist: track.artist ?? '',
            album: track.album ?? '',
            artwork: art ? [{ src: art }] : []
          })
        : null
    session.metadata = metadata(null)
    const art = track ? await artworkFor(track) : null
    // A newer song may have started while the cover loaded.
    if (shown !== track) {
      if (art) URL.revokeObjectURL(art)
      return
    }
    if (artwork) URL.revokeObjectURL(artwork)
    artwork = art
    if (art) session.metadata = metadata(art)
  }

  const reportPosition = (): void => {
    const { track, playing, position, duration } = player.getState()
    if (!track || duration <= 0) return
    const now = performance.now()
    const expected = reported.position + (reported.playing ? (now - reported.at) / 1000 : 0)
    const changed = track.id !== reported.trackId || playing !== reported.playing || duration !== reported.duration
    if (!changed && Math.abs(expected - position) < DRIFT_SECONDS) return
    reported = { trackId: track.id, playing, duration, position, at: now }
    try {
      session.setPositionState({ duration, position: Math.min(position, duration), playbackRate: 1 })
    } catch {
      // A length the overlay won't accept just means no progress bar there.
    }
  }

  const sync = (): void => {
    const { track, playing } = player.getState()
    // The library swaps in fresh copies of songs, so a change of song is a change of id or of what's shown.
    if (track?.id !== shown?.id || track?.title !== shown?.title || track?.artist !== shown?.artist || track?.artworkId !== shown?.artworkId) {
      shown = track
      void showSong(track)
    }
    session.playbackState = !track ? 'none' : playing ? 'playing' : 'paused'
    reportPosition()
  }

  const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => player.play()],
    ['pause', () => player.pause()],
    ['stop', () => player.pause()],
    ['nexttrack', () => player.next()],
    ['previoustrack', () => player.previous()],
    ['seekto', (details) => {
      if (details.seekTime !== undefined) player.seek(details.seekTime)
    }]
  ]
  for (const [action, handler] of actions) session.setActionHandler(action, handler)

  sync()
  const unsubscribe = player.subscribe(sync)
  return () => {
    unsubscribe()
    for (const [action] of actions) session.setActionHandler(action, null)
    session.metadata = null
    if (artwork) URL.revokeObjectURL(artwork)
  }
}
