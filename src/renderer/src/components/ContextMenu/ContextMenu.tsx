import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './ContextMenu.module.css'

export type MenuEntry =
  | { label: string; onSelect: () => void; icon?: ReactNode; danger?: boolean }
  | { heading: string }
  | { separator: true }

interface ContextMenuProps {
  label: string
  x: number
  y: number
  entries: MenuEntry[]
  onClose: () => void
}

const EDGE = 8

// A right-click menu at the pointer. It stays inside the window, closes on Escape or a click elsewhere,
// and the arrow keys move between items.
export function ContextMenu({ label, x, y, entries, onClose }: ContextMenuProps) {
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const box = menu.current?.getBoundingClientRect()
    if (!box) return
    setPosition({
      left: Math.max(EDGE, Math.min(x, window.innerWidth - box.width - EDGE)),
      top: Math.max(EDGE, Math.min(y, window.innerHeight - box.height - EDGE))
    })
    menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
  }, [x, y])

  useEffect(() => {
    const closeOutside = (event: PointerEvent): void => {
      if (!menu.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', closeOutside, true)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', closeOutside, true)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const onKeyDown = (event: KeyboardEvent): void => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])]
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') onClose()
    else if (event.key === 'ArrowDown') items[(index + 1) % items.length]?.focus()
    else if (event.key === 'ArrowUp') items[(index - 1 + items.length) % items.length]?.focus()
    else return
    event.preventDefault()
  }

  return createPortal(
    <div ref={menu} role="menu" aria-label={label} className={styles.menu} style={position} onKeyDown={onKeyDown}>
      {entries.map((entry, i) => {
        if ('separator' in entry) return <div key={i} role="separator" className={styles.separator} />
        if ('heading' in entry) return <div key={i} className={styles.heading}>{entry.heading}</div>
        return (
          <button
            key={i}
            role="menuitem"
            className={styles.item}
            data-danger={entry.danger || undefined}
            onClick={() => {
              onClose()
              entry.onSelect()
            }}
          >
            <span className={styles.icon}>{entry.icon}</span>
            {entry.label}
          </button>
        )
      })}
    </div>,
    document.body
  )
}
