import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import https from 'https';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/ixc': {
        target: 'https://coopertecisp.com.br',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/ixc/, '/webservice/v1'),
      },
      '/api/smartolt': {
        target: 'https://ncbrasil.smartolt.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/smartolt/, '/api/v2'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Garantir SNI correto para TLS
            proxyReq.setHeader('Host', 'ncbrasil.smartolt.com');
          });
          proxy.on('error', (err, req, res) => {
            console.error('[Proxy SmartOLT] Erro:', err.message);
          });
        },
        agent: new https.Agent({
          keepAlive: true,
          rejectUnauthorized: false,
          servername: 'ncbrasil.smartolt.com',
        }),
      },
      '/api/whapi': {
        target: 'https://gate.whapi.cloud',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/whapi/, ''),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'AVL Telecom Dashboard',
        short_name: 'AVL Dashboard',
        description: 'Command Center Dashboard for AVL Telecom',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3000000,
      }
    }),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
