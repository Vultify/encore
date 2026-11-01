import { useCallback, useMemo, useState } from 'react'
import type { Playlist, Track } from '@shared/api'
import { CollectionHeader, HeaderAction } from '@/components/CollectionHeader/CollectionHeader'
import { ConfirmDialog } from '@/components/Dialog/Dialog'
import { EmptyState } from '@/components/Panel/Panel'
import { TrackList } from '@/components/TrackList/TrackList'
import { HeartIcon, MusicIcon, PencilIcon, TrashIcon } from '@/components/icons'
import { collectionSummary } from '@/lib/library'
import { likedTracks, playlistArtwork, playlistTracks } from '@/lib/playlists'
import { player } from '@/player/player'
import { library } from '@/store/library'
import { notify } from '@/store/notice'
import styles from './library.module.css'

export const playlistQueue = (playlistId: number): string => `playlist:${playlistId}`
export const LIKED_QUEUE = 'liked'

interface PlaylistPageProps {
  playlist: Playlist
  tracksById: Map<number, Track>
  onBack: () => void
}

export function PlaylistPage({ playlist, tracksById, onBack }: PlaylistPageProps) {
  const { tracks, entryIds } = useMemo(() => playlistTracks(playlist, tracksById), [playlist, tracksById])
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const queue = playlistQueue(playlist.id)

  const finishRename = (name: string | null): void => {
    setRenaming(false)
    if (name !== null && name.trim() && name !== playlist.name) library.renamePlaylist(playlist.id, name)
  }

  const deletePlaylist = async (): Promise<void> => {
    setConfirmingDelete(false)
    await library.removePlaylist(playlist.id)
    notify(`Deleted ${playlist.name}`)
    onBack()
  }

  const cancelDelete = useCallback(() => setConfirmingDelete(false), [])

  return (
    <div className={styles.page}>
      <CollectionHeader
        kind="Playlist"
        title={playlist.name}
        details={collectionSummary(tracks)}
        artworkId={playlistArtwork(tracks)}
        backLabel="Playlists"
        onBack={onBack}
        onPlay={() => player.playQueue(tracks, 0, queue, playlist.name)}
        canPlay={tracks.length > 0}
        renaming={renaming}
        onRename={finishRename}
        actions={
          <>
            <HeaderAction label="Rename playlist" onClick={() => setRenaming(true)}>
              <PencilIcon size={17} />
            </HeaderAction>
            <HeaderAction label="Delete playlist" onClick={() => setConfirmingDelete(true)}>
              <TrashIcon size={17} />
            </HeaderAction>
          </>
        }
      />

      {tracks.length > 0 ? (
        <TrackList
          label={`${playlist.name} songs`}
          tracks={tracks}
          queueSource={queue}
          queueName={playlist.name}
          playlistId={playlist.id}
          entryIds={entryIds}
          onMove={(from, to) => library.moveEntry(playlist.id, entryIds[from], to)}
        />
      ) : (
        <EmptyState icon={<MusicIcon size={26} />} title="This playlist is empty">
          Right-click any song in your library and choose this playlist to add it here.
        </EmptyState>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete ${playlist.name}?`}
          message="The playlist goes away for good. The songs stay in your library and on your computer."
          confirmLabel="Delete playlist"
          onConfirm={deletePlaylist}
          onCancel={cancelDelete}
        />
      )}
    </div>
  )
}

export function LikedCover() {
  return (
    <span className={styles.likedCover}>
      <HeartIcon size={40} filled />
    </span>
  )
}

export function LikedPage({ tracks, onBack }: { tracks: Track[]; onBack: () => void }) {
  const liked = useMemo(() => likedTracks(tracks), [tracks])

  return (
    <div className={styles.page}>
      <CollectionHeader
        kind="Playlist"
        title="Liked Songs"
        details={collectionSummary(liked)}
        artworkId={null}
        cover={<LikedCover />}
        backLabel="Playlists"
        onBack={onBack}
        onPlay={() => player.playQueue(liked, 0, LIKED_QUEUE, 'Liked Songs')}
        canPlay={liked.length > 0}
      />
      {liked.length > 0 ? (
        <TrackList label="Liked Songs" tracks={liked} queueSource={LIKED_QUEUE} queueName="Liked Songs" />
      ) : (
        <EmptyState icon={<HeartIcon size={26} />} title="No liked songs yet">
          Tap the heart in the player, or right-click a song and choose Like.
        </EmptyState>
      )}
    </div>
  )
}
