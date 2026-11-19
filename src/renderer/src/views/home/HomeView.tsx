import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ListeningStats, Track } from '@shared/api'
import { Artwork } from '@/components/Artwork/Artwork'
import { Button } from '@/components/Button/Button'
import { EmptyState, LoadingState, Panel } from '@/components/Panel/Panel'
import { Segmented } from '@/components/Segmented/Segmented'
import { TrackList } from '@/components/TrackList/TrackList'
import { ChevronDownIcon, MusicIcon, PlayIcon, ShuffleIcon, UploadIcon } from '@/components/icons'
import { useLibraryGroups } from '@/hooks/useLibraryGroups'
import { formatListening, playCount, songCount } from '@/lib/format'
import { chartBars, spanInfo, spanStart, SPANS, topArtists, topSongs, type ArtistStat, type SongStat, type StatsSpan } from '@/lib/stats'
import { player } from '@/player/player'
import { useHistoryVersion } from '@/store/history'
import { usePreferences } from '@/store/preferences'
import type { LibraryLocation } from '../library/LibraryView'
import { ListeningChart } from './ListeningChart'
import views from '../views.module.css'
import styles from './home.module.css'

// How many songs and artists each top list shows.
const TOP_COUNT = 5

const SPAN_OPTIONS = SPANS.map((info) => ({ value: info.id, label: info.label }))

function greeting(hour = new Date().getHours()): string {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// The stats for a span, fetched again whenever new listening is saved. The last ones stay up while the next load,
// so switching spans doesn't flash a spinner.
function useStats(span: StatsSpan): { span: StatsSpan; stats: ListeningStats } | null {
  const version = useHistoryVersion()
  const [result, setResult] = useState<{ span: StatsSpan; stats: ListeningStats } | null>(null)
  useEffect(() => {
    let current = true
    void window.encore.library.listeningStats(spanStart(span), spanInfo(span).bucket).then((stats) => {
      if (current && stats) setResult({ span, stats })
    })
    return () => {
      current = false
    }
  }, [span, version])
  return result
}

interface HomeViewProps {
  span: StatsSpan
  onSpanChange: (span: StatsSpan) => void
  onNavigate: (location: LibraryLocation) => void
  onOpenLibrary: () => void
  onOpenSettings: () => void
}

// Home is about the listening, not the browsing: time spent, top songs and artists, and a mix of the top songs
// that changes as the listening does.
export function HomeView({ span, onSpanChange, onNavigate, onOpenLibrary, onOpenSettings }: HomeViewProps) {
  const { tracks, artists, loaded } = useLibraryGroups()
  const { topMixSize } = usePreferences()
  const result = useStats(span)
  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])

  const songs = useMemo(() => (result ? topSongs(result.stats, tracksById) : []), [result, tracksById])
  const favorites = useMemo(() => (result ? topArtists(result.stats, artists) : []), [result, artists])

  const header = (
    <>
      <h2 className={views.heading}>{greeting()}</h2>
      {loaded && tracks.length > 0 && result?.stats.firstPlayedAt != null && (
        <Segmented label="Time span" options={SPAN_OPTIONS} value={span} onChange={onSpanChange} />
      )}
    </>
  )

  const body = (): ReactNode => {
    if (!loaded || !result) return <LoadingState label="Loading your stats" />
    if (tracks.length === 0) {
      return (
        <EmptyState icon={<UploadIcon size={26} />} title="Your music lives here" action={{ label: 'Add a music folder', onClick: onOpenSettings }}>
          Drag songs or whole folders anywhere in this window, or pick a music folder and new songs show up on their own.
        </EmptyState>
      )
    }
    if (result.stats.firstPlayedAt === null) {
      return (
        <EmptyState icon={<MusicIcon size={26} />} title="Your stats grow as you listen" action={{ label: 'Go to your library', onClick: onOpenLibrary }}>
          Play some music, and Home keeps track of how long you listen, your top songs, and your favorite artists.
        </EmptyState>
      )
    }

    const info = spanInfo(result.span)
    return (
      <div className={styles.scroll}>
        <div className={styles.dashboard}>
          <section className={`${styles.card} ${styles.wide} ${styles.time}`} aria-label="Listening time">
            <div className={styles.timeText}>
              <h3 className={styles.cardTitle}>Listening time</h3>
              <span className={styles.hero}>{formatListening(result.stats.totalSeconds)}</span>
              <span className={styles.heroLabel}>listened {info.phrase}</span>
            </div>
            <ListeningChart bars={chartBars(result.span, result.stats)} bucket={info.bucket} />
          </section>
          <TopSongs songs={songs} phrase={info.phrase} mixSize={topMixSize} span={result.span} />
          <TopArtists artists={favorites} phrase={info.phrase} onOpen={(key) => onNavigate({ tab: 'Artists', key })} />
          <TopMix songs={songs} size={topMixSize} span={result.span} />
        </div>
      </div>
    )
  }

  return (
    <Panel label="Home" header={header}>
      {body()}
    </Panel>
  )
}

