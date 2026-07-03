/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL publique de l'API en production (ex. https://e-depot-api.onrender.com). Vide en dev (proxy Vite). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
