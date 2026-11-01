import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { artworkUrl, type Track } from '@shared/api'
import { player, usePlayer } from '@/player/player'
import { library, useLibrary } from '@/store/library'
import { notify } from '@/store/notice'
import { formatDuration } from '@/lib/format'
import { UNKNOWN_ARTIST } from '@/lib/library'
import { nextPlaylistName } from '@/lib/playlists'
import { ContextMenu, type MenuEntry } from '../ContextMenu/ContextMenu'
import { ConfirmDialog, NameDialog } from '../Dialog/Dialog'
import { HeartIcon, MoreIcon, MusicIcon, PauseIcon, PlayIcon, PlusIcon, TrashIcon } from '../icons'
import styles from './TrackList.module.css'

interface TrackListProps {
  label: string
  tracks: Track[]
  // Names the list the queue comes from, so the queue follows it when songs are added or changed.
  queueSource: string
  // Shows track numbers instead of covers, for album pages.
  numbered?: boolean
  // Scrolls inside its own space. Turn off when the page around it scrolls instead.
  contained?: boolean
  // On a playlist page: the playlist, and each row's entry id, so songs can be removed or dragged into a new order.
  playlistId?: number
  entryIds?: number[]
  onMove?: (from: number, to: number) => void
}

interface OpenMenu {
  x: number
  y: number
  index: number
}

