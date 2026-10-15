import { artworkUrl } from '@shared/api'
import { usePlayer } from '@/player/player'
import styles from './NowPlayingStage.module.css'

// The big album on the left. Without a song, or a song without a cover, it shows Encore's ring mark.
export function NowPlayingStage() {
  const { track } = usePlayer()

  return (
    <section aria-label="Now playing" className={styles.stage}>
      <div className={styles.artFrame}>
        <div className={styles.artGlow} aria-hidden="true" />
        <div className={styles.art}>
          {track?.artworkId ? (
            <img className={styles.cover} src={artworkUrl(track.artworkId)} alt={`${track.album ?? track.title} cover`} draggable={false} />
          ) : (
            <>
              <span className={styles.ringOuter} aria-hidden="true" />
              <span className={styles.ringInner} aria-hidden="true" />
              <span className={styles.ringDot} aria-hidden="true" />
            </>
          )}
        </div>
      </div>

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
