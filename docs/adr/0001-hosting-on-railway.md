# 0001 — Host Phase 1 on Railway

Status: accepted (2026-05-29)

## Decision

Deploy the Phase-1 prototype to **Railway** as one project with three services —
`lights-server` (ASP.NET Core + SignalR, private), `lights-management` and
`lights-client` (static apps served by Caddy, public). Caddy on each front-end
reverse-proxies `/api` and `/hubs` to the server over Railway's private network,
keeping the browser same-origin (no CORS, clean WebSocket upgrade). Deployment is
Railway-native (each service auto-deploys from `main`); GitHub Actions runs the
server tests + front-end builds as a non-blocking quality gate.

## Context & trade-offs

The choice was between **Railway** and **Azure**, the two platforms the owner has
experience with. Phase 1 is a prototype whose priorities are: easy deploys,
turnkey custom domains + SSL, WebSocket support (SignalR), and — because the
project is AI-first — a mature MCP for an agent to operate the platform.

Railway wins on every Phase-1 priority: native WebSocket support, free
auto-renewing TLS on both `*.up.railway.app` and custom domains, a first-party
**MCP server** (`mcp.railway.com`) that can create projects, manage variables and
domains, and trigger/inspect deploys with a human-in-the-loop on destructive
actions, and a low-friction CLI for CI. Azure's comparable pieces exist (App
Service free managed certs; the official `microsoft/mcp` server across 40+
services) but its MCP is oriented to operating resources rather than app
deployment, and the setup carries more ceremony.

## Considered and rejected (for now): Azure

Azure's decisive advantage is **deferred**, not present: **Azure SignalR Service**
is the clean scale-out backplane this project's own roadmap already names for the
SaaS phase, and Azure is the natural fit once Auth0/Stripe/Postgres and
multi-instance scale arrive. None of that is Phase 1.

## Revisit trigger

Reopen this decision when the SaaS roadmap (`docs/roadmap.md`) starts: the move to
a durable store + multi-instance scale (Azure SignalR Service / Redis backplane)
is the point to re-evaluate Azure. The hub uses connection groups
(`session:{id}`), so the application code is expected to migrate unchanged.
