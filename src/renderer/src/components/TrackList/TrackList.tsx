import { useEffect } from 'react'
import { artworkUrl, type Track } from '@shared/api'
import { player, usePlayer } from '@/player/player'
import { formatDuration } from '@/lib/format'
import { UNKNOWN_ARTIST } from '@/lib/library'
import { MusicIcon, PauseIcon, PlayIcon } from '../icons'
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
}

export function TrackList({ label, tracks, queueSource, numbered = false, contained = true }: TrackListProps) {
  const { track: current, playing } = usePlayer()

  // Playing a song queues up the rest of the list after it.
  const play = (index: number): void => player.playQueue(tracks, index, queueSource)
  useEffect(() => player.syncQueue(queueSource, tracks), [queueSource, tracks])

  const classes = [styles.list, contained && styles.contained, numbered && styles.numbered].filter(Boolean).join(' ')

  return (
    <ul className={classes} aria-label={label}>
      {tracks.map((track, index) => {
        const isCurrent = track.id === current?.id
        return (
          <li
            key={track.id}
            className={styles.row}
            title={track.path}
            aria-current={isCurrent || undefined}
            onDoubleClick={() => play(index)}
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
            <span className={styles.format}>{track.format}</span>
            <span className={styles.time}>{formatDuration(track.duration)}</span>
          </li>
        )
      })}
    </ul>
  )
}
