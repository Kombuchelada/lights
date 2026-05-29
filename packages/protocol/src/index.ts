/**
 * @lights/protocol — shared wire-protocol types and constants for the Lights
 * light-control system.
 *
 * This module is the single source of truth for the TypeScript surfaces
 * (management controller + client screen). It is hand-kept in sync with the
 * C# DTOs in `server/Lights.Core`. See `docs/protocol.md`.
 *
 * No runtime dependencies — safe to import from any bundler.
 */

/**
 * Schema version. v2 added the Phase-2 "stimulus depth" fields (stereo render
 * mode, per-eye clock-grid targeting, rotation, aperture, eye-distance, A/B
 * background). They are all optional and additive: a v1 state — or any state
 * with no v2 fields — still renders as a single mono circle.
 */
export const PROTOCOL_VERSION = 2 as const;

/** Roles a connection can take within a session group. */
export type Role = 'controller' | 'client';

/** How the current color was chosen on the controller (informational). */
export type ColorSource = 'rgb' | 'wavelength';

/**
 * Render mode.
 * - `mono`     — single full-screen circle (v1 behavior).
 * - `vergence` — dual-pane, eye-distance drives convergence.
 * - `align`    — dual-pane alignment pattern for fitting the headset.
 * - `paired`   — dual-pane, the same grid positions in both eyes.
 * - `manual`   — dual-pane, independent per-eye grid positions.
 *
 * (The `KITT` sweep is Phase 3 and intentionally omitted.)
 */
export type RenderMode = 'mono' | 'vergence' | 'align' | 'paired' | 'manual';

/** sRGB color channels, each 0–255. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Position + size of the light, normalised to the viewport so it renders
 * identically on any screen resolution.
 *
 * - `x`, `y`  — 0..1 fraction of width/height (`0.5, 0.5` = center).
 * - `radius`  — 0..1 fraction of *half the shorter viewport side*
 *               (`1` ≈ the circle touches the top & bottom edges).
 */
export interface Shape {
  x: number;
  y: number;
  radius: number;
}

/**
 * Per-eye targeting on the fixed 13-cell clock grid. `positions` is a 13-bit
 * mask: bit 0 = center, bits 1..12 =
 * clock-hour positions on a ring (12 = top, 3 = right, 6 = bottom, 9 = left).
 * Several bits may be set at once. `rotationDeg` rotates the ring pattern.
 */
export interface EyeField {
  /** 13-bit mask of lit grid cells (0..8191). */
  positions: number;
  /** Rotation of the ring pattern, degrees (0..360). */
  rotationDeg: number;
}

/**
 * A/B alternating background. `hz === 0` paints a
 * steady `color`; `hz > 0` alternates the background between black and `color`
 * — a full-screen flash, so it is gated behind the client's photosensitivity
 * consent exactly like flicker.
 */
export interface AbBackground {
  /** The alternate/second background color. */
  color: Rgb;
  /** Alternation rate in Hz; `0` = steady color. Rendered locally on the client. */
  hz: number;
}

/** Axis the `KITT` sweep oscillates along. */
export type SweepAxis = 'x' | 'y';

/**
 * `KITT` scanning sweep — an oscillating light. `hz === 0` is off (the light
 * stays at its `shape` position); `hz > 0` oscillates the light center back and
 * forth along `axis` with amplitude `range` (normalised). Like flicker, the
 * motion is animated locally on the client from this state — we never send one
 * message per frame. It is *movement*, not a flash, so it is not behind the
 * photosensitivity gate, but the client honours `prefers-reduced-motion`.
 */
export interface Sweep {
  /** Oscillations per second; `0` = off (steady position). */
  hz: number;
  /** Which position axis sweeps. */
  axis: SweepAxis;
  /** Peak offset from the base position, 0..1 of the viewport. */
  range: number;
}

