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

// A song with its tags read. Missing tags are null, except title, which falls back to the file name.
export interface Track {
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
}

export interface ImportProgress {
  done: number
  total: number
}

export interface LibraryControls {
  // Turns a dropped File into its path on disk. Returns an empty string for files that aren't on disk.
  pathForFile: (file: File) => string
  // Finds every supported song in the given files and folders and reads its tags and cover art.
  importPaths: (paths: string[]) => Promise<Track[]>
  onImportProgress: (listener: (progress: ImportProgress) => void) => () => void
}

export interface EncoreApi {
  window: WindowControls
  library: LibraryControls
}

// IPC channel names shared by the main process and the preload script.
export const Channels = {
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggle-maximize',
  closeToTray: 'window:close-to-tray',
  isMaximized: 'window:is-maximized',
  maximizedChanged: 'window:maximized-changed',
  importPaths: 'library:import-paths',
  importProgress: 'library:import-progress'
} as const

// Cover art is served to the interface through this private scheme, one file per unique image.
export const ARTWORK_SCHEME = 'encore-art'
export const ARTWORK_ID = /^[a-f0-9]{40}\.(jpg|png|webp|gif|bmp)$/

export const artworkUrl = (id: string): string => `${ARTWORK_SCHEME}://local/${id}`
