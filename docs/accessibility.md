# Accessibility — Lights

The M7 a11y audit of the **controller** (`apps/management`) and **client**
(`apps/client`), the fixes it produced, and the manual checklist for keeping
the surface accessible. Read with [`roadmap.md`](roadmap.md) (M7) and
[`testing.md`](testing.md) (real-device verification).

Target: **WCAG 2.1 AA**. The controller is the clinician-facing surface that
must be fully keyboard- and screen-reader-operable; the client is a headset
display whose only interaction is the join form and the photosensitivity
consent gate.

---

## Audit findings & fixes (M7)

A baseline pass shipped in M6 (labels, focus-visible rings, roles). The M7 deep
pass added:

### 1. Contrast — white text on the accent failed AA (dark theme)

White on the dark-theme accent `#3b82f6` measured **3.68:1**, below the 4.5:1
AA threshold for normal text. This affected every filled control: the
**Start session** button and the *on* state of the segmented controls (theme
toggle, channel lock).

The accent also serves as **link/label text on the dark background**, where it
must stay *light* (`accent on panel` = 4.80:1) — so darkening the single token
would have traded one failure for another. Fix: a dedicated **`--accent-fill`**
token (`#2563eb`, white = **5.17:1**) for filled surfaces, leaving `--accent`
light for text. See `styles.scss`.

All other token pairs pass AA in both themes (verified by computing relative
luminance / contrast ratios for every text-on-surface pair; the lowest passing
pair is `danger on bg` = 4.51:1 in light).

### 2. Radiogroups had no keyboard pattern

The theme toggle and channel-lock controls use `role="radiogroup"` /
`role="radio"`, which sets a screen-reader expectation the markup didn't meet:
arrow-key selection and a **single tab stop**. As shipped, every radio was a tab
stop and arrow keys did nothing.

Fix: a `RovingRadiogroup` directive (`radiogroup.directive.ts`) applied to
`[role="radiogroup"]`. It manages a **roving tabindex** (the checked radio is
the lone tab stop, re-derived via a `MutationObserver` on `aria-checked` as the
signal-bound selection changes) and handles **Arrow / Home / End** — moving
focus and activating the target, so selection follows focus per the
[WAI-ARIA radio pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/).
Covered by a unit test in `app.spec.ts`.

### 3. Status changes were silent to screen readers

Connection state (`connecting → connected → reconnecting`) and the
client-presence indicator (`Waiting → Client connected`) updated visually only.
Both are now `role="status"` `aria-live="polite"` regions, so a screen-reader
user hears the session come up and the headset join/drop. The connection badge
gets a visually-hidden `"Connection:"` prefix so the announcement is
self-describing.

### 4. The live preview added screen-reader noise

The preview box is a purely **visual mirror** of controls that are already
individually labelled (color, brightness, size, position, flicker). It now
carries `aria-hidden="true"` to avoid announcing duplicate, redundant state.

### 5. Client — consent modal focus

When the photosensitivity consent dialog opens, focus now moves to the **safe
default** ("Keep steady") button rather than staying on the canvas, and
**Escape declines**. This prevents a keyboard/AT user from enabling flicker by
reflex (e.g. hitting Enter), and keeps the modal operable without a pointer.

---

## Manual checklist

Re-run when touching the control surface. Verify in **both** themes.

**Keyboard**
- [ ] Tab reaches every control in a sensible order; nothing is trapped.
- [ ] Each segmented control (theme, channel lock) is a **single** tab stop;
      arrow keys move and change selection; Home/End jump to ends.
- [ ] All sliders adjust with arrow keys; buttons activate with Enter/Space.
- [ ] A visible focus ring is present on every focusable element.
- [ ] Client: the consent dialog takes focus on open and Escape declines.

**Screen reader** (VoiceOver / NVDA)
- [ ] Every slider announces its name and value (e.g. "Red channel, 128").
- [ ] Color swatches announce their name; the wavelength slider announces nm.
- [ ] Connecting / connected / reconnecting is announced as it changes.
- [ ] Client connect/disconnect is announced.
- [ ] The flicker risk warning is announced when it appears (it is a live region).
- [ ] The preview box is **not** announced (it is `aria-hidden`).

**Visual / contrast**
- [ ] Text and UI contrast pass AA in light and dark (re-check if tokens change).
- [ ] `prefers-reduced-motion` is honored client-side (flicker rendering).
- [ ] Layout is usable at 200% zoom and on a narrow (≤520px) viewport.

---

## Known gaps / non-goals

- **No full focus-trap** in the controller's modals — there are none; the
  controller is a single non-modal view. The client's two dialogs are simple
  enough that focusing the safe default + Escape suffices for the prototype.
- **Automated a11y testing** (axe / Lighthouse CI) is not wired into CI; the
  checklist above is manual. A SaaS-phase candidate.
- The client is **not** designed for screen-reader operation beyond the join
  form and consent gate — it is a full-screen stimulus display.