/** The complete, renderable light state — the unit of realtime sync. */
export interface LightState {
  /** Schema version; equals {@link PROTOCOL_VERSION}. */
  v: number;
  /** Resolved sRGB color that is actually rendered. */
  color: Rgb;
  /** Which input produced `color`. */
  source: ColorSource;
  /** Selected wavelength in nm when `source === 'wavelength'`. */
  wavelengthNm?: number;
  /** 0..1 — rendered as the alpha of the light over pure black. */
  brightness: number;
  /** Normalised position + size. */
  shape: Shape;
  /** Flicker frequency in Hz; `0` = steady. Rendered locally on the client. */
  flickerHz: number;
  /** Optional sender timestamp (epoch ms), for diagnostics only. */
  ts?: number;

  /* ---- v2 (stimulus depth) — all optional; absent ⇒ mono single circle ---- */

  /** Render mode; absent or `mono` ⇒ the v1 single-circle behavior. */
  mode?: RenderMode;
  /** Left-eye targeting (stereo modes only). */
  left?: EyeField;
  /** Right-eye targeting (stereo modes only). */
  right?: EyeField;
  /** Per-dot aperture size in stereo modes, 0..1 of half the shorter pane side. */
  aperture?: number;
  /** Interpupillary horizontal offset of the two panes, -1..1 of half-pane width. */
  eyeDistance?: number;
  /** A/B alternating background. */
  background?: AbBackground;
  /** `KITT` oscillating sweep of the light position. */
  sweep?: Sweep;
}

/* ------------------------------------------------------------------ *
 * Limits — authoritative on the server, mirrored here for the UIs.   *
 * ------------------------------------------------------------------ */
export const LIMITS = {
  color: { min: 0, max: 255 },
  brightness: { min: 0, max: 1 },
  radius: { min: 0, max: 1 },
  position: { min: 0, max: 1 },
  wavelengthNm: { min: 380, max: 780 },
  /**
   * Hard ceiling for flicker frequency. A consent gate is still required on
   * the client before *any* flicker > 0 is rendered.
   */
  flickerHz: { min: 0, max: 60 },
  /* v2 stimulus-depth ranges. */
  aperture: { min: 0, max: 1 },
  eyeDistance: { min: -1, max: 1 },
  rotationDeg: { min: 0, max: 360 },
  /** 13-bit clock-grid mask (bit 0 = center, 1..12 = clock hours). */
  eyePositions: { min: 0, max: 0x1fff },
  /** A/B background alternation rate; same ceiling + consent gate as flicker. */
  abHz: { min: 0, max: 60 },
  /** `KITT` sweep oscillation rate — slow scanner motion, not a strobe. */
  sweepHz: { min: 0, max: 5 },
  /** `KITT` sweep amplitude, normalised fraction of the viewport. */
  sweepRange: { min: 0, max: 1 },
} as const;

/** Frequencies in this band carry the highest photosensitive-seizure risk. */
export const FLICKER_HIGH_RISK_BAND_HZ = { min: 15, max: 25 } as const;

/* ------------------------------------------------------------------ *
 * Per-eye clock grid — 1 center + 12 clock-hour positions on a ring. *
 * Shared by the controller (button layout / preview) and the client  *
 * renderer so both place the dots identically.                       *
 * ------------------------------------------------------------------ */

/** Number of cells in the per-eye grid (center + 12 clock hours). */
export const EYE_GRID_CELLS = 13;
/** Bit for the center cell (index 0). */
export const EYE_CENTER_BIT = 1;

/**
 * Clock angle (degrees, 0 = up/12-o'clock, clockwise) for a grid cell.
 * Index `0` is the center and has no angle (returns `0`); `1..12` map to the
 * clock hours, so `12` = top, `3` = right, `6` = bottom, `9` = left.
 */
export function eyeGridAngleDeg(index: number): number {
  if (index <= 0) return 0;
  return (index % 12) * 30;
}

/** A normalized offset (dx, dy) from a pane center. */
export interface GridOffset {
  dx: number;
  dy: number;
}

