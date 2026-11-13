import type { ComponentProps } from 'react'
import { BackIcon } from '../icons'
import styles from './Button.module.css'

interface ButtonProps extends ComponentProps<'button'> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
}

// The app's pill button. Primary is the main action in the accent color, secondary sits beside it, and danger
// confirms something that can't be undone.
export function Button({ variant = 'secondary', size = 'medium', type = 'button', className, ...rest }: ButtonProps) {
  return <button type={type} className={[styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')} {...rest} />
}

// The way back from a page, at its top left.
export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.back} onClick={onClick}>
      <BackIcon size={16} />
      {label}
    </button>
  )
}