export function TrackList({ label, tracks, queueSource, numbered = false, contained = true, playlistId, entryIds, onMove }: TrackListProps) {
  const { track: current, playing } = usePlayer()
  const { playlists, missing } = useLibrary()
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  // The song waiting for a new playlist, while its name is being typed.
  const [naming, setNaming] = useState<Track | null>(null)
  const closeNaming = useCallback(() => setNaming(null), [])
  // The song waiting for a yes before it leaves the library.
  const [removing, setRemoving] = useState<Track | null>(null)
  const closeRemoving = useCallback(() => setRemoving(null), [])

  // Playing a song queues up the rest of the list after it. A song whose file is gone explains why instead.
  const play = (index: number): void => {
    const track = tracks[index]
    if (missing.has(track.id)) {
      notify(`Can't find the file for ${track.title}. It may have been moved or deleted.`)
      return
    }
    player.playQueue(tracks, index, queueSource)
  }

  const remove = async (track: Track): Promise<void> => {
    setRemoving(null)
    await library.removeTracks([track.id])
    player.forget([track.id])
    notify(`Removed ${track.title} from your library`)
  }
  useEffect(() => player.syncQueue(queueSource, tracks), [queueSource, tracks])

  // Drag to reorder: remembers the row being dragged and where it would land.
  const dragFrom = useRef<number | null>(null)
  const [dropAt, setDropAt] = useState<{ index: number; after: boolean } | null>(null)

  const dragOver = (event: DragEvent, index: number): void => {
    if (dragFrom.current === null) return
    event.preventDefault()
    const box = event.currentTarget.getBoundingClientRect()
    setDropAt({ index, after: event.clientY > box.top + box.height / 2 })
  }

  const drop = (event: DragEvent): void => {
    event.preventDefault()
    const from = dragFrom.current
    if (from !== null && dropAt && onMove) {
      let to = dropAt.index + (dropAt.after ? 1 : 0)
      if (from < to) to -= 1
      if (to !== from) onMove(from, to)
    }
    dragFrom.current = null
    setDropAt(null)
  }

  const addTo = async (target: { id: number; name: string }, track: Track): Promise<void> => {
    const playlist = playlists.find((candidate) => candidate.id === target.id)
    if (playlist?.entries.some((entry) => entry.trackId === track.id)) {
      notify(`Already in ${target.name}`)
      return
    }
    await library.addToPlaylist(target.id, [track.id])
    notify(`Added to ${target.name}`)
  }

  const menuEntries = (index: number): MenuEntry[] => {
    const track = tracks[index]
    const liked = track.likedAt !== null
    const entryId = entryIds?.[index]
    return [
      {
        label: liked ? 'Remove from Liked Songs' : 'Like',
        icon: <HeartIcon size={16} filled={liked} />,
        onSelect: () => library.setLiked([track.id], !liked)
      },
      { separator: true },
      { heading: 'Add to playlist' },
      {
        label: 'New playlist',
        icon: <PlusIcon size={16} />,
        onSelect: () => setNaming(track)
      },
      ...playlists
        .filter((playlist) => playlist.id !== playlistId)
        .map((playlist): MenuEntry => ({ label: playlist.name, onSelect: () => addTo(playlist, track) })),
      ...(playlistId !== undefined && entryId !== undefined
        ? [
            { separator: true } as const,
            {
              label: 'Remove from this playlist',
              icon: <TrashIcon size={16} />,
              danger: true,
              onSelect: () => library.removeFromPlaylist(playlistId, [entryId])
            }
          ]
        : []),
      { separator: true },
      {
        label: 'Remove from library',
        icon: <TrashIcon size={16} />,
        danger: true,
        onSelect: () => setRemoving(track)
      }
    ]
  }

  const classes = [styles.list, contained && styles.contained, numbered && styles.numbered].filter(Boolean).join(' ')

  return (
    <>
      <ul className={classes} aria-label={label} onDragLeave={(event) => event.currentTarget === event.target && setDropAt(null)}>
        {tracks.map((track, index) => {
          const isCurrent = track.id === current?.id
          const isLiked = track.likedAt !== null
          const isMissing = missing.has(track.id)
          return (
            <li
              key={entryIds?.[index] ?? track.id}
              className={styles.row}
              title={track.path}
              aria-current={isCurrent || undefined}
              data-missing={isMissing || undefined}
              data-drop={dropAt?.index === index ? (dropAt.after ? 'after' : 'before') : undefined}
              draggable={Boolean(onMove)}
              onDragStart={(event) => {
                dragFrom.current = index
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', track.title)
              }}
              onDragOver={(event) => dragOver(event, index)}
              onDrop={drop}
              onDragEnd={() => {
                dragFrom.current = null
                setDropAt(null)
              }}
              onDoubleClick={() => play(index)}
              onContextMenu={(event) => {
                event.preventDefault()
                setMenu({ x: event.clientX, y: event.clientY, index })
              }}
            >
              <span className={styles.art}>
                {numbered ? (
                  <span className={styles.number}>{track.trackNumber ?? index + 1}</span>
                ) : track.artworkId ? (
                  <img src={artworkUrl(track.artworkId)} alt="" loading="lazy" draggable={false} />
                ) : (
                  <MusicIcon size={16} />
                )}
                <button
                  className={styles.play}
                  aria-label={isCurrent && playing ? `Pause ${track.title}` : `Play ${track.title}`}
                  onClick={() => (isCurrent ? player.toggle() : play(index))}
                  onDoubleClick={(event) => event.stopPropagation()}
                >
                  {isCurrent && playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
                </button>
              </span>
              <span className={styles.text}>
                <span className={styles.title}>{track.title}</span>
                <span className={styles.sub}>
                  {numbered ? (track.artist ?? UNKNOWN_ARTIST) : [track.artist ?? UNKNOWN_ARTIST, track.album].filter(Boolean).join(' · ')}
                </span>
              </span>
              {isLiked && (
                <span className={styles.liked} aria-label="Liked" role="img">
                  <HeartIcon size={15} filled />
                </span>
              )}
              <button
                className={styles.more}
                aria-label={`More options for ${track.title}`}
                aria-haspopup="menu"
                aria-expanded={menu?.index === index}
                onClick={(event) => {
                  const box = event.currentTarget.getBoundingClientRect()
                  setMenu({ x: box.left, y: box.bottom + 4, index })
                }}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <MoreIcon size={18} />
              </button>
              {isMissing ? (
                <span className={styles.missing}>File not found</span>
              ) : (
                <span className={styles.format}>{track.format}</span>
              )}
              <span className={styles.time}>{formatDuration(track.duration)}</span>
            </li>
          )
        })}
      </ul>
      {menu && tracks[menu.index] && (
        <ContextMenu
          label={`${tracks[menu.index].title} options`}
          x={menu.x}
          y={menu.y}
          entries={menuEntries(menu.index)}
          onClose={closeMenu}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.title} from your library?`}
          message="It comes out of Encore, your playlists, and Liked Songs. The file stays on your computer, and you can add it back any time."
          confirmLabel="Remove"
          onConfirm={() => remove(removing)}
          onCancel={closeRemoving}
        />
      )}
      {naming && (
        <NameDialog
          title="New playlist"
          initial={nextPlaylistName(playlists)}
          confirmLabel="Create"
          onCancel={closeNaming}
          onConfirm={async (name) => {
            const track = naming
            setNaming(null)
            const created = await library.createPlaylist(name, [track.id])
            notify(`Added to ${created.name}`)
          }}
        />
      )}
    </>
  )
}
