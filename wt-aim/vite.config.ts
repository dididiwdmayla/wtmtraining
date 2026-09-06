import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // host: true no script dev permite abrir no celular pela rede local
  // ou pela porta pública do Codespaces.
  server: { host: true, port: 5173 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
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
