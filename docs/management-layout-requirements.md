# Controller layout redesign — requirements & clinician questions

Working doc for redesigning the **management (controller) app** layout so a
clinician on a laptop/desktop can reach all or most controls **without
scrolling**, while the **narrow/mobile** view stays as it is today (single
column — it already works well there).

This is not yet a build plan. It collects the decisions already made and the
open questions a **clinician** needs to answer before we commit to a layout.

---

## Settled so far

- **Keep mobile as-is.** The current single-column layout is the mobile/narrow
  design. The redesign only changes wide screens (a new desktop breakpoint).
- **Target screen:** a **1080p browser window** (~1920×1080; ~1900×900 usable
  after browser chrome). Plenty of horizontal room — vertical height is the
  tighter constraint.
- **Stereo/VR is a common mode**, not an edge case. The layout must work well
  with the Stereo/VR controls expanded (eye grids, aperture, eye-distance,
  rotation), not just in mono mode.
- **Collapsible sections are acceptable** — but with a caveat (see below).

### Caveat on collapsing

A collapsed section is functionally the same as scrolling: the control is off
screen and costs a click to reveal. So collapsing should be aimed at
**set-once** controls, not the knobs a clinician adjusts live mid-session. The
whole point of Question 1 below is to learn which is which, so we only collapse
what genuinely deserves it. With ~1900px of width we expect a 2–3 column grid
can show most controls at once without collapsing anything.

---

## The full control inventory (what exists today)

So answers can reference real controls. Grouped as they appear in the app now:

| Group | Controls |
|-------|----------|
| **Session** | Session code + QR, client-connected status, render confirmation |
| **Color** | RGB sliders (with ±1 fine-step), preset swatches, custom color picker, memory slots (Save + M1–M4), channel lock, wavelength (nm) picker |
| **Light** | Brightness, Size |
| **Position** | X, Y, Center button |
| **Stereo / VR** | Render mode (mono / vergence / align / paired / manual), per-eye clock grids (left/right), aperture (dot size), eye-distance, rotation (left/right + lock) |
| **Flicker** | Frequency (Hz), safety warnings |
| **A/B background** | Background color, alternation (Hz), safety warnings |
| **Sweep (KITT)** | Rate (Hz), axis, range |
| **Live preview** | Visual mirror of the stimulus (not a control) |

---

## Questions for the clinician

### Q1. Live knobs vs. set-once controls *(highest priority)*

During an **active session** with a patient, which controls do you adjust
**repeatedly, live, mid-session** — versus which do you **set once at the start**
and then leave alone?

This drives the layout directly: live knobs stay visible and reachable at all
times; set-once controls can be tucked into a collapsed or secondary area.

For each, mark **Live** / **Set-once** / **Rarely or never used**:

- [ ] Color — RGB sliders
- [ ] Color — presets / memory slots
- [ ] Color — wavelength (nm)
- [ ] Brightness
- [ ] Size
- [ ] Position (X / Y)
- [ ] Stereo render mode
- [ ] Per-eye targeting grids
- [ ] Aperture (dot size)
- [ ] Eye-distance
- [ ] Rotation
- [ ] Flicker frequency
- [ ] A/B background
- [ ] Sweep (rate / axis / range)

### Q2. The single most-watched control

While running a session, is there **one control (or a small cluster)** your
attention and hands stay on most of the time? (e.g. position, brightness, or the
eye grids.) If so, that becomes the visual anchor of the layout.

### Q3. Preview placement

The **live preview** mirrors what the patient sees. On a wide screen, do you
want it:
- **Always visible** while you work the controls (e.g. pinned to one side), or
- Fine to have it scroll away once the session is set up?

How much do you actually rely on the on-screen preview versus watching the
patient / headset directly?

### Q4. Controls used together

Are there controls you frequently **adjust as a pair or in sequence** and would
want **side by side**? (e.g. brightness + flicker, or color + position.)
Grouping these in the same column reduces eye/hand travel.

### Q5. Controls that should be hard to hit by accident

Any controls where an accidental change mid-session would be a problem and you'd
**prefer them slightly out of the way** (collapsed, or behind a deliberate
action)? Flicker and A/B background already carry seizure-risk warnings —
should those be more guarded, or are they used routinely?

### Q6. Mono vs. stereo in practice

Roughly what share of sessions are **mono** vs. **stereo/VR**? If stereo is the
default, we optimize the primary layout for it and treat mono as the simpler
case (rather than the other way around).

### Q7. Anything missing or in the wrong place

Looking at the control inventory above — is anything **hard to find, mislabeled,
or grouped wrong** today? Any control you wish were faster to reach, or any
you've never used?

---

## How answers feed the design

- **Q1 + Q2** → which cards are always-visible "live" controls vs. collapsible
  "setup" controls, and the visual anchor.
- **Q3** → whether the preview becomes a pinned side panel on desktop.
- **Q4** → column grouping / adjacency in the multi-column grid.
- **Q5** → what (if anything) gets collapsed or guarded.
- **Q6** → whether mono or stereo is the layout's primary case.
- **Q7** → any regrouping to fold in while we're reworking the layout.