const mixName = (size: number): string => `Your Top ${size}`
const mixQueue = (span: StatsSpan): string => `top-mix:${span}`

// The mix follows the latest song details, so a like or an identified title shows up in it right away. The player
// only reorders its queue when the songs themselves change.
function useMix(songs: SongStat[], size: number): Track[] {
  return useMemo(() => songs.slice(0, size).map((song) => song.track), [songs, size])
}

function TopSongs({ songs, phrase, mixSize, span }: { songs: SongStat[]; phrase: string; mixSize: number; span: StatsSpan }) {
  const mix = useMix(songs, mixSize)
  return (
    <section className={styles.card} aria-label="Top songs">
      <h3 className={styles.cardTitle}>Top songs</h3>
      {songs.length === 0 ? (
        <p className={styles.quiet}>Nothing played {phrase}.</p>
      ) : (
        <ol className={styles.ranks}>
          {songs.slice(0, TOP_COUNT).map((song, i) => (
            <li key={song.track.id}>
              <button
                className={styles.rank}
                data-lead={i === 0 || undefined}
                title={`Play ${song.track.title}`}
                onClick={() => player.playQueue(mix, i, mixQueue(span), mixName(mixSize))}
              >
                <span className={styles.rankNumber}>{i + 1}</span>
                <span className={styles.rankCover}>{song.track.artworkId ? <Artwork id={song.track.artworkId} thumbnail /> : <MusicIcon size={i === 0 ? 24 : 16} />}</span>
                <span className={styles.rankText}>
                  <span className={styles.rankTitle}>{song.track.title}</span>
                  <span className={styles.rankSub}>{song.track.artist ?? 'Unknown artist'}</span>
                </span>
                <span className={styles.rankStat}>{playCount(song.plays)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function TopArtists({ artists, phrase, onOpen }: { artists: ArtistStat[]; phrase: string; onOpen: (key: string) => void }) {
  return (
    <section className={styles.card} aria-label="Top artists">
      <h3 className={styles.cardTitle}>Top artists</h3>
      {artists.length === 0 ? (
        <p className={styles.quiet}>Nothing played {phrase}.</p>
      ) : (
        <ol className={styles.ranks}>
          {artists.slice(0, TOP_COUNT).map(({ artist, seconds }, i) => (
            <li key={artist.key}>
              <button className={styles.rank} data-lead={i === 0 || undefined} data-round title={`Open ${artist.name}`} onClick={() => onOpen(artist.key)}>
                <span className={styles.rankNumber}>{i + 1}</span>
                <span className={styles.rankCover}>{artist.artworkId ? <Artwork id={artist.artworkId} thumbnail /> : <MusicIcon size={i === 0 ? 24 : 16} />}</span>
                <span className={styles.rankText}>
                  <span className={styles.rankTitle}>{artist.name}</span>
                  <span className={styles.rankSub}>{songCount(artist.tracks.length)} in your library</span>
                </span>
                <span className={styles.rankStat}>{formatListening(seconds)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// A mix of the top songs that's never saved as a playlist. It follows the stats, and while it's playing, the
// queue follows it too.
function TopMix({ songs, size, span }: { songs: SongStat[]; size: number; span: StatsSpan }) {
  const mix = useMix(songs, size)
  const [open, setOpen] = useState(false)
  const name = mixName(size)
  const queue = mixQueue(span)

  useEffect(() => player.syncQueue(queue, mix), [queue, mix])

  if (mix.length === 0) return null
  const covers = [...new Set(mix.map((track) => track.artworkId).filter((id): id is string => id !== null))].slice(0, 4)
  const length = mix.reduce((total, track) => total + (track.duration ?? 0), 0)
  const details = [mix.length < size ? `${songCount(mix.length)} so far` : songCount(mix.length), formatListening(length), 'Changes as you listen']

  return (
    <section className={`${styles.card} ${styles.wide}`} aria-label={name}>
      <div className={styles.mixHead}>
        <span className={styles.mosaic} data-count={covers.length >= 4 ? 4 : covers.length > 0 ? 1 : 0}>
          {covers.length >= 4 ? covers.map((id) => <Artwork key={id} id={id} thumbnail />) : covers[0] ? <Artwork id={covers[0]} /> : <MusicIcon size={26} />}
        </span>
        <div className={styles.mixText}>
          <h3 className={styles.mixTitle}>{name}</h3>
          <span className={styles.mixDetails}>{details.join(' · ')}</span>
        </div>
        <div className={styles.mixActions}>
          <Button onClick={() => player.playShuffled(mix, queue, name)}>
            <ShuffleIcon size={16} />
            Shuffle
          </Button>
          <Button variant="primary" onClick={() => player.playQueue(mix, 0, queue, name)}>
            <PlayIcon size={16} />
            Play
          </Button>
        </div>
      </div>
      <button className={styles.showSongs} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide the songs' : 'Show the songs'}
        <ChevronDownIcon size={15} />
      </button>
      {open && <TrackList label={name} tracks={mix} queueSource={queue} queueName={name} contained={false} />}
    </section>
  )
}
