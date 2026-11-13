// How much one notch of the mouse wheel moves the volume.
const WHEEL_STEP = 0.05

// The volume after one notch of the mouse wheel, or null for no change. While muted, scrolling down stays silent
// and scrolling up unmutes from where the volume was.
export function wheelVolume(volume: number, muted: boolean, deltaY: number): number | null {
  if (deltaY === 0 || (muted && deltaY > 0)) return null
  return Math.round(Math.min(1, Math.max(0, volume - Math.sign(deltaY) * WHEEL_STEP)) * 100) / 100
}
