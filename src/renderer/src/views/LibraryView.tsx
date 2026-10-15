import { useState } from 'react'
import { EmptyState, Panel } from '@/components/Panel/Panel'
import { UploadIcon } from '@/components/icons'
import styles from './views.module.css'

const TABS = ['Playlists', 'Albums', 'Artists', 'Local files'] as const
type Tab = (typeof TABS)[number]

export function LibraryView() {
  const [tab, setTab] = useState<Tab>('Playlists')

  const header = (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Library sections">
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={styles.tab}
            onClick={() => setTab(name)}
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
      <EmptyState icon={<UploadIcon size={26} />} title="Your library is empty">
        Drag songs or whole folders anywhere in this window to add them. MP3, FLAC, WAV, and M4A all work.
      </EmptyState>
    </Panel>
  )
}