/**
 * Normalized offset of grid cell `index` on a ring of radius `ringRadius`,
 * with the whole pattern rotated by `rotationDeg`. The center cell sits at the
 * origin. `+dy` is downward (canvas coordinates).
 */
export function eyeGridOffset(index: number, ringRadius: number, rotationDeg = 0): GridOffset {
  if (index <= 0) return { dx: 0, dy: 0 };
  const theta = ((eyeGridAngleDeg(index) + rotationDeg - 90) * Math.PI) / 180;
  return { dx: Math.cos(theta) * ringRadius, dy: Math.sin(theta) * ringRadius };
}

/** Whether bit `index` (0..12) is lit in a 13-bit eye-position mask. */
export const isEyeBitSet = (positions: number, index: number): boolean =>
  (positions & (1 << index)) !== 0;

/** Session pairing codes: Crockford base32 (no I/L/O/U), fixed length. */
export const SESSION_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SESSION_CODE_LENGTH = 6;

/** SignalR hub route. */
export const CONTROL_HUB_PATH = '/hubs/control';

/** Hub method names (client → server invocations). */
export const HubMethods = {
  joinSession: 'JoinSession',
  sendState: 'SendState',
  leaveSession: 'LeaveSession',
  /** Client → server: confirm the client rendered the state stamped `ts`. */
  ackState: 'AckState',
} as const;

/** Hub event names (server → client pushes). */
export const HubEvents = {
  receiveState: 'ReceiveState',
  clientJoined: 'ClientJoined',
  clientLeft: 'ClientLeft',
  controllerJoined: 'ControllerJoined',
  controllerLeft: 'ControllerLeft',
  sessionEnded: 'SessionEnded',
  /** Server → controller: the client rendered the state stamped `ts` (echo-back). */
  stateRendered: 'StateRendered',
} as const;

/** Payload of the {@link HubEvents.stateRendered} echo-back event. */
export interface StateRendered {
  /** The `ts` of the state the client rendered (controller's send clock). */
  ts: number;
}

/** Response from `POST /api/sessions`. */
export interface CreateSessionResponse {
  sessionId: string;
  code: string;
  /** Absolute URL that opens the client already pointed at this session. */
  joinUrl: string;
  /** ISO-8601 expiry. */
  expiresAt: string;
}

const clamp = (n: number, lo: number, hi: number): number =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;

const clampChannel = (n: number): number =>
  Math.round(clamp(n, LIMITS.color.min, LIMITS.color.max));

const RENDER_MODES: readonly RenderMode[] = ['mono', 'vergence', 'align', 'paired', 'manual'];

const sanitizeMode = (m: unknown): RenderMode =>
  RENDER_MODES.includes(m as RenderMode) ? (m as RenderMode) : 'mono';

const sanitizeEye = (e: Partial<EyeField> | undefined): EyeField | undefined => {
  if (!e) return undefined;
  return {
    positions:
      Math.round(clamp(e.positions ?? 0, LIMITS.eyePositions.min, LIMITS.eyePositions.max)) & 0x1fff,
    rotationDeg: clamp(e.rotationDeg ?? 0, LIMITS.rotationDeg.min, LIMITS.rotationDeg.max),
  };
};

const sanitizeBackground = (b: Partial<AbBackground> | undefined): AbBackground | undefined => {
  if (!b) return undefined;
  const c = b.color ?? { r: 0, g: 0, b: 0 };
  return {
    color: { r: clampChannel(c.r), g: clampChannel(c.g), b: clampChannel(c.b) },
    hz: clamp(b.hz ?? 0, LIMITS.abHz.min, LIMITS.abHz.max),
  };
};

