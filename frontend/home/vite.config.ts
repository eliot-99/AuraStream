import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh
      fastRefresh: true,
      // Include .tsx files
      include: "**/*.{jsx,tsx}",
    }), 
    wasm(), 
    topLevelAwait()
  ],
  server: {
    host: true, // listen on all interfaces for external access
    allowedHosts: [
      'a0771082dcbf.ngrok-free.app'
    ],
    port: 5173,
    strictPort: true,
    https: false, // In real deployment, serve via HTTPS/WSS at the proxy/CDN level
    cors: true,
    // HMR config: use external host only when VITE_PUBLIC_HOST is set; otherwise use default local HMR
    hmr: process.env.VITE_PUBLIC_HOST ? {
      protocol: 'wss',
      host: process.env.VITE_PUBLIC_HOST,
      port: 443,
      clientPort: 443,
    } : true,
    // Avoid reload loops if a separate build updates dist
    watch: {
      ignored: ['**/dist/**']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
        secure: false,
      }
    }
  },
  optimizeDeps: {
    // Prevent esbuild pre-bundling from choking on WASM in argon2-browser
    exclude: ['argon2-browser']
  }
});