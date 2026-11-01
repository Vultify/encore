import { net } from 'electron'
import type { MatchCandidate } from '../../shared/api'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const REMEMBERED_CANDIDATES = 4000

// A candidate plus where its cover lives and, for Apple's catalog, who made it. These stay in the main process.
export interface FoundCandidate extends MatchCandidate {
  coverUrl: string | null
  thumbnailUrl: string | null
  artistId: number | null
}

export class LookupError extends Error {}

// Every candidate handed to the interface is remembered here, so a pick can only ever be one Encore found itself.
const found = new Map<string, FoundCandidate>()

export const foundCandidate = (id: string): FoundCandidate | undefined => found.get(id)

export function remember(candidate: FoundCandidate): void {
  found.delete(candidate.id)
  found.set(candidate.id, candidate)
  if (found.size > REMEMBERED_CANDIDATES) found.delete(found.keys().next().value!)
}

// Covers only ever come from Apple's image servers and the Cover Art Archive, or from the stand-ins tests set up.
const IMAGE_HOSTS = [/\.mzstatic\.com$/, /^coverartarchive\.org$/]
const testOrigins = [process.env.ENCORE_LOOKUP_URL, process.env.ENCORE_ACOUSTID_URL, process.env.ENCORE_COVERART_URL]
  .filter((url): url is string => Boolean(url))
  .map((url) => new URL(url).origin)

function isAllowedImage(url: string): boolean {
  try {
    const target = new URL(url)
    if (target.protocol === 'https:' && IMAGE_HOSTS.some((host) => host.test(target.hostname))) return true
    return testOrigins.includes(target.origin)
  } catch {
    return false
  }
}

export async function fetchImage(url: string): Promise<{ data: Uint8Array<ArrayBuffer>; type: string } | null> {
  if (!isAllowedImage(url)) return null
  const response = await net.fetch(url).catch(() => null)
  const type = response?.headers.get('content-type')?.split(';')[0].trim() ?? ''
  if (!response?.ok || !type.startsWith('image/')) return null
  const data = new Uint8Array(await response.arrayBuffer())
  return data.length > 0 && data.length <= MAX_IMAGE_BYTES ? { data, type } : null
}
