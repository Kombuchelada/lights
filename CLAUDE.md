# CLAUDE.md — Lights

Realtime light-control for a phone-in-a-headset stimulus. A clinician
**controller** drives a colored light on a headset **client** screen in realtime.
Eventual SaaS (Auth0, Stripe, profiles, folders) — deferred; Phase 1 is the
working light-control prototype.

## Layout
- `server/` — ASP.NET Core (net10.0) minimal API + **SignalR** `ControlHub`; `Lights.Core` (DTOs, sessions, wavelength), `Lights.Api.Tests` (xUnit).
- `apps/management/` — Angular 21 **zoneless, signals** controller.
- `apps/client/` — vanilla TS + Vite **PWA**, pure-black canvas renderer.
- `packages/protocol/` — shared TS types/limits; **mirrors the C# DTOs**.
- `docs/architecture.md`, `docs/protocol.md`, `docs/roadmap.md` — design, wire contract, feature roadmap (read these).
- `docs/deployment.md`, `docs/adr/` — Railway hosting runbook + architecture decision records.

## Run (dev)
```
cd server && dotnet run --project Lights.Api      # http :5000, https :5001
cd apps/management && npm start                   # :4200, proxies → :5000
cd apps/client && npm run dev                      # :5173, proxies → :5000
```
Controller "Start session" → 6-char code → client joins by code or `?code=`.

## Key facts / gotchas
- **.NET install:** `dot.net`/`aka.ms` are network-blocked; install SDK from
  `packages.microsoft.com` via apt (`dotnet-sdk-10.0`). NuGet (`api.nuget.org`) is reachable.
- Drop to `net9.0` in the `.csproj`s if only .NET 9 is installed.
- JSON is **camelCase** on both SignalR and HTTP (configured in `Program.cs`).
- TS apps import `@lights/protocol` via a **tsconfig/vite path alias** to its `src` (no build step).
- Geometry is **normalized 0..1**; brightness is the circle's **alpha**; flicker
  is rendered client-side from `flickerHz` (gated by a consent prompt).
- Server is authoritative: all state runs through `ProtocolLimits.Sanitize`.
- **iOS PWA limits:** the manifest `display:fullscreen` is **Android-only** (iOS
  ignores it); the Fullscreen API is unsupported on iPhone for non-video, so
  tap-to-fullscreen no-ops there and the **status bar can't be hidden** in a
  home-screen web app (`black-translucent` over black is the best blend).
- **Client escape hatch:** standalone PWA has no address bar, so **long-press the
  canvas** summons the join overlay (Resume / Reload / re-join); the overlay also
  auto-shows when the controller or session drops (`onControllerLeft`/`onSessionEnded`).
- `pkill -f "Lights.Api"` self-matches the shell if the pattern is in the script — kill by port (`fuser -k 5000/tcp`) instead.

## Conventions
- Branch: `claude/festive-ptolemy-cHoMr`. Commit footer: the session URL line. No model identifiers in artifacts.

## Status
- ✅ **M0** scaffold + docs + protocol. ✅ **M1** realtime core. ✅ **Phase-1
  control surface (M2–M6):** client renderer/PWA; controller RGB sliders + channel
  lock, wavelength (nm) picker, brightness/size, X/Y position, flicker + high-risk
  warning, live preview, QR join code, light/dark/system theme (defaults system),
  baseline a11y. Verified: management build clean + 5/5 unit tests; server 20/20.
  Controller theming/QR via `@lights/protocol` + the `qrcode` dep (allowed CommonJS).
  Client join: type code, `?code=` URL, **or in-app camera QR scan** (`scanner.ts`;
  native `BarcodeDetector` with a lazy-loaded `jsqr` fallback for iOS — needs HTTPS).
- ✅ **M7 complete:** docs polish; deeper a11y audit (radiogroup roving-tabindex/arrow
  keys via `radiogroup.directive.ts`, WCAG AA contrast fix with a `--accent-fill` token,
  live-region status, preview `aria-hidden` — see `docs/accessibility.md`); HTTPS/LAN
  real-device **testing guide** + opt-in dev TLS (`DEV_TLS_CERT`/`DEV_TLS_KEY` in the
  client `vite.config.ts`) in `docs/testing.md`. Phase 1 is feature-complete; the only
  open item — the human-in-the-loop physical device run — is now ✅ done (maintainer
  manual end-to-end pass, logged in `docs/testing.md`).
