# CONTEXT — Lumessa

Domain glossary for the Lumessa realtime light-control system. Opinionated: when
several words exist for one concept, the canonical term is the heading and the
rejected synonyms are listed under _Avoid_.

## Roles & surfaces

### Controller
The clinician-facing app (`apps/management/`) that drives the light in realtime.
Also the target of the design-system work — future tools, admin, and support
pages will live here.
_Avoid_: management panel, management page, admin, dashboard.

### Client
The headset-phone app (`apps/client/`) that renders the light fullscreen. A
**thin, single-tool renderer** — deliberately austere and **out of scope** for
the design system.
_Avoid_: viewer, display, screen.

## Controller layout

### Control card
A bordered panel grouping one set of related controls. The cards are **Color**,
**Light**, **Position**, **Stereo / VR**, **Flicker**, **A/B background**, and
**Sweep (KITT)**.
_Avoid_: panel, section, tile, widget.

### Card grid
The multi-column arrangement of control cards shown automatically on wide
screens. Packs cards by content height (masonry-style, via CSS multi-column)
rather than aligning rows. Below the breakpoint the cards fall back to a single
column. Distinct from the per-eye targeting **grid** inside the Stereo card.
_Avoid_: layout, columns view, masonry mode.

### Compact view
A user-toggled, persisted display density that tightens padding/margins,
replaces text labels with icons where one fits (full text kept in
`title`/`aria-label`), and hides convenience hints — never safety warnings.
Independent of the card grid.
_Avoid_: dense mode, mini mode, condensed.

### Collapsed summary
What a collapsed control card shows in its header: the title plus a live readout
of the card's key state (Color → swatch, Light → %, Position → x,y, Stereo →
mode, Flicker/A·B/Sweep → Hz). Lets a clinician monitor state without expanding
the card.
_Avoid_: preview, accordion header, peek.

### Sticky preview
The live preview mirror pinned in view while the card grid scrolls, so realtime
feedback is always visible on wide screens.
_Avoid_: floating preview, mini-map.

## Safety

### Flicker warning
The photosensitive-seizure caution/high-risk notices shown for non-zero flicker
or A/B alternation. A medical-safety element: rendered at full prominence
regardless of compact view or collapse state — never hidden or reduced to an
icon.
_Avoid_: flicker hint, flashing note.

## Styling / design system

### Design tokens
Named CSS custom properties that encode the design language (color, spacing,
radius, type scale), defined in `apps/management/src/styles.scss`. Color tokens
are themed via `html[data-theme]`; spacing/radius/type are theme-independent.
Controller styles consume them via `var(--…)` rather than hardcoding values.
_Avoid_: variables (too generic), theme vars.

### Consistency
The primary goal driving the design-system work: future controller pages should
share one visual language. The concern is **cross-page visual consistency**, NOT
agent familiarity with a CSS framework — so the chosen path must *enforce* a
scale, not merely make CSS easier to write.
_Avoid_: conflating with "agent legibility".

### Token enforcement
The mechanism that keeps the design system from drifting: a stylelint rule
(`stylelint-declaration-strict-value`) that flags raw values where a token
exists, paired with the human-readable `docs/design-system.md`. Adopted
**phased** — color enforcement first, then radius, spacing, and type each
tokenized + adopted before its rule is tightened, so CI never becomes a wall of
red. Lives in the CI `build-frontends` job (non-blocking gate: drift is visible,
but does not block the Railway deploy).
_Avoid_: "the linter" (ambiguous — Angular/TS also lint).

### Component patterns
Reusable controller UI primitives (`.card`, `.field`, `.seg-btn`, `.swatch`,
`.hint`, `.step-btn`…). Today live inside `app-root`'s emulated-encapsulation
styles, so a new page cannot yet reuse them. Making them shareable is future
design-system work and is **separate from tokens** — tokens fix values,
component patterns fix structure.
_Avoid_: components (collides with Angular `@Component`).
