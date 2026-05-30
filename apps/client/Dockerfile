# Lumessa headset client (vanilla TS + Vite PWA) — built to static assets, served
# by Caddy which also reverse-proxies /api and /hubs to the private server
# service (same-origin: no CORS, WebSockets pass through). This service is the
# QR / join-URL target (go.<domain>).
#
# Build context is the repo root (set RAILWAY_DOCKERFILE_PATH=apps/client/Dockerfile
# on the Railway service); the app depends on ../../packages/protocol.

FROM node:20-alpine AS build
WORKDIR /repo
COPY packages/protocol/ ./packages/protocol/
COPY apps/client/ ./apps/client/
WORKDIR /repo/apps/client
RUN npm ci
# VITE_API_BASE is intentionally left unset → '' → same-origin requests that
# Caddy proxies to the server. No build-time backend URL needed.
RUN npm run build
# Vite emits to dist/.

FROM caddy:2-alpine AS runtime
COPY apps/client/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/client/dist /srv
