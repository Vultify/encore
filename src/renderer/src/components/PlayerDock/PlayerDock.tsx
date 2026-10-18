import type { CSSProperties } from 'react'
import { artworkUrl } from '@shared/api'
import { player, usePlayer } from '@/player/player'
import { formatDuration } from '@/lib/format'
import { library, useLibrary } from '@/store/library'
import {
  HeartIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PopOutIcon,
  PreviousIcon,
  RepeatIcon,
  ShuffleIcon,
  VolumeIcon,
  VolumeMutedIcon
} from '../icons'
import styles from './PlayerDock.module.css'

// The floating glass pill at the bottom center. Controls wake up once a song is loaded.
export function PlayerDock() {
  const { track, playing, position, duration, volume, muted, queue, index } = usePlayer()
  const idle = !track
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0
  const level = muted ? 0 : volume
  // The player holds a copy of the song from when it started, so the liked state comes from the library.
  const { tracks } = useLibrary()
  const liked = Boolean(track && tracks.find((candidate) => candidate.id === track.id)?.likedAt)

  return (
    <div className={styles.dock} role="region" aria-label="Player">
      <span className={styles.cover} aria-hidden="true">
        {track?.artworkId ? <img src={artworkUrl(track.artworkId)} alt="" draggable={false} /> : <span className={styles.coverRing} />}
      </span>

      <span className={styles.meta}>
        <span className={styles.title}>{track?.title ?? 'Not playing'}</span>
        <span className={styles.artist}>{track ? (track.artist ?? 'Unknown artist') : 'Pick a song to start'}</span>
      </span>

      <button
        className={`${styles.iconButton} ${styles.like}`}
        aria-label={liked ? 'Remove from Liked Songs' : 'Like'}
        aria-pressed={liked}
        disabled={idle}
        onClick={() => track && library.setLiked([track.id], !liked)}
      >
        <HeartIcon size={18} filled={liked} />
      </button>

      <div className={styles.controls}>
        {/* Shuffle and repeat arrive with the playback experience phase. */}
        <button className={styles.iconButton} aria-label="Shuffle" disabled>
          <ShuffleIcon size={18} />
        </button>
        <button className={styles.iconButton} aria-label="Previous song" disabled={idle} onClick={() => player.previous()}>
          <PreviousIcon size={19} />
        </button>
        <button className={styles.play} aria-label={playing ? 'Pause' : 'Play'} disabled={idle} onClick={() => player.toggle()}>
          {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>
        <button
          className={styles.iconButton}
          aria-label="Next song"
          disabled={idle || index >= queue.length - 1}
          onClick={() => player.next()}
        >
          <NextIcon size={19} />
        </button>
        <button className={styles.iconButton} aria-label="Repeat" disabled>
          <RepeatIcon size={18} />
        </button>
      </div>

      <span className={styles.time}>
        {formatDuration(idle ? 0 : position)} / {formatDuration(idle ? 0 : duration)}
      </span>

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

      {/* The mini player arrives with the desktop integration phase. */}
      <button className={styles.iconButton} aria-label="Pop out to mini player" title="Pop out (Ctrl + Alt + Space)" disabled>
        <PopOutIcon size={18} />
      </button>

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
    </div>
  )
}
