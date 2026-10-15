import { useCallback, useEffect, useRef, useState } from 'react'
import type { Track } from '@shared/api'
import { TitleBar, type View } from './components/TitleBar/TitleBar'
import { NowPlayingStage } from './components/NowPlayingStage/NowPlayingStage'
import { PlayerDock } from './components/PlayerDock/PlayerDock'
import { DropOverlay } from './components/DropOverlay/DropOverlay'
import { Toast } from './components/Toast/Toast'
import { useFileDrop } from './hooks/useFileDrop'
import { songCount } from './lib/format'
import { HomeView } from './views/HomeView'
import { LibraryView, type LibraryTab } from './views/LibraryView'
import { SearchView } from './views/SearchView'
import styles from './App.module.css'

// The Stage layout: album on the left, the current view in a glass panel on the right, player dock floating below.
export default function App() {
  const [view, setView] = useState<View>('library')
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('Playlists')
  const [tracks, setTracks] = useState<Track[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  // Progress messages can arrive after the import has already finished, so only show them while it runs.
  const importRunning = useRef(false)
  const clearNotice = useCallback(() => setNotice(null), [])

  // Loads the saved library when Encore opens.
  useEffect(() => {
    window.encore.library.getTracks().then(setTracks)
  }, [])

  useEffect(
    () =>
      window.encore.library.onImportProgress(({ done, total }) => {
        if (importRunning.current && done < total) setNotice(`Reading songs ${done.toLocaleString()} of ${total.toLocaleString()}`)
      }),
    []
  )

  // Reads the music in what was dropped, saves anything new or changed, and shows it in Local files.
  const addDroppedFiles = useCallback(async (files: File[]) => {
    const paths = files.map((file) => window.encore.library.pathForFile(file)).filter(Boolean)
    importRunning.current = true
    setImporting(true)
    setNotice('Looking for music')
    const result = await window.encore.library.importPaths(paths).catch(() => null)
    importRunning.current = false
    setImporting(false)

    if (!result) {
      setNotice('Something went wrong adding those songs')
      return
    }
    if (result.found === 0) {
      setNotice('No MP3, FLAC, WAV, or M4A files in what you dropped')
      return
    }

    const { added, updated } = result
    if (added.length > 0 || updated.length > 0) {
      const changed = new Map(updated.map((track) => [track.id, track]))
      setTracks((current) => [...current.map((track) => changed.get(track.id) ?? track), ...added])
    }
    setNotice(
      added.length > 0
        ? `Added ${songCount(added.length)}`
        : updated.length > 0
          ? `Updated ${songCount(updated.length)}`
          : 'Those songs are already in your library'
    )
    setView('library')
    setLibraryTab('Local files')
  }, [])

  const dragging = useFileDrop(addDroppedFiles)

  return (
    <div className={styles.app}>
      <div className={styles.glow} aria-hidden="true" />
      <TitleBar view={view} onViewChange={setView} />
      <main className={styles.content}>
        <NowPlayingStage />
        {view === 'home' && <HomeView />}
        {view === 'library' && <LibraryView tab={libraryTab} onTabChange={setLibraryTab} tracks={tracks} />}
        {view === 'search' && <SearchView />}
      </main>
      <PlayerDock />
      <Toast message={notice} persist={importing} onDone={clearNotice} />
      <DropOverlay visible={dragging} />
    </div>
  )
}
