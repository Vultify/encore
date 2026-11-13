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
  let shown = ''
  // Volume and the song's position change often but don't show in the tray, so those reports leave it alone.
  const update = (state: TrayState): void => {
    const tooltip = trayTooltip(state.now)
    const template = trayMenuTemplate(state, actions)
    const key = tooltip + JSON.stringify(template)
    if (key === shown) return
    shown = key
    tray.setToolTip(tooltip)
    tray.setContextMenu(Menu.buildFromTemplate(template))
  }
  update(initial)
  tray.on('click', actions.show)
  return { update, destroy: () => tray.destroy() }
}
