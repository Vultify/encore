import { useCallback, useRef, useState } from 'react'
import type { LocalFile } from '@shared/api'
import { TitleBar, type View } from './components/TitleBar/TitleBar'
import { NowPlayingStage } from './components/NowPlayingStage/NowPlayingStage'
import { PlayerDock } from './components/PlayerDock/PlayerDock'
import { DropOverlay } from './components/DropOverlay/DropOverlay'
import { Toast } from './components/Toast/Toast'
import { useFileDrop } from './hooks/useFileDrop'
import { HomeView } from './views/HomeView'
import { LibraryView, type LibraryTab } from './views/LibraryView'
import { SearchView } from './views/SearchView'
import styles from './App.module.css'

const songCount = (n: number): string => `${n} ${n === 1 ? 'song' : 'songs'}`

// The Stage layout: album on the left, the current view in a glass panel on the right, player dock floating below.
export default function App() {
  const [view, setView] = useState<View>('library')
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('Playlists')
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const knownPaths = useRef(new Set<string>())
  const clearNotice = useCallback(() => setNotice(null), [])

  // Finds the music in what was dropped, adds anything new, and shows it in Local files.
  const addDroppedFiles = useCallback(async (files: File[]) => {
    const paths = files.map((file) => window.encore.library.pathForFile(file)).filter(Boolean)
    const found = paths.length > 0 ? await window.encore.library.scanPaths(paths) : []
    if (found.length === 0) {
      setNotice('No MP3, FLAC, WAV, or M4A files in what you dropped')
      return
    }

    const known = knownPaths.current
    const fresh = found.filter((file) => !known.has(file.path.toLowerCase()))
    fresh.forEach((file) => known.add(file.path.toLowerCase()))
    if (fresh.length > 0) setLocalFiles((current) => [...current, ...fresh])
    setNotice(fresh.length > 0 ? `Added ${songCount(fresh.length)}` : 'Those songs are already in your library')
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
        {view === 'library' && <LibraryView tab={libraryTab} onTabChange={setLibraryTab} localFiles={localFiles} />}
        {view === 'search' && <SearchView />}
      </main>
      <PlayerDock />
      <Toast message={notice} onDone={clearNotice} />
      <DropOverlay visible={dragging} />
    </div>
  )
}
