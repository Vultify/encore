import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Artwork } from '../Artwork/Artwork'
import { MusicIcon, PlayIcon } from '../icons'
import styles from './CoverGrid.module.css'

export interface CoverItem {
  key: string
  title: string
  subtitle: string
  artworkId: string | null
  // Drawn instead of the artwork, for special tiles like Liked Songs.
  cover?: ReactNode
  // Whether the play button shows on hover. Off for tiles with nothing to play.
  playable?: boolean
  // Whether the tile can be dragged to a new spot, when the grid allows reordering.
  movable?: boolean
}

interface CoverGridProps {
  label: string
  items: CoverItem[]
  // Round covers for artists, square for albums and playlists.
  round?: boolean
  onOpen: (key: string) => void
  onPlay?: (key: string) => void
  // Called when a movable tile is dropped on another, with the side it landed on.
  onReorder?: (fromKey: string, toKey: string, after: boolean) => void
}

// A grid of covers. Clicking a cover opens it, and the play button on hover plays it straight away.
export function CoverGrid({ label, items, round = false, onOpen, onPlay, onReorder }: CoverGridProps) {
  const dragKey = useRef<string | null>(null)
  const [dropAt, setDropAt] = useState<{ key: string; after: boolean } | null>(null)

  const dragOver = (event: DragEvent, item: CoverItem): void => {
    if (!dragKey.current || !item.movable) return
    event.preventDefault()
    const box = event.currentTarget.getBoundingClientRect()
    setDropAt({ key: item.key, after: event.clientX > box.left + box.width / 2 })
  }

  const finishDrag = (): void => {
    dragKey.current = null
    setDropAt(null)
  }

  return (
    <ul className={styles.grid} aria-label={label} data-round={round}>
      {items.map((item) => {
        const movable = Boolean(onReorder && item.movable)
        return (
          <li
            key={item.key}
            className={styles.item}
            data-drop={dropAt?.key === item.key ? (dropAt.after ? 'after' : 'before') : undefined}
            draggable={movable}
            onDragStart={(event) => {
              dragKey.current = item.key
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', item.title)
            }}
            onDragOver={(event) => dragOver(event, item)}
            onDrop={(event) => {
              event.preventDefault()
              if (dragKey.current && dropAt && dragKey.current !== dropAt.key) onReorder?.(dragKey.current, dropAt.key, dropAt.after)
              finishDrag()
            }}
            onDragEnd={finishDrag}
          >
            <button className={styles.open} onClick={() => onOpen(item.key)}>
              <span className={styles.cover}>
                {item.cover ??
                  (item.artworkId ? (
                    <Artwork id={item.artworkId} lazy />
                  ) : (
                    <MusicIcon size={28} />
                  ))}
              </span>
              <span className={styles.text}>
                <span className={styles.title}>{item.title}</span>
                <span className={styles.subtitle}>{item.subtitle}</span>
              </span>
            </button>
            {onPlay && item.playable !== false && (
              <button className={styles.play} aria-label={`Play ${item.title}`} onClick={() => onPlay(item.key)}>
                <PlayIcon size={18} />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
