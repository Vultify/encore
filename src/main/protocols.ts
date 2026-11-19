import { protocol } from 'electron'
import { ARTWORK_SCHEME, MEDIA_SCHEME } from '../shared/api'
import { serveArtwork, serveThumbnail } from './library/artwork'
import { serveMedia } from './library/media'
import { servePreview } from './identify'

// Electron only takes this list once, before the app is ready, so every private scheme is declared here.
export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: ARTWORK_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
  ])
}

// encore-art://local/<id> is saved cover art and encore-art://thumb/<id> a small copy of it.
// encore-art://preview/<id> is a match's cover while reviewing.
export function handleProtocols(): void {
  protocol.handle(ARTWORK_SCHEME, (request) => {
    const { host } = new URL(request.url)
    if (host === 'preview') return servePreview(request)
    if (host === 'thumb') return serveThumbnail(request)
    return serveArtwork(request)
  })
  protocol.handle(MEDIA_SCHEME, serveMedia)
}
