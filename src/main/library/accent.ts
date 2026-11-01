import { join } from 'node:path'
import { app, nativeImage } from 'electron'
import { ARTWORK_ID } from '../../shared/api'
import { pickAccent } from './palette'

// A small copy of the cover is plenty to find its main color, and quick to read.
const SAMPLE_SIZE = 48

// Each cover's color, worked out once. Null means the cover has no real color, so teal stays.
const accents = new Map<string, string | null>()

export function accentForArtwork(artworkId: string): string | null {
  if (!ARTWORK_ID.test(artworkId)) return null
  if (accents.has(artworkId)) return accents.get(artworkId)!

  const image = nativeImage.createFromPath(join(app.getPath('userData'), 'artwork', artworkId))
  const accent = image.isEmpty() ? null : pickAccent(image.resize({ width: SAMPLE_SIZE, height: SAMPLE_SIZE, quality: 'good' }).toBitmap())
  accents.set(artworkId, accent)
  return accent
}
