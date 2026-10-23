# Roadmap — Lumessa

The living feature list: what's built, what's next, and what's deliberately
deferred. Read it with [`architecture.md`](architecture.md) (design) and
[`protocol.md`](protocol.md) (wire contract).

**Legend:** ✅ done · 🚧 in progress · ⬜ planned · 💤 deferred

---

## Phase 1 — Control prototype

The working light-control surface: a clinician controller drives a colored
light on a headset client in realtime. The milestones mirror §5 of
`architecture.md`.

| Milestone | Scope | Status |
|-----------|-------|--------|
| **M0** | Scaffold: solution, three apps, protocol package, docs | ✅ |
| **M1** | Hub + session create/join + solid-color end-to-end | ✅ |
| **M2** | Client renderer: normalised circle, alpha brightness, pure black, fullscreen, wake lock, PWA | ✅ |
| **M3** | Management surface: RGB + brightness + radius + X/Y, throttled send, live mirror, session/QR | ✅ |
| **M4** | Wavelength (nm→RGB) picker, presets, channel lock | ✅ |
| **M5** | Flicker (rAF) + photosensitivity safety gate + reduced-motion | ✅ |
| **M6** | Theming (light/dark/system) + a11y pass + reconnection hardening | ✅ |
| **M7** | Docs polish, deeper a11y audit, real-device testing (HTTPS/LAN) | ✅ |

### M7 — done

- ✅ **Docs polish** — `architecture.md` / `protocol.md` reconciled with the
  code (milestone state, hub surface, REST endpoints); this roadmap added.
- ✅ **Deeper a11y audit** — keyboard-operation pass (radiogroups now follow the
  WAI-ARIA roving-tabindex/arrow pattern), WCAG AA contrast verified across both
  themes (fixed a failing white-on-accent pair via a dedicated `--accent-fill`
  token), status changes made live regions, and the visual preview hidden from
  AT. Findings, fixes, and the standing checklist live in
  [`accessibility.md`](accessibility.md).
- ✅ **Real-device test guide over HTTPS/LAN** — [`testing.md`](testing.md)
  covers the three secure-context paths (live Railway deploy / LAN + mkcert /
  HTTPS tunnel), opt-in dev TLS (`DEV_TLS_CERT`/`DEV_TLS_KEY` in the client Vite
  config), and manual scripts including the M6 reconnection / resync path.
  - ✅ **Hands-on device run** — maintainer manual end-to-end pass on a real
    device; result recorded in that doc's log.

### Known Phase-1 limitations

Deliberate prototype trade-offs, not bugs — each is closed by a SaaS-roadmap
item below.

- **In-memory, single-instance session store.** Sessions live in one server
  process and are lost on restart. Expiry is a 1-hour TTL evicted *lazily on
  access* (`InMemorySessionStore`); there is no background GC, so an idle expired
  session lingers in memory until something next looks it up. Scale-out / a
  durable store is the persistence + scale work below.
- ~~**No authentication; dev CORS is wide-open.**~~ ✅ **Resolved** — Auth0 now
  gates the clinician (controller): JWT bearer on `POST /api/sessions` and the
  hub's controller role, sessions account-scoped to the controller's `sub`, and
  CORS narrowed to an env-driven allowlist. The headset client stays anonymous
  code-join by design. See [`auth0.md`](auth0.md).

---

## Phase 2 — Stimulus depth ✅

Richer-stimulus features delivered as an **additive `v = 2`** protocol superset
(every new field optional ⇒ v1 still renders mono) plus a new dual-pane "stereo"
client render mode. The per-eye grid is a **clock face** (center + 12 clock-hour
positions), the eye state is a **13-bit mask** (multiple dots per eye), and each
render mode maps to a stereo layout.

- ✅ **Per-eye 13-position targeting** — independent left/right placement on the
  fixed clock grid (`EyeField.positions`, a 13-bit mask). Two on-screen grid
  pickers on the controller.
- ✅ **Stereoscopic VR render mode** — dual-pane client output. Modes `mono` /
  `vergence` / `align` / `paired` / `manual`. (`KITT` sweep remains Phase 3, below.)
