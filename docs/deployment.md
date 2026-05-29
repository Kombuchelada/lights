# Deployment — Lights on Railway

Phase-1 hosting runbook. The *why* is in [`adr/0001-hosting-on-railway.md`](adr/0001-hosting-on-railway.md).

## Topology

One Railway **project**, three **services**, all built from this repo (build
context = repo root; each service sets `RAILWAY_DOCKERFILE_PATH`):

| Service | Dockerfile | Public? | URL |
|---|---|---|---|
| `lights-server` | `server/Dockerfile` | private | `*.up.railway.app` (health only) |
| `lights-management` | `apps/management/Dockerfile` | public | `app.<domain>` |
| `lights-client` | `apps/client/Dockerfile` | public | `go.<domain>` |

The two front-ends run **Caddy**, which serves the static bundle and
reverse-proxies `/api` + `/hubs` to the server over Railway's private network.
The browser only ever talks to its own origin, so there is no CORS and the
SignalR WebSocket upgrades cleanly. The server has **no public custom domain** —
it's reached privately at `lights-server.railway.internal:8080`.

## Service configuration (variables)

**`lights-server`**
- `ASPNETCORE_URLS=http://[::]:8080` — bind IPv6 so both the public edge and the
  private network reach it; fixed port keeps the private origin stable.
- `Client__BaseUrl=https://go.<domain>` — used to build the QR/join URL
  (`Program.cs` reads `Client:BaseUrl`; `__` is the env form of `:`). Until the
  custom domain is live, set this to the client's `*.up.railway.app` URL.
- `RAILWAY_DOCKERFILE_PATH=server/Dockerfile`
- Networking: target port **8080**; healthcheck path `/healthz`.

**`lights-management`** and **`lights-client`**
- `SERVER_ORIGIN=http://lights-server.railway.internal:8080` — Caddy's proxy target.
- `RAILWAY_DOCKERFILE_PATH=apps/management/Dockerfile` / `apps/client/Dockerfile`
- `$PORT` is injected by Railway; Caddy listens on it (see each `Caddyfile`).

> Enable **Private Networking** on the project so `*.railway.internal` resolves.

## CI/CD

**Deployment is Railway-native:** connect the repo to each service and Railway
rebuilds from that service's Dockerfile on every push to `main` — no GitHub
Actions deploy step, no `RAILWAY_TOKEN` needed.

`.github/workflows/ci.yml` is a **quality gate only** (it does not deploy). On
push to `main` and on every PR it runs:
1. `test-server` — `dotnet test`.
2. `build-frontends` — `npm ci && npm run build` for client + management.

> Native auto-deploy does **not** block on this gate (Railway deploys on push
> regardless of CI). If you want a green gate to gate deploys, turn **off**
> Railway auto-deploy for each service and add a deploy job to the workflow:
> install the Railway CLI and run `railway up --service <name>` for each service,
> with a repo secret `RAILWAY_TOKEN` (a Railway **project token**: Project →
> Settings → Tokens).

## Custom domain (Squarespace DNS)

Squarespace supports **CNAME on subdomains** (not the apex), which suits the
`app.`/`go.` scheme. For each public service: Railway → service → Settings →
Networking → **Custom Domain** → enter `app.<domain>` (resp. `go.<domain>`),
then add the **CNAME** record Railway shows in Squarespace
(Settings → Domains → DNS):

| Host | Type | Value |
|---|---|---|
| `app` | CNAME | *(target Railway displays for lights-management)* |
| `go`  | CNAME | *(target Railway displays for lights-client)* |

Railway provisions + auto-renews TLS once the record resolves. After `go.<domain>`
is live, set the server's `Client__BaseUrl=https://go.<domain>` so QR codes point
at the real domain.

## Let an agent drive it (Railway MCP)

This decision was made AI-first. The first-party Railway MCP (it forces a
human-in-the-loop on destructive actions) is wired in via project-scoped
[`.mcp.json`](../.mcp.json) at the repo root:

```json
{ "mcpServers": { "railway": { "type": "http", "url": "https://mcp.railway.com" } } }
```

Because it's committed, every session sees the `railway` server; there are **no
secrets in the file** (OAuth handles auth). One-time steps:

1. **Authenticate** — in an interactive Claude Code session run `/mcp`, pick
   `railway`, and complete the browser OAuth flow. (Claude Code flags the server
   for auth when it first returns 401/403.)
2. The agent can then create the project/services, set the variables above, and
   manage domains on your behalf.

Equivalent CLI setup (instead of editing `.mcp.json` by hand):

- **Remote (recommended):** `claude mcp add railway --transport http https://mcp.railway.com`
- **Local:** `claude mcp add railway-mcp-server -- npx -y @railway/mcp-server`
  (uses your logged-in Railway CLI).

> **Web vs. desktop:** the OAuth `/mcp` flow needs an interactive client (Claude
> Code desktop/CLI). Authenticate there once; this sandboxed web environment
> can't open the browser flow itself. The GitHub Actions gate needs no MCP.

## First-deploy order

1. Create project + the three services from this GitHub repo (set each
   `RAILWAY_DOCKERFILE_PATH`); enable auto-deploy from `main`.
2. Set service variables (above); enable Private Networking.
3. Push to `main` → Railway builds + deploys each service from its Dockerfile.
   (`ci.yml` runs the tests/builds in parallel as a visible gate.)
4. Verify `lights-server` `/healthz`, open `lights-management`, start a session,
   scan the QR into `lights-client`, confirm realtime control.
5. Set `Client__BaseUrl` to the client's `*.up.railway.app` URL so QR codes work
   on the subdomains; revisit when a custom domain is added.

## Rollback

Railway → service → Deployments → **Redeploy** a previous build. Or revert the
commit on `main` and let the workflow redeploy.

## Notes / follow-ups

- CORS in `Program.cs` is dev-open. With same-origin Caddy proxying it isn't
  exercised in this topology, but tighten it (env-driven allowlist) before any
  non-prototype use.
- Single instance, in-memory sessions (see `docs/roadmap.md` limitations).
  Multi-instance needs the Azure SignalR / Redis backplane — the ADR's revisit
  trigger.
