import type { NowPlaying, PlayerCommand } from '@shared/api'
import { player } from './player'

const COMMANDS: Record<PlayerCommand, () => void> = {
  toggle: () => player.toggle(),
  next: () => player.next(),
  previous: () => player.previous()
}

// Tells the tray what's playing whenever that changes, and carries out the presses that come back from it.
export function connectRemote(): () => void {
  let reported = ''
  const report = (): void => {
    const { track, playing, hasNext } = player.getState()
    const now: NowPlaying = {
      trackId: track?.id ?? null,
      title: track?.title ?? '',
      artist: track?.artist ?? null,
      artworkId: track?.artworkId ?? null,
      playing,
      hasNext
    }
    // The player changes several times a second while it plays, but this summary rarely does.
    const key = JSON.stringify(now)
    if (key === reported) return
    reported = key
    window.encore.remote.report(now)
  }

  report()
  const stopReporting = player.subscribe(report)
  const stopListening = window.encore.remote.onCommand((command) => COMMANDS[command]?.())
  return () => {
    stopReporting()
    stopListening()
  }
}
