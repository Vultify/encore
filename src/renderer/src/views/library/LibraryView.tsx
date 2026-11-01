import { useMemo, type ReactNode } from 'react'
import { CoverGrid } from '@/components/CoverGrid/CoverGrid'
import { EmptyState, Panel } from '@/components/Panel/Panel'
import { TrackList } from '@/components/TrackList/TrackList'
import { MusicIcon, UploadIcon } from '@/components/icons'
import { songCount } from '@/lib/format'
import { byAlbum } from '@/lib/library'
import { player } from '@/player/player'
import { useLibraryGroups } from '@/hooks/useLibraryGroups'
import { AlbumPage, albumQueue } from './AlbumPage'
import { ArtistPage, artistQueue } from './ArtistPage'
import { PlaylistsTab } from './PlaylistsTab'
import { IdentifyBanner } from './IdentifyBanner'
import { IdentifyPage } from './IdentifyPage'
import shared from '../views.module.css'
import styles from './library.module.css'

export const LIBRARY_TABS = ['Playlists', 'Albums', 'Artists', 'Local files'] as const
// The review page for identifying songs lives under Local files.
export const IDENTIFY_KEY = 'identify'
export type LibraryTab = (typeof LIBRARY_TABS)[number]

// Where the library is: a tab, and the album, artist, or playlist page open in it, if any.
export interface LibraryLocation {
  tab: LibraryTab
  key: string | null
}

interface LibraryViewProps {
  location: LibraryLocation
  onNavigate: (location: LibraryLocation) => void
}

export function LibraryView({ location, onNavigate }: LibraryViewProps) {
  const { tab, key: openKey } = location
  const { tracks, albums, artists } = useLibraryGroups()
  const localFiles = useMemo(() => [...tracks].sort(byAlbum), [tracks])

  const open = (key: string): void => onNavigate({ tab, key })
  const close = (): void => onNavigate({ tab, key: null })

  const header = (
    <>
      <div className={shared.tabs} role="tablist" aria-label="Library sections">
        {LIBRARY_TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={shared.tab}
            onClick={() => onNavigate({ tab: name, key: null })}
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
        <PlaylistsTab tracks={tracks} openKey={openKey} onOpen={open} onBack={close} />
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
              if (picked) player.playQueue(picked.tracks, 0, albumQueue(picked), picked.title)
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
              if (picked) player.playQueue(picked.tracks, 0, artistQueue(picked), picked.name)
            }}
          />
        </div>
      )
    }

    if (openKey === IDENTIFY_KEY) return <IdentifyPage onBack={close} />
    return (
      <>
        <IdentifyBanner onReview={() => open(IDENTIFY_KEY)} />
        <TrackList label="Local files" tracks={localFiles} queueSource="local-files" queueName="Local files" />
      </>
    )
  }

  return (
    <Panel label="Library" header={header}>
      {body()}
    </Panel>
  )
}
