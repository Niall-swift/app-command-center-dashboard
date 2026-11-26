import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/ispfy': {
        // Apontando para o proxy seguro no Firebase para burlar bloqueios de IP (Firewall)
        target: 'https://us-central1-avl-telecom.cloudfunctions.net/ispfyProxy',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/ispfy/, ''),
      },
      '/api/smartolt': {
        target: 'https://us-central1-avl-telecom.cloudfunctions.net/smartOltProxy',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/smartolt/, ''),
      },
      '/api/whapi': {
        target: 'https://gate.whapi.cloud',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/whapi/, ''),
      },
      '/api/whatsapp-cdn': {
        target: 'https://pps.whatsapp.net',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/whatsapp-cdn/, ''),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'mask-icon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
      ],
      manifest: {
        id: '/',
        name: 'AVL Telecom — Command Center NOC',
        short_name: 'AVL NOC',
        description: 'Painel executivo NOC, atendimento WhatsApp 360°, ISPFY e monitoramento 24h AVL Telecom.',
        lang: 'pt-BR',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        background_color: '#0b1222',
        theme_color: '#0b1222',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Chat WhatsApp 360°',
            short_name: 'Chat WA',
            description: 'Abrir atendimento ao vivo WhatsApp e ISPFY',
            url: '/chat?source=pwa-shortcut',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Mapa Bairro / Rua (NOC)',
            short_name: 'NOC Região',
            description: 'Monitorar clientes online/offline e rompimentos',
            url: '/ispfy/regiao?source=pwa-shortcut',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Inteligência & CTO',
            short_name: 'Intel. CTO',
            description: 'Viabilidade de CTO, sinal óptico e Turbo',
            url: '/ispfy/inteligencia?source=pwa-shortcut',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Nova Ordem de Serviço',
            short_name: 'Nova O.S.',
            description: 'Abrir chamado técnico no ISPFY',
            url: '/ispfy/nova-os?source=pwa-shortcut',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6000000,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (!normalizedId.includes('/node_modules/')) return;
          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/react-router/') ||
            normalizedId.includes('/node_modules/react-router-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
          if (
            normalizedId.includes('/node_modules/firebase/') ||
            normalizedId.includes('/node_modules/@firebase/')
          ) {
            return 'vendor-firebase';
          }
          if (normalizedId.includes('/node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          if (normalizedId.includes('/node_modules/framer-motion/')) {
            return 'vendor-motion';
          }
          if (normalizedId.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          if (normalizedId.includes('/node_modules/@tanstack/')) {
            return 'vendor-query';
          }
          if (normalizedId.includes('/node_modules/recharts/')) {
            return 'vendor-charts';
          }
          if (normalizedId.includes('/node_modules/date-fns/')) {
            return 'vendor-dates';
          }
          if (
            normalizedId.includes('/node_modules/jspdf/') ||
            normalizedId.includes('/node_modules/jspdf-autotable/') ||
            normalizedId.includes('/node_modules/html2canvas/')
          ) {
            return 'vendor-pdf';
          }
          if (normalizedId.includes('/node_modules/cmdk/')) {
            return 'vendor-cmdk';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
