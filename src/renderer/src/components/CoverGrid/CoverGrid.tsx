import { artworkUrl } from '@shared/api'
import { MusicIcon, PlayIcon } from '../icons'
import styles from './CoverGrid.module.css'

export interface CoverItem {
  key: string
  title: string
  subtitle: string
  artworkId: string | null
}

interface CoverGridProps {
  label: string
  items: CoverItem[]
  // Round covers for artists, square for albums and playlists.
  round?: boolean
  onOpen: (key: string) => void
  onPlay: (key: string) => void
}

// A grid of covers. Clicking a cover opens it, and the play button on hover plays it straight away.
export function CoverGrid({ label, items, round = false, onOpen, onPlay }: CoverGridProps) {
  return (
    <ul className={styles.grid} aria-label={label} data-round={round}>
      {items.map((item) => (
        <li key={item.key} className={styles.item}>
          <button className={styles.open} onClick={() => onOpen(item.key)}>
            <span className={styles.cover}>
              {item.artworkId ? (
                <img src={artworkUrl(item.artworkId)} alt="" loading="lazy" draggable={false} />
              ) : (
                <MusicIcon size={28} />
              )}
            </span>
            <span className={styles.text}>
              <span className={styles.title}>{item.title}</span>
              <span className={styles.subtitle}>{item.subtitle}</span>
            </span>
          </button>
          <button className={styles.play} aria-label={`Play ${item.title}`} onClick={() => onPlay(item.key)}>
            <PlayIcon size={18} />
          </button>
        </li>
      ))}
    </ul>
  )
}
