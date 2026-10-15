import { useState } from 'react'
import { TitleBar, type View } from './components/TitleBar/TitleBar'
import { NowPlayingStage } from './components/NowPlayingStage/NowPlayingStage'
import { PlayerDock } from './components/PlayerDock/PlayerDock'
import { HomeView } from './views/HomeView'
import { LibraryView } from './views/LibraryView'
import { SearchView } from './views/SearchView'
import styles from './App.module.css'

// The Stage layout: album on the left, the current view in a glass panel on the right, player dock floating below.
export default function App() {
  const [view, setView] = useState<View>('library')

  return (
    <div className={styles.app}>
      <div className={styles.glow} aria-hidden="true" />
      <TitleBar view={view} onViewChange={setView} />
      <main className={styles.content}>
        <NowPlayingStage />
        {view === 'home' && <HomeView />}
        {view === 'library' && <LibraryView />}
        {view === 'search' && <SearchView />}
      </main>
      <PlayerDock />
    </div>
  )
}
