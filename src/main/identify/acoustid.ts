import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { net } from 'electron'
import fpcalcPath from '../../../resources/bin/fpcalc.exe?asset&asarUnpack'
import { LookupError, remember, type FoundCandidate } from './candidates'
import { candidatesFromAcoustId, type AcoustIdAnswer } from './soundMatch'
import { soundKey } from '../settings'

const run = promisify(execFile)

// Tests point these at stand-ins so they never depend on AcoustID or the Cover Art Archive.
const LOOKUP_URL = process.env.ENCORE_ACOUSTID_URL ?? 'https://api.acoustid.org/v2/lookup'
const COVER_ART_URL = process.env.ENCORE_COVERART_URL ?? 'https://coverartarchive.org'
// Each person's own free key from acoustid.org, saved in Settings. Without one, tests supply theirs, and while
// developing it can come from .env. Built apps never carry a key of their own, since anyone could pull it out.
const FALLBACK_KEY = process.env.ENCORE_ACOUSTID_KEY ?? (import.meta.env.DEV ? import.meta.env.MAIN_VITE_ACOUSTID_KEY : '') ?? ''
const key = (): string => soundKey() ?? FALLBACK_KEY
// AcoustID allows three lookups a second.
const REQUEST_GAP_MS = 400
// Two minutes of a song is plenty to recognize it, and keeps fingerprinting quick.
const LISTEN_SECONDS = 120
const FINGERPRINT_TIMEOUT_MS = 30_000
const INVALID_KEY = 4

let lastRequest = 0
async function waitTurn(): Promise<void> {
  const wait = lastRequest + REQUEST_GAP_MS - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequest = Date.now()
}

// Listens to the song with Chromaprint and returns its fingerprint. Nothing leaves the computer here.
async function fingerprint(path: string): Promise<{ duration: number; fingerprint: string } | null> {
  try {
    const { stdout } = await run(fpcalcPath, ['-json', '-length', String(LISTEN_SECONDS), path], {
      timeout: FINGERPRINT_TIMEOUT_MS,
      windowsHide: true
    })
    const print = JSON.parse(stdout) as { duration?: number; fingerprint?: string }
    return print.fingerprint && print.duration ? { duration: print.duration, fingerprint: print.fingerprint } : null
  } catch {
    return null
  }
}

// Recognizes a song by its sound: makes its fingerprint, sends only that to AcoustID, and ranks the releases
// it's on. Returns nothing when there's no key, the song can't be fingerprinted, or AcoustID doesn't know it.
export async function matchBySound(path: string, songLength: number | null): Promise<FoundCandidate[]> {
  // Read once, so removing the key while a song is fingerprinted can't send an empty one.
  const client = key()
  if (!client) return []
  const print = await fingerprint(path)
  if (!print) return []

  await waitTurn()
  const body = new URLSearchParams({
    client,
    duration: String(Math.round(print.duration)),
    fingerprint: print.fingerprint,
    meta: 'recordings releasegroups releases tracks',
    format: 'json'
  })
  // Listening is only a backup, so if AcoustID can't be reached this song just gets no sound matches.
  const response = await net.fetch(LOOKUP_URL, { method: 'POST', body }).catch(() => null)
  if (!response) return []

  const answer = (await response.json().catch(() => ({}))) as AcoustIdAnswer & { error?: { code?: number } }
  if (answer.status !== 'ok') {
    if (answer.error?.code === INVALID_KEY) {
      throw new LookupError("Your AcoustID key isn't working. Check it under Music in Settings.")
    }
    return []
  }

  const candidates = candidatesFromAcoustId(answer, songLength ?? print.duration, COVER_ART_URL)
  candidates.forEach(remember)
  return candidates
}
