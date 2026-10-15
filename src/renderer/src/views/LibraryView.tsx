import { useMemo } from 'react'
import { artworkUrl, type Track } from '@shared/api'
import { EmptyState, Panel } from '@/components/Panel/Panel'
import { MusicIcon, UploadIcon } from '@/components/icons'
import { formatDuration } from '@/lib/format'
import styles from './views.module.css'

export const LIBRARY_TABS = ['Playlists', 'Albums', 'Artists', 'Local files'] as const
export type LibraryTab = (typeof LIBRARY_TABS)[number]

interface LibraryViewProps {
  tab: LibraryTab
  onTabChange: (tab: LibraryTab) => void
  tracks: Track[]
}

export function LibraryView({ tab, onTabChange, tracks }: LibraryViewProps) {
  const header = (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Library sections">
        {LIBRARY_TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={styles.tab}
            onClick={() => onTabChange(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <span className={styles.hint}>
        <UploadIcon size={15} />
        Drop music files anywhere
      </span>
    </>
  )

  return (
    <Panel label="Library" header={header}>
      {tab === 'Local files' && tracks.length > 0 ? (
        <TrackList tracks={tracks} />
      ) : (
        <EmptyState icon={<UploadIcon size={26} />} title="Your library is empty">
          Drag songs or whole folders anywhere in this window to add them. MP3, FLAC, WAV, and M4A all work.
        </EmptyState>
      )}
    </Panel>
  )
}

const text = (value: string | null): string => value?.toLocaleLowerCase() ?? '￿'

// Album order: by artist, then album, then disc and track number, with untagged songs last.
function byAlbum(a: Track, b: Track): number {
  return (
    text(a.albumArtist ?? a.artist).localeCompare(text(b.albumArtist ?? b.artist)) ||
    text(a.album).localeCompare(text(b.album)) ||
    (a.discNumber ?? 1) - (b.discNumber ?? 1) ||
    (a.trackNumber ?? Infinity) - (b.trackNumber ?? Infinity) ||
    a.title.localeCompare(b.title)
  )
}

function TrackList({ tracks }: { tracks: Track[] }) {
  const sorted = useMemo(() => [...tracks].sort(byAlbum), [tracks])

  return (
    <ul className={styles.trackList} aria-label="Local files">
      {sorted.map((track) => (
        <li key={track.id} className={styles.trackRow} title={track.path}>
          <span className={styles.trackArt}>
            {track.artworkId ? (
              <img src={artworkUrl(track.artworkId)} alt="" loading="lazy" draggable={false} />
            ) : (
              <MusicIcon size={16} />
            )}
          </span>
          <span className={styles.trackText}>
            <span className={styles.trackTitle}>{track.title}</span>
            <span className={styles.trackSub}>
              {[track.artist ?? 'Unknown artist', track.album].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className={styles.trackFormat}>{track.format}</span>
          <span className={styles.trackTime}>{formatDuration(track.duration)}</span>
        </li>
      ))}
    </ul>
  )
}
