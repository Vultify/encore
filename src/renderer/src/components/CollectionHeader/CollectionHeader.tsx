import { artworkUrl } from '@shared/api'
import { BackIcon, MusicIcon, PlayIcon } from '../icons'
import styles from './CollectionHeader.module.css'

interface CollectionHeaderProps {
  kind: string
  title: string
  details: string
  artworkId: string | null
  round?: boolean
  backLabel: string
  onBack: () => void
  onPlay: () => void
}

// The top of an album or artist page: back button, cover, name, details, and Play.
export function CollectionHeader({ kind, title, details, artworkId, round = false, backLabel, onBack, onPlay }: CollectionHeaderProps) {
  return (
    <div className={styles.header}>
      <button className={styles.back} onClick={onBack}>
        <BackIcon size={16} />
        {backLabel}
      </button>
      <div className={styles.body}>
        <span className={styles.cover} data-round={round}>
          {artworkId ? <img src={artworkUrl(artworkId)} alt="" draggable={false} /> : <MusicIcon size={34} />}
        </span>
        <div className={styles.info}>
          <span className={styles.kind}>{kind}</span>
          <h2 className={styles.title}>{title}</h2>
          <span className={styles.details}>{details}</span>
        </div>
        <button className={styles.play} onClick={onPlay}>
          <PlayIcon size={16} />
          Play
        </button>
      </div>
    </div>
  )
}
