import { useEffect } from 'react'
import { usePreferences } from '@/store/preferences'

// Sets the app's accent: a color picked from the playing song's cover, or the one color chosen in Settings.
// With no song, or a cover with no real color, it goes back to teal. The change fades because --accent is a
// registered, animated color.
export function useAccentColor(artworkId: string | null): void {
  const { accent } = usePreferences()

  useEffect(() => {
    const root = document.documentElement
    if (accent !== 'album') {
      root.style.setProperty('--accent', accent)
      return
    }
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
  }, [artworkId, accent])
}
