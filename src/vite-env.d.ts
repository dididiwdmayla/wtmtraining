/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * SHA do commit do deploy. A Vercel expõe `VERCEL_GIT_COMMIT_SHA` no
   * build; `vite.config.ts` reescreve para cá. Ausente no dev local.
   */
  readonly VITE_VERCEL_GIT_COMMIT_SHA?: string;
}
