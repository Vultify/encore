import { protocol } from 'electron'
import { ARTWORK_SCHEME, MEDIA_SCHEME } from '../shared/api'
import { serveArtwork } from './library/artwork'
import { serveMedia } from './library/media'
import { servePreview } from './identify'

// Electron only takes this list once, before the app is ready, so every private scheme is declared here.
export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: ARTWORK_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ])
}

// encore-art://local/<id> is saved cover art. encore-art://preview/<id> is a match's cover while reviewing.
export function handleProtocols(): void {
  protocol.handle(ARTWORK_SCHEME, (request) => (new URL(request.url).host === 'preview' ? servePreview(request) : serveArtwork(request)))
  protocol.handle(MEDIA_SCHEME, serveMedia)
}
