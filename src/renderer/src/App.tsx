import { useCallback, useEffect, useRef, useState } from 'react'
import { TitleBar, type View } from './components/TitleBar/TitleBar'
import { NowPlayingStage } from './components/NowPlayingStage/NowPlayingStage'
import { PlayerDock } from './components/PlayerDock/PlayerDock'
import { DropOverlay } from './components/DropOverlay/DropOverlay'
import { Toast } from './components/Toast/Toast'
import { useFileDrop } from './hooks/useFileDrop'
import { player, usePlayer } from './player/player'
import { library } from './store/library'
import { clearNotice, notify, useNotice } from './store/notice'
import { songCount } from './lib/format'
import { HomeView } from './views/HomeView'
import { LibraryView, type LibraryLocation } from './views/library/LibraryView'
import { SearchView } from './views/SearchView'
import styles from './App.module.css'

const FILE_CHECK_INTERVAL_MS = 10_000

// The Stage layout: album on the left, the current view in a glass panel on the right, player dock floating below.
export default function App() {
  const [view, setView] = useState<View>('library')
  const [location, setLocation] = useState<LibraryLocation>({ tab: 'Playlists', key: null })
  // Kept here so a search is still there after visiting another view.
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocus, setSearchFocus] = useState(0)
  const notice = useNotice()
  // Progress messages can arrive after the import has already finished, so only show them while it runs.
  const importRunning = useRef(false)

  const { failed } = usePlayer()

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
        setView('search')
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
  }, [])

  // Loads the saved library and playlists when Encore opens.
  useEffect(() => {
    library.load()
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

  useEffect(
    () =>
      window.encore.library.onImportProgress(({ done, total }) => {
        if (importRunning.current && done < total) {
          notify(`Reading songs ${done.toLocaleString()} of ${total.toLocaleString()}`, { persist: true })
        }
      }),
    []
  )

  // Reads the music in what was dropped, saves anything new or changed, and shows it in Local files.
  const addDroppedFiles = useCallback(async (files: File[]) => {
    const paths = files.map((file) => window.encore.library.pathForFile(file)).filter(Boolean)
    importRunning.current = true
    notify('Looking for music', { persist: true })
    const result = await window.encore.library.importPaths(paths).catch(() => null)
    importRunning.current = false

    if (!result) {
      notify('Something went wrong adding those songs')
      return
    }
    if (result.found === 0) {
      notify('No MP3, FLAC, WAV, or M4A files in what you dropped')
      return
    }

    library.applyImport(result)
    const { added, updated } = result
    notify(
      added.length > 0
        ? `Added ${songCount(added.length)}`
        : updated.length > 0
          ? `Updated ${songCount(updated.length)}`
          : 'Those songs are already in your library'
    )
    setView('library')
    setLocation({ tab: 'Local files', key: null })
  }, [])

  const dragging = useFileDrop(addDroppedFiles)

  const goToLibrary = useCallback((next: LibraryLocation) => {
    setLocation(next)
    setView('library')
  }, [])

  return (
    <div className={styles.app}>
      <div className={styles.glow} aria-hidden="true" />
      <TitleBar view={view} onViewChange={setView} />
      <main className={styles.content}>
        <NowPlayingStage />
        {view === 'home' && <HomeView />}
        {view === 'library' && <LibraryView location={location} onNavigate={setLocation} />}
        {view === 'search' && <SearchView query={searchQuery} onQueryChange={setSearchQuery} onNavigate={goToLibrary} focusRequest={searchFocus} />}
      </main>
      <PlayerDock />
      <Toast message={notice.message} persist={notice.persist} onDone={clearNotice} />
      <DropOverlay visible={dragging} />
    </div>
  )
}
