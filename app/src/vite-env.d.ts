/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Optional absolute API base. Leave empty in dev to use the Vite proxy.
  readonly VITE_HARNESS_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
