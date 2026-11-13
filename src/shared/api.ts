import type { EqualizerSettings } from './equalizer'

// The API the preload script exposes to the interface as window.encore.
export interface WindowControls {
  minimize: () => void
  toggleMaximize: () => void
  closeToTray: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (listener: (maximized: boolean) => void) => () => void
  // Swaps the full window for the mini player.
  popOut: () => void
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
  // Writes identified songs' tags and covers into their files, so other apps see them too.
  saveToFiles: (trackIds: number[]) => Promise<SaveToFilesResult>
  // Catches up on songs saved to the music folders while Encore was closed.
  scanMusicFolders: () => Promise<ImportResult>
  // Starts saving a listen to a song, with the list it's playing from. Returns its id, or null if the song is gone.
  startListen: (trackId: number, sourceKey: string | null) => Promise<number | null>
  // Saves how many seconds a listen has lasted, and whether that's long enough to count as a play.
  updateListen: (listenId: number, seconds: number, counted: boolean) => void
  // Listening since a moment in time, for the stats on Home.
  listeningStats: (since: number, bucket: StatsBucket) => Promise<ListeningStats>
  // Songs that showed up in a music folder while Encore is open, already saved to the library.
  onFolderImport: (listener: (result: ImportResult) => void) => () => void
}

// Listening time is grouped by day for a week or month, and by month for longer spans.
export type StatsBucket = 'day' | 'month'

export interface ListeningStats {
  totalSeconds: number
  // Every song listened to in the span, with how often it counted as played and for how long.
  tracks: { trackId: number; plays: number; seconds: number }[]
  // Seconds listened per local day (2026-11-03) or month (2026-11). Days and months with none are left out.
  buckets: { key: string; seconds: number }[]
  // When the very first listen happened, or null if nothing has ever been played.
  firstPlayedAt: number | null
}

export interface SaveToFilesResult {
  // The songs as they are now, read back from their rewritten files.
  saved: Track[]
  // Songs left untouched, with the reason in plain words.
  failed: { trackId: number; title: string; reason: string }[]
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
  // True when the song was recognized by its sound rather than its name. Those matches may be wrong.
  bySound: boolean
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

// What's playing, in brief, for the tray and the mini player. The main window reports it whenever it changes.
export interface NowPlaying {
  trackId: number | null
  title: string
  artist: string | null
  artworkId: string | null
  playing: boolean
  hasNext: boolean
  // In seconds. The position is only reported when it jumps, so while playing it runs on from when it was sent.
  position: number
  duration: number
  // Where the volume slider sits, from 0 to 1, and whether it's muted.
  volume: number
  muted: boolean
}

export type PlayerCommand = 'toggle' | 'next' | 'previous' | 'toggleMute' | { volume: number }

// Where listening left off, so Encore reopens on the same song with the rest of its list still queued.
export interface PlayerSession {
  sourceKey: string
  sourceName: string
  // The list's songs in their own order, and the play order as positions in that list.
  sourceIds: number[]
  order: number[]
  cursor: number
  // Songs added with Play next or Add to queue, still waiting.
  queuedIds: number[]
  // The song that was playing, whether it came from the queue rather than the list, and how far into it, in seconds.
  trackId: number
  fromQueue: boolean
  position: number
  shuffle: boolean
  repeat: 'off' | 'all' | 'one'
}

export interface PlayerPreferences {
  volume: number
  muted: boolean
  session: PlayerSession | null
  equalizer: EqualizerSettings
}

export interface RemoteControls {
  report: (nowPlaying: NowPlaying) => void
  onCommand: (listener: (command: PlayerCommand) => void) => () => void
}

// For the mini player, which shows what the main window's player is doing and passes button presses back to it.
export interface MiniPlayerControls {
  current: () => Promise<NowPlaying | null>
  onNowPlaying: (listener: (now: NowPlaying | null) => void) => () => void
  send: (command: PlayerCommand) => void
  // Brings back the full window and puts the mini player away.
  openEncore: () => void
  // The see-through space around the pill lets clicks reach whatever is behind it, except while the pointer is on the pill.
  setInteractive: (interactive: boolean) => void
}

// The accent follows the playing album's cover, or stays one of these colors. Teal is also the resting color.
export const ACCENT_PRESETS = [
  { name: 'Teal', color: '#2bc4a8' },
  { name: 'Coral', color: '#ff8a5c' },
  { name: 'Violet', color: '#c77dff' },
  { name: 'Pink', color: '#ff7ea8' },
  { name: 'Blue', color: '#64a8ff' }
] as const

export type AccentChoice = 'album' | (typeof ACCENT_PRESETS)[number]['color']

export const DEFAULT_MINI_PLAYER_SHORTCUT = 'Control+Alt+Space'

// The mix of top songs on Home holds this many, set in steps of five.
export const TOP_MIX = { min: 5, max: 100, step: 5, default: 25 } as const

// Whatever is typed for the mix size, rounded to the nearest five and kept in range. Anything that isn't a
// number keeps the size it had.
export function roundMixSize(value: number, fallback: number = TOP_MIX.default): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(TOP_MIX.max, Math.max(TOP_MIX.min, Math.round(value / TOP_MIX.step) * TOP_MIX.step))
}

