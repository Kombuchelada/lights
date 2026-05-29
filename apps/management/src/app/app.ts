import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ControlService } from './control/control.service';
import { ThemeService, type ThemeMode } from './theme.service';
import { QrCode } from './qr-code';
import { RovingRadiogroup } from './radiogroup.directive';
import {
  FLICKER_HIGH_RISK_BAND_HZ,
  LIMITS,
  EYE_GRID_CELLS,
  eyeGridOffset,
  wavelengthToRgb,
  type Rgb,
  type RenderMode,
  type SweepAxis,
  type LightState,
} from '@lights/protocol';

type Channel = 'r' | 'g' | 'b';
type Lock = 'none' | 'rg' | 'rb' | 'gb' | 'rgb';
type Eye = 'left' | 'right';

/** Number of in-session color memory slots (M1–M4). */
const MEMORY_SLOTS = 4;

interface Preset {
  label: string;
  rgb: Rgb;
}

/** Height (px) of the preview box; the dot diameter is `radius` × this. */
const PREVIEW_H = 150;

/** Bitmask of the four cardinal clock positions (3/6/9/12 o'clock) — the ALIGN pattern. */
const ALIGN_MASK = (1 << 3) | (1 << 6) | (1 << 9) | (1 << 12);

/** Per-mode seed defaults. */
const MODE_PRESETS: Record<RenderMode, Partial<LightState>> = {
  mono: { mode: 'mono' },
  vergence: {
    mode: 'vergence',
    left: { positions: 1, rotationDeg: 0 },
    right: { positions: 1, rotationDeg: 0 },
    aperture: 0.18,
    eyeDistance: 0.1,
  },
  align: {
    mode: 'align',
    left: { positions: ALIGN_MASK, rotationDeg: 0 },
    right: { positions: ALIGN_MASK, rotationDeg: 0 },
    aperture: 0.1,
    eyeDistance: 0,
  },
  // Paired and manual start with a clear grid — the clinician picks positions;
  // paired mirrors each pick to both eyes.
  paired: {
    mode: 'paired',
    left: { positions: 0, rotationDeg: 0 },
    right: { positions: 0, rotationDeg: 0 },
    aperture: 0.12,
    eyeDistance: 0,
  },
  manual: {
    mode: 'manual',
    left: { positions: 0, rotationDeg: 0 },
    right: { positions: 0, rotationDeg: 0 },
    aperture: 0.12,
    eyeDistance: 0,
  },
};

interface PreviewDot {
  left: number;
  top: number;
  size: number;
}

/** Which channels each lock setting binds together. */
const LOCK_SETS: Record<Lock, readonly Channel[]> = {
  none: [],
  rg: ['r', 'g'],
  rb: ['r', 'b'],
  gb: ['g', 'b'],
  rgb: ['r', 'g', 'b'],
};

const clampChannel = (n: number): number =>
  Math.max(0, Math.min(255, Math.round(Number.isFinite(n) ? n : 0)));

const rgbToHex = (c: Rgb): string =>
  '#' + [c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, '0')).join('');

const hexToRgb = (value: string): Rgb | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

