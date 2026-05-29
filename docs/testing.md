# Testing — Lights

How to verify Lights on real hardware, and the manual test scripts that close
out **M7**. Read with [`accessibility.md`](accessibility.md) (a11y checklist),
[`architecture.md`](architecture.md), and [`deployment.md`](deployment.md).

Automated coverage already runs in CI: server xUnit (`Lights.Api.Tests`) and the
controller's unit tests (`apps/management`, vitest). This doc covers what those
can't — the realtime path, the renderer, and the secure-context browser APIs
**on an actual phone in a headset**.

---

## Why a phone, and why HTTPS

The stimulus runs on a phone in a headset, so the things most worth testing on
hardware are the ones a desktop browser can't exercise:

- **Screen Wake Lock** — keeps the display on during a session.
- **Fullscreen** — tap-to-fullscreen on the client canvas.
- **PWA install + service worker** — "Add to Home Screen", offline shell.
- Real **flicker** rendering and **reduced-motion** behavior on the device GPU.
- The **reconnection / resync** path over a flaky mobile radio.

Several of these (service worker / PWA install, Screen Wake Lock, and fullscreen
in some mobile browsers) require a **secure context** — i.e. `https://` or
`localhost`. A plain `http://<LAN-IP>` origin will load and the **realtime path
still works** (SignalR/WebSocket does not need a secure context), but those
APIs silently no-op. So for a faithful device test, use HTTPS.

Pick the option that matches what you're testing:

| Option | Use when | Secure context |
|--------|----------|----------------|
| **A. Live Railway deploy** | Verifying the shipped build on a device | ✅ (real cert) |
| **B. LAN + mkcert cert** | Iterating on local changes against a device | ✅ (trusted dev cert) |
| **C. HTTPS tunnel** | Local changes, can't install a cert on the phone | ✅ (tunnel cert) |
| LAN over plain HTTP | Quick realtime check only (no PWA/wake-lock) | ❌ |

---

## Option A — test the live Railway deploy (recommended, zero setup)

The production deploy is already HTTPS, so it's the fastest faithful device
test. On the phone, open the client and on a laptop open the controller:

- Controller: <https://lights-management-production.up.railway.app>
- Client (PWA): <https://lights-client-production.up.railway.app>

