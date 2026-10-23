# Authentication (Auth0)

Only the **controller** authenticates. The headset **client** joins anonymously
with a 6-character session code. Sessions belong to the account that creates
them: the controller's `sub` is stamped onto the session when it's created, and
the server checks it whenever a controller joins.

## As deployed

| Thing | Value |
|---|---|
| Tenant | `dev-en23jhoni7eu3ibw` (US region) |
| Login domain | `login.lumessa.xyz` (an Auth0 custom domain with a managed certificate) |
| SPA application | "Lumessa", client ID `yTdTbnDzjOOjtDht55Q4pXOAVKXaQe5c` |
| API audience | `https://api.lumessa.xyz` (RS256) |
| Login methods | Email + password (database connection) and Google |

Every value in this table is public: each one already ships in the SPA bundle.
There are no secrets in the repository.

## Token flow

```
Clinician → controller SPA (@auth0/auth0-angular, domain = login.lumessa.xyz)
          → access token (iss = https://login.lumessa.xyz/, aud = https://api.lumessa.xyz)
          → Authorization: Bearer on /api/*   (HTTP interceptor)
          → ?access_token=… on /hubs/control   (SignalR accessTokenFactory)
Server    → JwtBearer; ValidIssuers = { custom domain, default tenant }
```

- **Hub token in the query string.** Browsers can't set headers on a WebSocket
  handshake, so `OnMessageReceived` reads `access_token` from the query for
  `/hubs/*` requests. This is the standard SignalR pattern.
- **Two valid issuers.** The custom domain and the default tenant domain share
  signing keys, so the server accepts tokens from either.
  `Auth0__AdditionalIssuers` (comma-separated) sets the extra issuers and defaults
  to `https://login.lumessa.xyz/`.
- **No CORS in production.** The Caddy front-ends proxy `/api` and `/hubs` on the
  same origin, so `Cors__AllowedOrigins` only matters in local development.

## One hub, two roles

The controller and the anonymous client share `/hubs/control`, so the hub class
**must not** carry a blanket `[Authorize]`. Instead:

- Anyone can open a hub connection.
- `JoinSession(code, "controller")` requires an authenticated user whose `sub`
  matches the session's `OwnerSub`. Otherwise it throws `HubException`.
- `JoinSession(code, "client")` is open to anyone.
- `SendState` is accepted only from the controller role.

On HTTP, `POST /api/sessions` requires authorization. `GET /api/sessions/{code}`
and `/healthz` are anonymous.

See [`Program.cs`](../server/Lumessa.Api/Program.cs) and
[`ControlHub.cs`](../server/Lumessa.Api/ControlHub.cs).

## Configuration

**SPA (build time):** [`auth.config.ts`](../apps/management/src/app/auth.config.ts)
holds `domain`, `clientId`, and `audience`. At runtime, `redirectUri` is the page
origin, so one build serves both production and `localhost:4200`. If those values
are missing, `isAuthConfigured` turns off the auth UI, the interceptor, and the
hub token, so local development runs without auth.

**Server (environment variables):**

| Variable | Purpose |
|---|---|
| `Auth0__Domain` | OIDC metadata and JWKS discovery. If unset, the server skips JWT validation. |
| `Auth0__Audience` | The expected `aud`. |
| `Auth0__AdditionalIssuers` | Optional extra accepted issuers. |
| `Cors__AllowedOrigins` | Allowed origins for local cross-origin development. |

**Auth0 dashboard (manual):** Allowed Callback, Logout, and Web Origin URLs for
`https://app.lumessa.xyz` and `http://localhost:4200`; refresh-token rotation; the
database and Google connections; and the verified `login.lumessa.xyz` custom
domain. The client (`join.lumessa.xyz`) is not an Auth0 application.

To rotate a value, edit `auth.config.ts` and/or the Railway variables, then
redeploy.

## Deferred

- Roles and RBAC (for example, an admin role)
- Microsoft social login, which needs its own Azure app registration
- Persistent per-account room codes
