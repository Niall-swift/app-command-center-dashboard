import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Headers necessários para SharedArrayBuffer (FFmpeg.wasm)
    // credentialless: habilita crossOriginIsolated sem bloquear imagens externas (Firebase Storage)
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      '/api/ixc': {
        target: 'https://coopertecisp.com.br',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/ixc/, '/webservice/v1'),
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
