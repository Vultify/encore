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
}

// A song read from disk that hasn't been saved to the library yet.
export type NewTrack = Omit<Track, 'id' | 'addedAt' | 'likedAt'>

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
  listPlaylists: 'playlists:list',
  createPlaylist: 'playlists:create',
  renamePlaylist: 'playlists:rename',
  removePlaylist: 'playlists:remove',
  reorderPlaylists: 'playlists:reorder',
  addToPlaylist: 'playlists:add-tracks',
  removeFromPlaylist: 'playlists:remove-entries',
  movePlaylistEntry: 'playlists:move-entry'
} as const

// Cover art is served to the interface through this private scheme, one file per unique image.
export const ARTWORK_SCHEME = 'encore-art'
export const ARTWORK_ID = /^[a-f0-9]{40}\.(jpg|png|webp|gif|bmp)$/

export const artworkUrl = (id: string): string => `${ARTWORK_SCHEME}://local/${id}`

// Songs stream to the player through this scheme by library id, so the interface never reads arbitrary files.
export const MEDIA_SCHEME = 'encore-media'

export const mediaUrl = (trackId: number): string => `${MEDIA_SCHEME}://track/${trackId}`
