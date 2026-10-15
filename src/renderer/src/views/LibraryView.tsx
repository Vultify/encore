import type { LocalFile } from '@shared/api'
import { EmptyState, Panel } from '@/components/Panel/Panel'
import { MusicIcon, UploadIcon } from '@/components/icons'
import styles from './views.module.css'

export const LIBRARY_TABS = ['Playlists', 'Albums', 'Artists', 'Local files'] as const
export type LibraryTab = (typeof LIBRARY_TABS)[number]

interface LibraryViewProps {
  tab: LibraryTab
  onTabChange: (tab: LibraryTab) => void
  localFiles: LocalFile[]
}

export function LibraryView({ tab, onTabChange, localFiles }: LibraryViewProps) {
  const header = (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Library sections">
        {LIBRARY_TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={styles.tab}
            onClick={() => onTabChange(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <span className={styles.hint}>
        <UploadIcon size={15} />
        Drop music files anywhere
      </span>
    </>
  )

  return (
    <Panel label="Library" header={header}>
      {tab === 'Local files' && localFiles.length > 0 ? (
        <LocalFileList files={localFiles} />
      ) : (
        <EmptyState icon={<UploadIcon size={26} />} title="Your library is empty">
          Drag songs or whole folders anywhere in this window to add them. MP3, FLAC, WAV, and M4A all work.
        </EmptyState>
      )}
    </Panel>
  )
}

// Plain file list until tags are read. Each row shows the file name, its folder, and its format.
function LocalFileList({ files }: { files: LocalFile[] }) {
  return (
    <ul className={styles.fileList} aria-label="Local files">
      {files.map((file) => (
        <li key={file.path} className={styles.fileRow} title={file.path}>
          <span className={styles.fileIcon}>
            <MusicIcon size={16} />
          </span>
          <span className={styles.fileText}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileFolder}>{file.folder}</span>
          </span>
          <span className={styles.fileFormat}>{file.format}</span>
        </li>
      ))}
    </ul>
  )
}
