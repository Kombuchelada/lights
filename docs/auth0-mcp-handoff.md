# Auth0 — pick-up handoff (MCP tenant setup)

Short-lived handoff for finishing the Auth0 go-live via the **Auth0 MCP server**.
Once the remaining manual steps are done and verified, this file can be deleted.

## ✅ Done via the MCP (2026-05-29)

Tenant **`dev-en23jhoni7eu3ibw.us.auth0.com`** (US region):

| Object | Value |
|---|---|
| SPA Application "Lumessa Controller" | Client ID **`yTdTbnDzjOOjtDht55Q4pXOAVKXaQe5c`** |
| API "Lumessa API" | Identifier (audience) **`https://api.lumessa.xyz`**, RS256, offline access on |

Callback / Logout / Allowed-Origins on the SPA are set to `https://app.lumessa.xyz`
+ `http://localhost:4200`. The three values are wired into
[`auth.config.ts`](../apps/management/src/app/auth.config.ts); builds + tests green.

## ✅ Code + deploy done (2026-05-29)

- Committed + pushed; `main` rebuilt all three Railway services (controller SPA
  ships the real `auth.config.ts`).
- **Railway `lights-server` env set** (redeploy `7b346162`): `Auth0__Domain` =
  `dev-en23jhoni7eu3ibw.us.auth0.com`, `Auth0__Audience` = `https://api.lumessa.xyz`,
  `Cors__AllowedOrigins` = `https://app.lumessa.xyz,http://localhost:4200`.
- Enforcement is gated on config: with the env vars set, prod requires a clinician
  token; without them (local dev) the controller stays anonymous.

## ⚠️ Remaining MANUAL steps — login WILL fail until these are done

The Auth0 MCP has no connection / web-origins tool, so these are dashboard-only:

1. **Enable login connections on the SPA app** — apps created via the Management
   API are *not* auto-added to connections, so login fails until you do this.
   Dashboard → Applications → **Lumessa Controller** → **Connections** tab → enable:
   - **Database** (Username-Password-Authentication)
   - **Google** (`google-oauth2`)
   - **Microsoft** (`windowslive` — may need creating under Authentication → Social)
   Direct link: `https://manage.auth0.com/dashboard/us/dev-en23jhoni7eu3ibw/applications/yTdTbnDzjOOjtDht55Q4pXOAVKXaQe5c/connections`
2. **Add Allowed Web Origins** (needed for SPA silent token refresh; the MCP can't
   set `web_origins`). Same app → **Settings** → *Allowed Web Origins* → add
   `https://app.lumessa.xyz` and `http://localhost:4200` → Save.

Then verify login at **https://app.lumessa.xyz** (and/or local `npm start` → :4200).
Until step 1 is done, "Log in" will error with *no connections enabled for the client*.

---

## (original plan — for reference)

## Where things stand

- **Code is complete and green.** All server + Angular SPA wiring is implemented;
  builds pass and tests pass (**server 27/27, management 10/10**). Full detail of
  what was built is in [`auth0.md`](auth0.md) → "What's implemented".
- **Auth self-suppresses until configured.** With placeholder values still in
  [`auth.config.ts`](../apps/management/src/app/auth.config.ts), `isAuthConfigured`
  is `false`, so the SPA runs unauthenticated and the server's JWT validation
  no-ops. Nothing is broken while we wait for the tenant.
- **MCP is wired.** [`.mcp.json`](../.mcp.json) now has an `auth0` stdio server
  (`npx -y @auth0/auth0-mcp-server run`). **It only loads after a Claude Code
  restart** — that's the reason for this handoff.

## Resuming the conversation

- Terminal: `claude --resume` (pick this session) or `claude --continue` (most
  recent). VS Code extension: reopen from session history. Context is preserved.
- Or start fresh and point the agent at this file — it's written to run cold.

## What the USER must do (only you can)

1. **Create the Auth0 account + US tenant** at <https://auth0.com/signup>.
   - **Pick the US region** during signup — this is *permanent*. You'll get a
     tenant domain like `dev-xxxxx.us.auth0.com`.
2. **Authenticate the MCP** (terminal):
   ```
   npx @auth0/auth0-mcp-server init
   ```
   Approve the device request in the browser. Verify:
   ```
   npx @auth0/auth0-mcp-server session     # should show your tenant, not "No active session"
   ```
3. **Restart Claude Code**, then run **`/mcp`** and connect/approve the `auth0`
   server so its tools load.
4. Tell the agent: **"Auth0 MCP is connected — create the apps."**

## What the AGENT does once the MCP is connected

Create the Auth0 objects via the MCP tools, then wire the values in:

1. **SPA Application** (single-page app) for the controller. Set:
   - Allowed Callback URLs: `https://app.lumessa.xyz`, `http://localhost:4200`
   - Allowed Logout URLs: `https://app.lumessa.xyz`, `http://localhost:4200`
   - Allowed Web Origins: `https://app.lumessa.xyz`, `http://localhost:4200`
   - Refresh-token rotation: **On**
   - → record **Domain** + **Client ID** (both public).
2. **API** (resource server): Identifier **`https://api.lumessa.xyz`**, signing
   **RS256** → this is the **audience**.
3. **Connections**: ensure **Database** + **Google** (`google-oauth2`) +
   **Microsoft** (`windowslive`) are enabled on the SPA app. (New US tenants
   usually have Google on via Auth0 dev keys; Microsoft typically needs enabling.)
4. **Fill the public values** in
   [`auth.config.ts`](../apps/management/src/app/auth.config.ts):
   `domain`, `clientId`, `audience` (audience defaults to `https://api.lumessa.xyz`).
5. **Server env (Railway `lights-server` service)** — hand these to the user / set
   via the Railway MCP:
   - `Auth0__Domain` = the tenant domain (e.g. `dev-xxxxx.us.auth0.com`, no scheme)
   - `Auth0__Audience` = `https://api.lumessa.xyz`
   - (optional) `Cors__AllowedOrigins` = `https://app.lumessa.xyz,http://localhost:4200`
6. **Verify**: `cd server && dotnet test` (27/27) and
   `cd apps/management && npm run build && npm test` (10/10) still green; then a
   local end-to-end login at `http://localhost:4200`.

## The three values (the whole point)

| Value | Where it comes from | Where it goes |
|---|---|---|
| **Domain** | SPA app / tenant | `auth.config.ts` `domain` **and** server `Auth0__Domain` |
| **Client ID** | SPA app | `auth.config.ts` `clientId` |
| **Audience** | API Identifier (`https://api.lumessa.xyz`) | `auth.config.ts` `audience` **and** server `Auth0__Audience` |

## Reference

- [`auth0.md`](auth0.md) — full requirements, decisions, and "Going live" steps.
- Decisions locked in: US region; email+password + Google + Microsoft; client stays
  anonymous; sessions account-scoped by `sub`; RBAC / custom auth domain deferred.
</content>
