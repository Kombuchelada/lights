# Lumessa controller (Angular) — built to static assets, served by Caddy which
# also reverse-proxies /api and /hubs to the private server service (so the app
# stays same-origin: no CORS, WebSockets pass straight through).
#
# Build context is the repo root (set RAILWAY_DOCKERFILE_PATH=apps/management/Dockerfile
# on the Railway service) because the app imports ../../packages/protocol.

FROM node:25-alpine AS build
WORKDIR /repo
# Protocol source first — it's resolved via the tsconfig path alias.
COPY packages/protocol/ ./packages/protocol/
COPY apps/management/ ./apps/management/
WORKDIR /repo/apps/management
RUN npm ci
RUN npm run build
# Angular application builder emits to dist/management/browser.

FROM caddy:2-alpine AS runtime
COPY apps/management/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/management/dist/management/browser /srv
