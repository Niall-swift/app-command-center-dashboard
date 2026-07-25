// vite.config.ts
import { defineConfig } from "file:///C:/Users/niall/OneDrive/%C3%81rea%20de%20Trabalho/avl%20telecom/app-command-center-dashboard/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/niall/OneDrive/%C3%81rea%20de%20Trabalho/avl%20telecom/app-command-center-dashboard/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { componentTagger } from "file:///C:/Users/niall/OneDrive/%C3%81rea%20de%20Trabalho/avl%20telecom/app-command-center-dashboard/node_modules/lovable-tagger/dist/index.js";
import { VitePWA } from "file:///C:/Users/niall/OneDrive/%C3%81rea%20de%20Trabalho/avl%20telecom/app-command-center-dashboard/node_modules/vite-plugin-pwa/dist/index.js";
import https from "https";
var __vite_injected_original_dirname = "C:\\Users\\niall\\OneDrive\\\xC1rea de Trabalho\\avl telecom\\app-command-center-dashboard";
var vite_config_default = defineConfig(({ mode }) => ({
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"]
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api/ispfy": {
        target: "https://coopertecisp.com.br:8043",
        changeOrigin: true,
        secure: false,
        rewrite: (path2) => path2.replace(/^\/api\/ispfy/, "/api")
      },
      "/api/smartolt": {
        target: "https://ncbrasil.smartolt.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path2) => path2.replace(/^\/api\/smartolt/, "/api/v2"),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            proxyReq.setHeader("Host", "ncbrasil.smartolt.com");
          });
          proxy.on("error", (err, req, res) => {
            console.error("[Proxy SmartOLT] Erro:", err.message);
          });
        },
        agent: new https.Agent({
          keepAlive: true,
          rejectUnauthorized: false,
          servername: "ncbrasil.smartolt.com"
        })
      },
      "/api/whapi": {
        target: "https://gate.whapi.cloud",
        changeOrigin: true,
        secure: true,
        rewrite: (path2) => path2.replace(/^\/api\/whapi/, "")
      },
      "/api/whatsapp-cdn": {
        target: "https://pps.whatsapp.net",
        changeOrigin: true,
        secure: true,
        rewrite: (path2) => path2.replace(/^\/api\/whatsapp-cdn/, "")
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "AVL Telecom Dashboard",
        short_name: "AVL Dashboard",
        description: "Command Center Dashboard for AVL Telecom",
        theme_color: "#ffffff",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3e6
      }
    }),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxuaWFsbFxcXFxPbmVEcml2ZVxcXFxcdTAwQzFyZWEgZGUgVHJhYmFsaG9cXFxcYXZsIHRlbGVjb21cXFxcYXBwLWNvbW1hbmQtY2VudGVyLWRhc2hib2FyZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcbmlhbGxcXFxcT25lRHJpdmVcXFxcXHUwMEMxcmVhIGRlIFRyYWJhbGhvXFxcXGF2bCB0ZWxlY29tXFxcXGFwcC1jb21tYW5kLWNlbnRlci1kYXNoYm9hcmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL25pYWxsL09uZURyaXZlLyVDMyU4MXJlYSUyMGRlJTIwVHJhYmFsaG8vYXZsJTIwdGVsZWNvbS9hcHAtY29tbWFuZC1jZW50ZXItZGFzaGJvYXJkL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XHJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnO1xyXG5pbXBvcnQgaHR0cHMgZnJvbSAnaHR0cHMnO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIGV4Y2x1ZGU6IFsnQGZmbXBlZy9mZm1wZWcnLCAnQGZmbXBlZy91dGlsJ11cclxuICB9LFxyXG4gIHNlcnZlcjoge1xyXG4gICAgaG9zdDogXCI6OlwiLFxyXG4gICAgcG9ydDogODA4MCxcclxuICAgIHByb3h5OiB7XHJcbiAgICAgICcvYXBpL2lzcGZ5Jzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHBzOi8vY29vcGVydGVjaXNwLmNvbS5icjo4MDQzJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpXFwvaXNwZnkvLCAnL2FwaScpLFxyXG4gICAgICB9LFxyXG4gICAgICAnL2FwaS9zbWFydG9sdCc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwczovL25jYnJhc2lsLnNtYXJ0b2x0LmNvbScsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaVxcL3NtYXJ0b2x0LywgJy9hcGkvdjInKSxcclxuICAgICAgICBjb25maWd1cmU6IChwcm94eSkgPT4ge1xyXG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKHByb3h5UmVxLCByZXEpID0+IHtcclxuICAgICAgICAgICAgLy8gR2FyYW50aXIgU05JIGNvcnJldG8gcGFyYSBUTFNcclxuICAgICAgICAgICAgcHJveHlSZXEuc2V0SGVhZGVyKCdIb3N0JywgJ25jYnJhc2lsLnNtYXJ0b2x0LmNvbScpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICBwcm94eS5vbignZXJyb3InLCAoZXJyLCByZXEsIHJlcykgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbUHJveHkgU21hcnRPTFRdIEVycm86JywgZXJyLm1lc3NhZ2UpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhZ2VudDogbmV3IGh0dHBzLkFnZW50KHtcclxuICAgICAgICAgIGtlZXBBbGl2ZTogdHJ1ZSxcclxuICAgICAgICAgIHJlamVjdFVuYXV0aG9yaXplZDogZmFsc2UsXHJcbiAgICAgICAgICBzZXJ2ZXJuYW1lOiAnbmNicmFzaWwuc21hcnRvbHQuY29tJyxcclxuICAgICAgICB9KSxcclxuICAgICAgfSxcclxuICAgICAgJy9hcGkvd2hhcGknOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnaHR0cHM6Ly9nYXRlLndoYXBpLmNsb3VkJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiB0cnVlLFxyXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGlcXC93aGFwaS8sICcnKSxcclxuICAgICAgfSxcclxuICAgICAgJy9hcGkvd2hhdHNhcHAtY2RuJzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHBzOi8vcHBzLndoYXRzYXBwLm5ldCcsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogdHJ1ZSxcclxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpXFwvd2hhdHNhcHAtY2RuLywgJycpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIHJlYWN0KCksXHJcbiAgICBWaXRlUFdBKHtcclxuICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXHJcbiAgICAgIGluY2x1ZGVBc3NldHM6IFsnZmF2aWNvbi5pY28nLCAnYXBwbGUtdG91Y2gtaWNvbi5wbmcnLCAnbWFzay1pY29uLnN2ZyddLFxyXG4gICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgIG5hbWU6ICdBVkwgVGVsZWNvbSBEYXNoYm9hcmQnLFxyXG4gICAgICAgIHNob3J0X25hbWU6ICdBVkwgRGFzaGJvYXJkJyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogJ0NvbW1hbmQgQ2VudGVyIERhc2hib2FyZCBmb3IgQVZMIFRlbGVjb20nLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnI2ZmZmZmZicsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgc3JjOiAncHdhLTE5MngxOTIucG5nJyxcclxuICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcclxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZydcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHNyYzogJ3B3YS01MTJ4NTEyLnBuZycsXHJcbiAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXHJcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgXVxyXG4gICAgICB9LFxyXG4gICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgbWF4aW11bUZpbGVTaXplVG9DYWNoZUluQnl0ZXM6IDMwMDAwMDAsXHJcbiAgICAgIH1cclxuICAgIH0pLFxyXG4gICAgbW9kZSA9PT0gJ2RldmVsb3BtZW50JyAmJlxyXG4gICAgY29tcG9uZW50VGFnZ2VyKCksXHJcbiAgXS5maWx0ZXIoQm9vbGVhbiksXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pKTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE4YixTQUFTLG9CQUFvQjtBQUMzZCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBZTtBQUN4QixPQUFPLFdBQVc7QUFMbEIsSUFBTSxtQ0FB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
