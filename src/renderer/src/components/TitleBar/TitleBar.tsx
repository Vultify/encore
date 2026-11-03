import { useEffect, useState } from 'react'
import { CloseIcon, LogoMark, MaximizeIcon, MinimizeIcon, RestoreIcon, SearchIcon } from '../icons'
import styles from './TitleBar.module.css'

export type View = 'home' | 'library' | 'search'

interface TitleBarProps {
  view: View
  onViewChange: (view: View) => void
}

// The top bar doubles as the window's drag area: logo on the left, nav pill in the middle, window buttons on the right.
export function TitleBar({ view, onViewChange }: TitleBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.mark}>
          <LogoMark />
        </span>
        <span className={styles.wordmark}>encore</span>
      </div>

      <nav aria-label="Main" className={styles.nav}>
        <NavTab label="Home" active={view === 'home'} onClick={() => onViewChange('home')} />
        <NavTab label="Library" active={view === 'library'} onClick={() => onViewChange('library')} />
        <button
          className={styles.tab}
          aria-label="Search"
          aria-current={view === 'search' ? 'page' : undefined}
          onClick={() => onViewChange('search')}
        >
          <SearchIcon size={17} strokeWidth={2} />
        </button>
      </nav>

      <div className={styles.end}>
        <WindowButtons />
      </div>
    </header>
  )
}

function NavTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={styles.tab} aria-current={active ? 'page' : undefined} onClick={onClick}>
      {label}
    </button>
  )
}

function WindowButtons() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.encore.window.isMaximized().then(setMaximized)
    return window.encore.window.onMaximizedChange(setMaximized)
  }, [])

  return (
    <div className={styles.windowButtons}>
      <button className={styles.windowButton} aria-label="Minimize" onClick={window.encore.window.minimize}>
        <MinimizeIcon size={14} strokeWidth={1.8} />
      </button>
      <button
        className={styles.windowButton}
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onClick={window.encore.window.toggleMaximize}
      >
        {maximized ? <RestoreIcon size={14} strokeWidth={1.8} /> : <MaximizeIcon size={13} strokeWidth={1.8} />}
      </button>
      <button
        className={`${styles.windowButton} ${styles.close}`}
        aria-label="Close to tray"
        title="Close to tray"
        onClick={window.encore.window.closeToTray}
      >
        <CloseIcon size={14} strokeWidth={1.8} />
      </button>
    </div>
  )
}