@Component({
  selector: 'app-root',
  imports: [QrCode, RovingRadiogroup],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly control = inject(ControlService);
  protected readonly theme = inject(ThemeService);
  protected readonly state = this.control.state;

  protected readonly limits = LIMITS;
  protected readonly riskBand = FLICKER_HIGH_RISK_BAND_HZ;

  protected readonly presets: readonly Preset[] = [
    { label: 'Far Red', rgb: { r: 100, g: 0, b: 0 } },
    { label: 'Red', rgb: { r: 255, g: 0, b: 0 } },
    { label: 'Red-Orange', rgb: { r: 255, g: 69, b: 0 } },
    { label: 'Orange', rgb: { r: 255, g: 128, b: 0 } },
    { label: 'Yellow', rgb: { r: 255, g: 255, b: 0 } },
    { label: 'Yellow-Green', rgb: { r: 154, g: 205, b: 50 } },
    { label: 'Green', rgb: { r: 0, g: 255, b: 0 } },
    { label: 'Cyan', rgb: { r: 0, g: 255, b: 255 } },
    { label: 'Blue', rgb: { r: 0, g: 0, b: 255 } },
    { label: 'Indigo', rgb: { r: 75, g: 0, b: 130 } },
    { label: 'Violet', rgb: { r: 128, g: 0, b: 255 } },
    { label: 'Magenta', rgb: { r: 255, g: 0, b: 255 } },
    { label: 'White', rgb: { r: 255, g: 255, b: 255 } },
    { label: 'Black', rgb: { r: 0, g: 0, b: 0 } },
  ];

  protected readonly axisOptions: readonly { value: SweepAxis; label: string }[] = [
    { value: 'x', label: 'Horizontal' },
    { value: 'y', label: 'Vertical' },
  ];

  /** Ephemeral, controller-local color memory: stash/recall up to four colors mid-session. */
  protected readonly memory = signal<readonly (Rgb | null)[]>(Array(MEMORY_SLOTS).fill(null));
  private nextSlot = 0;

  protected readonly lockOptions: readonly { value: Lock; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'rg', label: 'R+G' },
    { value: 'rb', label: 'R+B' },
    { value: 'gb', label: 'G+B' },
    { value: 'rgb', label: 'All' },
  ];

  protected readonly themeOptions: readonly { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'system', label: 'System', icon: '🖥' },
    { value: 'light', label: 'Light', icon: '☀' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
  ];

  protected readonly modeOptions: readonly { value: RenderMode; label: string }[] = [
    { value: 'mono', label: 'Mono' },
    { value: 'vergence', label: 'Vergence' },
    { value: 'align', label: 'Align' },
    { value: 'paired', label: 'Paired' },
    { value: 'manual', label: 'Manual' },
  ];

  /** Static layout (percent within a square box) of the 13 clock-grid cells. */
  protected readonly gridCells: readonly { index: number; left: number; top: number; label: string }[] =
    Array.from({ length: EYE_GRID_CELLS }, (_, i) => {
      const o = eyeGridOffset(i, 38, 0);
      return { index: i, left: 50 + o.dx, top: 50 + o.dy, label: i === 0 ? 'C' : String(i) };
    });

  protected readonly lock = signal<Lock>('none');
  protected readonly rotationLock = signal(false);

  protected readonly color = computed(() => this.state().color);
  protected readonly hex = computed(() => rgbToHex(this.color()));
  protected readonly brightnessPct = computed(() => Math.round(this.state().brightness * 100));
  protected readonly radiusPct = computed(() => Math.round(this.state().shape.radius * 100));
  protected readonly xPct = computed(() => Math.round(this.state().shape.x * 100));
  protected readonly yPct = computed(() => Math.round(this.state().shape.y * 100));
  protected readonly wavelength = computed(() => Math.round(this.state().wavelengthNm ?? 580));
  protected readonly usingWavelength = computed(() => this.state().source === 'wavelength');
  protected readonly flickerHz = computed(() => this.state().flickerHz);
  protected readonly flickerRisk = computed<'none' | 'caution' | 'high'>(() => {
    const hz = this.flickerHz();
    if (hz <= 0) return 'none';
    if (hz >= this.riskBand.min && hz <= this.riskBand.max) return 'high';
    return 'caution';
  });
  protected readonly previewDiameterPx = computed(() =>
    Math.round(this.state().shape.radius * PREVIEW_H),
  );

  // ---- v2 stimulus-depth reads ----
  protected readonly mode = computed<RenderMode>(() => this.state().mode ?? 'mono');
  protected readonly isStereo = computed(() => this.mode() !== 'mono');
  protected readonly leftPositions = computed(() => this.state().left?.positions ?? 0);
  protected readonly rightPositions = computed(() => this.state().right?.positions ?? 0);
  protected readonly leftRotation = computed(() => Math.round(this.state().left?.rotationDeg ?? 0));
  protected readonly rightRotation = computed(() => Math.round(this.state().right?.rotationDeg ?? 0));
  protected readonly aperturePct = computed(() => Math.round((this.state().aperture ?? 0.12) * 100));
  protected readonly eyeDistancePct = computed(() => Math.round((this.state().eyeDistance ?? 0) * 100));

  protected readonly abColor = computed<Rgb>(() => this.state().background?.color ?? { r: 0, g: 0, b: 0 });
  protected readonly abHex = computed(() => rgbToHex(this.abColor()));
  protected readonly abHz = computed(() => this.state().background?.hz ?? 0);
  protected readonly abRisk = computed<'none' | 'caution' | 'high'>(() => {
    const hz = this.abHz();
    if (hz <= 0) return 'none';
    if (hz >= this.riskBand.min && hz <= this.riskBand.max) return 'high';
    return 'caution';
  });

  // ---- KITT sweep reads ----
  protected readonly sweepHz = computed(() => this.state().sweep?.hz ?? 0);
  protected readonly sweepAxis = computed<SweepAxis>(() => this.state().sweep?.axis ?? 'x');
  protected readonly sweepRangePct = computed(() => Math.round((this.state().sweep?.range ?? 0.3) * 100));
  protected readonly sweeping = computed(() => this.sweepHz() > 0);

  // ---- Echo-back delivery confirmation ----
  /** The headset has confirmed rendering at least as recent a frame as we last sent. */
  protected readonly rendered = computed(
    () => this.control.lastRenderedTs() > 0 && this.control.lastRenderedTs() >= this.control.lastSentTs(),
  );
  protected readonly roundTripMs = computed(() => this.control.roundTripMs());
  protected readonly hasRenderConfirmation = computed(() => this.control.lastRenderedTs() > 0);

  /** Two-pane preview dots, mirroring the client renderer's stereo geometry. */
  protected readonly previewPanes = computed<{ left: PreviewDot[]; right: PreviewDot[] } | null>(() => {
    if (!this.isStereo()) return null;
    const ring = this.state().shape.radius * 38;
    const size = Math.max(4, (this.state().aperture ?? 0.12) * PREVIEW_H);
    const shift = (this.state().eyeDistance ?? 0) * 25;
    const build = (positions: number, rot: number, dir: number): PreviewDot[] => {
      const dots: PreviewDot[] = [];
      for (let i = 0; i < EYE_GRID_CELLS; i++) {
        if ((positions & (1 << i)) === 0) continue;
        const o = eyeGridOffset(i, ring, rot);
        dots.push({ left: 50 + dir * shift + o.dx, top: 50 + o.dy, size });
      }
      return dots;
    };
    return {
      left: build(this.leftPositions(), this.leftRotation(), -1),
      right: build(this.rightPositions(), this.rightRotation(), 1),
    };
  });

  start(): void {
    void this.control.startSession();
  }

  setTheme(mode: ThemeMode): void {
    this.theme.set(mode);
  }

  setLock(lock: Lock): void {
    this.lock.set(lock);
  }

  setPreset(rgb: Rgb): void {
    this.control.update({ color: rgb, source: 'rgb', wavelengthNm: undefined });
  }

  onHexInput(value: string): void {
    const rgb = hexToRgb(value);
    if (rgb) this.control.update({ color: rgb, source: 'rgb', wavelengthNm: undefined });
  }

  onChannel(ch: Channel, value: string): void {
    const v = clampChannel(Number(value));
    const linked = LOCK_SETS[this.lock()];
    const next: Rgb = { ...this.color() };
    if (linked.includes(ch)) {
      for (const k of linked) next[k] = v;
    } else {
      next[ch] = v;
    }
    this.control.update({ color: next, source: 'rgb', wavelengthNm: undefined });
  }

  /** ±1 nudge on an RGB channel, honoring the active channel lock. */
  stepChannel(ch: Channel, delta: number): void {
    this.onChannel(ch, String(this.color()[ch] + delta));
  }

  onWavelength(value: string): void {
    const nm = Number(value);
    this.control.update({ source: 'wavelength', wavelengthNm: nm, color: wavelengthToRgb(nm) });
  }

  /** ±1 nm nudge on the wavelength, clamped to the visible band. */
  stepWavelength(delta: number): void {
    const nm = Math.max(
      this.limits.wavelengthNm.min,
      Math.min(this.limits.wavelengthNm.max, this.wavelength() + delta),
    );
    this.onWavelength(String(nm));
  }

  // ---- In-session color memory slots ----

  /** Stash the current color into the next slot (round-robin over M1–M4). */
  saveColor(): void {
    const slots = this.memory().slice();
    slots[this.nextSlot] = { ...this.color() };
    this.memory.set(slots);
    this.nextSlot = (this.nextSlot + 1) % MEMORY_SLOTS;
  }

  /** Recall a stored slot as the current color (no-op for an empty slot). */
  recallSlot(index: number): void {
    const rgb = this.memory()[index];
    if (rgb) this.setPreset(rgb);
  }

  onBrightness(value: string): void {
    this.control.update({ brightness: Number(value) / 100 });
  }

  onRadius(value: string): void {
    this.control.update({ shape: { ...this.state().shape, radius: Number(value) / 100 } });
  }

  onX(value: string): void {
    this.control.update({ shape: { ...this.state().shape, x: Number(value) / 100 } });
  }

  onY(value: string): void {
    this.control.update({ shape: { ...this.state().shape, y: Number(value) / 100 } });
  }

  center(): void {
    this.control.update({ shape: { ...this.state().shape, x: 0.5, y: 0.5 } });
  }

  onFlicker(value: string): void {
    this.control.update({ flickerHz: Number(value) });
  }

  stopFlicker(): void {
    this.control.update({ flickerHz: 0 });
  }

  // ---- v2 stimulus-depth handlers ----

  setMode(mode: RenderMode): void {
    this.control.update(MODE_PRESETS[mode]);
  }

  isCellOn(eye: Eye, index: number): boolean {
    const positions = eye === 'left' ? this.leftPositions() : this.rightPositions();
    return (positions & (1 << index)) !== 0;
  }

  toggleCell(eye: Eye, index: number): void {
    const bit = 1 << index;
    // Paired mode mirrors every toggle to both eyes.
    if (this.mode() === 'paired') {
      const next = this.leftPositions() ^ bit;
      this.control.update({
        left: { positions: next, rotationDeg: this.leftRotation() },
        right: { positions: next, rotationDeg: this.rightRotation() },
      });
      return;
    }
    const cur = eye === 'left' ? this.leftPositions() : this.rightPositions();
    const field = {
      positions: cur ^ bit,
      rotationDeg: eye === 'left' ? this.leftRotation() : this.rightRotation(),
    };
    this.control.update(eye === 'left' ? { left: field } : { right: field });
  }

  onRotation(eye: Eye, value: string): void {
    const deg = Number(value);
    if (this.rotationLock()) {
      this.control.update({
        left: { positions: this.leftPositions(), rotationDeg: deg },
        right: { positions: this.rightPositions(), rotationDeg: deg },
      });
      return;
    }
    const field = {
      positions: eye === 'left' ? this.leftPositions() : this.rightPositions(),
      rotationDeg: deg,
    };
    this.control.update(eye === 'left' ? { left: field } : { right: field });
  }

  setRotationLock(on: boolean): void {
    this.rotationLock.set(on);
    if (on) {
      // Snap the left eye to the right eye's rotation when locking.
      this.control.update({
        left: { positions: this.leftPositions(), rotationDeg: this.rightRotation() },
      });
    }
  }

  onAperture(value: string): void {
    this.control.update({ aperture: Number(value) / 100 });
  }

  onEyeDistance(value: string): void {
    this.control.update({ eyeDistance: Number(value) / 100 });
  }

  onAbColor(value: string): void {
    const rgb = hexToRgb(value);
    if (rgb) this.control.update({ background: { color: rgb, hz: this.abHz() } });
  }

  onAbHz(value: string): void {
    this.control.update({ background: { color: this.abColor(), hz: Number(value) } });
  }

  stopAb(): void {
    this.control.update({ background: { color: this.abColor(), hz: 0 } });
  }

  // ---- KITT sweep handlers ----

  onSweepHz(value: string): void {
    this.control.update({
      sweep: { hz: Number(value), axis: this.sweepAxis(), range: this.sweepRangePct() / 100 },
    });
  }

  setSweepAxis(axis: SweepAxis): void {
    this.control.update({
      sweep: { hz: this.sweepHz(), axis, range: this.sweepRangePct() / 100 },
    });
  }

  onSweepRange(value: string): void {
    this.control.update({
      sweep: { hz: this.sweepHz(), axis: this.sweepAxis(), range: Number(value) / 100 },
    });
  }

  stopSweep(): void {
    this.control.update({ sweep: { hz: 0, axis: this.sweepAxis(), range: this.sweepRangePct() / 100 } });
  }
}
