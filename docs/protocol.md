# Lights — Wire Protocol (v2)

The contract shared by the server (C# DTOs in `server/Lights.Core`), the
management controller, and the client screen. The TypeScript source of truth is
[`packages/protocol/src/index.ts`](../packages/protocol/src/index.ts); the C#
DTOs are hand-kept in sync.

## Transport

Realtime runs over a **SignalR** hub at **`/hubs/control`**. With SignalR the
*message type is the method name* and the *payload is the argument* — so there
is no separate envelope on the wire. (A logical envelope of
`{ v, type, ts, payload }` still describes each message, and would be used
verbatim if a raw-WebSocket or Web PubSub transport were added later.)

Session creation is a plain REST call so the controller can render a code/QR and
so it stays auth-friendly:

```
POST /api/sessions
→ 200 { "sessionId": "…", "code": "K3F9Q2", "joinUrl": "https://…/?code=K3F9Q2",
        "expiresAt": "2026-05-29T16:30:00Z" }

GET  /api/sessions/{code}   → 200 { "sessionId", "expiresAt" } | 404 { "error": "not_found" }
GET  /healthz               → 200 { "status": "ok" }
```

CORS is wide-open in dev (any origin, credentials allowed); lock it down to known
origins before any non-local deployment.

### Hub methods (client → server)

| Method | Args | Notes |
|---|---|---|
| `JoinSession` | `code: string, role: "controller" \| "client"` | Joins the SignalR group `session:{sessionId}`. Codes are matched case-insensitively. |
| `SendState`   | `state: LightState` | Controller only. Server validates/clamps, stores as last state, relays to the *other* members of the group (`OthersInGroup`). |
| `AckState`    | `ts: number` | Client only (echo-back). Confirms the client rendered the state stamped `ts`; the server relays it to the controller as `StateRendered`. Throttled client-side (latest-wins). |
| `LeaveSession`| — | Optional; disconnect is handled automatically. |

### Hub events (server → client)

| Event | Args | Sent to |
|---|---|---|
| `ReceiveState` | `state: LightState` | Client(s); also the just-joined client for initial sync. |
| `StateRendered` | `info: { ts: number }` | Controller (echo-back). The client rendered the state stamped `ts`; the controller shows delivery + round-trip latency. |
| `ClientJoined` | `info: { connectionId: string }` | Controller (trigger a fresh snapshot). |
| `ClientLeft` | — | Controller. |
| `ControllerJoined` | — | Client. |
| `ControllerLeft` | — | Client. |
| `SessionEnded` | `reason: string` | All participants. |

## `LightState`

```jsonc
{
  "v": 2,                                  // schema version (PROTOCOL_VERSION)
  "color": { "r": 255, "g": 0, "b": 0 },   // resolved sRGB, 0–255
  "source": "rgb",                         // "rgb" | "wavelength"
  "wavelengthNm": 406,                     // present when source === "wavelength"
  "brightness": 0.5,                       // 0..1 → alpha of the light over black
  "shape": { "x": 0.5, "y": 0.5, "radius": 0.35 }, // normalised 0..1 of viewport
  "flickerHz": 0,                          // 0 = steady; client renders locally
  "ts": 1716950000000,                     // optional sender epoch-ms (diagnostics)

  // ---- v2 (stimulus depth) — all optional; absent ⇒ mono single circle ----
  "mode": "mono",                          // mono | vergence | align | paired | manual
  "left":  { "positions": 1, "rotationDeg": 0 }, // per-eye 13-bit clock grid + rotation
  "right": { "positions": 1, "rotationDeg": 0 },
  "aperture": 0.12,                        // per-dot size (stereo), 0..1
  "eyeDistance": 0.1,                       // pane interpupillary offset, -1..1
  "background": { "color": { "r": 0, "g": 0, "b": 80 }, "hz": 0 }, // A/B background

  // ---- Phase 3 — additive optional; absent ⇒ no sweep ----
  "sweep": { "hz": 0, "axis": "x", "range": 0.3 } // KITT oscillating sweep
}
```

| Field | Type | Range / values | Meaning |
|---|---|---|---|
| `v` | int | `2` | Schema version. |
| `color.{r,g,b}` | int | `0..255` | Resolved sRGB actually rendered. |
| `source` | enum | `rgb` \| `wavelength` | Which input produced `color` (informational). |
| `wavelengthNm` | number? | `380..780` | Set when `source = wavelength`. |
| `brightness` | number | `0..1` | Alpha of the light over pure black. |
| `shape.x`, `shape.y` | number | `0..1` | Center as a fraction of width/height (`0.5,0.5` = center). In stereo it offsets each pane's center. |
| `shape.radius` | number | `0..1` | Mono: circle radius. Stereo: radius of the ring the dots sit on. |
| `flickerHz` | number | `0..60` | Flicker frequency; `0` = steady. Rendered client-side. |
| `ts` | number? | epoch ms | Optional, diagnostics only. |
| `mode` | enum? | `mono`(default) \| `vergence` \| `align` \| `paired` \| `manual` | Render mode. Absent ⇒ `mono` (the v1 single circle). |
| `left`, `right` | object? | see below | Per-eye targeting (stereo modes). |
| `aperture` | number? | `0..1` | Per-dot size in stereo, fraction of half the shorter pane side. |
| `eyeDistance` | number? | `-1..1` | Horizontal offset of the two panes (interpupillary); `+` diverges. |
| `background` | object? | see below | A/B alternating background. |
| `sweep` | object? | see below | `KITT` oscillating sweep of the light position. |

### v2 — stimulus depth (Phase 2)

The v2 fields are **additive and optional**: a v1 state — or any state with no v2
fields — sanitizes to `mode: "mono"` and renders exactly as before. They model
dual-pane VR features.

**`mode`** selects the render layout: `mono` (single circle), `vergence`,
`align`, `paired`, `manual`. The `KITT` sweep is Phase 3 and not included.

**`left` / `right` (`EyeField`)** — per-eye targeting on a fixed **13-cell clock
grid**:

```jsonc
{ "positions": 1, "rotationDeg": 0 }
```

- `positions` — a **13-bit mask** (`0..8191`). Bit `0` = center; bits `1..12` =
  the clock-hour positions on a ring (`12` = top, `3` = right, `6` = bottom,
  `9` = left). Multiple bits may be set (several dots per eye). A uni-mode flag
  (bit `8192`) is replaced by `mode: "mono"`.
- `rotationDeg` — `0..360`, rotates the ring pattern.

In **stereo** modes the client splits the canvas into left/right panes and draws a
dot of size `aperture` at each lit cell, on a ring of `shape.radius`, offset by
`eyeDistance`.

**`background` (`AbBackground`)** — A/B alternating background:

```jsonc
{ "color": { "r": 0, "g": 0, "b": 80 }, "hz": 0 }
```

- `hz === 0` paints a **steady** backdrop color; `hz > 0` **alternates** the
  backdrop between black and `color`. Because that is a full-screen flash, any
  `hz > 0` is gated behind the **same photosensitivity consent** as flicker
  (clamped to `60`, `prefers-reduced-motion` respected).

### Phase 3 — `sweep` + echo-back

The `sweep` field and the echo-back round-trip are **additive** Phase-3
extensions. `sweep` is one more optional `LightState` field (a missing field ⇒
no sweep), so the schema version stays **`v = 2`**; echo-back adds a hub
method/event pair, which needs no version change.

**`sweep` (`Sweep`)** — the `KITT` oscillating scan:

```jsonc
{ "hz": 0, "axis": "x", "range": 0.3 }
```

- `hz` — oscillations per second, `0..5` (slow scanner motion, not a strobe);
  `0` = off (the light holds at its `shape` position).
- `axis` — `"x"` (default) or `"y"`: which position axis oscillates.
- `range` — `0..1`, peak offset from the base position.

The client animates it locally with `requestAnimationFrame` — the center moves
sinusoidally around `shape.{x,y}` by `±range` on `axis`, clamped to `0..1`. It
applies in **mono and stereo**. Because it is *movement* (not a flash) it is
**not** behind the photosensitivity gate, but the client pauses it for viewers
who prefer reduced motion (`prefers-reduced-motion`).

**Echo-back** — after rendering each frame the client invokes `AckState(ts)`
(throttled, latest-wins) with the state's `ts`; the server relays it to the
controller as `StateRendered { ts }`. The controller surfaces **delivery**
(rendered vs. pending) and the **round-trip latency** (`now − ts`, one clock),
confirming the frame actually reached the headset.

### Validation & clamping

The server is authoritative: every field is clamped to `LIMITS` before being
stored or relayed. The UIs mirror the same clamps (`sanitizeLightState`) for
instant feedback. Non-finite numbers fall back to the field minimum/default.

### Why normalised geometry

Phones differ in resolution and aspect. Position (`x,y`) and `radius` are
fractions of the viewport, so an identical `LightState` renders the same on any
device. `radius` is relative to *half the shorter side* so a value of `1` fills
vertically regardless of width.

### Flicker is state, not frames

`flickerHz` describes intent. The client animates the on/off cycle locally with
`requestAnimationFrame`, so we never send one message per flash. **Any**
flicker > 0 is gated behind a photosensitivity consent on the client, clamped to
`LIMITS.flickerHz.max` (60), with extra caution in `FLICKER_HIGH_RISK_BAND_HZ`
(~15–25 Hz) and `prefers-reduced-motion` respected.

## Throttling

The controller coalesces rapid input (sliders) and sends at most ~20 msg/s
(every ~50 ms) with leading + trailing edges, so the final value always lands.

## Session codes

6 characters from the Crockford base32 alphabet
`0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no `I/L/O/U`). Generated server-side,
case-insensitive on join, 1-hour TTL (in-memory for the prototype).

## Versioning

`v` is the schema version. Additive fields keep the door open: every v2 field is
optional, so v1 and v2 states interoperate (a missing field ⇒ its default). The
current version is **`2`** — the Phase-2 stimulus superset (per-eye targeting,
stereo render mode, rotation, aperture, eye-distance, A/B background). The
Phase-3 `sweep` field is also additive and optional, so it joins the v2 superset
without a version bump; echo-back is a hub method/event pair and is likewise
unversioned.
