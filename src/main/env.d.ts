// Settings read from .env when Encore is built. Only names starting with MAIN_VITE_ reach the main process.
interface ImportMetaEnv {
  readonly MAIN_VITE_ACOUSTID_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
