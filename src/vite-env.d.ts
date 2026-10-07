/// <reference types="vite/client" />

/**
 * Vite only exposes variables prefixed with `VITE_`, and they are inlined as
 * strings at build time. Declaring them here means a typo or a missing build
 * variable is a compile error instead of a blank page in production.
 */
interface ImportMetaEnv {
  readonly VITE_PUBLIC_SUPABASE_URL: string;
  readonly VITE_PUBLIC_SUPABASE_ANON_KEY: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
