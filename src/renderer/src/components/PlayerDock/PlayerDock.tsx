import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { Artwork } from '../Artwork/Artwork'
import { EqualizerPanel } from '../Equalizer/EqualizerPanel'
import { player, usePlayer, type RepeatMode } from '@/player/player'
import { formatDuration } from '@/lib/format'
import { library } from '@/store/library'
import {
  EqualizerIcon,
  HeartIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PopOutIcon,
  PreviousIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  VolumeIcon,
  VolumeMutedIcon
} from '../icons'
import styles from './PlayerDock.module.css'

const REPEAT_LABELS: Record<RepeatMode, string> = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' }

interface PlayerDockProps {
  // In the Now Playing view the big screen shows the song and its progress, so the dock slims down to controls.
  compact: boolean
  onOpenNowPlaying: () => void
}

// The floating glass pill at the bottom center. Controls wake up once a song is loaded.
export function PlayerDock({ compact, onOpenNowPlaying }: PlayerDockProps) {
  const { track, playing, position, duration, volume, muted, hasNext, shuffle, repeat, equalizer } = usePlayer()
  const [equalizerOpen, setEqualizerOpen] = useState(false)
  const equalizerButton = useRef<HTMLButtonElement>(null)
  const closeEqualizer = useCallback(() => setEqualizerOpen(false), [])
  const idle = !track
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0
  const level = muted ? 0 : volume
  const liked = Boolean(track?.likedAt)

  return (
    <>
      {equalizerOpen && <EqualizerPanel id="equalizer" toggle={equalizerButton} onClose={closeEqualizer} />}
      <div className={styles.dock} role="region" aria-label="Player" data-compact={compact || undefined}>
        {!compact && (
          <button className={styles.nowPlaying} aria-label="Open Now Playing" disabled={idle} onClick={onOpenNowPlaying}>
            <span className={styles.cover} aria-hidden="true">
              {track?.artworkId ? <Artwork id={track.artworkId} /> : <span className={styles.coverRing} />}
            </span>
            <span className={styles.meta}>
              <span className={styles.title}>{track?.title ?? 'Not playing'}</span>
              <span className={styles.artist}>{track ? (track.artist ?? 'Unknown artist') : 'Pick a song to start'}</span>
            </span>
          </button>
        )}

        <button
          className={`${styles.iconButton} ${styles.toggle}`}
          aria-label={liked ? 'Remove from Liked Songs' : 'Like'}
          aria-pressed={liked}
          disabled={idle}
          onClick={() => track && library.setLiked([track.id], !liked)}
        >
          <HeartIcon size={18} filled={liked} />
        </button>

        <div className={styles.controls}>
          <button
            className={`${styles.iconButton} ${styles.toggle}`}
            aria-label="Shuffle"
            aria-pressed={shuffle}
            disabled={idle}
            onClick={() => player.toggleShuffle()}
          >
            <ShuffleIcon size={18} />
          </button>
          <button className={styles.iconButton} aria-label="Previous song" disabled={idle} onClick={() => player.previous()}>
            <PreviousIcon size={19} />
          </button>
          <button className={styles.play} aria-label={playing ? 'Pause' : 'Play'} disabled={idle} onClick={() => player.toggle()}>
            {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
          </button>
          <button className={styles.iconButton} aria-label="Next song" disabled={!hasNext} onClick={() => player.next()}>
            <NextIcon size={19} />
          </button>
          <button
            className={`${styles.iconButton} ${styles.toggle}`}
            aria-label={REPEAT_LABELS[repeat]}
            aria-pressed={repeat !== 'off'}
            title="Repeat: off, all, or one"
            disabled={idle}
            onClick={() => player.cycleRepeat()}
          >
            {repeat === 'one' ? <RepeatOneIcon size={18} /> : <RepeatIcon size={18} />}
          </button>
        </div>

        {!compact && (
          <span className={styles.time}>
            {formatDuration(idle ? 0 : position)} / {formatDuration(idle ? 0 : duration)}
          </span>
        )}

        <button
          ref={equalizerButton}
          className={styles.iconButton}
          aria-label="Equalizer"
          aria-expanded={equalizerOpen}
          aria-controls={equalizerOpen ? 'equalizer' : undefined}
          title={equalizer.enabled ? 'Equalizer (on)' : 'Equalizer'}
          data-on={equalizer.enabled || undefined}
          onClick={() => setEqualizerOpen(!equalizerOpen)}
        >
          <EqualizerIcon size={18} />
        </button>

        <div className={styles.volume}>
          <button
            className={styles.iconButton}
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={() => player.toggleMute()}
            onWheel={(event) => player.setVolume(volume - Math.sign(event.deltaY) * 0.05)}
          >
            {level === 0 ? <VolumeMutedIcon size={18} /> : <VolumeIcon size={18} />}
          </button>
          <div className={styles.volumePopover}>
            <input
              type="range"
              className={styles.volumeSlider}
              aria-label="Volume"
              min={0}
              max={1}
              step={0.01}
              value={level}
              style={{ '--fill': `${level * 100}%` } as CSSProperties}
              onChange={(event) => player.setVolume(Number(event.target.value))}
            />
          </div>
        </div>

        <button
          className={styles.iconButton}
          aria-label="Pop out to mini player"
          title="Switch to the mini player"
          onClick={() => window.encore.window.popOut()}
        >
          <PopOutIcon size={18} />
        </button>

        {!compact && (
          <div className={styles.seekTrack} aria-hidden={idle}>
            <span className={styles.progress} style={{ width: `${progress * 100}%` }} />
            <input
              type="range"
              className={styles.seek}
              aria-label="Seek"
              aria-valuetext={`${formatDuration(position)} of ${formatDuration(duration)}`}
              min={0}
              max={duration || 0}
              step={0.1}
              value={idle ? 0 : position}
              disabled={idle}
              onChange={(event) => player.seek(Number(event.target.value))}
            />
          </div>
        )}
      </div>
    </>
  )
}
