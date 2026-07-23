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
      "/api/ixc": {
        target: "https://coopertecisp.com.br",
        changeOrigin: true,
        secure: false,
        rewrite: (path2) => path2.replace(/^\/api\/ixc/, "/webservice/v1")
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxuaWFsbFxcXFxPbmVEcml2ZVxcXFxcdTAwQzFyZWEgZGUgVHJhYmFsaG9cXFxcYXZsIHRlbGVjb21cXFxcYXBwLWNvbW1hbmQtY2VudGVyLWRhc2hib2FyZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcbmlhbGxcXFxcT25lRHJpdmVcXFxcXHUwMEMxcmVhIGRlIFRyYWJhbGhvXFxcXGF2bCB0ZWxlY29tXFxcXGFwcC1jb21tYW5kLWNlbnRlci1kYXNoYm9hcmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL25pYWxsL09uZURyaXZlLyVDMyU4MXJlYSUyMGRlJTIwVHJhYmFsaG8vYXZsJTIwdGVsZWNvbS9hcHAtY29tbWFuZC1jZW50ZXItZGFzaGJvYXJkL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XHJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnO1xyXG5pbXBvcnQgaHR0cHMgZnJvbSAnaHR0cHMnO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIGV4Y2x1ZGU6IFsnQGZmbXBlZy9mZm1wZWcnLCAnQGZmbXBlZy91dGlsJ11cclxuICB9LFxyXG4gIHNlcnZlcjoge1xyXG4gICAgaG9zdDogXCI6OlwiLFxyXG4gICAgcG9ydDogODA4MCxcclxuICAgIHByb3h5OiB7XHJcbiAgICAgICcvYXBpL2l4Yyc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwczovL2Nvb3BlcnRlY2lzcC5jb20uYnInLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGlcXC9peGMvLCAnL3dlYnNlcnZpY2UvdjEnKSxcclxuICAgICAgfSxcclxuICAgICAgJy9hcGkvc21hcnRvbHQnOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnaHR0cHM6Ly9uY2JyYXNpbC5zbWFydG9sdC5jb20nLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGlcXC9zbWFydG9sdC8sICcvYXBpL3YyJyksXHJcbiAgICAgICAgY29uZmlndXJlOiAocHJveHkpID0+IHtcclxuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcScsIChwcm94eVJlcSwgcmVxKSA9PiB7XHJcbiAgICAgICAgICAgIC8vIEdhcmFudGlyIFNOSSBjb3JyZXRvIHBhcmEgVExTXHJcbiAgICAgICAgICAgIHByb3h5UmVxLnNldEhlYWRlcignSG9zdCcsICduY2JyYXNpbC5zbWFydG9sdC5jb20nKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgcHJveHkub24oJ2Vycm9yJywgKGVyciwgcmVxLCByZXMpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1Byb3h5IFNtYXJ0T0xUXSBFcnJvOicsIGVyci5tZXNzYWdlKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYWdlbnQ6IG5ldyBodHRwcy5BZ2VudCh7XHJcbiAgICAgICAgICBrZWVwQWxpdmU6IHRydWUsXHJcbiAgICAgICAgICByZWplY3RVbmF1dGhvcml6ZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgc2VydmVybmFtZTogJ25jYnJhc2lsLnNtYXJ0b2x0LmNvbScsXHJcbiAgICAgICAgfSksXHJcbiAgICAgIH0sXHJcbiAgICAgICcvYXBpL3doYXBpJzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHBzOi8vZ2F0ZS53aGFwaS5jbG91ZCcsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogdHJ1ZSxcclxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpXFwvd2hhcGkvLCAnJyksXHJcbiAgICAgIH0sXHJcbiAgICAgICcvYXBpL3doYXRzYXBwLWNkbic6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwczovL3Bwcy53aGF0c2FwcC5uZXQnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IHRydWUsXHJcbiAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaVxcL3doYXRzYXBwLWNkbi8sICcnKSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxyXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ2FwcGxlLXRvdWNoLWljb24ucG5nJywgJ21hc2staWNvbi5zdmcnXSxcclxuICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICBuYW1lOiAnQVZMIFRlbGVjb20gRGFzaGJvYXJkJyxcclxuICAgICAgICBzaG9ydF9uYW1lOiAnQVZMIERhc2hib2FyZCcsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICdDb21tYW5kIENlbnRlciBEYXNoYm9hcmQgZm9yIEFWTCBUZWxlY29tJyxcclxuICAgICAgICB0aGVtZV9jb2xvcjogJyNmZmZmZmYnLFxyXG4gICAgICAgIGljb25zOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHNyYzogJ3B3YS0xOTJ4MTkyLnBuZycsXHJcbiAgICAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXHJcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBzcmM6ICdwd2EtNTEyeDUxMi5wbmcnLFxyXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxyXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIF1cclxuICAgICAgfSxcclxuICAgICAgd29ya2JveDoge1xyXG4gICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiAzMDAwMDAwLFxyXG4gICAgICB9XHJcbiAgICB9KSxcclxuICAgIG1vZGUgPT09ICdkZXZlbG9wbWVudCcgJiZcclxuICAgIGNvbXBvbmVudFRhZ2dlcigpLFxyXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgfSxcclxuICB9LFxyXG59KSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBOGIsU0FBUyxvQkFBb0I7QUFDM2QsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFDeEIsT0FBTyxXQUFXO0FBTGxCLElBQU0sbUNB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
