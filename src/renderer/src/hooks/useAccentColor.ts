import { useEffect } from 'react'

// Sets the app's accent to a color picked from the playing song's cover, or back to teal when there's
// no song or the cover has no real color. The change fades because --accent is a registered, animated color.
export function useAccentColor(artworkId: string | null): void {
  useEffect(() => {
    const root = document.documentElement
    if (!artworkId) {
      root.style.removeProperty('--accent')
      return
    }

    let current = true
    window.encore.library.accentColor(artworkId).then((color) => {
      // A newer song may have started while this one's color was being worked out.
      if (!current) return
      if (color) root.style.setProperty('--accent', color)
      else root.style.removeProperty('--accent')
    })
    return () => {
      current = false
    }
  }, [artworkId])
}
