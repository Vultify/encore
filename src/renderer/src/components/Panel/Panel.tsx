import type { ReactNode } from 'react'
import styles from './Panel.module.css'

interface PanelProps {
  label: string
  header?: ReactNode
  children: ReactNode
}

// The floating glass panel on the right side of the Stage layout.
export function Panel({ label, header, children }: PanelProps) {
  return (
    <section aria-label={label} className={styles.panel}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.body}>{children}</div>
    </section>
  )
}

interface EmptyStateProps {
  icon: ReactNode
  title: string
  children: ReactNode
}

// A calm centered message for screens with nothing to show yet.
export function EmptyState({ icon, title, children }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>{icon}</span>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.emptyText}>{children}</p>
    </div>
  )
}
