import styles from './NowPlayingStage.module.css'

// The big album on the left. Until a song plays it shows Encore's ring mark as a resting state.
export function NowPlayingStage() {
  return (
    <section aria-label="Now playing" className={styles.stage}>
      <div className={styles.artFrame}>
        <div className={styles.artGlow} aria-hidden="true" />
        <div className={styles.art}>
          <span className={styles.ringOuter} aria-hidden="true" />
          <span className={styles.ringInner} aria-hidden="true" />
          <span className={styles.ringDot} aria-hidden="true" />
        </div>
      </div>

      <div className={styles.info}>
        <span className={styles.label}>Now playing</span>
        <h1 className={styles.title}>Nothing yet</h1>
        <p className={styles.subtitle}>Drop songs or folders anywhere, or pick something from your library.</p>
      </div>
    </section>
  )
}
