import { useEffect, useState } from 'react'
import { artworkUrl, previewUrl, type MatchCandidate, type Track } from '@shared/api'
import { SaveToFileDialog } from '@/components/Dialog/SaveToFileDialog'
import { BackIcon, MusicIcon } from '@/components/icons'
import { formatDuration, songCount } from '@/lib/format'
import { UNKNOWN_ARTIST } from '@/lib/library'
import { identify, useIdentify, type ReviewItem } from '@/store/identify'
import { library, useLibrary } from '@/store/library'
import styles from './identify.module.css'

// Matches at or above this score are labeled the best match.
const BEST_MATCH = 0.75
// Lengths this close are almost certainly the same recording.
const SAME_LENGTH_SECONDS = 3

const fileName = (path: string): string => path.slice(Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')) + 1)

// Goes through looked-up songs one at a time: pick the right match or skip. Nothing is saved without a pick.
export function IdentifyPage({ onBack }: { onBack: () => void }) {
  const { running, done, total, items } = useIdentify()
  const { tracks } = useLibrary()
  const pending = items.find((item) => item.decision === 'pending')
  const track = pending && tracks.find((candidate) => candidate.id === pending.trackId)
  const position = items.filter((item) => item.decision !== 'pending').length + 1

  const finish = (): void => {
    identify.reset()
    onBack()
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={onBack}>
          <BackIcon size={16} />
          Local files
        </button>
        <div className={styles.titleRow}>
          <div>
            <span className={styles.kind}>Identify songs</span>
            <h2 className={styles.title}>Review matches</h2>
          </div>
          <span className={styles.progress} role="status">
            {running ? `Looking up ${done} of ${total}` : total > 0 && pending ? `Song ${position} of ${total}` : ''}
          </span>
        </div>
      </header>

      {pending && track ? (
        <Review key={pending.trackId} item={pending} track={track} />
      ) : pending ? (
        // The song was removed from the library while waiting, so there's nothing to review.
        <SkipGone trackId={pending.trackId} />
      ) : running ? (
        <div className={styles.waiting}>
          <p>Looking up your songs. Matches show up here as they're found.</p>
          <button className={styles.secondary} onClick={() => identify.stop()}>
            Stop
          </button>
        </div>
      ) : (
        <Summary items={items} onDone={finish} />
      )}
    </div>
  )
}

function Review({ item, track }: { item: ReviewItem; track: Track }) {
  const [picked, setPicked] = useState<string | null>(item.candidates[0]?.id ?? null)
  const bySound = item.candidates.some((candidate) => candidate.bySound)
  const [saving, setSaving] = useState(false)

  const use = async (): Promise<void> => {
    if (!picked) return
    setSaving(true)
    await identify.apply(item.trackId, picked)
    setSaving(false)
  }

  return (
    <>
      <section className={styles.section} aria-label="Your song">
        <h3 className={styles.sectionTitle}>Your song</h3>
        <div className={styles.song}>
          <span className={styles.songArt}>
            {track.artworkId ? <img src={artworkUrl(track.artworkId)} alt="" draggable={false} /> : <MusicIcon size={22} />}
          </span>
          <span className={styles.songText}>
            <span className={styles.songTitle}>{track.title}</span>
            <span className={styles.songSub}>
              {track.artist ?? UNKNOWN_ARTIST} · {formatDuration(track.duration)}
            </span>
            <span className={styles.songFile}>{fileName(track.path)}</span>
          </span>
        </div>
      </section>

      <section className={styles.section} aria-label="Matches">
        <h3 className={styles.sectionTitle}>{item.candidates.length > 0 ? 'Pick the right one' : 'No matches found'}</h3>
        {bySound && (
          <p className={styles.soundNote} role="note">
            Found by listening, since the name gave nothing to search for. These may be wrong, so check before using one.
          </p>
        )}
        {item.candidates.length > 0 ? (
          <ul className={styles.matches} aria-label="Matches">
            {item.candidates.map((candidate, index) => (
              <li key={candidate.id}>
                <MatchCard
                  candidate={candidate}
                  best={index === 0 && candidate.score >= BEST_MATCH}
                  sameLength={sameLength(track, candidate)}
                  picked={picked === candidate.id}
                  onPick={() => setPicked(candidate.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.note}>
            Encore couldn't find this song by its name or by listening to it. You can skip it, or rename the file to
            "Artist - Title" and try again.
          </p>
        )}
      </section>

      <div className={styles.actions}>
        <button className={styles.secondary} onClick={() => identify.skip(item.trackId)} disabled={saving}>
          Skip
        </button>
        {item.candidates.length > 0 && (
          <button className={styles.primary} onClick={use} disabled={!picked || saving}>
            {saving ? 'Saving' : 'Use this match'}
          </button>
        )}
      </div>
    </>
  )
}

const sameLength = (track: Track, candidate: MatchCandidate): boolean =>
  track.duration !== null && candidate.duration !== null && Math.abs(track.duration - candidate.duration) <= SAME_LENGTH_SECONDS

interface MatchCardProps {
  candidate: MatchCandidate
  best: boolean
  sameLength: boolean
  picked: boolean
  onPick: () => void
}

function MatchCard({ candidate, best, sameLength, picked, onPick }: MatchCardProps) {
  const albumLine = [candidate.album, candidate.year].filter(Boolean).join(' · ')
  return (
    <button
      className={styles.match}
      aria-pressed={picked}
      aria-label={`${candidate.title} by ${candidate.artist}${candidate.album ? `, on ${candidate.album}` : ''}`}
      onClick={onPick}
    >
      <span className={styles.matchCover}>
        <img src={previewUrl(candidate.id)} alt="" draggable={false} />
        {best && <span className={styles.badge}>{candidate.bySound ? 'Closest by sound' : 'Best match'}</span>}
      </span>
      <span className={styles.matchTitle}>{candidate.title}</span>
      <span className={styles.matchSub}>{candidate.artist}</span>
      {albumLine && <span className={styles.matchSub}>{albumLine}</span>}
      <span className={styles.matchLength} data-same={sameLength || undefined}>
        {formatDuration(candidate.duration)}
        {sameLength && ' · same length'}
      </span>
    </button>
  )
}

// Moves past a song that left the library mid-review.
function SkipGone({ trackId }: { trackId: number }) {
  useEffect(() => identify.skip(trackId), [trackId])
  return null
}

// The end of a review: what changed, with the option to write the picks into the song files too.
function Summary({ items, onDone }: { items: ReviewItem[]; onDone: () => void }) {
  const { tracks } = useLibrary()
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState(false)
  const applied = items.filter((item) => item.decision === 'applied')
  const skipped = items.filter((item) => item.decision === 'skipped').length
  // Only songs still identified can be saved, in case one was restored meanwhile.
  const toSave = tracks.filter((track) => track.identified && applied.some((item) => item.trackId === track.id))

  const save = async (): Promise<void> => {
    setConfirming(false)
    await library.saveToFiles(toSave.map((track) => track.id))
    setSaved(true)
  }

  return (
    <div className={styles.waiting}>
      <p className={styles.summary}>
        {items.length === 0
          ? 'Nothing was looked up.'
          : `All done. ${applied.length > 0 ? `${songCount(applied.length)} updated` : 'Nothing updated'}${skipped > 0 ? `, ${skipped} skipped` : ''}.`}
      </p>
      {toSave.length > 0 && !saved && (
        <p>The new details live in Encore for now. Saving them into the song files lets iTunes and other apps see them too.</p>
      )}
      <div className={styles.summaryActions}>
        {toSave.length > 0 && !saved && (
          <button className={styles.secondary} onClick={() => setConfirming(true)}>
            Save to the files too
          </button>
        )}
        <button className={styles.primary} onClick={onDone}>
          Back to Local files
        </button>
      </div>
      {confirming && <SaveToFileDialog songs={toSave} onConfirm={save} onCancel={() => setConfirming(false)} />}
    </div>
  )
}
