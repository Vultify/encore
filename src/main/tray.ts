import { Menu, Tray, nativeImage } from 'electron'
import trayIcon from '../../resources/tray.png?asset'

interface TrayActions {
  show: () => void
  quit: () => void
}

// Puts Encore in the system tray. Clicking the icon brings the window back.
export function createTray(actions: TrayActions): Tray {
  const tray = new Tray(nativeImage.createFromPath(trayIcon))
  tray.setToolTip('Encore')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Encore', click: actions.show },
      { type: 'separator' },
      { label: 'Quit Encore', click: actions.quit }
    ])
  )
  tray.on('click', actions.show)
  return tray
}
