import { EmptyState, Panel } from '@/components/Panel/Panel'
import { MusicIcon } from '@/components/icons'
import styles from './views.module.css'

export function HomeView() {
  return (
    <Panel label="Home" header={<h2 className={styles.heading}>Home</h2>}>
      <EmptyState icon={<MusicIcon size={26} />} title="Nothing here yet">
        Your recent plays and favorite playlists show up here once you start listening.
      </EmptyState>
    </Panel>
  )
}
