import { expect, test } from '@playwright/test'
import { CANDIDATE_ID, type MatchCandidate } from '../src/shared/api'
import { coreTitle, looksOriginal, needsDeeperLook, preferLocalSpelling, rankCandidates, searchTerm } from '../src/main/identify/match'

let nextId = 1
const result = (title: string, artist: string, album: string, seconds: number, extra: Partial<MatchCandidate> = {}): MatchCandidate => ({
  id: `itunes-${nextId++}`,
  title,
  artist,
  album,
  albumArtist: null,
  trackNumber: 1,
  discNumber: 1,
  year: 2003,
  duration: seconds,
  score: 0,
  bySound: false,
  ...extra
})

const albums = (ranked: MatchCandidate[]): string[] => ranked.map((candidate) => `${candidate.title} / ${candidate.album}`)

test('the search term drops video junk and featured artists', () => {
  expect(searchTerm({ title: 'Uptown Funk (Lyrics) ft. Bruno Mars', artist: 'Mark Ronson', duration: null })).toBe('Mark Ronson Uptown Funk')
  expect(searchTerm({ title: 'Welcome Home (Official Video)', artist: 'Coheed and Cambria', duration: null })).toBe('Coheed and Cambria Welcome Home')
  expect(searchTerm({ title: 'Numb', artist: null, duration: null })).toBe('Numb')
})

test('core titles ignore brackets and featured artists', () => {
  expect(coreTitle('Uptown Funk (feat. Bruno Mars)')).toBe('uptown funk')
  expect(coreTitle('Uptown Funk ft. Bruno Mars')).toBe('uptown funk')
  expect(coreTitle('Numb [Live In Texas]')).toBe('numb')
})

// Real results Apple's search returned for "Linkin Park Numb".
test('the album version beats live versions, helped by the length', () => {
  const ranked = rankCandidates({ title: 'Numb', artist: 'Linkin Park', duration: 186 }, [
    result('Numb', 'LINKIN PARK', 'Meteora (Deluxe Edition)', 187.5, { trackNumber: 13 }),
    result('Numb (Live In Texas)', 'LINKIN PARK', 'Live In Texas', 194.3, { trackNumber: 13 }),
    result('Numb (Live)', 'LINKIN PARK', 'One More Light: Live', 230.6, { trackNumber: 14 }),
    result('Numb', 'LINKIN PARK', 'Meteora', 187.5, { trackNumber: 13 })
  ])
  expect(albums(ranked)).toEqual(['Numb / Meteora', 'Numb / Meteora (Deluxe Edition)'])
  expect(ranked[0].score).toBeGreaterThanOrEqual(0.9)
})

// Real results Apple's search returned for "Mark Ronson Uptown Funk".
test('the original beats remixes, and repeats of the same album track are dropped', () => {
  const ranked = rankCandidates({ title: 'Uptown Funk ft. Bruno Mars', artist: 'Mark Ronson', duration: 268 }, [
    result('Uptown Funk (feat. Bruno Mars)', 'Mark Ronson', 'Uptown Special', 269.7, { trackNumber: 4 }),
    result('Uptown Funk (feat. Bruno Mars) [Dave Audé Remix]', 'Mark Ronson', 'Uptown Funk (feat. Bruno Mars) [Remixes] - EP', 237.4, { trackNumber: 2 }),
    result('Uptown Funk (feat. Bruno Mars)', 'Mark Ronson', 'Uptown Special', 269.7, { trackNumber: 4 }),
    result('Uptown Funk (feat. Bruno Mars)', 'Mark Ronson', 'Uptown Funk (feat. Bruno Mars) [Remixes] - EP', 269.7, { trackNumber: 1 })
  ])
  expect(albums(ranked)[0]).toBe('Uptown Funk (feat. Bruno Mars) / Uptown Special')
  expect(ranked.filter((candidate) => candidate.album === 'Uptown Special')).toHaveLength(1)
  expect(albums(ranked)).not.toContain('Uptown Funk (feat. Bruno Mars) [Dave Audé Remix] / Uptown Funk (feat. Bruno Mars) [Remixes] - EP')
})

test('tribute and karaoke albums are pushed out, like the ones Picard picked', () => {
  const ranked = rankCandidates({ title: 'Numb', artist: 'Linkin Park', duration: 186 }, [
    result('Numb (Linkin Park Tribute)', 'It Lives, It Breathes', 'Linkin Park/Slipknot Tribute', 190),
    result('Numb', 'Karaoke Kings', 'Karaoke Hits 2003', 186),
    result('Numb', 'LINKIN PARK', 'Meteora', 187.5)
  ])
  expect(albums(ranked)).toEqual(['Numb / Meteora'])
})

test('a live song stays a candidate when the song itself is live', () => {
  const ranked = rankCandidates({ title: 'Numb (Live)', artist: 'Linkin Park', duration: 230 }, [
    result('Numb (Live)', 'LINKIN PARK', 'One More Light: Live', 230.6),
    result('Numb', 'LINKIN PARK', 'Meteora', 187.5)
  ])
  expect(albums(ranked)[0]).toBe('Numb (Live) / One More Light: Live')
})

// Real results Apple's search returned while checking Caleb's own songs.
test('a song with the same name by a different artist is not offered', () => {
  const ranked = rankCandidates({ title: 'Numb', artist: 'Linkin Park', duration: 186 }, [
    result('Numb', 'LINKIN PARK', 'Meteora', 188),
    result('NUMB', 'XXXTENTACION', '?', 186)
  ])
  expect(albums(ranked)).toEqual(['Numb / Meteora'])
})