- ✅ **Rotation** — per-eye `rotationDeg`, with a lock to move both together.
- ✅ **Aperture** — per-dot size in stereo (`aperture`).
- ✅ **Eye-distance** — interpupillary offset of the two panes (`eyeDistance`).
- ✅ **A/B alternating background** — second backdrop color (`background.color`);
  a new `background.hz` alternates it with black, gated behind the **same
  photosensitivity consent** as flicker.

Verified: protocol/management/client builds clean; server **24/24** unit tests
(sanitize of all v2 fields + v1 back-compat); management **7/7** (eye-grid bitmask
toggling + paired-mode mirroring). ✅ **User-tested:** the dual-pane render was
covered in the maintainer's manual device pass (per `docs/testing.md`).

---

## Phase 3 — Controller ergonomics ✅

Smaller quality-of-life features that aren't captured by Phase 2 (stimulus
depth) or the SaaS roadmap. All controller-only UI except the `KITT` sweep
(an additive optional `sweep` field, still `v = 2`) and echo-back (additive
hub method/event, no version change).

- ✅ **In-session color memory slots** — quick stash/recall of four colors
  mid-session (**Save** + `M1–M4`). Ephemeral and controller-local (a signal,
  cleared on reload), round-robin save; distinct from the SaaS "saved protocols".
- ✅ **Fuller preset palette** — 14 swatches: added the clinically useful
  **Far Red** (`100,0,0`) and **Black** (`0,0,0`), plus **Red-Orange**,
  **Yellow-Green**, **Indigo**, and **Magenta**.
- ✅ **Per-channel fine-step `±` buttons** — ±1 nudge on each RGB channel and
  ±1 nm on wavelength, flanking each slider and honoring the active channel lock.
- ✅ **Echo-back delivery confirmation** — the client `AckState(ts)`s each
  rendered frame (throttled, latest-wins); the server relays it to the
  controller as `StateRendered`, which shows **✓ Rendered on client** plus the
  round-trip latency. Confirms the message reached the headset, not just the
  controller's local preview.
- ✅ **`KITT` scanning sweep** — an oscillating light. Additive optional `sweep`
  field (`{ hz, axis: x|y, range }`); the client animates the position
  sinusoidally with `requestAnimationFrame` (movement, not a flash, so it honours
  `prefers-reduced-motion` rather than the photosensitivity gate). Works in mono
  and stereo.

Verified: server **27/27** (sweep sanitize + v1/v2 back-compat), management
**10/10** (memory round-robin, locked fine-step, sweep), all builds clean.
✅ **User-tested:** full manual end-to-end pass on a real device (incl. the KITT
sweep) — logged in [`testing.md`](testing.md).

---

## SaaS roadmap 💤

Designed-for but not built. Phase 1 keeps the seams clean so these slot in
without reworking the realtime core.

- ✅ **Auth (Auth0).** JWT bearer on the API + a hub access token; Angular Auth0
  SPA SDK; session-create + controller hub role require auth; account-scoped
  sessions by `sub`; login on the **custom domain `login.lumessa.xyz`** (server
  accepts both custom-domain + default-tenant issuers). Closed the "no auth / open
  CORS" limitation. Remaining follow-ups (deferred): RBAC/roles, Microsoft social,
  and persistent per-account room codes. **See [`auth0.md`](auth0.md).**
- 💤 **Persistence / profiles / folders.** Swap `InMemorySessionStore` for EF
  Core (Postgres/SQL Server); saved "protocols" reuse the `LightState` DTO;
  folders as owned entities. Removes the volatile single-instance limitation.
- 💤 **Billing (Stripe).** Subscription/seat gating on session creation +
  advanced features; webhook endpoint + customer/subscription entities.
- 💤 **Scale-out.** Azure SignalR Service or a Redis backplane; because the hub
  uses connection groups (`session:{id}`), the hub code is unchanged.

---

## Cross-references

- [`architecture.md`](architecture.md) — system shape, realtime model, decisions.
- [`protocol.md`](protocol.md) — the wire contract (messages, types, limits).
- `CLAUDE.md` — working layout, run commands, gotchas.
