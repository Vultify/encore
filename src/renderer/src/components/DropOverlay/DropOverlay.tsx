import { UploadIcon } from '../icons'
import styles from './DropOverlay.module.css'

// Covers the window while files are dragged over it, so it's clear the drop will land anywhere.
export function DropOverlay({ visible }: { visible: boolean }) {
  return (
    <div className={styles.overlay} data-visible={visible} aria-hidden={!visible}>
      <div className={styles.card} role="status">
        <span className={styles.icon}>
          <UploadIcon size={30} />
        </span>
        <p className={styles.title}>Drop to add to your library</p>
        <p className={styles.text}>Songs or whole folders. MP3, FLAC, WAV, and M4A.</p>
      </div>
    </div>
  )
}
