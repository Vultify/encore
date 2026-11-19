import type { MenuItemConstructorOptions } from 'electron'
import { hasNewVersion, type NowPlaying, type UpdateStatus } from '../shared/api'

export interface TrayActions {
  show: () => void
  toggleMiniPlayer: () => void
  toggle: () => void
  next: () => void
  previous: () => void
  // Brings up the update in Settings, or restarts into it once it's downloaded.
  showUpdate: () => void
  installUpdate: () => void
  quit: () => void
}

export interface TrayState {
  now: NowPlaying | null
  miniPlayerOpen: boolean
  // The mini player's shortcut, shown beside its menu item.
  shortcut: string
  update: UpdateStatus
}

// Windows tray tooltips are cut off past this many characters.
const TOOLTIP_MAX = 127

// Windows menus treat "&" as a hidden shortcut marker, so a real ampersand has to be doubled to show.
const menuText = (text: string): string => text.replaceAll('&', '&&')

const songLine = (now: NowPlaying): string => (now.artist ? `${now.title} · ${now.artist}` : now.title)

// A new version gets its own item above Quit, for anyone who mostly uses Encore from the tray.
function updateItems(update: UpdateStatus, actions: TrayActions): MenuItemConstructorOptions[] {
  if (!hasNewVersion(update)) return []
  const item: MenuItemConstructorOptions =
    update.state === 'ready'
      ? { label: 'Restart to update Encore', click: actions.installUpdate }
      : update.state === 'downloading'
        ? { label: `Downloading Encore ${update.version}…`, enabled: false }
        : { label: `Update to Encore ${update.version}`, click: actions.showUpdate }
  return [item, { type: 'separator' }]
}

// The tray's right-click menu: what's playing, playback controls, then the windows and quitting.
export function trayMenuTemplate({ now, miniPlayerOpen, shortcut, update }: TrayState, actions: TrayActions): MenuItemConstructorOptions[] {
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
    ...updateItems(update, actions),
    { label: 'Quit Encore', click: actions.quit }
  ]
}

// "Encore" alone, or the song playing, shortened to fit.
export function trayTooltip(now: NowPlaying | null): string {
  if (!now?.trackId) return 'Encore'
  const text = `Encore · ${songLine(now)}`
  return text.length > TOOLTIP_MAX ? `${text.slice(0, TOOLTIP_MAX - 1)}…` : text
}
