/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  // More env variables can be added here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}