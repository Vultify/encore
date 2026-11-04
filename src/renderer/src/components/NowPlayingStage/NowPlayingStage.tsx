import { Artwork } from '../Artwork/Artwork'
import { usePlayer } from '@/player/player'
import styles from './NowPlayingStage.module.css'

// The big album on the left. Clicking it opens the Now Playing view. Without a song, or a song without
// a cover, it shows Encore's ring mark.
export function NowPlayingStage({ onOpen }: { onOpen: () => void }) {
  const { track } = usePlayer()

  const art = (
    <>
      <div className={styles.artGlow} aria-hidden="true" />
      <div className={styles.art}>
        {track?.artworkId ? (
          <Artwork className={styles.cover} id={track.artworkId} alt={`${track.album ?? track.title} cover`} />
        ) : (
          <>
            <span className={styles.ringOuter} aria-hidden="true" />
            <span className={styles.ringInner} aria-hidden="true" />
            <span className={styles.ringDot} aria-hidden="true" />
          </>
        )}
      </div>
    </>
  )

  return (
    <section aria-label="Now playing" className={styles.stage}>
      {track ? (
        <button className={styles.artFrame} aria-label="Open Now Playing" onClick={onOpen}>
          {art}
        </button>
      ) : (
        <div className={styles.artFrame}>{art}</div>
      )}

      <div className={styles.info}>
        <span className={styles.label}>Now playing</span>
        {track ? (
          <>
            <h1 className={styles.title}>{track.title}</h1>
            <p className={styles.subtitle}>{[track.artist ?? 'Unknown artist', track.album].filter(Boolean).join(' · ')}</p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Nothing yet</h1>
            <p className={styles.subtitle}>Drop songs or folders anywhere, or pick something from your library.</p>
          </>
        )}
      </div>
    </section>
  )
}
