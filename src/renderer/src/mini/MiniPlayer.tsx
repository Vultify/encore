import { useEffect, useState } from 'react'
import { artworkUrl, type NowPlaying, type PlayerCommand } from '@shared/api'
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon } from '@/components/icons'
import { useAccentColor } from '@/hooks/useAccentColor'
import styles from './MiniPlayer.module.css'

// How often the progress line moves along while a song plays.
const TICK_MS = 250

interface Report {
  now: NowPlaying | null
  at: number
}

// Where the song is now, running on from the last report while it plays.
function elapsed({ now, at }: Report): number {
  if (!now) return 0
  const position = now.playing ? now.position + (performance.now() - at) / 1000 : now.position
  return Math.min(position, now.duration)
}

const send = (command: PlayerCommand): void => window.encore.mini.send(command)

// The floating pill: the song, previous, play or pause, next, and a thin progress line. It only shows what the main
// window's player is doing; every press goes back there. Clicking the song opens Encore.
export function MiniPlayer() {
  const [report, setReport] = useState<Report>({ now: null, at: 0 })
  const [, setTick] = useState(0)
  // Goes up each time the window is shown, so the pill rises in again.
  const [shown, setShown] = useState(0)
  const { now } = report
  const song = now && now.trackId !== null ? now : null
  const progress = song && song.duration > 0 ? elapsed(report) / song.duration : 0

  useAccentColor(song?.artworkId ?? null)

  useEffect(() => {
    let heard = false
    const take = (next: NowPlaying | null): void => {
      heard = true
      setReport({ now: next, at: performance.now() })
    }
    // A change that arrives first is newer than the starting snapshot, so the snapshot is dropped then.
    window.encore.mini.current().then((first) => {
      if (!heard) setReport({ now: first, at: performance.now() })
    })
    return window.encore.mini.onNowPlaying(take)
  }, [])

  useEffect(() => {
    if (!song?.playing) return
    const timer = window.setInterval(() => setTick((tick) => tick + 1), TICK_MS)
    return () => window.clearInterval(timer)
  }, [song?.playing])

  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') setShown((count) => count + 1)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <div className={styles.stage}>
      <div
        key={shown}
        className={styles.pill}
        role="region"
        aria-label="Mini player"
        onMouseEnter={() => window.encore.mini.setInteractive(true)}
        onMouseLeave={() => window.encore.mini.setInteractive(false)}
      >
        <button className={styles.song} aria-label="Open Encore" title="Open Encore" onClick={() => window.encore.mini.openEncore()}>
          <span className={styles.cover} aria-hidden="true">
            {song?.artworkId ? <img src={artworkUrl(song.artworkId)} alt="" draggable={false} /> : <span className={styles.coverRing} />}
          </span>
          <span className={styles.meta}>
            <span className={styles.title}>{song ? song.title : 'Not playing'}</span>
            <span className={styles.artist}>{song ? (song.artist ?? 'Unknown artist') : 'Pick a song in Encore'}</span>
          </span>
        </button>

        <button className={styles.iconButton} aria-label="Previous song" disabled={!song} onClick={() => send('previous')}>
          <PreviousIcon size={19} />
        </button>
        <button className={styles.play} aria-label={song?.playing ? 'Pause' : 'Play'} disabled={!song} onClick={() => send('toggle')}>
          {song?.playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>
        <button className={styles.iconButton} aria-label="Next song" disabled={!song?.hasNext} onClick={() => send('next')}>
          <NextIcon size={19} />
        </button>

        <span className={styles.progress} style={{ width: `${progress * 100}%` }} aria-hidden="true" />
      </div>
    </div>
  )
}
