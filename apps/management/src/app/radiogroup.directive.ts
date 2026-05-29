import {
  AfterViewInit,
  Directive,
  ElementRef,
  OnDestroy,
  inject,
} from '@angular/core';

/**
 * Implements the WAI-ARIA radiogroup keyboard pattern for an element marked
 * `role="radiogroup"` whose children carry `role="radio"`.
 *
 * Native focus order would make every radio a tab stop; the ARIA pattern
 * instead wants a single tab stop (the checked radio) and arrow keys to move
 * *and* select within the group. This directive supplies both:
 *
 * - **Roving tabindex** — the checked radio gets `tabindex=0`, the rest `-1`.
 *   It re-derives this whenever `aria-checked` changes (the template binds it to
 *   a signal), so it stays correct as the selection updates.
 * - **Arrow / Home / End** — move focus to the adjacent radio and activate it.
 *   Selection follows focus, so a `click()` drives the component's existing
 *   handler, keeping the directive ignorant of the model.
 */
@Directive({
  selector: '[role="radiogroup"]',
})
export class RovingRadiogroup implements AfterViewInit, OnDestroy {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private observer?: MutationObserver;

  ngAfterViewInit(): void {
    this.host.addEventListener('keydown', this.onKeydown);
    this.syncTabindex();
    // Re-derive the single tab stop when the selection (aria-checked) changes.
    this.observer = new MutationObserver(() => this.syncTabindex());
    this.observer.observe(this.host, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-checked'],
    });
  }

  ngOnDestroy(): void {
    this.host.removeEventListener('keydown', this.onKeydown);
    this.observer?.disconnect();
  }

  private radios(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>('[role="radio"]'));
  }

  /** Checked radio is the lone tab stop; if none is checked, the first is. */
  private syncTabindex(): void {
    const radios = this.radios();
    const checked = radios.findIndex((r) => r.getAttribute('aria-checked') === 'true');
    const stop = checked === -1 ? 0 : checked;
    radios.forEach((r, i) => r.setAttribute('tabindex', i === stop ? '0' : '-1'));
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    const radios = this.radios();
    const current = radios.indexOf(document.activeElement as HTMLElement);
    if (current === -1) return;

    let next = current;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (current + 1) % radios.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (current - 1 + radios.length) % radios.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = radios.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    radios[next].focus();
    radios[next].click(); // selection follows focus, per the radio pattern
  };
}
