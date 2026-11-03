import { useCallback, useEffect, useState } from 'react'
import type { ImportResult } from '@shared/api'
import { TitleBar, type View } from './components/TitleBar/TitleBar'
import { NowPlayingStage } from './components/NowPlayingStage/NowPlayingStage'
import { PlayerDock } from './components/PlayerDock/PlayerDock'
import { DropOverlay } from './components/DropOverlay/DropOverlay'
import { Toast } from './components/Toast/Toast'
import { useAccentColor } from './hooks/useAccentColor'
import { useFileDrop } from './hooks/useFileDrop'
import { player, usePlayer } from './player/player'
import { connectMediaSession } from './player/mediaSession'
import { rememberPlayer } from './player/memory'
import { connectRemote } from './player/remote'
import { library, useLibrary } from './store/library'
import { identify, useIdentify } from './store/identify'
import { clearNotice, notify, useNotice } from './store/notice'
import { songCount } from './lib/format'
import { HomeView } from './views/HomeView'
import { IDENTIFY_KEY, LibraryView, type LibraryLocation } from './views/library/LibraryView'
import { NowPlayingView } from './views/NowPlayingView'
import { SearchView } from './views/SearchView'
import { SettingsView } from './views/settings/SettingsView'
import styles from './App.module.css'

const FILE_CHECK_INTERVAL_MS = 10_000

// Songs that turned up in the music folders on their own join the library with a short note.
function addFolderSongs(result: ImportResult | null): void {
  if (!result) return
  library.applyImport(result)
  if (result.added.length > 0) notify(`Added ${songCount(result.added.length)} from your music folders`)
  identify.identifyNewSongs(result.added)
}

// The Stage layout: album on the left, the current view in a glass panel on the right, player dock floating below.
export default function App() {
  const [view, setView] = useState<View>('library')
  const [location, setLocation] = useState<LibraryLocation>({ tab: 'Playlists', key: null })
  // Kept here so a search is still there after visiting another view.
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocus, setSearchFocus] = useState(0)
  // The big Now Playing view takes over the space under the title bar while it's open.
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false)
  const notice = useNotice()

  const { failed, track } = usePlayer()
  const { tracks } = useLibrary()

  // The player holds its own copies of songs. Whenever the library changes, it swaps in the latest ones.
  useEffect(() => player.refresh(tracks), [tracks])

  // The accent follows the playing song's cover.
  useAccentColor(track?.artworkId ?? null)

  // Going anywhere else closes the Now Playing view.
  const showView = useCallback((next: View) => {
    setNowPlayingOpen(false)
    setView(next)
  }, [])
  const closeNowPlaying = useCallback(() => setNowPlayingOpen(false), [])

  useEffect(() => {
    if (!failed) return
    notify(`Couldn't play ${failed.title}. The file may have moved.`)
    library.markMissing(failed.id)
  }, [failed])

  // Space plays and pauses, unless it's typing or pressing a focused control. Ctrl + F opens search.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        showView('search')
        setSearchFocus((count) => count + 1)
        return
      }
      if (event.code !== 'Space' || event.repeat) return
      if ((event.target as HTMLElement).closest('input, textarea, button, [contenteditable]')) return
      event.preventDefault()
      player.toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showView])

  // Loads the saved library and playlists when Encore opens, picks up where listening left off, and catches up on
  // songs saved to the music folders while it was closed. From then on the tray, the media keys, and the Windows
  // media overlay can control the player, and new songs in the music folders show up by themselves.
  useEffect(() => {
    const loaded = library.load()
    const forgetPlayer = rememberPlayer(loaded)
    void loaded.then(() => window.encore.library.scanMusicFolders().catch(() => null)).then(addFolderSongs)
    const stopWatching = window.encore.library.onFolderImport(addFolderSongs)
    const disconnectRemote = connectRemote()
    const disconnectMediaSession = connectMediaSession()
    return () => {
      forgetPlayer()
      stopWatching()
      disconnectRemote()
      disconnectMediaSession()
    }
  }, [])

  // Coming back to the window re-checks which song files exist, in case some were moved or put back.
  useEffect(() => {
    let lastCheck = Date.now()
    const onFocus = (): void => {
      if (Date.now() - lastCheck < FILE_CHECK_INTERVAL_MS) return
      lastCheck = Date.now()
      library.checkFiles()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Reads the music in what was dropped, saves anything new or changed, and shows it in Local files.
  const addDroppedFiles = useCallback(async (files: File[]) => {
    const paths = files.map((file) => window.encore.library.pathForFile(file)).filter(Boolean)
    const result = await library.importMusic(paths, 'No MP3, FLAC, WAV, or M4A files in what you dropped')
    if (!result) return
    identify.identifyNewSongs(result.added)
    showView('library')
    setLocation({ tab: 'Local files', key: null })
  }, [showView])

  const dragging = useFileDrop(addDroppedFiles)

  const goToLibrary = useCallback(
    (next: LibraryLocation) => {
      setLocation(next)
      showView('library')
    },
    [showView]
  )

  // Starting to identify songs, from the banner or a song's menu, opens the review page.
  const { reviewRequest } = useIdentify()
  useEffect(() => {
    if (reviewRequest > 0) goToLibrary({ tab: 'Local files', key: IDENTIFY_KEY })
  }, [reviewRequest, goToLibrary])

  return (
    <div className={styles.app}>
      <div className={styles.glow} aria-hidden="true" />
      <TitleBar view={view} onViewChange={showView} />
      {nowPlayingOpen ? (
        <NowPlayingView onClose={closeNowPlaying} />
      ) : (
        <main className={styles.content}>
          <NowPlayingStage onOpen={() => setNowPlayingOpen(true)} />
          {view === 'home' && <HomeView />}
          {view === 'library' && <LibraryView location={location} onNavigate={setLocation} />}
          {view === 'search' && <SearchView query={searchQuery} onQueryChange={setSearchQuery} onNavigate={goToLibrary} focusRequest={searchFocus} />}
          {view === 'settings' && <SettingsView />}
        </main>
      )}
      <PlayerDock compact={nowPlayingOpen} onOpenNowPlaying={() => setNowPlayingOpen(true)} />
      <Toast message={notice.message} persist={notice.persist} onDone={clearNotice} />
      <DropOverlay visible={dragging} />
    </div>
  )
}
