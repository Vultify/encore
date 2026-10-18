import { useMemo } from 'react'
import { groupAlbums, groupArtists, type Album, type Artist } from '@/lib/library'
import { useLibrary, type LibraryState } from '@/store/library'

// The library with its songs grouped into albums and artists, recomputed only when the songs change.
export function useLibraryGroups(): LibraryState & { albums: Album[]; artists: Artist[] } {
  const state = useLibrary()
  const albums = useMemo(() => groupAlbums(state.tracks), [state.tracks])
  const artists = useMemo(() => groupArtists(state.tracks, albums), [state.tracks, albums])
  return { ...state, albums, artists }
}
