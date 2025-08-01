/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PATIENTS_TABLE_NAME: string
  readonly VITE_AWS_REGION: string
  // Add other environment variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
