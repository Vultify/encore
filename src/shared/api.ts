// The API the preload script exposes to the interface as window.encore.
export interface WindowControls {
  minimize: () => void
  toggleMaximize: () => void
  closeToTray: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (listener: (maximized: boolean) => void) => () => void
}

export type AudioFormat = 'mp3' | 'flac' | 'wav' | 'm4a'

export const AUDIO_FORMATS: readonly AudioFormat[] = ['mp3', 'flac', 'wav', 'm4a']

// A song in the library. Missing tags are null, except title, which falls back to the file name.
export interface Track {
  id: number
  path: string
  format: AudioFormat
  title: string
  artist: string | null
  album: string | null
  albumArtist: string | null
  trackNumber: number | null
  discNumber: number | null
  year: number | null
  duration: number | null
  artworkId: string | null
  addedAt: number
  // When the song was liked, or null if it isn't.
  likedAt: number | null
  // True when the tags shown come from a match the song was identified as, not from the file.
  identified: boolean
}

// A song read from disk that hasn't been saved to the library yet.
export type NewTrack = Omit<Track, 'id' | 'addedAt' | 'likedAt' | 'identified'>

// One spot in a playlist. A song can appear more than once, so each spot has its own id.
export interface PlaylistEntry {
  id: number
  trackId: number
  addedAt: number
}

export interface Playlist {
  id: number
  name: string
  entries: PlaylistEntry[]
  createdAt: number
  updatedAt: number
}

export interface ImportResult {
  // Every supported song found in what was dropped, new or not.
  found: number
  added: Track[]
  updated: Track[]
}

export interface ImportProgress {
  done: number
  total: number
}

export interface LibraryControls {
  // Turns a dropped File into its path on disk. Returns an empty string for files that aren't on disk.
  pathForFile: (file: File) => string
  getTracks: () => Promise<Track[]>
  // Finds every supported song in the given files and folders, reads new or changed ones, and saves them.
  importPaths: (paths: string[]) => Promise<ImportResult>
  onImportProgress: (listener: (progress: ImportProgress) => void) => () => void
  setLiked: (trackIds: number[], liked: boolean) => Promise<Track[]>
  // Removes songs from the library and returns the ids that were removed. Files stay on disk.
  removeTracks: (trackIds: number[]) => Promise<number[]>
  // The ids of songs whose files can't be found right now.
  findMissing: () => Promise<number[]>
  // The accent color picked from a cover, as #rrggbb, or null when the cover has no real color.
  accentColor: (artworkId: string) => Promise<string | null>
}

// One possible match for a song, as found by the music search. Its id is how the interface refers back to it.
export interface MatchCandidate {
  id: string
  title: string
  artist: string
  album: string | null
  albumArtist: string | null
  trackNumber: number | null
  discNumber: number | null
  year: number | null
  duration: number | null
  // How well it fits the song, from 0 to 1. The interface calls 0.75 and up a best match.
  score: number
}

// The matches found for one song, best first. Empty when nothing fit.
export interface IdentifyResult {
  trackId: number
  candidates: MatchCandidate[]
}

export interface IdentifyProgress {
  done: number
  total: number
  // Set when the search stopped early, for example with no internet connection.
  error?: string
}

export interface IdentifyControls {
  // Looks the songs up one at a time in the background. Results and progress arrive through the listeners.
  start: (trackIds: number[]) => Promise<void>
  stop: () => void
  onResult: (listener: (result: IdentifyResult) => void) => () => void
  onProgress: (listener: (progress: IdentifyProgress) => void) => () => void
  // Saves a picked match and returns the song as it now looks.
  apply: (trackId: number, candidateId: string) => Promise<Track | null>
  // Drops a song's match so it shows the file's own tags again.
  restore: (trackId: number) => Promise<Track | null>
}

// Every call that changes a playlist returns all playlists as they are afterward, in order.
export interface PlaylistControls {
  list: () => Promise<Playlist[]>
  create: (name: string, trackIds?: number[]) => Promise<{ created: Playlist; playlists: Playlist[] }>
  rename: (playlistId: number, name: string) => Promise<Playlist[]>
  remove: (playlistId: number) => Promise<Playlist[]>
  reorder: (playlistIds: number[]) => Promise<Playlist[]>
  addTracks: (playlistId: number, trackIds: number[]) => Promise<Playlist[]>
  removeEntries: (playlistId: number, entryIds: number[]) => Promise<Playlist[]>
  moveEntry: (playlistId: number, entryId: number, toIndex: number) => Promise<Playlist[]>
}

export interface EncoreApi {
  window: WindowControls
  library: LibraryControls
  playlists: PlaylistControls
  identify: IdentifyControls
}

export const PLAYLIST_NAME_MAX = 100

// IPC channel names shared by the main process and the preload script.
export const Channels = {
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggle-maximize',
  closeToTray: 'window:close-to-tray',
  isMaximized: 'window:is-maximized',
  maximizedChanged: 'window:maximized-changed',
  getTracks: 'library:get-tracks',
  importPaths: 'library:import-paths',
  importProgress: 'library:import-progress',
  setLiked: 'library:set-liked',
  removeTracks: 'library:remove-tracks',
  findMissing: 'library:find-missing',
  accentColor: 'library:accent-color',
  listPlaylists: 'playlists:list',
  createPlaylist: 'playlists:create',
  renamePlaylist: 'playlists:rename',
  removePlaylist: 'playlists:remove',
  reorderPlaylists: 'playlists:reorder',
  addToPlaylist: 'playlists:add-tracks',
  removeFromPlaylist: 'playlists:remove-entries',
  movePlaylistEntry: 'playlists:move-entry',
  identifyStart: 'identify:start',
  identifyStop: 'identify:stop',
  identifyResult: 'identify:result',
  identifyProgress: 'identify:progress',
  identifyApply: 'identify:apply',
  identifyRestore: 'identify:restore'
} as const

// Cover art is served to the interface through this private scheme, one file per unique image.
export const ARTWORK_SCHEME = 'encore-art'
export const ARTWORK_ID = /^[a-f0-9]{40}\.(jpg|png|webp|gif|bmp)$/

export const artworkUrl = (id: string): string => `${ARTWORK_SCHEME}://local/${id}`

// A match's cover, fetched by the main process so the interface never loads images straight from the internet.
export const CANDIDATE_ID = /^itunes-\d{1,20}$/
export const previewUrl = (candidateId: string): string => `${ARTWORK_SCHEME}://preview/${candidateId}`

// Songs stream to the player through this scheme by library id, so the interface never reads arbitrary files.
export const MEDIA_SCHEME = 'encore-media'

export const mediaUrl = (trackId: number): string => `${MEDIA_SCHEME}://track/${trackId}`
