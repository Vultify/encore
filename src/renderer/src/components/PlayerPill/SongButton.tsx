import { Artwork } from '../Artwork/Artwork'
import { Marquee } from '../Marquee/Marquee'
import pill from './pill.module.css'

interface SongButtonProps {
  label: string
  artworkId: string | null
  title: string
  artist: string
  onClick: () => void
  disabled?: boolean
  className?: string
  tooltip?: string
  // Long names scroll instead of being cut off. With motion off, they scroll only while play is true.
  scroll?: { play: boolean }
}

// The round cover with the song and artist beside it, as both pills show it. Clicking it opens a bigger view.
export function SongButton({ label, artworkId, title, artist, onClick, disabled, className = '', tooltip, scroll }: SongButtonProps) {
  return (
    <button className={`${pill.song} ${className}`} aria-label={label} title={tooltip} disabled={disabled} onClick={onClick}>
      <span className={pill.cover} aria-hidden="true">
        {artworkId ? <Artwork id={artworkId} thumbnail /> : <span className={pill.coverRing} />}
      </span>
      <span className={pill.meta}>
        {scroll ? (
          <>
            <Marquee className={pill.title} text={title} play={scroll.play} />
            <Marquee className={pill.artist} text={artist} play={scroll.play} />
          </>
        ) : (
          <>
            <span className={`${pill.title} ${pill.cut}`}>{title}</span>
            <span className={`${pill.artist} ${pill.cut}`}>{artist}</span>
          </>
        )}
      </span>
    </button>
  )
}
