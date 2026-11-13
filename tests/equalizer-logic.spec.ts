import { expect, test } from '@playwright/test'
import {
  clampGain,
  DEFAULT_EQUALIZER,
  EQ_BANDS,
  EQ_PRESETS,
  EQ_RANGE,
  equalizerGains,
  isEqualizerSettings,
  peakBoost,
  type EqualizerSettings
} from '../src/shared/equalizer'

const levels = (gain: number): number[] => EQ_BANDS.map(() => gain)

test('every preset has a whole-decibel level for each band, inside the range', () => {
  expect(new Set(EQ_PRESETS.map((preset) => preset.name)).size).toBe(EQ_PRESETS.length)
  for (const preset of EQ_PRESETS) {
    expect(preset.gains).toHaveLength(EQ_BANDS.length)
    for (const gain of preset.gains) {
      expect(Number.isInteger(gain)).toBe(true)
      expect(Math.abs(gain)).toBeLessThanOrEqual(EQ_RANGE)
    }
  }
})

test('the levels come from the picked preset, or from Custom', () => {
  const custom = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  expect(equalizerGains({ enabled: true, preset: 'bass', custom })).toEqual([6, 5, 4, 2, 1, 0, 0, 0, 0, 0])
  expect(equalizerGains({ enabled: true, preset: 'custom', custom })).toEqual(custom)

  // Changing what comes back never changes a preset or the saved Custom levels.
  equalizerGains({ enabled: true, preset: 'flat', custom })[0] = 9
  equalizerGains({ enabled: true, preset: 'custom', custom })[0] = 9
  expect(EQ_PRESETS[0].gains[0]).toBe(0)
  expect(custom[0]).toBe(1)
})

test('levels move in whole decibels and stop at the ends', () => {
  expect(clampGain(3.4)).toBe(3)
  expect(clampGain(-2.6)).toBe(-3)
  expect(clampGain(40)).toBe(EQ_RANGE)
  expect(clampGain(-40)).toBe(-EQ_RANGE)
})

test('saved settings only count when every part makes sense', () => {
  expect(isEqualizerSettings(DEFAULT_EQUALIZER)).toBe(true)
  expect(isEqualizerSettings({ enabled: true, preset: 'custom', custom: levels(-12) })).toBe(true)

  const bad: unknown[] = [
    null,
    'flat',
    { ...DEFAULT_EQUALIZER, enabled: 'yes' },
    { ...DEFAULT_EQUALIZER, preset: 'jazz' },
    { ...DEFAULT_EQUALIZER, custom: levels(0).slice(1) },
    { ...DEFAULT_EQUALIZER, custom: levels(13) },
    { ...DEFAULT_EQUALIZER, custom: levels(1.5) }
  ]
  for (const value of bad) expect(isEqualizerSettings(value)).toBe(false)
})

test('the volume makes room for exactly as much as the equalizer boosts', () => {
  for (const sampleRate of [44100, 48000]) {
    expect(peakBoost(levels(0), sampleRate)).toBe(0)
    expect(peakBoost(levels(-6), sampleRate)).toBe(0)

    // One band on its own peaks right at its slider.
    const one = levels(0)
    one[5] = 6
    expect(peakBoost(one, sampleRate)).toBeCloseTo(6, 1)

    // Boosting every band raises the whole sound by more than any one slider, since neighbors add up.
    expect(peakBoost(levels(6), sampleRate)).toBeGreaterThan(7)
  }

  const bass: EqualizerSettings = { enabled: true, preset: 'bass', custom: levels(0) }
  expect(peakBoost(equalizerGains(bass), 48000)).toBeGreaterThanOrEqual(6)
})
