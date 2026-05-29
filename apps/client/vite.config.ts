import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Opt-in HTTPS for real-device testing (secure-context APIs: service worker /
// PWA install, Screen Wake Lock). Point these at a LAN cert (e.g. mkcert) and
// the dev server serves TLS; unset, dev stays plain HTTP. See docs/testing.md.
const cert = process.env.DEV_TLS_CERT;
const key = process.env.DEV_TLS_KEY;
const https = cert && key ? { cert: readFileSync(cert), key: readFileSync(key) } : undefined;

// The headset client and the server run on different dev origins, so proxy the
// API and the SignalR hub (WebSocket) to the backend's HTTP endpoint.
export default defineConfig({
  resolve: {
    alias: {
      '@lights/protocol': fileURLToPath(new URL('../../packages/protocol/src/index.ts', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    https,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/hubs': { target: 'http://localhost:5000', changeOrigin: true, ws: true },
    },
  },
});
