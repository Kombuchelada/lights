# Context — Lights

Domain glossary for the Lights light-control project. Defines project-specific
terms so plans and code (human- or agent-authored) stay consistent.

## Apps

### Controller
The Angular management app (`apps/management/`) a clinician uses to drive the
light. The styling/design-system work targets **this** app, because future
tools, admin, and support pages will live here.
_Avoid_: management UI (when speaking of the styled surface), dashboard

### Client
The vanilla-TS PWA (`apps/client/`) rendered on the headset phone. A **thin,
single-tool renderer** — a fullscreen black canvas plus a minimal join/scanner
overlay. Deliberately austere and **out of scope** for the design system; it is
not expected to host other tools.
_Avoid_: viewer, headset app (when precision matters)

## Styling / design system

### Design tokens
Named CSS custom properties that encode the design language (color, spacing,
radius, type scale). Today only **color** tokens exist (in
`apps/management/src/styles.scss`, themed via `html[data-theme]`); spacing,
radius, and type are still hardcoded and inconsistent. The plan is to extend
tokens to cover those axes and refactor the controller to consume them.
_Avoid_: variables (too generic), theme vars

### Consistency
The primary goal driving this work: future controller pages should share one
visual language. The concern is **cross-page visual consistency**, NOT agent
familiarity with a CSS framework — so the chosen path must *enforce* a scale,
not merely make CSS easier to write.
_Avoid_: conflating with "agent legibility"

### Token enforcement
The mechanism that keeps the design system from drifting: a stylelint rule
(`stylelint-declaration-strict-value`) that flags raw values where a token
exists, paired with a human-readable `docs/design-system.md`. Adopted
**phased** — color enforcement first (zero refactor debt), then radius,
spacing, and type each tokenized + adopted before its rule is tightened, so CI
never becomes a wall of red. Lives in the CI `build-frontends` job (non-blocking
gate: drift is visible, but does not block the Railway deploy).
_Avoid_: "the linter" (ambiguous — Angular/TS also lint)

### Component patterns
Reusable controller UI primitives (`.card`, `.field`, `.seg-btn`, `.swatch`,
`.hint`, `.step-btn`…). Today trapped inside `app-root`'s emulated-encapsulation
styles, so a new page cannot reuse them. Making them shareable is part of the
design-system work and is **separate from tokens** — tokens fix values,
component patterns fix structure.
_Avoid_: components (collides with Angular `@Component`)
