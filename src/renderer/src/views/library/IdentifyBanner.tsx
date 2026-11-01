import { useMemo } from 'react'
import { songCount } from '@/lib/format'
import { identify, needsIdentifying, useIdentify } from '@/store/identify'
import { useLibrary } from '@/store/library'
import styles from './identify.module.css'

// Sits above Local files: offers to identify songs missing an album or cover, and shows a run's progress.
export function IdentifyBanner({ onReview }: { onReview: () => void }) {
  const { tracks, missing } = useLibrary()
  const { running, done, total, items } = useIdentify()
  const needed = useMemo(() => needsIdentifying(tracks, missing), [tracks, missing])
  const waiting = items.filter((item) => item.decision === 'pending').length

  if (!running && waiting === 0 && needed.length === 0) return null

  const reviewButton = waiting > 0 && (
    <button className={styles.primary} onClick={onReview}>
      Review {waiting === 1 ? 'match' : `${waiting} matches`}
    </button>
  )

  return (
    <div className={styles.banner} role="region" aria-label="Identify songs">
      {running ? (
        <>
          <span className={styles.bannerText}>
            Looking up songs {done} of {total}
          </span>
          {reviewButton}
          <button className={styles.secondary} onClick={() => identify.stop()}>
            Stop
          </button>
        </>
      ) : waiting > 0 ? (
        <>
          <span className={styles.bannerText}>{waiting === 1 ? '1 match is' : `${waiting} matches are`} ready to review.</span>
          {reviewButton}
        </>
      ) : (
        <>
          <span className={styles.bannerText}>
            {songCount(needed.length)} {needed.length === 1 ? 'is' : 'are'} missing an album or cover.
          </span>
          <button className={styles.primary} onClick={() => identify.start(needed)}>
            Identify songs
          </button>
        </>
      )}
    </div>
  )
}
