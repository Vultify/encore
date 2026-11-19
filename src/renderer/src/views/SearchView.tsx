import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CoverGrid } from '@/components/CoverGrid/CoverGrid'
import { EmptyState, LoadingState, Panel } from '@/components/Panel/Panel'
import { TrackList } from '@/components/TrackList/TrackList'
import { CloseIcon, SearchIcon, UploadIcon } from '@/components/icons'
import { useLibraryGroups } from '@/hooks/useLibraryGroups'
import { songCount } from '@/lib/format'
import { collectionSummary } from '@/lib/library'
import { playlistArtwork, playlistKey, playlistTracks } from '@/lib/playlists'
import { searchLibrary } from '@/lib/search'
import { player } from '@/player/player'
import { albumQueue } from './library/AlbumPage'
import { artistQueue } from './library/ArtistPage'
import type { LibraryLocation } from './library/LibraryView'
import { playlistQueue } from './library/PlaylistPage'
import pages from './library/library.module.css'
import styles from './views.module.css'

// How many songs and covers show before "Show all".
const SONGS_SHOWN = 5
const COVERS_SHOWN = 6

interface SearchViewProps {
  query: string
  onQueryChange: (query: string) => void
  onNavigate: (location: LibraryLocation) => void
  // Changes each time Ctrl + F is pressed, so the box takes focus even when search is already open.
  focusRequest: number
}

export function SearchView({ query, onQueryChange, onNavigate, focusRequest }: SearchViewProps) {
  const library = useLibraryGroups()
  const input = useRef<HTMLInputElement>(null)
  const [showAllSongs, setShowAllSongs] = useState(false)

  // Typing stays smooth on a big library: results catch up a moment behind the keystrokes.
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(
    () => searchLibrary(deferredQuery, library),
    [deferredQuery, library.tracks, library.artists, library.albums, library.playlists]
  )
  const tracksById = useMemo(() => new Map(library.tracks.map((track) => [track.id, track])), [library.tracks])
  // Kept as the same list between redraws, since the player follows the list a song was played from.
  const shownSongs = useMemo(
    () => (showAllSongs ? results.songs : results.songs.slice(0, SONGS_SHOWN)),
    [results.songs, showAllSongs]
  )

  // Each search is its own list, so typing a new one never takes over the songs already playing.
  const songsQueue = `search:${showAllSongs ? 'all' : 'top'}:${deferredQuery.trim().toLowerCase().slice(0, 200)}`

  useEffect(() => input.current?.focus(), [focusRequest])
  useEffect(() => setShowAllSongs(false), [deferredQuery])

  const header = (
    <label className={styles.search}>
      <SearchIcon size={18} strokeWidth={2} />
      <span className="visually-hidden">Search</span>
      <input
        ref={input}
        type="search"
        autoFocus
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && onQueryChange('')}
        placeholder="Search songs, artists, albums, playlists"
      />
      {query && (
        <button
          className={styles.clear}
          aria-label="Clear search"
          onClick={() => {
            onQueryChange('')
            input.current?.focus()
          }}
        >
          <CloseIcon size={15} strokeWidth={2.2} />
        </button>
      )}
    </label>
  )

  const body = (): ReactNode => {
    if (!library.loaded) return <LoadingState label="Loading your library" />
    if (library.tracks.length === 0) {
      return (
        <EmptyState icon={<UploadIcon size={26} />} title="Nothing to search yet">
          Drag songs or whole folders anywhere in this window to add them.
        </EmptyState>
      )
    }
    if (!deferredQuery.trim()) {
      return (
        <EmptyState icon={<SearchIcon size={26} />} title="Search your music">
          Find songs, artists, albums, and playlists by any part of their name.
        </EmptyState>
      )
    }

    const { songs, artists, albums, playlists } = results
    if (songs.length + artists.length + albums.length + playlists.length === 0) {
      return (
        <EmptyState icon={<SearchIcon size={26} />} title="No matches">
          Nothing in your library matches {deferredQuery.trim()}. Try fewer or shorter words.
        </EmptyState>
      )
    }

    return (
      <div className={`${pages.page} ${pages.scroll}`}>
        {songs.length > 0 && (
          <section className={pages.section} aria-label="Songs">
            <div className={styles.sectionHeader}>
              <h3 className={pages.sectionTitle}>Songs</h3>
              {songs.length > SONGS_SHOWN && (
                <button className={styles.showAll} onClick={() => setShowAllSongs(!showAllSongs)}>
                  {showAllSongs ? 'Show less' : `Show all ${songCount(songs.length)}`}
                </button>
              )}
            </div>
            <TrackList label="Song results" tracks={shownSongs} queueSource={songsQueue} queueName="Search results" contained={false} />
          </section>
        )}

        {artists.length > 0 && (
          <section className={pages.section} aria-label="Artists">
            <h3 className={pages.sectionTitle}>Artists</h3>
            <CoverGrid
              label="Artist results"
              round
              items={artists.slice(0, COVERS_SHOWN).map((artist) => ({
                key: artist.key,
                title: artist.name,
                subtitle: songCount(artist.tracks.length),
                artworkId: artist.artworkId
              }))}
              onOpen={(key) => onNavigate({ tab: 'Artists', key })}
              onPlay={(key) => {
                const artist = artists.find((candidate) => candidate.key === key)
                if (artist) player.playQueue(artist.tracks, 0, artistQueue(artist), artist.name)
              }}
            />
          </section>
        )}

        {albums.length > 0 && (
          <section className={pages.section} aria-label="Albums">
            <h3 className={pages.sectionTitle}>Albums</h3>
            <CoverGrid
              label="Album results"
              items={albums.slice(0, COVERS_SHOWN).map((album) => ({
                key: album.key,
                title: album.title,
                subtitle: album.artist,
                artworkId: album.artworkId
              }))}
              onOpen={(key) => onNavigate({ tab: 'Albums', key })}
              onPlay={(key) => {
                const album = albums.find((candidate) => candidate.key === key)
                if (album) player.playQueue(album.tracks, 0, albumQueue(album), album.title)
              }}
            />
          </section>
        )}

        {playlists.length > 0 && (
          <section className={pages.section} aria-label="Playlists">
            <h3 className={pages.sectionTitle}>Playlists</h3>
            <CoverGrid
              label="Playlist results"
              items={playlists.slice(0, COVERS_SHOWN).map((playlist) => {
                const songsIn = playlistTracks(playlist, tracksById).tracks
                return {
                  key: playlistKey(playlist.id),
                  title: playlist.name,
                  subtitle: collectionSummary(songsIn),
                  artworkId: playlistArtwork(songsIn),
                  playable: songsIn.length > 0
                }
              })}
              onOpen={(key) => onNavigate({ tab: 'Playlists', key })}
              onPlay={(key) => {
                const playlist = playlists.find((candidate) => playlistKey(candidate.id) === key)
                if (playlist) player.playQueue(playlistTracks(playlist, tracksById).tracks, 0, playlistQueue(playlist.id), playlist.name)
              }}
            />
          </section>
        )}
      </div>
    )
  }

  return (
    <Panel label="Search" header={header}>
      {body()}
    </Panel>
  )
}
