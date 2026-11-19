import { useEffect, useState } from 'react'

// Whether Encore's window is on screen. Hidden in the tray or minimized counts as not shown. The page itself can't
// tell, since Encore keeps hidden windows running at full speed for the music.
export function useWindowShown(): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    void window.encore.window.isShown().then(setShown)
    return window.encore.window.onShownChange(setShown)
  }, [])
  return shown
}
