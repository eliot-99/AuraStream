import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    https: false // In real deployment, serve via HTTPS/WSS at the proxy/CDN level
  }
});