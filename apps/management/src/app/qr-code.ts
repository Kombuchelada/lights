import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { toCanvas } from 'qrcode';

/**
 * Renders {@link value} as a QR code into a `<canvas>`. Generated locally (no
 * network, no third-party image service) so a join URL is never leaked. Kept
 * high-contrast (black on white) for reliable phone-camera scanning regardless
 * of the surrounding theme.
 */
@Component({
  selector: 'app-qr',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #cv class="qr" role="img" [attr.aria-label]="'QR code linking to ' + value()"></canvas>`,
  styles: `
    .qr {
      width: 168px;
      height: 168px;
      border-radius: 10px;
      background: #fff;
      display: block;
    }
  `,
})
export class QrCode {
  /** Absolute join URL to encode. */
  readonly value = input<string>('');

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('cv');

  constructor() {
    effect(() => {
      const ref = this.canvasRef();
      const v = this.value();
      if (!ref || !v) return;
      void toCanvas(ref.nativeElement, v, {
        width: 168,
        margin: 1,
        color: { dark: '#000000ff', light: '#ffffffff' },
      }).catch(() => {
        /* rendering failures are non-fatal; the code text is shown alongside */
      });
    });
  }
}
