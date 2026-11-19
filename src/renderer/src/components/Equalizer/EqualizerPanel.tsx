import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type RefObject } from 'react'
import { EQ_BANDS, EQ_PRESETS, EQ_RANGE, equalizerGains, type EqChoice } from '@shared/equalizer'
import { player, usePlayerValue } from '@/player/player'
import { Segmented } from '../Segmented/Segmented'
import { Switch } from '../Switch/Switch'
import styles from './EqualizerPanel.module.css'

const CHOICES: { value: EqChoice; label: string }[] = [
  ...EQ_PRESETS.map((preset) => ({ value: preset.id, label: preset.name })),
  { value: 'custom', label: 'Custom' }
]

// Slider size in pixels. The curve is drawn on the same scale so it runs through the middle of every knob.
const TRACK = 150
const KNOB = 14

const shortHz = (hz: number): string => (hz >= 1000 ? `${hz / 1000}k` : String(hz))
const longHz = (hz: number): string => (hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`)
const signed = (gain: number): string => (gain > 0 ? `+${gain}` : String(gain))

// How far up its slider a knob sits for a level, in pixels from the top.
const knobY = (gain: number): number => KNOB / 2 + (1 - (gain + EQ_RANGE) / (2 * EQ_RANGE)) * (TRACK - KNOB)

// A smooth line through every knob, reaching out to both edges, with the area between it and 0 dB filled in.
function curvePaths(gains: number[]): { line: string; area: string } {
  const points: [number, number][] = gains.map((gain, i) => [(i + 0.5) * 10, knobY(gain)])
  points.unshift([0, points[0][1]])
  points.push([100, points[points.length - 1][1]])
  let line = `M${points[0]}`
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [points[i - 1] ?? points[i], points[i], points[i + 1], points[i + 2] ?? points[i + 1]]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    line += ` C${c1} ${c2} ${p2}`
  }
  return { line, area: `${line} L100,${knobY(0)} L0,${knobY(0)} Z` }
}

interface EqualizerPanelProps {
  id: string
  // The button that opens the panel. Clicking it is left to the button, so it can close the panel too.
  toggle: RefObject<HTMLButtonElement | null>
  onClose: () => void
}

// The glass panel above the dock: an on/off switch, presets, and a slider per band with the curve behind them.
export function EqualizerPanel({ id, toggle, onClose }: EqualizerPanelProps) {
  const equalizer = usePlayerValue((state) => state.equalizer)
  const gains = equalizerGains(equalizer)
  const panel = useRef<HTMLDivElement>(null)
  const { line, area } = curvePaths(gains)

  useEffect(() => {
    panel.current?.focus()
    const closeOutside = (event: PointerEvent): void => {
      const target = event.target as Node
      if (!panel.current?.contains(target) && !toggle.current?.contains(target)) onClose()
    }
    window.addEventListener('pointerdown', closeOutside, true)
    return () => window.removeEventListener('pointerdown', closeOutside, true)
  }, [toggle, onClose])

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    // Escape closes just the panel, not the Now Playing view behind it.
    event.stopPropagation()
    onClose()
    toggle.current?.focus()
  }

  return (
    <div
      id={id}
      ref={panel}
      className={styles.panel}
      role="dialog"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      data-off={!equalizer.enabled || undefined}
      style={{ '--track': `${TRACK}px`, '--knob': `${KNOB}px` } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <div className={styles.head}>
        <h2 id={`${id}-title`} className={styles.title}>
          Equalizer
        </h2>
        <Switch checked={equalizer.enabled} onChange={(on) => player.setEqualizerOn(on)} labelledBy={`${id}-title`} />
      </div>

      <Segmented
        className={styles.presets}
        layout="chips"
        label="Preset"
        options={CHOICES}
        value={equalizer.preset}
        onChange={(preset) => player.chooseEqualizerPreset(preset)}
      />

      <div className={styles.board}>
        <div className={styles.scale} aria-hidden="true">
          <span>+{EQ_RANGE}</span>
          <span>0</span>
          <span>−{EQ_RANGE}</span>
        </div>
        <div className={styles.bands}>
          <svg className={styles.curve} viewBox={`0 0 100 ${TRACK}`} preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" x2="100" y1={knobY(0)} y2={knobY(0)} className={styles.zero} />
            <path d={area} className={styles.area} />
            <path d={line} className={styles.line} />
          </svg>
          {EQ_BANDS.map((hz, i) => (
            <div key={hz} className={styles.band}>
              <input
                type="range"
                className={styles.slider}
                aria-label={longHz(hz)}
                aria-valuetext={`${signed(gains[i])} dB`}
                title={`${longHz(hz)}: ${signed(gains[i])} dB`}
                min={-EQ_RANGE}
                max={EQ_RANGE}
                step={1}
                value={gains[i]}
                onChange={(event) => player.setEqualizerBand(i, Number(event.target.value))}
              />
              <span className={styles.hz} aria-hidden="true">
                {shortHz(hz)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
