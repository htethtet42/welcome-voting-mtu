/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Go backend API, e.g. "http://localhost:8081/api". */
  readonly VITE_API_URL?: string;
  /** Google OAuth client ID for voter sign-in (Google Cloud Console). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
