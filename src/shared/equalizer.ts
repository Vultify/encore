// The equalizer's settings and math, shared so the main process can check what's saved and tests can run it.

// Ten bands an octave apart, in hertz, from deep bass to air.
export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
// How far each band moves up or down, in decibels.
export const EQ_RANGE = 12
// How wide each band is: about an octave, so neighbors meet without gaps.
export const EQ_Q = 1.4

export type EqPresetId = 'flat' | 'bass' | 'treble' | 'vocal' | 'rock' | 'pop' | 'hiphop' | 'electronic' | 'acoustic'
export type EqChoice = EqPresetId | 'custom'

export interface EqPreset {
  id: EqPresetId
  name: string
  gains: readonly number[]
}

export interface EqualizerSettings {
  enabled: boolean
  preset: EqChoice
  // The levels for Custom, kept while another preset is picked.
  custom: number[]
}

const FLAT: readonly number[] = EQ_BANDS.map(() => 0)

export const EQ_PRESETS: readonly EqPreset[] = [
  { id: 'flat', name: 'Flat', gains: FLAT },
  { id: 'bass', name: 'Bass boost', gains: [6, 5, 4, 2, 1, 0, 0, 0, 0, 0] },
  { id: 'treble', name: 'Treble boost', gains: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6] },
  { id: 'vocal', name: 'Vocal', gains: [-2, -2, -1, 1, 3, 4, 4, 3, 1, 0] },
  { id: 'rock', name: 'Rock', gains: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5] },
  { id: 'pop', name: 'Pop', gains: [-1, 0, 2, 4, 5, 4, 2, 0, -1, -1] },
  { id: 'hiphop', name: 'Hip-hop', gains: [5, 5, 3, 1, -1, -1, 1, 0, 1, 2] },
  { id: 'electronic', name: 'Electronic', gains: [5, 4, 1, 0, -2, 2, 1, 2, 4, 5] },
  { id: 'acoustic', name: 'Acoustic', gains: [4, 3, 2, 1, 2, 2, 3, 3, 2, 1] }
]

export const DEFAULT_EQUALIZER: EqualizerSettings = { enabled: false, preset: 'flat', custom: [...FLAT] }

// Bands move in whole decibels and stop at the ends of the range.
export const clampGain = (gain: number): number => Math.min(EQ_RANGE, Math.max(-EQ_RANGE, Math.round(gain)))

// The level of each band for the picked preset, or the saved Custom levels.
export function equalizerGains(settings: EqualizerSettings): number[] {
  if (settings.preset === 'custom') return [...settings.custom]
  return [...(EQ_PRESETS.find((preset) => preset.id === settings.preset)?.gains ?? FLAT)]
}

const isGainList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length === EQ_BANDS.length && value.every((gain) => Number.isInteger(gain) && Math.abs(gain) <= EQ_RANGE)

export function isEqualizerSettings(value: unknown): value is EqualizerSettings {
  const settings = value as EqualizerSettings | null
  return (
    !!settings &&
    typeof settings === 'object' &&
    typeof settings.enabled === 'boolean' &&
    (settings.preset === 'custom' || EQ_PRESETS.some((preset) => preset.id === settings.preset)) &&
    isGainList(settings.custom)
  )
}

// How much one band changes a frequency, in decibels. These are the peaking filter formulas the audio engine
// itself uses, so the result matches what's heard.
function bandLevel(center: number, gain: number, frequency: number, sampleRate: number): number {
  if (gain === 0) return 0
  const a = 10 ** (gain / 40)
  const w0 = (2 * Math.PI * center) / sampleRate
  const alpha = Math.sin(w0) / (2 * EQ_Q)
  const cos0 = Math.cos(w0)
  const w = (2 * Math.PI * frequency) / sampleRate
  const size = (c0: number, c1: number, c2: number): number =>
    Math.hypot(c0 + c1 * Math.cos(w) + c2 * Math.cos(2 * w), c1 * Math.sin(w) + c2 * Math.sin(2 * w))
  return 20 * Math.log10(size(1 + alpha * a, -2 * cos0, 1 - alpha * a) / size(1 + alpha / a, -2 * cos0, 1 - alpha / a))
}

// Frequencies checked for the loudest point: every band's center, plus a fine sweep of what people hear.
const SWEEP = 240
const CHECKED = [...EQ_BANDS, ...Array.from({ length: SWEEP + 1 }, (_, i) => 20 * 1000 ** (i / SWEEP))]

// The most the equalizer raises any part of the sound, in decibels. Neighboring boosts add up, so this can be
// more than the highest slider. Encore lowers the volume by this much, so boosted songs never crackle.
export function peakBoost(gains: readonly number[], sampleRate: number): number {
  let peak = 0
  for (const frequency of CHECKED) {
    const level = gains.reduce((sum, gain, band) => sum + bandLevel(EQ_BANDS[band], gain, frequency, sampleRate), 0)
    peak = Math.max(peak, level)
  }
  return peak
}
