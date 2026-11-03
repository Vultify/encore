import { Menu, Tray, nativeImage } from 'electron'
import { trayMenuTemplate, trayTooltip, type TrayActions, type TrayState } from './trayMenu'
import trayIcon from '../../resources/tray.png?asset'

export interface EncoreTray {
  // Refreshes the menu and tooltip to match what's playing and whether the mini player is open.
  update: (state: TrayState) => void
  destroy: () => void
}

// Puts Encore in the system tray. Clicking the icon brings the window back; right-clicking shows playback controls.
export function createTray(actions: TrayActions, initial: TrayState): EncoreTray {
  const tray = new Tray(nativeImage.createFromPath(trayIcon))
  const update = (state: TrayState): void => {
    tray.setToolTip(trayTooltip(state.now))
    tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate(state, actions)))
  }
  update(initial)
  tray.on('click', actions.show)
  return { update, destroy: () => tray.destroy() }
}
