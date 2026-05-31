# Design system — controller (management app)

The human-readable source of truth for the controller's visual language. The
decision to keep handcrafted CSS with tokens (rather than adopt a UI framework)
is recorded in [`adr/0002-css-design-system-over-framework.md`](adr/0002-css-design-system-over-framework.md).

**Scope:** the Angular **controller** (`apps/management/`). The client PWA
(`apps/client/`) is a thin single-tool renderer and is deliberately out of
scope.

## How it works

All design values live as CSS custom properties (tokens) in
[`apps/management/src/styles.scss`](../apps/management/src/styles.scss), applied
on `:root`. **Color** tokens are themed — `:root` holds dark defaults,
`html[data-theme='light']` overrides them — and are set at runtime by
`ThemeService`. The **non-color** scales (spacing, radius, type) are
theme-independent and defined once.

Component styles in `app.scss` (and any future page/component) **consume tokens
via `var(--…)`**; they should not hardcode raw values where a token exists.

## Tokens

### Color (themed)

| Token | Role |
| --- | --- |
| `--bg` | Page background |
| `--panel`, `--panel-2` | Card / raised surfaces |
| `--text`, `--muted` | Primary / secondary text |
| `--accent` | Accent for text, links, borders on dark bg |
| `--accent-fill` | Accent for *filled* surfaces (buttons) — darker, so white text hits WCAG AA |
| `--on-accent` | Text/icons rendered over `--accent-fill` (white) |
| `--border` | Hairlines, card borders |
| `--ok`, `--warn`, `--danger` | Status / safety semantics |
| `--chan-r`, `--chan-g`, `--chan-b` | RGB channel indicators — absolute, identical in both themes |

### Spacing (4px base)

Use for `padding`, `margin`, `gap`. Fixed control dimensions (button/swatch
sizes, the preview height) stay literal — those are *sizing*, not layout rhythm.

`--space-1` 4px · `--space-2` 8px · `--space-3` 12px · `--space-4` 16px ·
`--space-5` 20px · `--space-6` 24px · `--space-8` 32px

### Radius

`--radius-sm` 6px · `--radius-md` 8px · `--radius-lg` 12px · `--radius-xl` 16px ·
`--radius-pill` 999px (fully-rounded chips). Circles use `50%` literally.

### Type (rem, 16px root)

`--text-2xs` 0.7 · `--text-xs` 0.78 · `--text-sm` 0.85 · `--text-base` 1 ·
`--text-lg` 1.4 · `--text-xl` 2.4

## Enforcement

A stylelint rule (`scale-unlimited/declaration-strict-value`) flags raw values
where a token should be used, with a message pointing back here. Config:
[`apps/management/.stylelintrc.json`](../apps/management/.stylelintrc.json).

```
cd apps/management
npm run lint:css        # check
npm run lint:css:fix    # auto-fix the standard-config cosmetic rules
```

CI runs `lint:css` in the `build-frontends` job. Like the rest of the CI gate,
it is **non-blocking** for the Railway deploy — it makes drift visible, it does
not gate the release.

### Phased rollout

Enforcement is being tightened one axis at a time, so CI never becomes a wall of
red that trains people (or agents) to disable the linter.

- **Phase 1 (current):** **color** properties (`/color$/`, `fill`, `stroke`).
  Legitimate absolutes are allowlisted in `ignoreValues` — pure black/white
  (`#000`/`#fff`), the spectrum-slider thumb border (`#0006`), `rgb(… / …)`
  overlays, `color-mix()`, and gradients.
- **Phase 2+ (planned):** add `border-radius`, then the spacing properties
  (`padding`/`margin`/`gap`), then `font-size` to the strict-value property
  list. Each axis is already fully tokenized in `app.scss`, so turning the rule
  on for it should stay green — verify with `npm run lint:css` before
  committing.

## Adding a token

1. Add the custom property to `styles.scss` (under the right group; if it is a
   color, add it to **both** `:root` and the light theme block).
2. Use it via `var(--…)` in component styles.
3. Update the relevant table above.
