import { createHash, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'

export interface UpdateServer {
  // An update config for Encore's ENCORE_UPDATE_CONFIG, pointing at this server.
  configPath: string
  // Every path Encore asked for, in order.
  requests: string[]
  close: () => Promise<void>
}

interface UpdateServerOptions {
  version: string
  // Answers every request with this status instead, like GitHub does for a repo it can't find.
  failWith?: number
  // Lists the wrong checksum for the installer, so its download fails the check.
  corrupt?: boolean
}

// Stands in for GitHub Releases: latest.yml names the newest version, and the installer is a made-up file that is
// never run. Its config keeps downloads in their own cache folder, apart from the real Encore's.
export async function startUpdateServer(dir: string, { version, failWith, corrupt = false }: UpdateServerOptions): Promise<UpdateServer> {
  const installer = randomBytes(256 * 1024)
  const sha512 = createHash('sha512')
    .update(corrupt ? randomBytes(16) : installer)
    .digest('base64')
  const latest = [
    `version: ${version}`,
    'files:',
    '  - url: Encore-Setup.exe',
    `    sha512: ${sha512}`,
    `    size: ${installer.length}`,
    'path: Encore-Setup.exe',
    `sha512: ${sha512}`,
    "releaseDate: '2026-11-19T00:00:00.000Z'"
  ].join('\n')

  const requests: string[] = []
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    requests.push(path)
    if (failWith) {
      response.writeHead(failWith).end()
    } else if (path === '/latest.yml') {
      response.writeHead(200, { 'content-type': 'text/yaml' }).end(latest)
    } else if (path === '/Encore-Setup.exe') {
      response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': installer.length }).end(installer)
    } else {
      response.writeHead(404).end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  const configPath = join(dir, 'update-config.yml')
  writeFileSync(configPath, `provider: generic\nurl: http://127.0.0.1:${port}/\nupdaterCacheDirName: encore-updater-test\n`)

  return {
    configPath,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  }
}
