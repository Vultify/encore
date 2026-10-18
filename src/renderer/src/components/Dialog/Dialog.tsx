import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PLAYLIST_NAME_MAX } from '@shared/api'
import styles from './Dialog.module.css'

interface ModalProps {
  role: 'dialog' | 'alertdialog'
  title: string
  onCancel: () => void
  children: ReactNode
}

// The shared frame: a dimmed backdrop, a glass card, and Escape or a click outside to cancel.
function Modal({ role, title, onCancel, children }: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return createPortal(
    <div className={styles.backdrop} onPointerDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div role={role} aria-modal="true" aria-labelledby={titleId} className={styles.dialog}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body
  )
}

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

// Asks before something that can't be undone. Cancel has focus, so a stray Enter is safe.
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => cancel.current?.focus(), [])

  return (
    <Modal role="alertdialog" title={title} onCancel={onCancel}>
      <p className={styles.message}>{message}</p>
      <div className={styles.buttons}>
        <button ref={cancel} className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        <button className={styles.danger} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

interface NameDialogProps {
  title: string
  initial: string
  confirmLabel: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

// Asks for a name, with a suggestion already selected so typing replaces it.
export function NameDialog({ title, initial, confirmLabel, onConfirm, onCancel }: NameDialogProps) {
  const [name, setName] = useState(initial)
  const trimmed = name.trim()

  return (
    <Modal role="dialog" title={title} onCancel={onCancel}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (trimmed) onConfirm(trimmed)
        }}
      >
        <input
          className={styles.field}
          aria-label="Name"
          value={name}
          maxLength={PLAYLIST_NAME_MAX}
          autoFocus
          onFocus={(event) => event.target.select()}
          onChange={(event) => setName(event.target.value)}
        />
        <div className={styles.buttons}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={!trimmed}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
