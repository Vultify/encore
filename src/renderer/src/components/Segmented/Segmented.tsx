import styles from './Segmented.module.css'

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  // Names the group, either directly or by the id of the text that names it.
  label?: string
  labelledBy?: string
  // A few choices sit in one pill; a longer set wraps as separate chips.
  layout?: 'pill' | 'chips'
  className?: string
}

// A set of choices with the picked one lit, like Week / Month / Year or the equalizer's presets.
export function Segmented<T extends string>({ options, value, onChange, label, labelledBy, layout = 'pill', className }: SegmentedProps<T>) {
  return (
    <div
      className={[layout === 'pill' ? styles.segmented : styles.chips, className].filter(Boolean).join(' ')}
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}
