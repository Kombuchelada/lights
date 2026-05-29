import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show the start-session call to action initially', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Start session');
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
});
