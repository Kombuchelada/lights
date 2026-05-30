# Auth0 — requirements & implementation handoff

Status: **code complete; awaiting tenant values.** All the server and SPA wiring
is implemented and the builds/tests are green. The only remaining steps are
**user-side**: create the Auth0 tenant + apps and drop in the three public values
(see [Going live](#going-live--what-the-user-must-do) below). Closes the
"no authentication; dev CORS wide-open" limitation in [`roadmap.md`](roadmap.md)
and the auth seam noted in [`architecture.md`](architecture.md).

## What's implemented

**Server** ([`Program.cs`](../server/Lights.Api/Program.cs), [`ControlHub.cs`](../server/Lights.Api/ControlHub.cs)):
- `Microsoft.AspNetCore.Authentication.JwtBearer` added; JWT validation configured
  from `Auth0__Domain` + `Auth0__Audience` (no-ops gracefully if unset, so dev
  without a tenant still runs). `OnMessageReceived` reads `access_token` from the
  query string for `/hubs/*` (SignalR handshake can't set an Authorization header).
- `app.UseAuthentication()` / `UseAuthorization()` after `UseCors`.
- `POST /api/sessions` is `.RequireAuthorization()`; `GET /api/sessions/{code}` and
  `/healthz` stay anonymous.
- The hub allows anonymous connections; inside `JoinSession`, `role == "controller"`
  requires an authenticated user and a `sub` matching the session's `OwnerSub`
  (stamped at create time). The `"client"` role stays open.
- CORS narrowed from allow-all to an allowlist (`Cors__AllowedOrigins`, plus
  built-in dev + `*.lumessa.xyz` defaults).

**Management SPA** ([`app.config.ts`](../apps/management/src/app/app.config.ts),
[`auth.config.ts`](../apps/management/src/app/auth.config.ts),
[`control.service.ts`](../apps/management/src/app/control/control.service.ts), [`app.ts`](../apps/management/src/app/app.ts)):
- `@auth0/auth0-angular` installed; `provideAuth0(...)` + `authHttpInterceptorFn`
  (allowedList `/api/*`) registered. Refresh-token rotation + localStorage cache.
- Session-create now goes through `HttpClient` (so the token is attached); the hub
  gets `accessTokenFactory: () => firstValueFrom(auth.getAccessTokenSilently())`.
- Top-bar Log in / Log out UI; "Start session" is gated behind login. Auth UI is
  suppressed until real tenant values are present (`isAuthConfigured`), so dev
  without a tenant is unaffected.

## Going live — what the user must do

1. Create the Auth0 account + **US** tenant, then the **SPA Application** + **API**
   (resource server) and enable Google/Microsoft connections (details below).
2. Put the three **public** values in
   [`auth.config.ts`](../apps/management/src/app/auth.config.ts): `domain`,
   `clientId`, `audience` (audience defaults to the proposed `https://api.lumessa.xyz`).
3. Set the matching server env vars on the Railway `lights-server` service:
   `Auth0__Domain` (e.g. `lumessa.us.auth0.com`) and `Auth0__Audience`
   (= the API Identifier). Optionally `Cors__AllowedOrigins`.
4. Register the SPA URLs in Auth0 (callback/logout/web-origin) for both
   `https://app.lumessa.xyz` and `http://localhost:4200`.

## Goal

Only the **clinician (controller)** authenticates. The **headset client** stays
**anonymous code-join** — it joins a session by 6-char code as today. Sessions
become scoped to the authenticated controller's account.

## Decisions already made (with the user)

| Choice | Decision |
|---|---|
| Tenant region | **US** (effectively permanent — moving regions means recreating the tenant) |
| Login methods | **Email+password** (Auth0 Database connection) + **Google** + **Microsoft** social. Apple optional later (requires an Apple Developer account, $99/yr). |
| Headset client auth | **None** — anonymous code-join. Only the controller logs in. |
| Session ownership | Sessions become **account-scoped** to the controller's user (`sub`). |
| Deferred for now | RBAC/roles (single clinician role), Auth0 custom domain (`auth.lumessa.xyz`), Stripe/billing gating. |

## Auth0 objects to create (dashboard or Auth0 MCP)

1. **SPA Application** → for the Angular controller (`apps/management`). Note its
   **Domain** and **Client ID** (both public, safe to commit).
2. **API** (resource server) → represents the .NET server. Set an **Identifier**
   (the audience). Recommended: **`https://api.lumessa.xyz`** (it's just a string,
   not a real endpoint). Signing alg **RS256**.
3. **Connections**: enable the **Database** connection + **Google** + **Microsoft**
   social connections on the SPA app.

### SPA Application URL settings

| Setting | Value |
|---|---|
| Allowed Callback URLs | `https://app.lumessa.xyz`, `http://localhost:4200` |
| Allowed Logout URLs | `https://app.lumessa.xyz`, `http://localhost:4200` |
| Allowed Web Origins | `https://app.lumessa.xyz`, `http://localhost:4200` |
| Refresh token rotation | **On** (rotating refresh tokens for the SPA) |

> `app.lumessa.xyz` is the controller; the client (`join.lumessa.xyz`) is **not**
> an Auth0 app and needs no URLs.

## Architecture / token flow

```
Clinician → Angular SPA (auth0-angular) → login → access token (audience = API id)
          → Bearer on /api/*  +  accessTokenFactory on the SignalR hub
.NET server validates:  Authority = https://<tenant>.us.auth0.com/   Audience = API id
```

- **SignalR caveat:** browsers can't set an `Authorization` header on the
  WebSocket handshake, so the token arrives in the **query string**
  (`?access_token=…`). The JwtBearer `OnMessageReceived` event must read it from
  the query for `/hubs/*` paths (standard SignalR+JWT pattern).
- **Same-origin in prod:** Caddy proxies `/api`+`/hubs` same-origin, so CORS isn't
  exercised in production; it only matters in dev (`:4200` → `:5000`).

## The hub auth nuance (important — read [`ControlHub`](../server/Lights.Api/ControlHub.cs))

The controller and the anonymous client **share one hub**; `JoinSession(code, role)`
takes a `role` of `"controller"` or `"client"`. So **do NOT** put a blanket
`[Authorize]` on the hub class — that would block the anonymous headset.

Instead:
- Allow the hub connection **anonymously**.
- Inside `JoinSession`, when `role == "controller"`, require
  `Context.User?.Identity?.IsAuthenticated == true` (throw `HubException`
  otherwise). The `"client"` path stays open.
- `SendState` already enforces `role == "controller"`; keep that.
- Recommended: stamp the session with the controller's `sub` at create time and
  verify it on controller join, so sessions are truly account-scoped.

For the HTTP endpoints in [`Program.cs`](../server/Lights.Api/Program.cs):
- `POST /api/sessions` (create) → **`[Authorize]`** / `.RequireAuthorization()`
  — only clinicians create sessions.
- `GET /api/sessions/{code}` (existence check) → **anonymous** — the client uses it.
- `GET /healthz` → anonymous.

## Implementation tasks

### Server (`server/Lights.Api`)
1. Add package `Microsoft.AspNetCore.Authentication.JwtBearer`.
2. `AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(...)`
   with `Authority = $"https://{Auth0__Domain}/"`, `Audience = Auth0__Audience`.
3. Add `OnMessageReceived` to pull `access_token` from the query string for
   requests whose path starts with `/hubs`.
4. `app.UseAuthentication(); app.UseAuthorization();` (after `UseCors`, before
   mapping endpoints/hub).
5. `.RequireAuthorization()` on `POST /api/sessions`; controller-auth check inside
   `JoinSession`.
6. **Lock down CORS**: replace `SetIsOriginAllowed(_ => true)` with an env-driven
   allowlist (`https://app.lumessa.xyz`, `http://localhost:4200`).
7. Config via env (Railway `lights-server` service): `Auth0__Domain`,
   `Auth0__Audience`.

### Management SPA (`apps/management`)
1. `npm i @auth0/auth0-angular`.
2. `provideAuth0({ domain, clientId, authorizationParams: { audience, redirect_uri }})`
   in the app config (zoneless/standalone providers — supported).
3. Attach the HTTP interceptor (`authHttpInterceptorFn`) with an `allowedList`
   covering `/api/*` so the access token is added; protect routes with the auth
   guard; add login/logout UI.
4. **SignalR**: in [`control.service.ts`](../apps/management/src/app/control/control.service.ts),
   pass `accessTokenFactory: () => firstValueFrom(auth.getAccessTokenSilently())`
   to `withUrl(...)` when building the `HubConnection`.
5. Auth0 `domain`/`clientId`/`audience` are **public** — bake them into the
   Angular environment config (build-time) or a small runtime config; no secret.

### Protocol package
No change — auth is transport-level, not part of the wire contract.

## Suggested execution order (for the fresh session)

1. **User**: create the Auth0 account + **US** tenant (only the user can do this).
2. Create the **SPA app** + **API** (dashboard, or wire the Auth0 MCP — see below)
   and enable the Google/Microsoft connections.
3. Collect three values: **Domain**, **SPA Client ID**, **API Identifier**.
4. Implement the **server** changes (JWT + hub controller-auth + CORS lockdown).
5. Implement the **Angular** changes (SDK + interceptor + guard + hub token).
6. Set Railway env vars on `lights-server` (`Auth0__Domain`, `Auth0__Audience`).
7. Test **locally** (`:4200` → `:5000`), then on **`app.lumessa.xyz`**.
8. Update [`roadmap.md`](roadmap.md) (Auth0 item) + the auth section of
   [`architecture.md`](architecture.md).

## Open questions to confirm before/while building

- **Tenant domain** — set once the tenant is named, e.g. `lumessa.us.auth0.com`.
  (Custom auth domain `auth.lumessa.xyz` is deferred.)
- **API identifier/audience** — proposed `https://api.lumessa.xyz`; confirm.
- **RBAC/roles** — recommended **deferred** (single clinician role) unless multi-role
  is needed now.

## Optional: Auth0 MCP server

There's an official `@auth0/auth0-mcp-server` (runs locally via `npx`, device-code
auth to your tenant) that would let the agent create the SPA app + API
programmatically instead of clicking the dashboard. It requires an existing tenant
first. To wire it, add to [`.mcp.json`](../.mcp.json) alongside `railway` and
authenticate via `/mcp`. Not required — the dashboard path works fine.

## Reference files

- [`server/Lights.Api/Program.cs`](../server/Lights.Api/Program.cs) — DI, **dev CORS**, endpoints, `MapHub`.
- [`server/Lights.Api/ControlHub.cs`](../server/Lights.Api/ControlHub.cs) — `JoinSession`/`SendState` (the role split).
- [`apps/management/src/app/control/control.service.ts`](../apps/management/src/app/control/control.service.ts) — Angular SignalR client (`withUrl`).
- [`docs/architecture.md`](architecture.md) — auth seam (§ Future work).
- [`docs/roadmap.md`](roadmap.md) — SaaS roadmap Auth0 item.
</content>
</invoke>
