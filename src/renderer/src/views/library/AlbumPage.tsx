import { CollectionHeader } from '@/components/CollectionHeader/CollectionHeader'
import { TrackList } from '@/components/TrackList/TrackList'
import { collectionSummary, type Album } from '@/lib/library'
import { player } from '@/player/player'
import styles from './library.module.css'

interface AlbumPageProps {
  album: Album
  backLabel: string
  onBack: () => void
}

export const albumQueue = (album: Album): string => `album:${album.key}`

export function AlbumPage({ album, backLabel, onBack }: AlbumPageProps) {
  const details = [album.artist, album.year, collectionSummary(album.tracks)].filter(Boolean).join(' · ')

  return (
    <div className={styles.page}>
      <CollectionHeader
        kind="Album"
        title={album.title}
        details={details}
        artworkId={album.artworkId}
        backLabel={backLabel}
        onBack={onBack}
        onPlay={() => player.playQueue(album.tracks, 0, albumQueue(album), album.title)}
      />
      <TrackList label={`${album.title} songs`} tracks={album.tracks} queueSource={albumQueue(album)} queueName={album.title} numbered />
    </div>
  )
}
