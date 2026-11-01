import { useCallback, useMemo, useState } from 'react'
import type { Track } from '@shared/api'
import { CoverGrid, type CoverItem } from '@/components/CoverGrid/CoverGrid'
import { NameDialog } from '@/components/Dialog/Dialog'
import { PlusIcon } from '@/components/icons'
import { collectionSummary } from '@/lib/library'
import { LIKED_KEY, likedTracks, nextPlaylistName, playlistArtwork, playlistKey, playlistTracks } from '@/lib/playlists'
import { player } from '@/player/player'
import { library, useLibrary } from '@/store/library'
import { LIKED_QUEUE, LikedCover, LikedPage, PlaylistPage, playlistQueue } from './PlaylistPage'
import styles from './library.module.css'

const NEW = 'new'

interface PlaylistsTabProps {
  tracks: Track[]
  openKey: string | null
  onOpen: (key: string) => void
  onBack: () => void
}

// Liked Songs first, then playlists in the order they've been arranged, then a tile to make a new one.
export function PlaylistsTab({ tracks, openKey, onOpen, onBack }: PlaylistsTabProps) {
  const { playlists } = useLibrary()
  const [naming, setNaming] = useState(false)
  const closeNaming = useCallback(() => setNaming(false), [])
  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])
  const liked = useMemo(() => likedTracks(tracks), [tracks])

  if (openKey === LIKED_KEY) return <LikedPage tracks={tracks} onBack={onBack} />
  const open = playlists.find((playlist) => playlistKey(playlist.id) === openKey)
  if (open) return <PlaylistPage key={open.id} playlist={open} tracksById={tracksById} onBack={onBack} />

  const items: CoverItem[] = [
    { key: LIKED_KEY, title: 'Liked Songs', subtitle: collectionSummary(liked), artworkId: null, cover: <LikedCover />, playable: liked.length > 0 },
    ...playlists.map((playlist): CoverItem => {
      const songs = playlistTracks(playlist, tracksById).tracks
      return {
        key: playlistKey(playlist.id),
        title: playlist.name,
        subtitle: collectionSummary(songs),
        artworkId: playlistArtwork(songs),
        playable: songs.length > 0,
        movable: true
      }
    }),
    {
      key: NEW,
      title: 'New playlist',
      subtitle: 'Make a playlist',
      artworkId: null,
      cover: (
        <span className={styles.newCover}>
          <PlusIcon size={30} />
        </span>
      ),
      playable: false
    }
  ]

  const openItem = (key: string): void => (key === NEW ? setNaming(true) : onOpen(key))

  const create = async (name: string): Promise<void> => {
    setNaming(false)
    const created = await library.createPlaylist(name)
    onOpen(playlistKey(created.id))
  }

  const play = (key: string): void => {
    if (key === LIKED_KEY) return player.playQueue(liked, 0, LIKED_QUEUE, 'Liked Songs')
    const playlist = playlists.find((candidate) => playlistKey(candidate.id) === key)
    if (playlist) player.playQueue(playlistTracks(playlist, tracksById).tracks, 0, playlistQueue(playlist.id), playlist.name)
  }

  const reorder = (fromKey: string, toKey: string, after: boolean): void => {
    const ids = playlists.map((playlist) => playlist.id)
    const from = ids.findIndex((id) => playlistKey(id) === fromKey)
    const [moved] = ids.splice(from, 1)
    const target = ids.findIndex((id) => playlistKey(id) === toKey)
    ids.splice(target + (after ? 1 : 0), 0, moved)
    library.reorderPlaylists(ids)
  }

  return (
    <div className={styles.scroll}>
      <CoverGrid label="Playlists" items={items} onOpen={openItem} onPlay={play} onReorder={reorder} />
      {naming && (
        <NameDialog
          title="New playlist"
          initial={nextPlaylistName(playlists)}
          confirmLabel="Create"
          onConfirm={create}
          onCancel={closeNaming}
        />
      )}
    </div>
  )
}
