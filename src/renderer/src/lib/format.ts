// Seconds as m:ss, or h:mm:ss for anything an hour or longer.
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '-:--'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export const songCount = (n: number): string => `${n.toLocaleString()} ${n === 1 ? 'song' : 'songs'}`