Start a session on the controller, scan the QR with the phone, and run the
[manual scripts](#manual-test-scripts) below. Both must be on any network
(they don't need to share a LAN — the server is the rendezvous).

> Deploys are push-to-`main`. Verify the build under test matches `main`
> (`git log origin/main -1`) before trusting a result.

## Option B — LAN + mkcert dev cert (local changes on a device)

Best for iterating: the phone hits your dev machine over a **locally-trusted**
HTTPS cert, so secure-context APIs work and you see live edits.

1. **Install [mkcert](https://github.com/FiloSottile/mkcert)** and a local CA,
   then issue a cert for your machine's LAN IP:
   ```sh
   brew install mkcert
   mkcert -install
   IP=$(ipconfig getifaddr en0)            # your LAN IP (Wi-Fi); use en1 if wired
   mkcert -cert-file devcert.pem -key-file devkey.pem "$IP" localhost
   ```
2. **Run the server** (it stays plain HTTP on :5000; the front-end dev servers
   proxy to it and terminate TLS):
   ```sh
   cd server && dotnet run --project Lights.Api
   ```
3. **Serve the client over HTTPS on the LAN.** Vite already binds all
   interfaces (`host: true`) and reads an opt-in cert from
   `DEV_TLS_CERT` / `DEV_TLS_KEY` (see `vite.config.ts`):
   ```sh
   cd apps/client && DEV_TLS_CERT=../../devcert.pem DEV_TLS_KEY=../../devkey.pem npm run dev
   ```
4. **Serve the controller over HTTPS on the LAN**:
   ```sh
   cd apps/management && npm start -- --host 0.0.0.0 --ssl \
     --ssl-cert ../../devcert.pem --ssl-key ../../devkey.pem
   ```
5. On the phone (same Wi-Fi), open `https://<IP>:5173` (client) — and on a
   laptop `https://<IP>:4200` (controller). Both proxy `/api` + `/hubs` to the
   dev server's `:5000`, so no API-base config is needed.

> **Trusting the cert on the phone:** mkcert's certs are trusted on the machine
> that ran `mkcert -install`. On the phone you'll get a warning unless you
> install the mkcert **root CA** (`mkcert -CAROOT` shows its path) onto the
> device and trust it (iOS: Settings → General → VPN & Device Management →
> install profile → Certificate Trust Settings). If that's too much friction,
> use Option C.

> `*.pem` dev certs are git-ignored — keep them out of commits.

## Option C — HTTPS tunnel (no cert on the phone)

A tunnel gives a public HTTPS URL backed by your local dev server — no device
cert needed. With the three dev servers running locally (plain), point a tunnel
at the **client** (and a second at the controller):

```sh
# e.g. cloudflared (no account needed for quick tunnels)
cloudflared tunnel --url http://localhost:5173    # client
cloudflared tunnel --url http://localhost:4200    # controller
```

Open the printed `https://…trycloudflare.com` URLs on the phone / laptop. The
local Vite/Angular proxies still forward `/api` + `/hubs` to `:5000`.

---

## Manual test scripts

Run on the device. Capture the build under test (`git rev-parse --short HEAD`)
with results.

### 1. Join + solid color
1. Controller: **Start session** → a 6-char code + QR appear.
2. Phone — join three ways, all should work:
   - scan the QR with the phone's native camera (opens the client at `?code=`);
   - in the client (incl. when **installed as a PWA**), tap **📷 Scan QR code**,
     grant camera permission, and point at the controller's QR;
   - or type the code manually.
   The in-app scanner needs a secure context (camera permission) — the button is
   hidden on insecure origins; denying permission falls back to manual entry.
3. Controller shows **● Client connected**; the client canvas goes live.
4. Drag RGB / a preset / the wavelength slider → the headset color tracks it
   in realtime (sub-100ms feel).
5. Brightness, size, and X/Y position all mirror on the device.

### 2. Secure-context features (device)
1. Client: tap the canvas → it goes **fullscreen** and the screen **stays awake**
   for the length of the session (Wake Lock).
2. Background the app and return → it re-acquires the wake lock.
3. Browser menu shows **Add to Home Screen**; install it → it launches
   standalone (service worker registered — Option A/B/C only, not plain HTTP).

### 3. Flicker safety gate
1. Controller: raise **Flicker** above 0 → caution warning; into the high-risk
   band → the stronger warning.
2. First time flicker > 0 reaches the client, the **consent modal** appears.
3. **Keep steady** (or Escape) → the light stays solid. **Allow flicker** →
   the light flickers at the set Hz.
4. Enable **reduced motion** on the device → confirm flicker is suppressed /
   damped per the renderer's reduced-motion handling.

### 4. Reconnection / resync (the M6 path on hardware)
1. With a live session, toggle the phone's Wi-Fi off briefly.
2. Controller status → **reconnecting**; client shows the reconnecting state.
3. Restore Wi-Fi → both return to **connected** and the client **resyncs** to
   the controller's current state (color/brightness/position), not a stale one.
4. Close the controller tab → client shows "Controller disconnected".
5. End the session → client shows "Session ended".

### 5. Theming + a11y spot-check
- Toggle controller theme (system / light / dark) — see
  [`accessibility.md`](accessibility.md) for the full keyboard + screen-reader
  checklist; at minimum confirm both themes are legible on the device.

---

## Result log

Record device + browser + build + pass/fail per script. A run is "M7 complete"
when scripts 1–4 pass on at least one iOS and one Android device.

| Date | Device / OS / Browser | Build | Scripts 1–5 | Notes |
|------|-----------------------|-------|-------------|-------|
|      |                       |       |             |       |