- ✅ **Phase 2 complete (stimulus depth):** additive **`v = 2`** protocol superset
  (every new field optional ⇒ a v1 state still renders mono) + a dual-pane
  **stereo** client renderer. Adds per-eye **13-bit clock-grid** targeting
  (`left`/`right.positions`; center + 12 clock hours), render `mode`
  (mono/vergence/align/paired/manual — `KITT` stays Phase 3), per-eye
  `rotationDeg` (+ lock), `aperture` (per-dot size), `eyeDistance` (pane offset),
  and an **A/B background** (`background.color`/`hz`) gated behind the existing
  photosensitivity consent. Dual-pane stereo is our design. Verified: server
  24/24, management 7/7, all builds clean. ✅ User-tested on a real device.
- ✅ **Phase 3 complete (controller ergonomics):** ephemeral **color memory
  slots** (Save + `M1–M4`, round-robin, controller-local signal); **fuller preset
  palette** (14 swatches incl. Far Red/Black/Red-Orange/Yellow-Green/Indigo/Magenta);
  per-channel **±1 fine-step** buttons (RGB + nm, lock-aware); **echo-back**
  delivery confirmation (client `AckState(ts)` → server `StateRendered` →
  controller shows ✓ rendered + round-trip ms); and the **`KITT` sweep** (additive
  optional `sweep` field, still `v = 2`; client animates position sinusoidally via
  rAF, honors `prefers-reduced-motion`, works mono + stereo). Verified: server
  27/27, management 10/10, all builds clean. ✅ User-tested on a real device (incl. the sweep).
- ✅ **Auth0 (code complete; awaiting tenant values):** clinician-only auth. Server
  validates Auth0 JWTs (`Auth0__Domain`/`Auth0__Audience`); `POST /api/sessions` +
  the hub **controller** role require auth (the **client** role stays anonymous
  code-join); sessions are account-scoped by `sub`; CORS is an env allowlist
  (`Cors__AllowedOrigins`). SPA uses `@auth0/auth0-angular` (interceptor on `/api/*`,
  hub `accessTokenFactory` → query-string token) + login/logout UI gating "Start
  session". Auth UI/enforcement self-suppresses until real values are filled in
  (`auth.config.ts` `isAuthConfigured`), so dev runs unauthenticated. To go live:
  fill `apps/management/src/app/auth.config.ts` + set the server env vars — see
  `docs/auth0.md` "Going live". Verified: server 27/27, management 10/10, builds clean.
- **Deferred:** the rest of the SaaS roadmap (persistence/profiles, Stripe,
  scale-out; Auth0 RBAC/custom-domain follow-ups). Full list in `docs/roadmap.md`.

## Deployed (live on Railway)
- ✅ **Live in production** on Railway (runbook: `docs/deployment.md`; decision: `docs/adr/0001-hosting-on-railway.md`). US "color" spelling throughout.
  - Controller: https://app.lumessa.xyz
  - Client (PWA): https://join.lumessa.xyz
  - Apex `https://lumessa.xyz` 301-redirects to the controller. Custom domains on **Namecheap** (BasicDNS); see `docs/deployment.md` for the DNS records. The `*-production.up.railway.app` defaults are retired in favor of these.
  - Server: private (`lights-server.railway.internal:8080`); front-ends run **Caddy** proxying `/api`+`/hubs` over private networking (same-origin, no CORS).
- **Deploys are Railway-native:** push to **`main`** → all three services auto-rebuild. Keep `main` aligned with the dev branch (`git branch -f main HEAD && git push origin main`). `.github/workflows/ci.yml` is a non-blocking gate (does not deploy).
- **Railway MCP** is wired via `.mcp.json` (`https://mcp.railway.com`). On a new machine, authenticate once with `/mcp` → `railway` (OAuth, interactive client only). Project `lights` = `557f1afb-43e1-4dea-b4e3-6eb1878557c7`.
- **Caddyfile gotcha:** proxy `/api`+`/hubs` via `handle {}` blocks *before* the SPA `try_files` fallback, or API calls get rewritten to `index.html` (405). See the Caddyfiles' comments.
