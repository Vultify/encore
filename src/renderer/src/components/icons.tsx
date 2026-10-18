import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

// Shared wrapper so every icon has the same stroke style and stays hidden from screen readers.
function Icon({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
      <path d="M16 4a12 12 0 1 1-11.3 8" />
      <path d="M16 10a6 6 0 1 1-5.6 3.9" />
      <circle cx="16" cy="16" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </Icon>
)

export const MinimizeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
)

export const MaximizeIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="5" width="14" height="14" rx="3" />
  </Icon>
)

export const RestoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="8" width="12" height="12" rx="2.5" />
    <path d="M8 8V6.5A2.5 2.5 0 0 1 10.5 4H17.5A2.5 2.5 0 0 1 20 6.5V13.5A2.5 2.5 0 0 1 17.5 16H16" />
  </Icon>
)

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const PlayIcon = (p: IconProps) => (
  <Icon {...p} stroke="none">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" />
  </Icon>
)

export const PreviousIcon = (p: IconProps) => (
  <Icon {...p} strokeWidth={2}>
    <path d="M6 5.5v13" />
    <path d="M19 6.6v10.8a.9.9 0 0 1-1.4.74L10 12.74a.9.9 0 0 1 0-1.48l7.6-5.4a.9.9 0 0 1 1.4.74z" fill="currentColor" stroke="none" />
  </Icon>
)

export const NextIcon = (p: IconProps) => (
  <Icon {...p} strokeWidth={2}>
    <path d="M18 5.5v13" />
    <path d="M5 6.6v10.8a.9.9 0 0 0 1.4.74l7.6-5.4a.9.9 0 0 0 0-1.48l-7.6-5.4A.9.9 0 0 0 5 6.6z" fill="currentColor" stroke="none" />
  </Icon>
)

export const ShuffleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7h3c2.2 0 3.4 1.1 4.5 2.8l2.6 4.2c1.1 1.7 2.3 2.8 4.5 2.8H21" />
    <path d="M18 14l3 2.8-3 2.8" />
    <path d="M3 16.8h3c1.2 0 2.1-.3 2.9-.9" />
    <path d="M15 8c.8-.6 1.7-1 2.9-1H21" />
    <path d="M18 4.2 21 7l-3 2.8" />
  </Icon>
)

export const RepeatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17 2.5 20 5.5l-3 3" />
    <path d="M4 11V9.5a4 4 0 0 1 4-4h12" />
    <path d="M7 21.5 4 18.5l3-3" />
    <path d="M20 13v1.5a4 4 0 0 1-4 4H4" />
  </Icon>
)

export const VolumeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M16 9a4 4 0 0 1 0 6" />
    <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
  </Icon>
)

export const VolumeMutedIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </Icon>
)

export const HeartIcon = ({ filled = false, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p}>
    <path
      d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Icon>
)

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
)

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 7h15M9.5 7V4.8h5V7" />
    <path d="M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7" />
  </Icon>
)

export const MoreIcon = (p: IconProps) => (
  <Icon {...p} stroke="none">
    <circle cx="5.5" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.8" fill="currentColor" />
  </Icon>
)

export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
)

export const PauseIcon = (p: IconProps) => (
  <Icon {...p} stroke="none">
    <rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
  </Icon>
)

export const PopOutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-8 8" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Icon>
)

export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Icon>
)

export const MusicIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 18V5.5l11-2V16" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </Icon>
)
