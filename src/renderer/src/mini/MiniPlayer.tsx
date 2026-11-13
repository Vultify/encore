import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { artworkUrl, type NowPlaying, type PlayerCommand } from '@shared/api'
import { Marquee } from '@/components/Marquee/Marquee'
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon, VolumeIcon, VolumeMutedIcon } from '@/components/icons'
import { useAccentColor } from '@/hooks/useAccentColor'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import styles from './MiniPlayer.module.css'

// How often the progress line moves along while a song plays.
const TICK_MS = 250
// How much one turn of the mouse wheel moves the volume.
const WHEEL_STEP = 0.05

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

const setInteractive = (interactive: boolean): void => window.encore.mini.setInteractive(interactive)

// The floating pill: the song, previous, play or pause, next, volume, and a thin progress line. It only shows what
// the main window's player is doing; every press goes back there. Clicking the song opens Encore.
export function MiniPlayer() {
  const [report, setReport] = useState<Report>({ now: null, at: 0 })
  const [, setTick] = useState(0)
  // Goes up each time the window is shown, so the pill rises in again.
  const [shown, setShown] = useState(0)
  // While the volume slider is being dragged, it follows the pointer rather than waiting for the player to answer.
  const [held, setHeld] = useState<number | null>(null)
  // With motion off, a long name scrolls only while the pointer is on the pill.
  const [hovered, setHovered] = useState(false)
  const pointerOver = useRef(false)
  const dragging = useRef(false)
  const { now } = report
  const song = now && now.trackId !== null ? now : null
  const progress = song && song.duration > 0 ? elapsed(report) / song.duration : 0
  const level = held ?? (now && !now.muted ? now.volume : 0)

  useAccentColor(song?.artworkId ?? null)
  useReducedMotion()

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

  // A drag can wander off the pill, so clicks only start passing through again once the button is let go.
  const startDrag = (): void => {
    dragging.current = true
    window.addEventListener(
      'pointerup',
      () => {
        dragging.current = false
        setHeld(null)
        if (!pointerOver.current) setInteractive(false)
      },
      { once: true }
    )
  }

  const setVolume = (volume: number): void => {
    const rounded = Math.round(Math.min(1, Math.max(0, volume)) * 100) / 100
    if (dragging.current) setHeld(rounded)
    send({ volume: rounded })
  }

  return (
    <div className={styles.stage}>
      <div
        key={shown}
        className={styles.pill}
        role="region"
        aria-label="Mini player"
        onMouseEnter={() => {
          pointerOver.current = true
          setHovered(true)
          setInteractive(true)
        }}
        onMouseLeave={() => {
          pointerOver.current = false
          setHovered(false)
          if (!dragging.current) setInteractive(false)
        }}
      >
        <button className={styles.song} aria-label="Open Encore" title="Open Encore" onClick={() => window.encore.mini.openEncore()}>
          <span className={styles.cover} aria-hidden="true">
            {song?.artworkId ? <img src={artworkUrl(song.artworkId)} alt="" draggable={false} /> : <span className={styles.coverRing} />}
          </span>
          <span className={styles.meta}>
            <Marquee className={styles.title} text={song ? song.title : 'Not playing'} play={hovered} />
            <Marquee className={styles.artist} text={song ? (song.artist ?? 'Unknown artist') : 'Pick a song in Encore'} play={hovered} />
          </span>
        </button>

        <div className={styles.controls}>
          <button className={styles.iconButton} aria-label="Previous song" disabled={!song} onClick={() => send('previous')}>
            <PreviousIcon size={19} />
          </button>
          <button className={styles.play} aria-label={song?.playing ? 'Pause' : 'Play'} disabled={!song} onClick={() => send('toggle')}>
            {song?.playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
          </button>
          <button className={styles.iconButton} aria-label="Next song" disabled={!song?.hasNext} onClick={() => send('next')}>
            <NextIcon size={19} />
          </button>
        </div>

        <div className={styles.volume} onWheel={(event) => now && setVolume(level - Math.sign(event.deltaY) * WHEEL_STEP)}>
          <button className={styles.mute} aria-label={now?.muted ? 'Unmute' : 'Mute'} disabled={!now} onClick={() => send('toggleMute')}>
            {level === 0 ? <VolumeMutedIcon size={17} /> : <VolumeIcon size={17} />}
          </button>
          <input
            type="range"
            className={styles.volumeSlider}
            aria-label="Volume"
            min={0}
            max={1}
            step={0.01}
            value={level}
            disabled={!now}
            style={{ '--fill': `${level * 100}%` } as CSSProperties}
            onPointerDown={startDrag}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>

        <span className={styles.progress} style={{ width: `${progress * 100}%` }} aria-hidden="true" />
      </div>
    </div>
  )
}
