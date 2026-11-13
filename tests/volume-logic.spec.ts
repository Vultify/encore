import { expect, test } from '@playwright/test'
import { wheelVolume } from '../src/renderer/src/lib/volume'

test('one notch of the wheel moves the volume a step and stops at the ends', () => {
  expect(wheelVolume(0.5, false, -100)).toBe(0.55)
  expect(wheelVolume(0.5, false, 100)).toBe(0.45)
  expect(wheelVolume(0.98, false, -100)).toBe(1)
  expect(wheelVolume(0.02, false, 100)).toBe(0)
  expect(wheelVolume(0.3, false, -3)).toBe(0.35)
  expect(wheelVolume(0.5, false, 0)).toBeNull()
})

test('while muted, scrolling down stays silent and scrolling up unmutes from where the volume was', () => {
  expect(wheelVolume(0.6, true, 100)).toBeNull()
  expect(wheelVolume(0.6, true, -100)).toBe(0.65)
})
