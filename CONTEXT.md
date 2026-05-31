# CONTEXT — Lumessa

Domain glossary for the Lumessa realtime light-control system. Opinionated: when
several words exist for one concept, the canonical term is the heading and the
rejected synonyms are listed under _Avoid_.

## Roles & surfaces

### Controller
The clinician-facing app (`apps/management/`) that drives the light in realtime.
_Avoid_: management panel, management page, admin, dashboard.

### Client
The headset-phone app (`apps/client/`) that renders the light fullscreen.
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
