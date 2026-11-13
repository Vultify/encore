import { useEffect, useSyncExternalStore } from 'react'
import { preferences } from '@/store/preferences'

// Windows' Animation effects setting, as the page sees it.
const windowsQuiet = window.matchMedia('(prefers-reduced-motion: reduce)')

// The Motion setting decides, or leaves it to Windows when it's set to match.
function reduced(): boolean {
  const { motion } = preferences.getState()
  return motion === 'off' || (motion === 'system' && windowsQuiet.matches)
}

function subscribe(listener: () => void): () => void {
  const stop = preferences.subscribe(listener)
  windowsQuiet.addEventListener('change', listener)
  return () => {
    stop()
    windowsQuiet.removeEventListener('change', listener)
  }
}

const mark = (reduce: boolean): void => {
  document.documentElement.dataset.motion = reduce ? 'reduce' : 'full'
}

mark(reduced())

// Whether Encore should hold still. It also marks the page, so the stylesheets turn their motion off with it.
export function useReducedMotion(): boolean {
  const reduce = useSyncExternalStore(subscribe, reduced)
  useEffect(() => mark(reduce), [reduce])
  return reduce
}
