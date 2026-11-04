import { artworkUrl } from '@shared/api'
import styles from './Artwork.module.css'

interface ArtworkProps {
  id: string
  alt?: string
  // For long lists, so covers far down the list load only when scrolled to.
  lazy?: boolean
  className?: string
}

// A saved cover that fades in once it has loaded instead of popping in. A new cover starts faded out again.
export function Artwork({ id, alt = '', lazy = false, className }: ArtworkProps) {
  return (
    <img
      key={id}
      className={className ? `${styles.art} ${className}` : styles.art}
      src={artworkUrl(id)}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      draggable={false}
      onLoad={(event) => {
        event.currentTarget.dataset.loaded = 'true'
      }}
    />
  )
}
