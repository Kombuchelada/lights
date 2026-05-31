import { Injectable, computed, effect, signal } from '@angular/core';

/** User-selectable theme. `system` follows the OS `prefers-color-scheme`. */
export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'lumessa.theme';

/**
 * Signal-driven theming. Persists the chosen {@link ThemeMode}, tracks the OS
 * preference, and reflects the *effective* theme onto `<html data-theme>` +
 * `color-scheme` so global tokens (in `styles.scss`) and the component tree
 * restyle instantly. Defaults to `system`, per the product requirement.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.load());

  /** Tracks the OS dark-mode preference (only meaningful while mode = system). */
  private readonly systemDark = signal(false);

  /** The concrete theme actually applied: `system` resolved to light/dark. */
  readonly effective = computed<'light' | 'dark'>(() => {
    const mode = this.mode();
    if (mode === 'system') return this.systemDark() ? 'dark' : 'light';
    return mode;
  });

  constructor() {
    // Track the OS preference. Guarded + try/catch because some non-browser
    // environments (e.g. the jsdom test runner) expose a non-functional
    // `matchMedia`; if it's unavailable we simply default to light.
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        this.systemDark.set(mq.matches);
        mq.addEventListener?.('change', (e) => this.systemDark.set(e.matches));
      }
    } catch {
      /* matchMedia unavailable — `system` falls back to light */
    }

    // Reflect the effective theme onto the document.
    effect(() => {
      const eff = this.effective();
      if (typeof document !== 'undefined') {
        document.documentElement.dataset['theme'] = eff;
        document.documentElement.style.colorScheme = eff;
      }
    });

    // Persist the user's choice.
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, this.mode());
      } catch {
        /* storage may be unavailable (private mode); theme still works in-session */
      }
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private load(): ThemeMode {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {
      /* ignore */
    }
    return 'system';
  }
}