const sanitizeSweep = (s: Partial<Sweep> | undefined): Sweep | undefined => {
  if (!s) return undefined;
  return {
    hz: clamp(s.hz ?? 0, LIMITS.sweepHz.min, LIMITS.sweepHz.max),
    axis: s.axis === 'y' ? 'y' : 'x',
    range: clamp(s.range ?? 0, LIMITS.sweepRange.min, LIMITS.sweepRange.max),
  };
};

/** A safe, neutral default (dim, centered, steady). */
export function defaultLightState(): LightState {
  return {
    v: PROTOCOL_VERSION,
    color: { r: 255, g: 0, b: 0 },
    source: 'rgb',
    brightness: 0.5,
    shape: { x: 0.5, y: 0.5, radius: 0.35 },
    flickerHz: 0,
  };
}

/**
 * Clamp / normalise an incoming state so renderers can trust it. Mirrors the
 * server-side validation; both sides apply the same {@link LIMITS}.
 */
export function sanitizeLightState(input: Partial<LightState> | undefined): LightState {
  const d = defaultLightState();
  const s = input ?? {};
  const color = s.color ?? d.color;
  return {
    v: PROTOCOL_VERSION,
    color: {
      r: clampChannel(color.r),
      g: clampChannel(color.g),
      b: clampChannel(color.b),
    },
    source: s.source === 'wavelength' ? 'wavelength' : 'rgb',
    wavelengthNm:
      s.wavelengthNm === undefined
        ? undefined
        : clamp(s.wavelengthNm, LIMITS.wavelengthNm.min, LIMITS.wavelengthNm.max),
    brightness: clamp(s.brightness ?? d.brightness, LIMITS.brightness.min, LIMITS.brightness.max),
    shape: {
      x: clamp(s.shape?.x ?? d.shape.x, LIMITS.position.min, LIMITS.position.max),
      y: clamp(s.shape?.y ?? d.shape.y, LIMITS.position.min, LIMITS.position.max),
      radius: clamp(s.shape?.radius ?? d.shape.radius, LIMITS.radius.min, LIMITS.radius.max),
    },
    flickerHz: clamp(s.flickerHz ?? 0, LIMITS.flickerHz.min, LIMITS.flickerHz.max),
    ts: s.ts,
    mode: sanitizeMode(s.mode),
    left: sanitizeEye(s.left),
    right: sanitizeEye(s.right),
    aperture:
      s.aperture === undefined
        ? undefined
        : clamp(s.aperture, LIMITS.aperture.min, LIMITS.aperture.max),
    eyeDistance:
      s.eyeDistance === undefined
        ? undefined
        : clamp(s.eyeDistance, LIMITS.eyeDistance.min, LIMITS.eyeDistance.max),
    background: sanitizeBackground(s.background),
    sweep: sanitizeSweep(s.sweep),
  };
}

/**
 * Convert a visible-light wavelength (nm) to approximate sRGB using the
 * Bruton/Noah algorithm. Returns 0–255 channels.
 */
export function wavelengthToRgb(wavelength: number): Rgb {
  const nm = clamp(wavelength, LIMITS.wavelengthNm.min, LIMITS.wavelengthNm.max);
  const gamma = 0.8;
  const max = 255;
  let r = 0;
  let g = 0;
  let b = 0;

  if (nm < 440) {
    r = -(nm - 440) / (440 - 380);
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / (490 - 440);
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = -(nm - 510) / (510 - 490);
  } else if (nm < 580) {
    r = (nm - 510) / (580 - 510);
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = -(nm - 645) / (645 - 580);
  } else {
    r = -(nm - 781) / (781 - 645);
  }

  // Intensity falls off near the limits of human vision.
  let factor = 1;
  if (nm < 420) factor = 0.3 + (0.7 * (nm - 380)) / (420 - 380);
  else if (nm >= 701) factor = 0.3 + (0.7 * (780 - nm)) / (780 - 700);

  const ch = (c: number): number => (c <= 0 ? 0 : Math.round(max * Math.pow(c * factor, gamma)));
  return { r: ch(r), g: ch(g), b: ch(b) };
}
