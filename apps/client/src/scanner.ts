// jsQR is only needed as the fallback decoder (no native BarcodeDetector), and
// only once scanning starts — load it lazily so it stays out of the startup
// bundle (and off Android Chrome, which uses BarcodeDetector instead).
type JsQr = (typeof import('jsqr'))['default'];
let jsQrPromise: Promise<JsQr> | null = null;
const loadJsQr = (): Promise<JsQr> => (jsQrPromise ??= import('jsqr').then((m) => m.default));

/**
 * Camera-based QR scanner for the join screen. Opens the rear camera, decodes
 * frames, and reports the first QR payload it finds. Used so a client installed
 * as a PWA (no browser address bar to paste a `?code=` link into) can still join
 * by pointing at the controller's QR code.
 *
 * Decoding prefers the native `BarcodeDetector` where present (Android Chrome);
 * otherwise it falls back to jsQR over canvas pixels (covers iOS Safari, which
 * has no BarcodeDetector). Requires a secure context — `getUserMedia` is
 * unavailable on plain-HTTP origins (see docs/testing.md).
 */
export class QrScanner {
  private stream: MediaStream | null = null;
  private raf = 0;
  private running = false;
  private detector: { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> } | null =
    null;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const Detector = (globalThis as Record<string, unknown>)['BarcodeDetector'] as
      | (new (opts: { formats: string[] }) => {
          detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
        })
      | undefined;
    if (Detector) {
      try {
        this.detector = new Detector({ formats: ['qr_code'] });
      } catch {
        this.detector = null; // construction can throw if the format is unsupported
      }
    }
  }

  static get supported(): boolean {
    return !!navigator.mediaDevices?.getUserMedia;
  }

  /** Open the camera and scan until a QR is found; resolves with its payload. */
  async scan(): Promise<string> {
    if (!QrScanner.supported) {
      throw new Error('Camera access is not available on this device or origin.');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    this.video.srcObject = this.stream;
    this.video.setAttribute('playsinline', 'true'); // keep inline on iOS
    this.video.muted = true;
    await this.video.play();
    this.running = true;

    return new Promise<string>((resolve, reject) => {
      const tick = async (): Promise<void> => {
        if (!this.running) return;
        try {
          const value = await this.decodeFrame();
          if (value) {
            this.stop();
            resolve(value);
            return;
          }
        } catch (err) {
          this.stop();
          reject(err instanceof Error ? err : new Error('Scan failed'));
          return;
        }
        this.raf = requestAnimationFrame(() => void tick());
      };
      this.raf = requestAnimationFrame(() => void tick());
    });
  }

  /** Stop the camera and the scan loop. Safe to call more than once. */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  private async decodeFrame(): Promise<string | null> {
    if (this.video.readyState < this.video.HAVE_ENOUGH_DATA) return null;
    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    if (!w || !h) return null;

    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.drawImage(this.video, 0, 0, w, h);

    if (this.detector) {
      const codes = await this.detector.detect(this.canvas);
      return codes[0]?.rawValue ?? null;
    }

    const { data } = this.ctx.getImageData(0, 0, w, h);
    const jsQR = await loadJsQr();
    const result = jsQR(data, w, h, { inversionAttempts: 'dontInvert' });
    return result?.data ?? null;
  }
}

/**
 * Pull a session code out of a scanned QR payload. The controller's QR encodes
 * the full join URL (`https://…/?code=ABC123`); also accept a bare code so a
 * code-only QR works. Returns the raw token — the server normalises it.
 */
export function codeFromScan(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const code = new URL(trimmed).searchParams.get('code');
    if (code) return code;
  } catch {
    /* not a URL — fall through to treat the payload as a bare code */
  }
  return trimmed;
}
