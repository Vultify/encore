import { useEffect, type CSSProperties } from 'react'
import { artworkUrl, type Track } from '@shared/api'
import { Artwork } from '@/components/Artwork/Artwork'
import { ChevronDownIcon, CloseIcon, MusicIcon } from '@/components/icons'
import { formatDuration } from '@/lib/format'
import { UNKNOWN_ARTIST } from '@/lib/library'
import { player, usePlayer } from '@/player/player'
import styles from './NowPlayingView.module.css'

// How many songs from the list Up next shows. The rest are still coming, just not listed.
const UPCOMING_SHOWN = 40

// The big view of the playing song, with what's coming up beside it. Escape or the arrow closes it.
export function NowPlayingView({ onClose }: { onClose: () => void }) {
  const { track, sourceName, position, duration, queued, upcoming } = usePlayer()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <main className={styles.view}>
      <button className={styles.close} aria-label="Close Now Playing" onClick={onClose}>
        <ChevronDownIcon size={20} />
      </button>

      <section className={styles.stage} aria-label="Now Playing">
        <div className={styles.art}>
          {track?.artworkId && <img className={styles.artGlow} src={artworkUrl(track.artworkId)} alt="" aria-hidden="true" />}
          <div className={styles.cover}>
            {track?.artworkId ? (
              <Artwork id={track.artworkId} alt={`${track.album ?? track.title} cover`} />
            ) : (
              <MusicIcon size={64} />
            )}
          </div>
        </div>

        {track ? (
          <div className={styles.info}>
            {sourceName && <span className={styles.from}>Playing from {sourceName}</span>}
            <h1 className={styles.title}>{track.title}</h1>
            <span className={styles.byline}>
              {track.artist ?? UNKNOWN_ARTIST}
              {track.album && (
                <>
                  <span className={styles.dot} aria-hidden="true">
                    ·
                  </span>
                  <span className={styles.album}>{track.album}</span>
                </>
              )}
            </span>
          </div>
        ) : (
          <div className={styles.info}>
            <h1 className={styles.title}>Nothing playing</h1>
          </div>
        )}

        <div className={styles.progress}>
          <span className={styles.time}>{formatDuration(track ? position : 0)}</span>
          <input
            type="range"
            className={styles.seek}
            aria-label="Seek"
            aria-valuetext={`${formatDuration(position)} of ${formatDuration(duration)}`}
            min={0}
            max={duration || 0}
            step={0.1}
            value={track ? position : 0}
            disabled={!track}
            style={{ '--fill': `${duration > 0 ? Math.min(position / duration, 1) * 100 : 0}%` } as CSSProperties}
            onChange={(event) => player.seek(Number(event.target.value))}
          />
          <span className={styles.time}>{formatDuration(track ? duration : 0)}</span>
        </div>
      </section>

      <aside className={styles.upNext} aria-label="Up next">
        <div className={styles.upNextHeader}>
          <h2 className={styles.upNextTitle}>Up next</h2>
          {queued.length > 0 && (
            <button className={styles.clear} onClick={() => player.clearQueue()}>
              Clear queue
            </button>
          )}
        </div>

        <div className={styles.upNextList}>
          {queued.length === 0 && upcoming.length === 0 && (
            <p className={styles.empty}>Nothing up next. Right-click a song and choose Play next or Add to queue.</p>
          )}

          {queued.length > 0 && (
            <section aria-label="Your queue">
              <h3 className={styles.sectionTitle}>Your queue</h3>
              <ul className={styles.rows}>
                {queued.map((item) => (
                  <UpNextRow
                    key={item.key}
                    track={item.track}
                    onPlay={() => player.jumpToQueued(item.key)}
                    onRemove={() => player.removeFromQueue(item.key)}
                  />
                ))}
              </ul>
            </section>
          )}

          {upcoming.length > 0 && (
            <section aria-label="Next from the list">
              <h3 className={styles.sectionTitle}>Next from {sourceName}</h3>
              <ul className={styles.rows}>
                {upcoming.slice(0, UPCOMING_SHOWN).map((song, offset) => (
                  <UpNextRow key={`${song.id}-${offset}`} track={song} onPlay={() => player.jumpToUpcoming(offset)} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </aside>
    </main>
  )
}

interface UpNextRowProps {
  track: Track
  onPlay: () => void
  onRemove?: () => void
}

function UpNextRow({ track, onPlay, onRemove }: UpNextRowProps) {
  return (
    <li className={styles.row}>
      <button className={styles.rowPlay} aria-label={`Play ${track.title}`} onClick={onPlay}>
        <span className={styles.rowArt}>
          {track.artworkId ? <Artwork id={track.artworkId} lazy /> : <MusicIcon size={16} />}
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{track.title}</span>
          <span className={styles.rowArtist}>{track.artist ?? UNKNOWN_ARTIST}</span>
        </span>
        <span className={styles.rowTime}>{formatDuration(track.duration)}</span>
      </button>
      {onRemove && (
        <button className={styles.remove} aria-label={`Remove ${track.title} from the queue`} onClick={onRemove}>
          <CloseIcon size={14} />
        </button>
      )}
    </li>
  )
}
