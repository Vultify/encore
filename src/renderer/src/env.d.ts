import type { EncoreApi } from '@shared/api'

declare global {
  interface Window {
    encore: EncoreApi
  }
  // The version in package.json, filled in when the app is built.
  const __APP_VERSION__: string
}
