import { useRef, useState, type ReactNode } from 'react'
import { PLAYLIST_NAME_MAX } from '@shared/api'
import { Artwork } from '../Artwork/Artwork'
import { BackIcon, MusicIcon, PlayIcon } from '../icons'
import styles from './CollectionHeader.module.css'

interface CollectionHeaderProps {
  kind: string
  title: string
  details: string
  artworkId: string | null
  // Drawn instead of the artwork, for special collections like Liked Songs.
  cover?: ReactNode
  round?: boolean
  backLabel: string
  onBack: () => void
  onPlay: () => void
  canPlay?: boolean
  // Extra buttons beside Play, like rename and delete.
  actions?: ReactNode
  // While renaming, the title becomes a text box. Enter or clicking away saves, Escape cancels.
  renaming?: boolean
  onRename?: (name: string | null) => void
}

// The top of an album, artist, or playlist page: back button, cover, name, details, and Play.
export function CollectionHeader(props: CollectionHeaderProps) {
  const { kind, title, details, artworkId, cover, round = false, backLabel, onBack, onPlay, canPlay = true, actions, renaming, onRename } = props

  return (
    <div className={styles.header}>
      <button className={styles.back} onClick={onBack}>
        <BackIcon size={16} />
        {backLabel}
      </button>
      <div className={styles.body}>
        <span className={styles.cover} data-round={round}>
          {cover ?? (artworkId ? <Artwork id={artworkId} /> : <MusicIcon size={34} />)}
        </span>
        <div className={styles.info}>
          <span className={styles.kind}>{kind}</span>
          {renaming && onRename ? <NameField initial={title} onDone={onRename} /> : <h2 className={styles.title}>{title}</h2>}
          <span className={styles.details}>{details}</span>
        </div>
        <div className={styles.actions}>
          {actions}
          <button className={styles.play} onClick={onPlay} disabled={!canPlay}>
            <PlayIcon size={16} />
            Play
          </button>
        </div>
      </div>
    </div>
  )
}

function NameField({ initial, onDone }: { initial: string; onDone: (name: string | null) => void }) {
  const [value, setValue] = useState(initial)
  // Escape cancels, and the blur that follows must not save anyway.
  const finished = useRef(false)
  const finish = (name: string | null): void => {
    if (finished.current) return
    finished.current = true
    onDone(name)
  }

  return (
    <input
      className={styles.nameField}
      aria-label="Playlist name"
      value={value}
      maxLength={PLAYLIST_NAME_MAX}
      autoFocus
      onFocus={(event) => event.target.select()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') finish(null)
      }}
    />
  )
}

// A round icon button for the header's action row.
export function HeaderAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button className={styles.actionButton} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}
