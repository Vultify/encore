import { protocol } from 'electron'
import { ARTWORK_SCHEME, MEDIA_SCHEME } from '../shared/api'
import { serveArtwork } from './library/artwork'
import { serveMedia } from './library/media'

// Electron only takes this list once, before the app is ready, so every private scheme is declared here.
export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: ARTWORK_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ])
}

export function handleProtocols(): void {
  protocol.handle(ARTWORK_SCHEME, serveArtwork)
  protocol.handle(MEDIA_SCHEME, serveMedia)
}
