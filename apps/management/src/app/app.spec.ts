import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from '@auth0/auth0-angular';
import { of } from 'rxjs';
import { App } from './app';

// Minimal AuthService stub: the controller is treated as unauthenticated and the
// token factory is never exercised in these unit tests. (Auth UI is gated on
// `isAuthConfigured`, which is false in local dev — incl. the jsdom test host
// `localhost` — so the controller is reachable without a tenant login.)
const authStub: Partial<AuthService> = {
  isLoading$: of(false),
  isAuthenticated$: of(false),
  user$: of(null),
  getAccessTokenSilently: (() => of('')) as unknown as AuthService['getAccessTokenSilently'],
};

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), { provide: AuthService, useValue: authStub }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('reaches the session CTA directly in local dev (Auth0 bypassed on localhost)', async () => {
    // On localhost (incl. the jsdom test host) `isAuthConfigured` is false, so the
    // controller is not gated behind login — the primary CTA is "Start session".
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Start session');
    expect(text).not.toContain('Log in');
  });

  it('moves locked channels together when one is dragged', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as {
      setLock(l: string): void;
      onChannel(c: string, v: string): void;
      control: { state(): { color: { r: number; g: number; b: number } } };
    };
    app.setLock('rg');
    app.onChannel('r', '128');
    const color = app.control.state().color;
    expect(color.r).toBe(128);
    expect(color.g).toBe(128);
    expect(color.b).toBe(0); // blue is unlocked and unchanged
  });

  it('gives a radiogroup a single tab stop and moves selection with arrow keys', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const group = (fixture.nativeElement as HTMLElement).querySelector(
      '[role="radiogroup"][aria-label="Theme"]',
    )!;
    const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
    // Theme defaults to "system" (first option): it is the lone tab stop.
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);

    radios[0].focus();
    radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    // Selection followed focus to the second option ("light").
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  it('classifies flicker risk by frequency band', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as {
      onFlicker(v: string): void;
      flickerRisk(): 'none' | 'caution' | 'high';
    };
    app.onFlicker('0');
    expect(app.flickerRisk()).toBe('none');
    app.onFlicker('8');
    expect(app.flickerRisk()).toBe('caution');
    app.onFlicker('20');
    expect(app.flickerRisk()).toBe('high');
  });

  it('toggles eye-grid cells as a bitmask, independently per eye in manual mode', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as {
      setMode(m: string): void;
      toggleCell(eye: 'left' | 'right', i: number): void;
      isCellOn(eye: 'left' | 'right', i: number): boolean;
      leftPositions(): number;
    };
    app.setMode('manual');
    app.toggleCell('left', 0); // center
    app.toggleCell('left', 3); // 3 o'clock
    expect(app.isCellOn('left', 0)).toBe(true);
    expect(app.isCellOn('left', 3)).toBe(true);
    expect(app.isCellOn('right', 3)).toBe(false); // right eye untouched
    expect(app.leftPositions()).toBe((1 << 0) | (1 << 3));

    app.toggleCell('left', 0); // toggling off clears just that bit
    expect(app.isCellOn('left', 0)).toBe(false);
    expect(app.isCellOn('left', 3)).toBe(true);
  });

  it('mirrors eye-grid toggles to both eyes in paired mode', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as {
      setMode(m: string): void;
      toggleCell(eye: 'left' | 'right', i: number): void;
      isCellOn(eye: 'left' | 'right', i: number): boolean;
    };
    app.setMode('paired');
    app.toggleCell('right', 6); // 6 o'clock, clicked on the right grid
    expect(app.isCellOn('right', 6)).toBe(true);
    expect(app.isCellOn('left', 6)).toBe(true); // mirrored to the left eye
  });

  it('fine-steps a channel by ±1, honoring the channel lock', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as {
      setPreset(rgb: { r: number; g: number; b: number }): void;
      setLock(l: string): void;
      stepChannel(c: string, d: number): void;
      control: { state(): { color: { r: number; g: number; b: number } } };
    };
    app.setPreset({ r: 100, g: 50, b: 10 });
    app.stepChannel('r', 1);
    expect(app.control.state().color.r).toBe(101);

    app.setLock('rg');
    app.stepChannel('r', -1); // both R and G move with the lock
    const color = app.control.state().color;
    expect(color.r).toBe(100);
    expect(color.g).toBe(100);
    expect(color.b).toBe(10); // blue unlocked
  });

  it('stashes and recalls colors in round-robin memory slots', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as {
      setPreset(rgb: { r: number; g: number; b: number }): void;
      saveColor(): void;
      recallSlot(i: number): void;
      memory(): readonly ({ r: number; g: number; b: number } | null)[];
      control: { state(): { color: { r: number; g: number; b: number } } };
    };
    app.setPreset({ r: 10, g: 20, b: 30 });
    app.saveColor(); // → slot 0
    app.setPreset({ r: 200, g: 0, b: 0 });
    expect(app.memory()[0]).toEqual({ r: 10, g: 20, b: 30 });
    expect(app.memory()[1]).toBeNull();

    app.recallSlot(0); // restores the stashed color
    expect(app.control.state().color).toEqual({ r: 10, g: 20, b: 30 });

    app.recallSlot(1); // empty slot is a no-op
    expect(app.control.state().color).toEqual({ r: 10, g: 20, b: 30 });
  });

  it('drives the KITT sweep and stops it without losing axis/range', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as {
      onSweepHz(v: string): void;
      setSweepAxis(a: 'x' | 'y'): void;
      onSweepRange(v: string): void;
      stopSweep(): void;
      sweeping(): boolean;
      sweepAxis(): 'x' | 'y';
      sweepRangePct(): number;
    };
    app.onSweepHz('2');
    app.setSweepAxis('y');
    app.onSweepRange('40');
    expect(app.sweeping()).toBe(true);
    expect(app.sweepAxis()).toBe('y');
    expect(app.sweepRangePct()).toBe(40);

    app.stopSweep(); // rate → 0, but axis/range persist for a quick restart
    expect(app.sweeping()).toBe(false);
    expect(app.sweepAxis()).toBe('y');
    expect(app.sweepRangePct()).toBe(40);
  });
});
