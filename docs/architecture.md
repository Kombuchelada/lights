# Lights — Architecture

> Living design doc for the Lights light-control system. Phase 1 is a working
> prototype of the core realtime light control; auth, payments, and profiles
> are designed-for but deferred. Read it with [`protocol.md`](protocol.md) (the
> wire contract) and [`roadmap.md`](roadmap.md) (what's built vs. deferred).

## 1. What this is

A clinician (the **controller**) drives a colored light stimulus rendered on a
phone placed in a Cardboard/GearVR-style headset (the **client**). Control is
realtime: color, brightness, on-screen position & size, spectral wavelength,
and flicker frequency.

Design goals: a typed/versioned protocol, real session pairing, a modern
accessible themeable UI, an installable pure-black PWA client, and clear seams
for accounts, billing, and saved protocols.

## 2. Components

| Component | Tech | Responsibility |
|---|---|---|
| **Server** | ASP.NET Core (net10.0) minimal API + **SignalR** | Create/validate sessions, pair controller↔client, validate & relay `LightState`, hold last state for resync. |
| **Management** | **Angular** (zoneless, signals, standalone) | Rich accessible controller UI; light/dark/system theming; throttled state sends; live preview mirror; session + QR. |
| **Client** | **Vanilla TS + Vite** canvas PWA | Pure-black full-screen renderer; brightness via alpha; client-side flicker (rAF); **mono or dual-pane (stereo) render** with per-eye clock-grid dots + A/B background; fullscreen + Screen Wake Lock; installable. |
| **Protocol** | TS package `@lights/protocol` | Shared types, limits, helpers; mirrors the C# DTOs. |

```
            create session            scan QR / type code
 ┌──────────────────┐  POST /api/sessions   ┌──────────────────┐
 │  Management app   │ ──────────────►       │   Headset client  │
 │ (Angular zoneless)│  {code, qr, id}       │ (vanilla TS canvas│
 │  RGB/λ/flicker UI │                       │  PWA, pure black) │
 └────────┬─────────┘                        └─────────┬────────┘
          │  SignalR  (group = session:{id})           │
          │  SendState(state)           ReceiveState(state)
          ▼                                             ▼
        ┌───────────────────────────────────────────────────┐
        │     ASP.NET Core  —  /hubs/control + minimal API    │
        │  in-memory session store (TTL)  ·  Auth0 JWT bearer │
        └───────────────────────────────────────────────────┘
```

## 3. Realtime & pairing

Decision: the **controller creates** a session and shows a short **code + QR**.
The headset joins by scanning the QR (native camera opens the join URL) or by
**typing the code** (covers remote use — read the code aloud). One mechanism
serves both co-located and remote cases.

Session lifecycle:

1. Controller: `POST /api/sessions` → `{ sessionId, code, joinUrl, expiresAt }`
   (code = 6-char Crockford base32; TTL 1 h). The code/QR is displayed.
2. Controller connects to `/hubs/control`, calls `JoinSession(code, "controller")`.
3. Client opens (via QR or typed code), calls `JoinSession(code, "client")`.
4. On client join the server pushes the last known state to the client
   (`ReceiveState`) and notifies the controller (`ClientJoined`) so it can
   re-send a fresh snapshot — a resync-on-join.
5. Controller `SendState(state)` → server validates/clamps → relays
   `ReceiveState(state)` to the group. Server retains the last state.
6. **Reconnect:** SignalR auto-reconnect → re-`JoinSession` → re-sync.

Why **SignalR**: typed hubs, automatic reconnection, transport fallback, and
connection **groups** that map 1:1 to a session — with a clean path to
**Azure SignalR Service** for multi-instance scale *without code changes*
(the prototype runs a single self-hosted instance with an in-memory store).

The full wire contract is in [`protocol.md`](protocol.md).

## 4. Design principles

- **Commands describe intent; the client renders.** We sync *state*
  (e.g. `flickerHz: 6`), never per-frame messages. The client animates flicker
  locally with `requestAnimationFrame`, so timing is smooth and bandwidth/CPU
  stay low.
- **The server is authoritative on validation.** All `LightState` is clamped to
  `LIMITS` server-side; the UIs mirror the same clamps for instant feedback.
- **Normalised geometry.** Position & radius are 0..1 of the viewport, so the
  same state renders correctly on any phone.
- **Pure black means OLED-off.** The client paints nothing but the light on a
  `#000` canvas — true darkness in the headset.
- **Accessibility & theming are not afterthoughts.** The controller targets
  WCAG AA, full keyboard operation, and `light | dark | system` themes.

## 5. Phase 1 milestones

- [x] **M0** Scaffold: solution, three apps, protocol package, docs, `.gitignore`.
- [x] **M1** Hub + session create/join + "set solid color → client circle" end-to-end
      (verified: server build + 20 unit tests + a live SignalR controller↔client smoke test).
- [x] **M2** Client renderer: normalised circle, alpha brightness, black, fullscreen, wake lock, PWA.
- [x] **M3** Management surface: RGB + brightness + radius + X/Y (signals), throttled send, live mirror, session/QR UI.
- [x] **M4** Wavelength (nm→RGB) picker, presets, channel lock.
- [x] **M5** Flicker (rAF) + photosensitivity safety gate + reduced-motion.
- [x] **M6** Theming (light/dark/system) + a11y pass + reconnection hardening.
- [x] **M7** Docs polish + deeper a11y audit + real-device HTTPS/LAN testing
      guide. Maintainer manual device pass recorded in `testing.md`.

The full, living feature list — including deferred Phase 2 and SaaS work — is in
[`roadmap.md`](roadmap.md).

## 6. Safety (flicker)

Flashing light can trigger seizures in people with photosensitive epilepsy. The
client gates **any** flicker behind an explicit warning + consent, clamps to
`LIMITS.flickerHz.max`, surfaces an extra caution in the
`FLICKER_HIGH_RISK_BAND_HZ` (~15–25 Hz), and honours `prefers-reduced-motion`.
This is **not** a medical device and makes no clinical claims.

## 7. Environment

- **Node ≥ 20 / npm ≥ 10** for the front-ends; **.NET SDK 10 (LTS)** for the
  server (drop to `net9.0` in the `.csproj` if needed).
- **Dev:** front-ends proxy `/api` and `/hubs` to the server. The management app
  runs on `:4200`, the client on `:5173`, the server on `:5001`.
- **Real-device testing:** WebSockets, PWA install, fullscreen, and the Screen
  Wake Lock API need a **secure context (HTTPS)**. Serve over your LAN IP with a
  dev cert, or use an HTTPS dev tunnel and point the client's API base at it.
- **Note on this repo's cloud authoring environment:** the .NET SDK is not
  installable there, so the server is authored to build/run with `dotnet`
  locally; the Node apps build and run in either place.

## 8. Roadmap beyond Phase 1 (seams already in place)

> The canonical, living roadmap is [`roadmap.md`](roadmap.md); the summary below
> captures the seams this architecture deliberately leaves open.

- **Auth (Auth0) — ✅ done:** JWT bearer validation on the API (`Auth0__Domain` /
  `Auth0__Audience`); the controller authenticates via the Angular Auth0 SPA SDK,
  with the access token attached to `/api/*` (HTTP interceptor) and to the hub
  (SignalR `accessTokenFactory`, read from the `access_token` query string for
  `/hubs/*`). `POST /api/sessions` and the hub's **controller** role require auth;
  the **client** role stays anonymous. Sessions are account-scoped to the
  controller's `sub`. CORS is an env-driven allowlist (`Cors__AllowedOrigins`).
  Login is served on the Auth0 **custom domain `login.lumessa.xyz`**; the server's
  `ValidIssuers` accepts both that and the default-tenant issuer (shared signing
  keys). Deferred: RBAC/roles, Microsoft social, persistent per-account room codes.
- **Persistence / profiles / folders:** swap the in-memory session store for
  EF Core (Postgres/SQL Server). Saved "protocols" reuse the `LightState` DTO;
  folders are owned entities.
- **Billing (Stripe):** subscription/seat gating on session creation and
  advanced features; webhook endpoint + customer/subscription entities.
- **Scale:** Azure SignalR Service / Redis backplane — hub code unchanged.
- **Phase-2 stimulus (done):** per-eye 13-position clock-grid targeting, dual-pane
  stereoscopic VR (`vergence`/`align`/`paired`/`manual`), per-eye rotation,
  aperture, eye-distance, and A/B alternating background — shipped as the additive
  `v = 2` superset plus the stereo client render mode. See `roadmap.md`.
- **Phase-3 controller ergonomics (done):** in-session color memory slots, a
  fuller preset palette, per-channel ±1 fine-step, echo-back delivery confirmation
  (`AckState`/`StateRendered` round-trip), and the `KITT` oscillating sweep (an
  additive optional `sweep` field, animated client-side). See `roadmap.md`.
