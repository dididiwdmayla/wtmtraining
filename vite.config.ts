import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * A Vercel injeta `VERCEL_GIT_COMMIT_SHA` como variável de build, sem o
 * prefixo `VITE_` — então ela não chega ao cliente sozinha. O `define`
 * abaixo é o que a faz existir em `import.meta.env`. Vazia fora da
 * Vercel: quem decide mostrar "dev" é a tela, não o build.
 */
// Só o `process.env` do build: declarado aqui para não puxar
// @types/node inteiro para dentro de `src`, que é código de navegador.
declare const process: { env: Record<string, string | undefined> };

const commit =
  process.env.VITE_VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? '';

export default defineConfig({
  // host: true no script dev permite abrir no celular pela rede local
  // ou pela porta pública do Codespaces.
  server: { host: true, port: 5173 },
  define: {
    'import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA': JSON.stringify(commit),
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // mp3 entra no precache: o som do disparo é parte do treino e
      // precisa estar lá quando o PWA abrir sem rede.
      workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3}'] },
      manifest: {
        name: 'Treino de Mira',
        short_name: 'Mira',
        description: 'Treino de antecipacao, ponto fraco e tracking',
        theme_color: '#0a0c0a',
        background_color: '#0a0c0a',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          { src: '/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
