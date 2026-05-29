# Lights

Realtime light-control for a phone-in-a-headset stimulus, with a modern,
accessible web controller (clinician controller) + client screen.

- **Management app** — the rich, themeable (light / dark / system) controller a
  clinician uses to drive color, brightness, position, size, wavelength and
  flicker in realtime.
- **Client app** — an ultra-light, pure-black, installable PWA that renders the
  light stimulus on a phone placed in a Cardboard/GearVR-style headset.
- **Server** — ASP.NET Core minimal API + SignalR hub that pairs a controller
  with a client and relays state.

See [`docs/architecture.md`](docs/architecture.md) for the full design and
[`docs/protocol.md`](docs/protocol.md) for the wire contract.

> ⚠️ **Safety.** This tool can flicker the screen. Flashing light can trigger
> seizures in people with photosensitive epilepsy. Flicker is gated behind an
> explicit warning, clamped to a maximum frequency, and respects
> `prefers-reduced-motion`. This is **not** a medical device.

## Repository layout

```
/server              ASP.NET Core solution (built locally with the .NET SDK)
  Lights.Api         minimal API host + SignalR ControlHub + session store
  Lights.Core        domain: LightState DTOs, session model, wavelength util
  Lights.Api.Tests   xUnit tests for the core logic
/apps
  /management        Angular (zoneless, signals, standalone) controller
  /client            vanilla TS + Vite canvas PWA (the headset screen)
/packages/protocol   shared TS protocol types/constants (mirror the C# DTOs)
/docs                architecture.md, protocol.md
```

The TS apps consume the shared protocol via a path alias to
`packages/protocol/src` — no build/publish step is required for it.

## Prerequisites

- **Node.js ≥ 20** and **npm ≥ 10** — for the management and client apps.
- **.NET SDK 10** (LTS) — for the server. On .NET 9, change `<TargetFramework>`
  in the `.csproj` files from `net10.0` to `net9.0`; nothing else needs to
  change.

## Running locally (dev)

Three terminals:

```bash
# 1) Server (https://localhost:5001) — needs the .NET SDK
cd server && dotnet run --project Lights.Api

# 2) Management controller (http://localhost:4200)
cd apps/management && npm install && npm start

# 3) Client screen (http://localhost:5173)
cd apps/client && npm install && npm run dev
```

The front-ends proxy `/api` and `/hubs` to the server in dev (see each app's
proxy config). Open the management app, create a session, then open the client
and join with the code (or scan the QR with a phone on the same network).

### Testing on a real phone / headset

WebSockets, PWA install, fullscreen, and the Screen Wake Lock API all require a
**secure context (HTTPS)**. To test the client on an actual device:

- serve over your machine's LAN IP with a dev certificate, **or**
- use an HTTPS dev tunnel, and point the client's API base at the tunnel URL.

Details and the exact commands live in `docs/architecture.md` → *Environment*.

## Status

Phase 1 (prototype) — see the milestone checklist in `docs/architecture.md`.
Auth (Auth0), payments (Stripe), saved protocols + folders, and the Phase-2
stimulus features (per-eye targeting, stereoscopic VR) are designed-for but not
yet built.
