import { useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import styles from './Marquee.module.css'

// How fast the text moves, in pixels a second, and how long it rests at the start of each pass. Scrolling started
// by hovering rests only briefly, since someone is waiting to read it.
const SPEED = 28
const REST_MS = 2500
const HOVER_REST_MS = 600
// Space between the end of the text and its copy coming round again.
const GAP = 36
// Extra room left of the text for the fade, matching the stylesheet.
const EDGE = 6

interface MarqueeProps {
  text: string
  className?: string
  // With motion off, the text only scrolls while this is true, like while the pointer is over it.
  play?: boolean
}

// One line of text. When it's too long to show, it rests, scrolls along, and comes round again, so the whole name
// can be read. With motion off it's cut off with an ellipsis and only scrolls on hover. Either way, hovering shows
// the whole name as a tooltip.
export function Marquee({ text, className = '', play = false }: MarqueeProps) {
  const reduce = useReducedMotion()
  const box = useRef<HTMLSpanElement>(null)
  const track = useRef<HTMLSpanElement>(null)
  const first = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState(0)
  const [room, setRoom] = useState(0)
  const overflow = width > room + 1
  const moving = overflow && (!reduce || play)

  // Measured again when the text changes, the space for it changes, or the font finishes loading.
  useLayoutEffect(() => {
    let live = true
    const measure = (): void => {
      if (!live) return
      setWidth(first.current!.offsetWidth)
      setRoom(box.current!.clientWidth - EDGE)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box.current!)
    void document.fonts.ready.then(measure)
    return () => {
      live = false
      observer.disconnect()
    }
  }, [text])

  useLayoutEffect(() => {
    if (!moving) return
    const rest = reduce ? HOVER_REST_MS : REST_MS
    const distance = width + GAP
    const duration = rest + (distance / SPEED) * 1000
    const animation = track.current!.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(0)', offset: rest / duration },
        { transform: `translateX(-${distance}px)` }
      ],
      { duration, iterations: Infinity }
    )
    return () => animation.cancel()
  }, [moving, reduce, width, text])

  return (
    <span ref={box} className={`${styles.marquee} ${className}`} data-scrolling={moving || undefined} title={overflow ? text : undefined}>
      <span ref={track} className={styles.track}>
        <span ref={first}>{text}</span>
        {moving && (
          <span aria-hidden="true" style={{ paddingLeft: GAP }}>
            {text}
          </span>
        )}
      </span>
    </span>
  )
}
