import { expect, test } from '@playwright/test'
import { candidatesFromAcoustId, type AcoustIdAnswer } from '../src/main/identify/soundMatch'

// Shaped like AcoustID's real answer for a "Numb" download from my library: one fingerprint, linked to a live bootleg,
// the album recording, and a video compilation. The album shows up as a 2014 reissue before the 2003 original.
const id = (n: number): string => `0000000${n}-0000-4000-8000-00000000000${n}`.slice(-36)
const LINKIN = [{ name: 'Linkin Park' }]

const NUMB: AcoustIdAnswer = {
  status: 'ok',
  results: [
    {
      score: 0.984,
      recordings: [
        {
          id: id(1),
          title: 'Numb',
          artists: LINKIN,
          releasegroups: [{ id: id(2), title: '2002-02-02: Colorado Springs, CO, USA', type: 'Album', secondarytypes: ['Live'], artists: LINKIN, releases: [{ id: id(3) }] }]
        },
        {
          id: id(4),
          title: 'Numb',
          artists: LINKIN,
          duration: 187.52,
          releasegroups: [
            {
              id: id(5),
              title: 'Meteora',
              type: 'Album',
              artists: LINKIN,
              releases: [
                { id: id(6), date: { year: 2014 }, mediums: [{ position: 2, tracks: [{ position: 6 }] }] },
                { id: id(7), date: { year: 2003, month: 3, day: 25 }, mediums: [{ position: 1, tracks: [{ position: 13 }] }] }
              ]
            },
            { id: id(8), title: 'Numb', type: 'Single', artists: LINKIN, releases: [{ id: id(9), date: { year: 2003 }, mediums: [{ position: 1, tracks: [{ position: 1 }] }] }] },
            { id: id(10), title: 'Greatest Hits', type: 'Album', secondarytypes: ['Compilation'], artists: LINKIN, releases: [{ id: id(11), date: { year: 2011 } }] }
          ]
        },
        {
          id: id(12),
          title: 'Numb',
          artists: LINKIN,
          duration: 186,
          releasegroups: [{ id: id(13), title: 'Meteora Collection (Digital Video Compilation)', type: 'Other', artists: LINKIN, releases: [{ id: id(14) }] }]
        }
      ]
    }
  ]
}

const COVERS = 'https://coverartarchive.org'

test('the original album comes first, with the original release’s year, disc, and track number', () => {
  const [best] = candidatesFromAcoustId(NUMB, 186, COVERS)
  expect(best).toMatchObject({ title: 'Numb', artist: 'Linkin Park', album: 'Meteora', year: 2003, discNumber: 1, trackNumber: 13, bySound: true })
  expect(best.coverUrl).toBe(`${COVERS}/release-group/${id(5)}/front-500`)
})

test('the album beats the single even when both fit perfectly, and compilations and live recordings rank below', () => {
  const albums = candidatesFromAcoustId(NUMB, 186, COVERS).map((candidate) => candidate.album)
  expect(albums.slice(0, 3)).toEqual(['Meteora', 'Numb', 'Greatest Hits'])
  expect(albums.length).toBeLessThanOrEqual(4)
})

test('weak fingerprint matches are left out, keeping only the most likely release', () => {
  const weak: AcoustIdAnswer = { results: [{ score: 0.4, recordings: NUMB.results![0].recordings }] }
  expect(candidatesFromAcoustId(weak, 186, COVERS).map((candidate) => candidate.album)).toEqual(['Meteora'])
  expect(candidatesFromAcoustId({ results: [{ score: 0.2, recordings: NUMB.results![0].recordings }] }, 186, COVERS)).toEqual([])
})

test('an empty answer gives no matches', () => {
  expect(candidatesFromAcoustId({ status: 'ok', results: [] }, 186, COVERS)).toEqual([])
  expect(candidatesFromAcoustId({}, null, COVERS)).toEqual([])
})

test('artist names joined the way MusicBrainz writes them', () => {
  const answer: AcoustIdAnswer = {
    results: [
      {
        score: 0.95,
        recordings: [
          {
            id: id(1),
            title: 'Numb / Encore',
            artists: [{ name: 'Jay-Z', joinphrase: ' & ' }, { name: 'Linkin Park' }],
            releasegroups: [{ id: id(2), title: 'Collision Course', type: 'EP', artists: [{ name: 'Jay-Z', joinphrase: ' & ' }, { name: 'Linkin Park' }] }]
          }
        ]
      }
    ]
  }
  expect(candidatesFromAcoustId(answer, null, COVERS)[0]).toMatchObject({ artist: 'Jay-Z & Linkin Park', albumArtist: 'Jay-Z & Linkin Park' })
})
