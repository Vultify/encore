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

// Listening time the way people say it: 12h 40m, 2h, 45m, or 42s for under a minute.
export function formatListening(seconds: number): string {
  if (seconds < 1) return '0m'
  if (seconds < 60) return `${Math.floor(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export const playCount = (n: number): string => `${n.toLocaleString()} ${n === 1 ? 'play' : 'plays'}`
