/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OTLP_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
