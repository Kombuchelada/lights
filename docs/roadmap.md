# Roadmap — Lights

The living feature list: what's built, what's next, and what's deliberately
deferred. Read it with [`architecture.md`](architecture.md) (design) and
[`protocol.md`](protocol.md) (wire contract).

**Legend:** ✅ done · 🚧 in progress · ⬜ planned · 💤 deferred

---

## Phase 1 — Control prototype

The working light-control surface: a clinician controller drives a colored
light on a headset client in realtime. This is the current focus, and the
milestones mirror §5 of `architecture.md`.

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
  - ⬜ **Hands-on device run** — the guide and tooling are ready; running the
    scripts on a physical iOS + Android phone and filling in that doc's result
    table is the one remaining human-in-the-loop step (needs hardware).

### Known Phase-1 limitations

Deliberate prototype trade-offs, not bugs — each is closed by a SaaS-roadmap
item below.

- **In-memory, single-instance session store.** Sessions live in one server
  process and are lost on restart. Expiry is a 1-hour TTL evicted *lazily on
  access* (`InMemorySessionStore`); there is no background GC, so an idle expired
  session lingers in memory until something next looks it up. Scale-out / a
  durable store is the persistence + scale work below.
- **No authentication; dev CORS is wide-open.** Anyone with a code can join, and
  the server allows any origin with credentials (`Program.cs`). Auth0 + a
  locked-down CORS policy are on the SaaS roadmap.

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
toggling + paired-mode mirroring). The one human-in-the-loop step is a physical
headset run of the dual-pane render (per `docs/testing.md`).

---

## Phase 3 — Controller ergonomics 💤

Smaller quality-of-life features that aren't captured by Phase 2 (stimulus
depth) or the SaaS roadmap. None require a protocol bump except where noted —
most are controller-only UI.

- 💤 **In-session color memory slots** — quick stash/recall of up to ~4 colors
  mid-session (`SAVE`, `M1–M4`). Distinct from the SaaS "saved protocols":
  ephemeral, controller-local, zero-friction recall.
- 💤 **Fuller preset palette** — we have 8 swatches today. Missing the
  clinically useful **Far Red** (`100,0,0`) and **Black** (`0,0,0`), plus
  Magenta, Indigo, Yellow-Green, and Red-Orange.
- 💤 **Per-channel fine-step `± / «»` buttons** — ±1 nudge on each RGB channel
  (and ±1 nm on wavelength) for precise adjustment, honoring the active channel
  lock. Complements the existing sliders / numeric inputs.
- 💤 **Echo-back delivery confirmation** — surface the state the client actually
  rendered (server round-trip echo), rather than only the controller's locally
  predicted preview. Confirms the message reached the headset.
- 💤 **`KITT` scanning mode** — an oscillating/sweeping light stimulus. Named for
  the Knight Rider sweeping scanner; a mode that animates the circle's X
  position back and forth. Would need a protocol addition (sweep params) and
  client-side animation.

---

## SaaS roadmap 💤

Designed-for but not built. Phase 1 keeps the seams clean so these slot in
without reworking the realtime core.

- 💤 **Auth (Auth0).** JWT bearer on the API + a hub access token; Angular Auth0
  SPA SDK; `[Authorize]` on endpoints/hub; account-scoped sessions + optional
  persistent per-account room codes. Closes the "no auth / open CORS" limitation.
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
