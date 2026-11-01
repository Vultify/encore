import { useState } from 'react'
import { CollectionHeader } from '@/components/CollectionHeader/CollectionHeader'
import { CoverGrid } from '@/components/CoverGrid/CoverGrid'
import { TrackList } from '@/components/TrackList/TrackList'
import { collectionSummary, type Artist } from '@/lib/library'
import { player } from '@/player/player'
import { AlbumPage, albumQueue } from './AlbumPage'
import styles from './library.module.css'

interface ArtistPageProps {
  artist: Artist
  onBack: () => void
}

export const artistQueue = (artist: Artist): string => `artist:${artist.key}`

// An artist's albums, then all of their songs. Opening an album stays inside the artist page.
export function ArtistPage({ artist, onBack }: ArtistPageProps) {
  const [openAlbum, setOpenAlbum] = useState<string | null>(null)
  const album = artist.albums.find((candidate) => candidate.key === openAlbum)
  if (album) return <AlbumPage album={album} backLabel={artist.name} onBack={() => setOpenAlbum(null)} />

  const playAlbum = (key: string): void => {
    const picked = artist.albums.find((candidate) => candidate.key === key)
    if (picked) player.playQueue(picked.tracks, 0, albumQueue(picked), picked.title)
  }

  return (
    <div className={`${styles.page} ${styles.scroll}`}>
      <CollectionHeader
        kind="Artist"
        title={artist.name}
        details={collectionSummary(artist.tracks)}
        artworkId={artist.artworkId}
        round
        backLabel="Artists"
        onBack={onBack}
        onPlay={() => player.playQueue(artist.tracks, 0, artistQueue(artist), artist.name)}
      />

      {artist.albums.length > 0 && (
        <section className={styles.section} aria-label="Albums">
          <h3 className={styles.sectionTitle}>Albums</h3>
          <CoverGrid
            label={`${artist.name} albums`}
            items={artist.albums.map((item) => ({
              key: item.key,
              title: item.title,
              subtitle: item.year ? String(item.year) : collectionSummary(item.tracks),
              artworkId: item.artworkId
            }))}
            onOpen={setOpenAlbum}
            onPlay={playAlbum}
          />
        </section>
      )}

      <section className={styles.section} aria-label="Songs">
        <h3 className={styles.sectionTitle}>Songs</h3>
        <TrackList label={`${artist.name} songs`} tracks={artist.tracks} queueSource={artistQueue(artist)} queueName={artist.name} contained={false} />
      </section>
    </div>
  )
}
