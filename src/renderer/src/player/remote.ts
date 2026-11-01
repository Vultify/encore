import type { NowPlaying, PlayerCommand } from '@shared/api'
import { player } from './player'

// The mini player runs its progress line on from the last report, so the position is only sent again when it
// drifts from that by more than this.
const DRIFT_SECONDS = 1

const COMMANDS: Record<PlayerCommand, () => void> = {
  toggle: () => player.toggle(),
  next: () => player.next(),
  previous: () => player.previous()
}

// Tells the tray and the mini player what's playing whenever that changes, and carries out the presses that come
// back from them.
export function connectRemote(): () => void {
  let reported: NowPlaying | null = null
  let reportedAt = 0

  const report = (): void => {
    const { track, playing, hasNext, position, duration } = player.getState()
    const now: NowPlaying = {
      trackId: track?.id ?? null,
      title: track?.title ?? '',
      artist: track?.artist ?? null,
      artworkId: track?.artworkId ?? null,
      playing,
      hasNext,
      position: track ? position : 0,
      duration: track ? duration : 0
    }
    // The player changes several times a second while it plays, but this summary rarely does.
    if (reported) {
      const expected = reported.position + (reported.playing ? (performance.now() - reportedAt) / 1000 : 0)
      const same = (Object.keys(now) as (keyof NowPlaying)[]).every((key) => key === 'position' || now[key] === reported![key])
      if (same && Math.abs(expected - now.position) < DRIFT_SECONDS) return
    }
    reported = now
    reportedAt = performance.now()
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
