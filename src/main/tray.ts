import { Menu, Tray, nativeImage } from 'electron'
import type { NowPlaying } from '../shared/api'
import { trayMenuTemplate, trayTooltip, type TrayActions } from './trayMenu'
import trayIcon from '../../resources/tray.png?asset'

export interface EncoreTray {
  // Refreshes the menu and tooltip to match what's playing.
  update: (now: NowPlaying | null) => void
  destroy: () => void
}

// Puts Encore in the system tray. Clicking the icon brings the window back; right-clicking shows playback controls.
export function createTray(actions: TrayActions): EncoreTray {
  const tray = new Tray(nativeImage.createFromPath(trayIcon))
  const update = (now: NowPlaying | null): void => {
    tray.setToolTip(trayTooltip(now))
    tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate(now, actions)))
  }
  update(null)
  tray.on('click', actions.show)
  return { update, destroy: () => tray.destroy() }
}
