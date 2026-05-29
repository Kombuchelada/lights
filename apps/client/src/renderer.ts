import {
  defaultLightState,
  sanitizeLightState,
  eyeGridOffset,
  isEyeBitSet,
  EYE_GRID_CELLS,
  type LightState,
} from '@lights/protocol';

/**
 * Pure-black canvas renderer. Draws the light as a filled circle whose alpha is
 * the brightness. Flicker is animated locally with requestAnimationFrame from the
 * state's `flickerHz` — we never receive one message per flash. Redraws happen
 * only when the state changes or while animating, to spare battery in a headset.
 *
 * v2 adds two things, both still rendered locally from state:
 *  - **Stereo (dual-pane)** modes split the canvas into left/right panes and draw
 *    a dot at each lit cell of the per-eye 13-cell clock grid (with aperture =
 *    dot size, eye-distance = pane offset, and per-eye rotation of the pattern).
 *  - **A/B background** alternates the backdrop between black and a second color;
 *    like flicker, any alternation is gated behind the photosensitivity consent.
 *  - **KITT sweep** oscillates the light's position back and forth (movement, not
 *    a flash), animated locally and paused when the viewer prefers reduced motion.
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private state: LightState = sanitizeLightState(defaultLightState());
  private flickerConsented = false;

  /** Honour the OS "reduce motion" setting by holding the sweep still. */
  private reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private dirty = true;
  private visible = true;

  /** A/B background alternation phase: true = show color, false = show black. */
  private bgVisible = true;
  private lastToggle = 0;
  private lastBgToggle = 0;
  private rafId = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas is not supported in this browser.');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', this.resize);
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  /** Replace the rendered state — the server sends the full state on each update. */
  setState(next: LightState): void {
    this.state = sanitizeLightState(next);
    this.dirty = true;
  }

  /** When false (the default), the render stays steady regardless of flickerHz / A/B. */
  setFlickerConsent(consented: boolean): void {
    this.flickerConsented = consented;
    this.dirty = true;
  }

  /** Whether the current state would flash (flicker or alternating A/B) — used to prompt for consent. */
  get wantsFlicker(): boolean {
    return this.state.flickerHz > 0 || (this.state.background?.hz ?? 0) > 0;
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.resize);
  }

  private readonly resize = (): void => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.dirty = true;
  };

  private loop(now: number): void {
    const s = this.state;
    const consent = this.flickerConsented;
    const flickering = consent && s.flickerHz > 0;
    const abHz = s.background?.hz ?? 0;
    const alternatingBg = consent && abHz > 0;
    let changed = this.dirty;

    // KITT sweep is continuous motion: redraw every frame while it runs.
    if (this.sweeping()) changed = true;

    // Light on/off flicker.
    if (flickering) {
      const halfPeriodMs = 1000 / (s.flickerHz * 2);
      if (now - this.lastToggle >= halfPeriodMs) {
        this.visible = !this.visible;
        this.lastToggle = now;
        changed = true;
      }
    } else if (!this.visible) {
      this.visible = true; // restore to steady-on once flicker stops
      changed = true;
    }

    // A/B background alternation (independent rate from the light flicker).
    if (alternatingBg) {
      const halfPeriodMs = 1000 / (abHz * 2);
      if (now - this.lastBgToggle >= halfPeriodMs) {
        this.bgVisible = !this.bgVisible;
        this.lastBgToggle = now;
        changed = true;
      }
    } else if (!this.bgVisible) {
      this.bgVisible = true;
      changed = true;
    }

    if (changed) {
      this.draw();
      this.dirty = false;
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /** Current backdrop color: black, a steady A/B color, or the A/B "on" phase. */
  private backgroundCss(): string {
    const bg = this.state.background;
    if (!bg) return '#000';
    // Alternating only happens with consent; the "off" phase is black.
    if (bg.hz > 0 && this.flickerConsented && !this.bgVisible) return '#000';
    return `rgb(${bg.color.r}, ${bg.color.g}, ${bg.color.b})`;
  }

  /** Whether the KITT sweep is currently animating (on, and motion is allowed). */
  private sweeping(): boolean {
    return !this.reducedMotion && (this.state.sweep?.hz ?? 0) > 0;
  }

  /**
   * The light's effective normalised center, factoring the KITT sweep. The sweep
   * oscillates one axis sinusoidally around the base `shape` position; with the
   * sweep off (or reduced motion) this is just the base position.
   */
  private sweptCenter(): { x: number; y: number } {
    const s = this.state;
    let { x, y } = s.shape;
    if (this.sweeping() && s.sweep) {
      const offset = s.sweep.range * Math.sin((performance.now() / 1000) * s.sweep.hz * 2 * Math.PI);
      if (s.sweep.axis === 'y') y = Math.min(1, Math.max(0, y + offset));
      else x = Math.min(1, Math.max(0, x + offset));
    }
    return { x, y };
  }

  private draw(): void {
    const { ctx, canvas } = this;
    const s = this.state;
    const w = canvas.width;
    const h = canvas.height;

    ctx.globalAlpha = 1;
    ctx.fillStyle = this.backgroundCss();
    ctx.fillRect(0, 0, w, h);

    if (!this.visible || s.brightness <= 0) return;

    const center = this.sweptCenter();

    if ((s.mode ?? 'mono') === 'mono') {
      const radiusPx = s.shape.radius * (Math.min(w, h) / 2);
      this.drawDot(center.x * w, center.y * h, radiusPx);
    } else {
      this.drawStereo(w, h, center);
    }
  }

  /** Dual-pane render: left/right halves, each showing its eye's lit grid dots. */
  private drawStereo(w: number, h: number, center: { x: number; y: number }): void {
    const s = this.state;
    const paneW = w / 2;
    const shorter = Math.min(paneW, h);
    const ring = s.shape.radius * (shorter / 2);
    const dotR = (s.aperture ?? 0.12) * (shorter / 2);
    if (dotR <= 0) return;

    const edist = (s.eyeDistance ?? 0) * (paneW / 2);
    const offX = (center.x - 0.5) * paneW;
    const offY = (center.y - 0.5) * h;
    const cy = h / 2 + offY;

    // Left pane shifts left, right pane right (positive eye-distance = divergence).
    this.drawPane(0 + paneW / 2 + offX - edist, cy, ring, dotR, s.left?.positions ?? 0, s.left?.rotationDeg ?? 0);
    this.drawPane(paneW + paneW / 2 + offX + edist, cy, ring, dotR, s.right?.positions ?? 0, s.right?.rotationDeg ?? 0);
  }

  private drawPane(
    cx: number,
    cy: number,
    ring: number,
    dotR: number,
    positions: number,
    rotationDeg: number,
  ): void {
    if (positions === 0) return;
    for (let i = 0; i < EYE_GRID_CELLS; i++) {
      if (!isEyeBitSet(positions, i)) continue;
      const { dx, dy } = eyeGridOffset(i, ring, rotationDeg);
      this.drawDot(cx + dx, cy + dy, dotR);
    }
  }

  /** Filled circle in the current color, brightness as alpha. */
  private drawDot(cx: number, cy: number, r: number): void {
    if (r <= 0) return;
    const { ctx } = this;
    const s = this.state;
    ctx.globalAlpha = s.brightness;
    ctx.fillStyle = `rgb(${s.color.r}, ${s.color.g}, ${s.color.b})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
