import { useState } from 'react'
import type { StatsBucket } from '@shared/api'
import { formatListening } from '@/lib/format'
import type { Bar } from '@/lib/stats'
import styles from './ListeningChart.module.css'

// Up to this many bars, each gets its own label underneath. More than that, only the first and last do.
const LABEL_EVERY_BAR = 12

const shortLabel = (date: Date, bucket: StatsBucket, few: boolean): string =>
  bucket === 'month'
    ? date.toLocaleDateString(undefined, few ? { month: 'short' } : { month: 'short', year: 'numeric' })
    : date.toLocaleDateString(undefined, few ? { weekday: 'short' } : { month: 'short', day: 'numeric' })

const longLabel = (date: Date, bucket: StatsBucket): string =>
  bucket === 'month'
    ? date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

// Listening time per day or month as columns. Hovering or tabbing to a column shows its exact time.
export function ListeningChart({ bars, bucket }: { bars: Bar[]; bucket: StatsBucket }) {
  const [shown, setShown] = useState<number | null>(null)
  const most = Math.max(...bars.map((bar) => bar.seconds), 1)
  const few = bars.length <= LABEL_EVERY_BAR

  return (
    <div className={styles.chart}>
      <ol className={styles.bars} aria-label={`Listening time by ${bucket}`}>
        {bars.map((bar, i) => (
          <li
            key={bar.key}
            className={styles.slot}
            tabIndex={0}
            aria-label={`${longLabel(bar.date, bucket)}: ${formatListening(bar.seconds)}`}
            onPointerEnter={() => setShown(i)}
            onPointerLeave={() => setShown(null)}
            onFocus={() => setShown(i)}
            onBlur={() => setShown(null)}
          >
            <span
              className={styles.bar}
              data-current={bar.current || undefined}
              data-filled={bar.seconds > 0 || undefined}
              style={{ height: `${(bar.seconds / most) * 100}%` }}
            />
            {shown === i && (
              <span className={styles.tip} role="tooltip" data-edge={i < 2 ? 'start' : i > bars.length - 3 ? 'end' : undefined}>
                <strong>{formatListening(bar.seconds)}</strong>
                <span>{longLabel(bar.date, bucket)}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className={styles.axis} data-spread={!few || undefined} aria-hidden="true">
        {few ? (
          bars.map((bar) => <span key={bar.key}>{shortLabel(bar.date, bucket, true)}</span>)
        ) : (
          <>
            <span>{shortLabel(bars[0].date, bucket, false)}</span>
            <span>{shortLabel(bars[bars.length - 1].date, bucket, false)}</span>
          </>
        )}
      </div>
    </div>
  )
}