test('the original album beats a compilation of the same recording', () => {
  const ranked = rankCandidates({ title: 'Numb', artist: 'Linkin Park', duration: 186 }, [
    result('Numb', 'LINKIN PARK', 'Papercuts (Singles Collection 2000-2023)', 188),
    result('Numb', 'LINKIN PARK', 'Meteora', 188)
  ])
  expect(albums(ranked)).toEqual(['Numb / Meteora', 'Numb / Papercuts (Singles Collection 2000-2023)'])
})

test('a soundtrack credited to someone else ranks under the band’s own release', () => {
  const ranked = rankCandidates({ title: 'Welcome Home', artist: 'Coheed and Cambria', duration: 375 }, [
    result('Welcome Home', 'Coheed and Cambria', '9 (Original Motion Picture Soundtrack)', 375, { albumArtist: 'Danny Elfman & Deborah Lurie' }),
    result('Welcome Home', '8-Bit Misfits', '8-Bit Versions of Coheed and Cambria', 275),
    result('Welcome Home', 'Coheed and Cambria', 'Playlist: The Very Best of Coheed and Cambria', 376),
    result('Welcome Home', 'Sparrow Sleeps', 'In Keeping Secrets of Silent Birth 3: Lullaby renditions of Coheed and Cambria songs', 499),
    result('Welcome Home', 'Midnite String Quartet', 'MSQ Performs Coheed and Cambria', 291)
  ])
  expect(albums(ranked)).toEqual([
    'Welcome Home / Playlist: The Very Best of Coheed and Cambria',
    'Welcome Home / 9 (Original Motion Picture Soundtrack)'
  ])
})

test('a deeper look is needed when the best result is a compilation or not a near-perfect fit', () => {
  const song = { title: 'Welcome Home', artist: 'Coheed and Cambria', duration: 375 }
  const fromSearch = rankCandidates(song, [
    result('Welcome Home', 'Coheed and Cambria', '9 (Original Motion Picture Soundtrack)', 375, { albumArtist: 'Danny Elfman & Deborah Lurie' }),
    result('Welcome Home', 'Coheed and Cambria', 'Playlist: The Very Best of Coheed and Cambria', 376)
  ])
  expect(needsDeeperLook(fromSearch)).toBe(true)
  expect(needsDeeperLook([])).toBe(true)

  const numb = rankCandidates({ title: 'Numb', artist: 'Linkin Park', duration: 186 }, [result('Numb', 'LINKIN PARK', 'Meteora', 188)])
  expect(needsDeeperLook(numb)).toBe(false)
})

// The artist's own song list, which has the original album the song search skipped.
test('with the artist’s songs added, the original album wins', () => {
  const ranked = rankCandidates({ title: 'Welcome Home', artist: 'Coheed and Cambria', duration: 375 }, [
    result('Welcome Home', 'Coheed and Cambria', '9 (Original Motion Picture Soundtrack)', 375, { albumArtist: 'Danny Elfman & Deborah Lurie' }),
    result('Welcome Home', 'Coheed and Cambria', 'Playlist: The Very Best of Coheed and Cambria', 376),
    result('Welcome Home', 'Coheed and Cambria', "Good Apollo I'm Burning Star IV Volume One:  From Fear Through The Eyes Of Madness", 375, { trackNumber: 3 }),
    result('Welcome Home (Shawn "Clown" Crahan Remix)', 'Coheed and Cambria', 'Welcome Home (Shawn "Clown" Crahan Remix) - Single', 232),
    result('Welcome Home', 'Coheed and Cambria', 'The Essential Coheed & Cambria', 375)
  ])
  expect(albums(ranked)[0]).toBe("Welcome Home / Good Apollo I'm Burning Star IV Volume One:  From Fear Through The Eyes Of Madness")
  expect(looksOriginal(ranked[0])).toBe(true)
  expect(albums(ranked)).not.toContain('Welcome Home (Shawn "Clown" Crahan Remix) / Welcome Home (Shawn "Clown" Crahan Remix) - Single')
})

test('an instrumental of the same length is still a different recording', () => {
  const ranked = rankCandidates({ title: 'Numb', artist: 'Linkin Park', duration: 186 }, [
    result('Numb', 'LINKIN PARK', 'Meteora', 188),
    result('Numb (Instrumental)', 'LINKIN PARK', 'Papercuts: Instrumentals', 186)
  ])
  expect(albums(ranked)).toEqual(['Numb / Meteora'])
})

test('a different song is not a match', () => {
  expect(rankCandidates({ title: 'Numb', artist: 'Linkin Park', duration: 186 }, [result('Faint', 'LINKIN PARK', 'Meteora', 162)])).toEqual([])
})

test('the local spelling of an artist is kept when it is the same name', () => {
  expect(preferLocalSpelling('Linkin Park', 'LINKIN PARK')).toBe('Linkin Park')
  expect(preferLocalSpelling('Linkin Park', 'Jay-Z & Linkin Park')).toBe('Jay-Z & Linkin Park')
  expect(preferLocalSpelling(null, 'Mark Ronson')).toBe('Mark Ronson')
})

test('match ids: Apple and MusicBrainz shapes pass, anything else is refused', () => {
  expect(CANDIDATE_ID.test('itunes-590423552')).toBe(true)
  expect(CANDIDATE_ID.test('mb-11111111-2222-3333-4444-555555555555-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(true)
  for (const bad of ['itunes-1x', 'itunes-', '../etc', 'mb-11111111-2222-3333-4444-555555555555', 'mb-ZZZZZZZZ-2222-3333-4444-555555555555-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']) {
    expect(CANDIDATE_ID.test(bad)).toBe(false)
  }
})
