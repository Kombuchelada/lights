# 0002 — Handcrafted CSS with tokens, not a UI framework

**Status:** accepted

As the controller grows to host more tools plus admin/support pages, we needed
consistent styling across future pages. We considered adopting Tailwind or
Bootstrap, but the driving concern is **cross-page visual consistency**, not
agent familiarity with a framework's vocabulary. A utility framework does not
enforce consistency by itself — an agent can pick `rounded-md` vs `rounded-xl`
as easily as `10px` vs `12px`; enforcing a constrained scale and extracting
shared component patterns is the same work either way. So we keep the existing
handcrafted SCSS and instead: (1) extend the existing color tokens into a full
design language (color, spacing, radius, type) documented in
`docs/design-system.md`; (2) enforce token use mechanically via stylelint
(`stylelint-declaration-strict-value`) in CI, adopted **phased** (color first,
other axes as each is tokenized) so CI never becomes a wall of red; (3) make
reusable component patterns shareable across components rather than trapped in
`app-root`. The client PWA is explicitly out of scope (thin single-tool
renderer).

**Consequence / note to future readers:** the bespoke CSS is a deliberate
choice, not tech debt awaiting a framework. Before introducing
Tailwind/Bootstrap, revisit this ADR — the bar is whether it delivers
consistency that tokens + stylelint cannot.
