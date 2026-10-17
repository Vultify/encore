import { useMemo, useState, type ReactNode } from 'react'
import type { Track } from '@shared/api'
import { CoverGrid } from '@/components/CoverGrid/CoverGrid'
import { EmptyState, Panel } from '@/components/Panel/Panel'
import { TrackList } from '@/components/TrackList/TrackList'
import { MusicIcon, UploadIcon } from '@/components/icons'
import { songCount } from '@/lib/format'
import { byAlbum, groupAlbums, groupArtists } from '@/lib/library'
import { player } from '@/player/player'
import { AlbumPage, albumQueue } from './AlbumPage'
import { ArtistPage, artistQueue } from './ArtistPage'
import shared from '../views.module.css'
import styles from './library.module.css'

export const LIBRARY_TABS = ['Playlists', 'Albums', 'Artists', 'Local files'] as const
export type LibraryTab = (typeof LIBRARY_TABS)[number]

interface LibraryViewProps {
  tab: LibraryTab
  onTabChange: (tab: LibraryTab) => void
  tracks: Track[]
}

export function LibraryView({ tab, onTabChange, tracks }: LibraryViewProps) {
  const albums = useMemo(() => groupAlbums(tracks), [tracks])
  const artists = useMemo(() => groupArtists(tracks, albums), [tracks, albums])
  const localFiles = useMemo(() => [...tracks].sort(byAlbum), [tracks])

  // The album or artist page that's open, remembered per tab so switching tabs goes back to the grid.
  const [opened, setOpened] = useState<{ tab: LibraryTab; key: string } | null>(null)
  const openKey = opened?.tab === tab ? opened.key : null
  const open = (key: string): void => setOpened({ tab, key })
  const close = (): void => setOpened(null)

  const header = (
    <>
      <div className={shared.tabs} role="tablist" aria-label="Library sections">
        {LIBRARY_TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={shared.tab}
            onClick={() => {
              close()
              onTabChange(name)
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <span className={shared.hint}>
        <UploadIcon size={15} />
        Drop music files anywhere
      </span>
    </>
  )

  const body = (): ReactNode => {
    if (tracks.length === 0) {
      return (
        <EmptyState icon={<UploadIcon size={26} />} title="Your library is empty">
          Drag songs or whole folders anywhere in this window to add them. MP3, FLAC, WAV, and M4A all work.
        </EmptyState>
      )
    }

    if (tab === 'Playlists') {
      return (
        <EmptyState icon={<MusicIcon size={26} />} title="No playlists yet">
          Playlists you make will live here.
        </EmptyState>
      )
    }

    if (tab === 'Albums') {
      const album = albums.find((candidate) => candidate.key === openKey)
      if (album) return <AlbumPage album={album} backLabel="Albums" onBack={close} />
      if (albums.length === 0) {
        return (
          <EmptyState icon={<MusicIcon size={26} />} title="No albums yet">
            Songs with an album tag show up here. Everything else is under Local files.
          </EmptyState>
        )
      }
      return (
        <div className={styles.scroll}>
          <CoverGrid
            label="Albums"
            items={albums.map((item) => ({ key: item.key, title: item.title, subtitle: item.artist, artworkId: item.artworkId }))}
            onOpen={open}
            onPlay={(key) => {
              const picked = albums.find((candidate) => candidate.key === key)
              if (picked) player.playQueue(picked.tracks, 0, albumQueue(picked))
            }}
          />
        </div>
      )
    }

    if (tab === 'Artists') {
      const artist = artists.find((candidate) => candidate.key === openKey)
      if (artist) return <ArtistPage key={artist.key} artist={artist} onBack={close} />
      return (
        <div className={styles.scroll}>
          <CoverGrid
            label="Artists"
            round
            items={artists.map((item) => ({ key: item.key, title: item.name, subtitle: songCount(item.tracks.length), artworkId: item.artworkId }))}
            onOpen={open}
            onPlay={(key) => {
              const picked = artists.find((candidate) => candidate.key === key)
              if (picked) player.playQueue(picked.tracks, 0, artistQueue(picked))
            }}
          />
        </div>
      )
    }

    return <TrackList label="Local files" tracks={localFiles} queueSource="local-files" />
  }

  return (
    <Panel label="Library" header={header}>
      {body()}
    </Panel>
  )
}
