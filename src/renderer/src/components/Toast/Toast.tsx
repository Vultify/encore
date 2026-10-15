import { useEffect, useState } from 'react'
import styles from './Toast.module.css'

interface ToastProps {
  message: string | null
  // Keeps the toast up until the message is cleared, for work that's still in progress.
  persist?: boolean
  onDone: () => void
}

const SHOW_FOR_MS = 3200

// A short message that floats above the player dock and fades on its own.
export function Toast({ message, persist = false, onDone }: ToastProps) {
  // Keep the last text on screen while the toast fades out.
  const [text, setText] = useState(message)
  if (message && message !== text) setText(message)

  useEffect(() => {
    if (!message || persist) return
    const timer = setTimeout(onDone, SHOW_FOR_MS)
    return () => clearTimeout(timer)
  }, [message, persist, onDone])

  return (
    <div className={styles.toast} data-visible={Boolean(message)} role="status" aria-live="polite">
      {text}
    </div>
  )
}
