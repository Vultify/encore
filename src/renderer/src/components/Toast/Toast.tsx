import { useEffect, useState } from 'react'
import type { Notice } from '@/store/notice'
import styles from './Toast.module.css'

interface ToastProps {
  notice: Notice | null
  onDone: () => void
}

const SHOW_FOR_MS = 3200
// One with a button stays a while longer, so there's time to reach it.
const SHOW_WITH_ACTION_MS = 8000

// A short message that floats above the player dock and fades on its own.
export function Toast({ notice, onDone }: ToastProps) {
  // Keep the last one on screen while the toast fades out.
  const [shown, setShown] = useState(notice)
  if (notice && notice !== shown) setShown(notice)

  useEffect(() => {
    if (!notice || notice.persist) return
    const timer = setTimeout(onDone, notice.action ? SHOW_WITH_ACTION_MS : SHOW_FOR_MS)
    return () => clearTimeout(timer)
  }, [notice, onDone])

  return (
    <div className={styles.toast} data-visible={Boolean(notice)} data-action={Boolean(shown?.action) || undefined} role="status" aria-live="polite">
      {shown?.text}
      {shown?.action && (
        <button
          className={styles.action}
          tabIndex={notice ? undefined : -1}
          onClick={() => {
            shown.action?.run()
            onDone()
          }}
        >
          {shown.action.label}
        </button>
      )}
    </div>
  )
}
