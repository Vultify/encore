// Picks an accent color from cover art: the most vivid color that covers a fair share of the image,
// adjusted so it reads well on Encore's near-black background.

interface Hsl {
  h: number
  s: number
  l: number
}

const HUE_BUCKETS = 24
// A color has to cover at least this share of the cover to count, so tiny specks don't win.
const MIN_COVERAGE = 0.03
// Close to grey, black, or white doesn't count as a color.
const MIN_SATURATION = 0.22
const MIN_LIGHTNESS = 0.12
const MAX_LIGHTNESS = 0.92
// Where the picked color lands, so it's bright enough for the play button and its dark icon.
const SATURATION_RANGE = [0.45, 0.85] as const
const LIGHTNESS_RANGE = [0.55, 0.68] as const

function toHsl(r: number, g: number, b: number): Hsl {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = d / (1 - Math.abs(2 * l - 1))
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const h = max === rn ? ((gn - bn) / d + 6) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return { h: h * 60, s, l }
}

function toHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`
}

const clamp = (value: number, [low, high]: readonly [number, number]): number => Math.min(high, Math.max(low, value))

// Pixels come four bytes each. Electron hands over bitmaps as blue, green, red, alpha.
export function pickAccent(pixels: Uint8Array, order: 'bgra' | 'rgba' = 'bgra'): string | null {
  const [ri, bi] = order === 'bgra' ? [2, 0] : [0, 2]
  const buckets = Array.from({ length: HUE_BUCKETS }, () => ({ count: 0, weight: 0, r: 0, g: 0, b: 0 }))
  let total = 0

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    total += 1
    const r = pixels[i + ri]
    const g = pixels[i + 1]
    const b = pixels[i + bi]
    const { h, s, l } = toHsl(r, g, b)
    if (s < MIN_SATURATION || l < MIN_LIGHTNESS || l > MAX_LIGHTNESS) continue

    // Vivid, mid-bright pixels count most.
    const weight = s * (1 - Math.abs(l - 0.5) * 1.4)
    const bucket = buckets[Math.floor(h / (360 / HUE_BUCKETS)) % HUE_BUCKETS]
    bucket.count += 1
    bucket.weight += weight
    bucket.r += r * weight
    bucket.g += g * weight
    bucket.b += b * weight
  }

  const best = buckets
    .filter((bucket) => total > 0 && bucket.count / total >= MIN_COVERAGE && bucket.weight > 0)
    .sort((a, b) => b.weight - a.weight)[0]
  if (!best) return null

  const average = toHsl(best.r / best.weight, best.g / best.weight, best.b / best.weight)
  return toHex({ h: average.h, s: clamp(average.s, SATURATION_RANGE), l: clamp(average.l, LIGHTNESS_RANGE) })
}
