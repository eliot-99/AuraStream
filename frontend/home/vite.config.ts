import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  server: {
    https: false, // In real deployment, serve via HTTPS/WSS at the proxy/CDN level
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