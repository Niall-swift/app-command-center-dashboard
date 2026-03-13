import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  server: {
    host: "::",
    port: 8080,
    // Headers removidos: FFmpeg 0.12 single-threaded não precisa de SharedArrayBuffer / COOP/COEP.
    proxy: {
      '/api/ixc': {
        target: 'https://coopertecisp.com.br',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/ixc/, '/webservice/v1'),
      },
      '/api/smartolt': {
        target: 'https://api.smartolt.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/smartolt/, '/api/v2'),
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
