import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Stroke-icon paths on a 24×24 grid. Drawn as single `d` strings (circles and
 * rounded rects expressed as arcs) so one `<path>` renders any icon.
 */
const ICONS = {
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  camera:
    'M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z ' +
    'M8.5 13a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0',
  check: 'M20 6 9 17l-5-5',
  chevron: 'm6 9 6 6 6-6',
  hash: 'M4 9h16 M4 15h16 M10 3 8 21 M16 3l-2 18',
  link:
    'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5 ' +
    'M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5',
  lock: 'M6 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z M8 11V7a4 4 0 0 1 8 0v4',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M2 6l10 7 10-7',
  monitor: 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M8 21h8 M12 17v4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  plus: 'M12 5v14 M5 12h14',
  rows: 'M4 6h16 M4 10h16 M4 14h16 M4 18h16',
  size: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  sun:
    'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 ' +
    'M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  sweep: 'M2 12h20 M6 8l-4 4 4 4 M18 8l4 4-4 4',
  wave: 'M2 12c1.7-5 3.3-5 5 0s3.3 5 5 0 3.3-5 5 0 3.3 5 5 0',
} as const;

export type IconName = keyof typeof ICONS;

/**
 * Decorative inline SVG icon, sized to the surrounding text (1em) and colored
 * with `currentColor`. Always `aria-hidden` — the accessible name belongs on the
 * labelled control, never on the glyph.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" focusable="false">
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      width: 1em;
      height: 1em;
      vertical-align: -0.125em;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly path = computed(() => ICONS[this.name()]);
}