// Whether Encore animates: as Windows' Animation effects setting says, always, or never.
export const MOTION_CHOICES = ['system', 'on', 'off'] as const
export type MotionChoice = (typeof MOTION_CHOICES)[number]

export interface Preferences {
  // An Electron accelerator, like Control+Alt+Space.
  miniPlayerShortcut: string
  accent: AccentChoice
  motion: MotionChoice
  // Folders whose new songs are added to the library by themselves.
  musicFolders: string[]
  identifyNewSongs: boolean
  startWithWindows: boolean
  topMixSize: number
}

export type PreferenceChanges = Partial<Pick<Preferences, 'accent' | 'motion' | 'identifyNewSongs' | 'startWithWindows' | 'topMixSize'>>

export interface PreferenceControls {
  get: () => Promise<Preferences>
  onChange: (listener: (preferences: Preferences) => void) => () => void
  update: (changes: PreferenceChanges) => Promise<Preferences>
  // Returns false when the shortcut isn't allowed or another app already uses it.
  setMiniPlayerShortcut: (accelerator: string) => Promise<boolean>
  // Lets go of the current shortcut while a new one is recorded, and takes it back after.
  pauseMiniPlayerShortcut: (pause: boolean) => void
  // Asks for a folder with the Windows folder picker. Returns its path, or null if none was picked.
  addMusicFolder: () => Promise<string | null>
  removeMusicFolder: (path: string) => Promise<void>
  // Starting with Windows only works in the installed app, not while developing.
  canStartWithWindows: () => Promise<boolean>
}

export interface SettingsControls {
  getPlayer: () => Promise<PlayerPreferences>
  savePlayer: (preferences: PlayerPreferences) => void
}

export interface EncoreApi {
  window: WindowControls
  library: LibraryControls
  playlists: PlaylistControls
  identify: IdentifyControls
  remote: RemoteControls
  mini: MiniPlayerControls
  settings: SettingsControls
  preferences: PreferenceControls
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
  saveToFiles: 'library:save-to-files',
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
  identifyRestore: 'identify:restore',
  nowPlaying: 'player:now-playing',
  playerCommand: 'player:command',
  nowPlayingChanged: 'player:now-playing-changed',
  getNowPlaying: 'player:get-now-playing',
  remoteCommand: 'player:remote-command',
  popOut: 'mini:pop-out',
  openEncore: 'mini:open-encore',
  miniInteractive: 'mini:interactive',
  getPlayerSettings: 'settings:get-player',
  folderImport: 'library:folder-import',
  scanMusicFolders: 'library:scan-folders',
  startListen: 'library:start-listen',
  updateListen: 'library:update-listen',
  listeningStats: 'library:listening-stats',
  getPreferences: 'preferences:get',
  preferencesChanged: 'preferences:changed',
  updatePreferences: 'preferences:update',
  setMiniPlayerShortcut: 'preferences:set-shortcut',
  pauseMiniPlayerShortcut: 'preferences:pause-shortcut',
  addMusicFolder: 'preferences:add-folder',
  removeMusicFolder: 'preferences:remove-folder',
  canStartWithWindows: 'preferences:can-start-with-windows',
  savePlayerSettings: 'settings:save-player'
} as const

// Cover art is served to the interface through this private scheme, one file per unique image.
export const ARTWORK_SCHEME = 'encore-art'
export const ARTWORK_ID = /^[a-f0-9]{40}\.(jpg|png|webp|gif|bmp)$/

export const artworkUrl = (id: string): string => `${ARTWORK_SCHEME}://local/${id}`

// A match's cover, fetched by the main process so the interface never loads images straight from the internet.
// Apple matches are "itunes-" and the song's number. Sound matches are "mb-", then the album's and the recording's
// MusicBrainz ids.
const MB_ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
export const CANDIDATE_ID = new RegExp(`^(itunes-[0-9]{1,20}|mb-${MB_ID}-${MB_ID})$`)
export const previewUrl = (candidateId: string): string => `${ARTWORK_SCHEME}://preview/${candidateId}`

// Songs stream to the player through this scheme by library id, so the interface never reads arbitrary files.
export const MEDIA_SCHEME = 'encore-media'

export const mediaUrl = (trackId: number): string => `${MEDIA_SCHEME}://track/${trackId}`
