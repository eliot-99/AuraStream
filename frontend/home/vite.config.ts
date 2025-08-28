import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  server: {
    host: true, // listen on all interfaces for external access
    port: 5173,
    strictPort: true,
    https: false, // In real deployment, serve via HTTPS/WSS at the proxy/CDN level
    cors: true,
    // Stabilize HMR/WebSocket when accessed via public IP/port forwarding
    hmr: {
      protocol: 'ws',
      host: process.env.VITE_PUBLIC_HOST || undefined, // set to your PUBLIC_IP or domain for remote clients
      port: 5173,
      clientPort: 5173,
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