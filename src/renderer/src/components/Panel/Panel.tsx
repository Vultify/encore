import type { ReactNode } from 'react'
import styles from './Panel.module.css'

interface PanelProps {
  label: string
  header?: ReactNode
  // Changing this eases the content in again, for moving between tabs or pages inside one panel.
  contentKey?: string
  children: ReactNode
}

// The floating glass panel on the right side of the Stage layout. Its content eases in whenever it changes.
export function Panel({ label, header, contentKey, children }: PanelProps) {
  return (
    <section aria-label={label} className={styles.panel}>
      {header && <div className={styles.header}>{header}</div>}
      <div key={contentKey} className={styles.body}>
        {children}
      </div>
    </section>
  )
}

interface EmptyStateProps {
  icon: ReactNode
  title: string
  children: ReactNode
  // A button under the message, for the one thing worth doing next.
  action?: { label: string; onClick: () => void }
}

// A calm centered message for screens with nothing to show yet.
export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>{icon}</span>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.emptyText}>{children}</p>
      {action && (
        <button className={styles.emptyAction} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}

// A quiet spinner for while the library is being read. It waits a moment before showing, so a quick load never flashes.
export function LoadingState({ label }: { label: string }) {
  return (
    <div className={styles.loading} role="status" aria-label={label}>
      <span className={styles.spinner} />
    </div>
  )
}
