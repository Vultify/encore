import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

// A song as Apple's search returns it, minus the fields Encore ignores.
export interface CatalogSong {
  trackId: number
  trackName: string
  artistId?: number
  artistName: string
  collectionName: string
  collectionArtistName?: string
  trackNumber: number
  discNumber?: number
  releaseDate: string
  trackTimeMillis: number
}

// An artist's full song list, which Apple returns from a lookup by artist number.
export interface CatalogArtist {
  artistId: number
  artistName: string
  songs: CatalogSong[]
}

export interface LookupServer {
  url: string
  // Every song search term Encore sent, in order.
  terms: string[]
  // Every artist number Encore looked up, in order.
  artistLookups: number[]
  close: () => Promise<void>
}

// Stands in for Apple's catalog. A song search returns every song listed under a key found in the term.
// An artist search finds artists by name, a lookup returns an artist's songs, and any /art/ path returns a cover.
export async function startLookupServer(catalog: Record<string, CatalogSong[]>, artists: CatalogArtist[] = []): Promise<LookupServer> {
  const cover = readFileSync('resources/icon.png')
  const terms: string[] = []
  const artistLookups: number[] = []
  let origin = ''

  const asResults = (songs: object[]): string => JSON.stringify({ resultCount: songs.length, results: songs })
  const withArtwork = (song: CatalogSong): object => ({
    wrapperType: 'track',
    kind: 'song',
    ...song,
    artworkUrl100: `${origin}/art/${song.trackId}/100x100bb.png`
  })

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', origin)
    const json = { 'Content-Type': 'text/javascript; charset=utf-8' }

    if (url.pathname.startsWith('/art/')) {
      response.writeHead(200, { 'Content-Type': 'image/png' }).end(cover)
    } else if (url.pathname === '/lookup') {
      const id = Number(url.searchParams.get('id'))
      artistLookups.push(id)
      const artist = artists.find((candidate) => candidate.artistId === id)
      const found = artist ? [{ wrapperType: 'artist', artistId: id, artistName: artist.artistName }, ...artist.songs.map(withArtwork)] : []
      response.writeHead(200, json).end(asResults(found))
    } else if (url.pathname === '/search' && url.searchParams.get('entity') === 'musicArtist') {
      const term = (url.searchParams.get('term') ?? '').toLowerCase()
      const found = artists
        .filter((artist) => term.includes(artist.artistName.toLowerCase()))
        .map(({ artistId, artistName }) => ({ wrapperType: 'artist', artistId, artistName }))
      response.writeHead(200, json).end(asResults(found))
    } else if (url.pathname === '/search') {
      const term = url.searchParams.get('term') ?? ''
      terms.push(term)
      const found = Object.entries(catalog)
        .filter(([key]) => term.toLowerCase().includes(key))
        .flatMap(([, songs]) => songs.map(withArtwork))
      response.writeHead(200, json).end(asResults(found))
    } else {
      response.writeHead(404).end()
    }
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    url: `${origin}/search`,
    terms,
    artistLookups,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  }
}
