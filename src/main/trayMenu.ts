import type { MenuItemConstructorOptions } from 'electron'
import type { NowPlaying } from '../shared/api'

export interface TrayActions {
  show: () => void
  toggleMiniPlayer: () => void
  toggle: () => void
  next: () => void
  previous: () => void
  quit: () => void
}

export interface TrayState {
  now: NowPlaying | null
  miniPlayerOpen: boolean
  // The mini player's shortcut, shown beside its menu item.
  shortcut: string
}

// Windows tray tooltips are cut off past this many characters.
const TOOLTIP_MAX = 127

// Windows menus treat "&" as a hidden shortcut marker, so a real ampersand has to be doubled to show.
const menuText = (text: string): string => text.replaceAll('&', '&&')

const songLine = (now: NowPlaying): string => (now.artist ? `${now.title} · ${now.artist}` : now.title)

// The tray's right-click menu: what's playing, playback controls, then the windows and quitting.
export function trayMenuTemplate({ now, miniPlayerOpen, shortcut }: TrayState, actions: TrayActions): MenuItemConstructorOptions[] {
  const hasSong = now?.trackId != null
  return [
    ...(hasSong ? [{ label: menuText(songLine(now)), enabled: false }, { type: 'separator' } as const] : []),
    { label: now?.playing ? 'Pause' : 'Play', enabled: hasSong, click: actions.toggle },
    { label: 'Next', enabled: hasSong && Boolean(now?.hasNext), click: actions.next },
    { label: 'Previous', enabled: hasSong, click: actions.previous },
    { type: 'separator' },
    { label: 'Show Encore', click: actions.show },
    // The shortcut is only shown here; the mini player module is what claims it.
    {
      label: 'Mini player',
      type: 'checkbox',
      checked: miniPlayerOpen,
      accelerator: shortcut,
      registerAccelerator: false,
      click: actions.toggleMiniPlayer
    },
    { type: 'separator' },
    { label: 'Quit Encore', click: actions.quit }
  ]
}

// "Encore" alone, or the song playing, shortened to fit.
export function trayTooltip(now: NowPlaying | null): string {
  if (!now?.trackId) return 'Encore'
  const text = `Encore · ${songLine(now)}`
  return text.length > TOOLTIP_MAX ? `${text.slice(0, TOOLTIP_MAX - 1)}…` : text
}
