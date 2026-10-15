import { NextIcon, PlayIcon, PopOutIcon, PreviousIcon, RepeatIcon, ShuffleIcon, VolumeIcon } from '../icons'
import styles from './PlayerDock.module.css'

// The floating glass pill at the bottom center. It's disabled until there's music to play.
export function PlayerDock() {
  const idle = true

  return (
    <div className={styles.dock} role="region" aria-label="Player">
      <span className={styles.cover} aria-hidden="true">
        <span className={styles.coverRing} />
      </span>

      <span className={styles.meta}>
        <span className={styles.title}>Not playing</span>
        <span className={styles.artist}>Pick a song to start</span>
      </span>

      <div className={styles.controls}>
        <button className={styles.iconButton} aria-label="Shuffle" disabled={idle}>
          <ShuffleIcon size={18} />
        </button>
        <button className={styles.iconButton} aria-label="Previous song" disabled={idle}>
          <PreviousIcon size={19} />
        </button>
        <button className={styles.play} aria-label="Play" disabled={idle}>
          <PlayIcon size={20} />
        </button>
        <button className={styles.iconButton} aria-label="Next song" disabled={idle}>
          <NextIcon size={19} />
        </button>
        <button className={styles.iconButton} aria-label="Repeat" disabled={idle}>
          <RepeatIcon size={18} />
        </button>
      </div>

      <span className={styles.time}>0:00 / 0:00</span>

      <button className={styles.iconButton} aria-label="Volume" disabled={idle}>
        <VolumeIcon size={18} />
      </button>
      <button className={styles.iconButton} aria-label="Pop out to mini player" title="Pop out (Ctrl + Alt + Space)" disabled={idle}>
        <PopOutIcon size={18} />
      </button>

      <span className={styles.progress} style={{ width: '0%' }} aria-hidden="true" />
    </div>
  )
}
