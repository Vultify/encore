import { expect, test } from '@playwright/test'
import { pickAccent } from '../src/main/library/palette'

// Builds an image as RGBA pixels from [color, share] pairs.
function image(parts: [[number, number, number], number][], size = 1000): Uint8Array {
  const pixels: number[] = []
  for (const [[r, g, b], share] of parts) {
    for (let i = 0; i < Math.round(size * share); i++) pixels.push(r, g, b, 255)
  }
  return new Uint8Array(pixels)
}

const hue = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return Math.round(h * 60)
}

// Red sits at both ends of the color wheel, so it's measured as distance around the wheel from 0.
const isRed = (hex: string): boolean => Math.min(hue(hex), 360 - hue(hex)) < 12

const lightness = (hex: string): number => {
  const values = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return (Math.max(...values) + Math.min(...values)) / 2
}

test('a mostly red cover gives a red accent', () => {
  const accent = pickAccent(image([[[200, 30, 40], 1]]), 'rgba')!
  expect(isRed(accent)).toBe(true)
})

test('the vivid color wins over a bigger dull background', () => {
  // Like the Good Apollo cover: mostly black, with a bold red mark.
  const accent = pickAccent(image([[[10, 10, 12], 0.7], [[90, 90, 95], 0.15], [[210, 30, 45], 0.15]]), 'rgba')!
  expect(isRed(accent)).toBe(true)
})

test('tiny specks of color are ignored', () => {
  expect(pickAccent(image([[[20, 20, 20], 0.98], [[40, 200, 60], 0.02]]), 'rgba')).toBeNull()
})

test('black, white, and grey covers give no accent, so teal stays', () => {
  expect(pickAccent(image([[[0, 0, 0], 0.5], [[255, 255, 255], 0.5]]), 'rgba')).toBeNull()
  expect(pickAccent(image([[[128, 128, 128], 1]]), 'rgba')).toBeNull()
})

test('dark colors are lifted so they read on the dark background', () => {
  const accent = pickAccent(image([[[20, 30, 110], 1]]), 'rgba')!
  expect(lightness(accent)).toBeGreaterThanOrEqual(0.54)
  expect(hue(accent)).toBeGreaterThan(220)
  expect(hue(accent)).toBeLessThan(240)
})

test('blue, green, red, alpha pixels are read the right way round', () => {
  // The same pure red, stored blue first.
  const accent = pickAccent(new Uint8Array([40, 30, 200, 255, 40, 30, 200, 255]), 'bgra')!
  expect(isRed(accent)).toBe(true)
})

test('see-through pixels are ignored', () => {
  expect(pickAccent(new Uint8Array([200, 30, 40, 0, 200, 30, 40, 0]), 'rgba')).toBeNull()
})
