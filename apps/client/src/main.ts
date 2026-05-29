import './styles.css';
import { ClientConnection, type ConnectionStatus } from './connection';
import { Renderer } from './renderer';
import { QrScanner, codeFromScan } from './scanner';
import type { LightState } from '@lights/protocol';

const apiBase = (import.meta.env.VITE_API_BASE ?? '').toString();

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;
const consentOverlay = document.getElementById('consent') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const form = document.getElementById('join-form') as HTMLFormElement;
const codeInput = document.getElementById('code') as HTMLInputElement;
const acceptBtn = document.getElementById('consent-accept') as HTMLButtonElement;
const declineBtn = document.getElementById('consent-decline') as HTMLButtonElement;

const resumeBtn = document.getElementById('resume') as HTMLButtonElement;
const reloadBtn = document.getElementById('reload') as HTMLButtonElement;
const scanBtn = document.getElementById('scan') as HTMLButtonElement;
const scannerOverlay = document.getElementById('scanner') as HTMLDivElement;
const scannerVideo = document.getElementById('scanner-video') as HTMLVideoElement;
const scannerCanvas = document.getElementById('scanner-canvas') as HTMLCanvasElement;
const scannerStatus = document.getElementById('scanner-status') as HTMLParagraphElement;
const scannerCancel = document.getElementById('scanner-cancel') as HTMLButtonElement;

const renderer = new Renderer(canvas);

let flickerConsent = false;
let consentAsked = false;
let connStatus: ConnectionStatus = 'idle';

/** Bring back the join overlay (e.g. on a drop, or summoned by long-press). */
function showJoinOverlay(message?: string): void {
  overlay.classList.remove('hidden');
  // "Resume" only makes sense when the hub link is still up behind the overlay.
  resumeBtn.hidden = connStatus !== 'connected';
  if (message) setStatus(message);
  codeInput.focus();
}

const statusText: Record<ConnectionStatus, string> = {
  idle: 'Enter the session code from the controller.',
  connecting: 'Connecting…',
  connected: 'Connected.',
  reconnecting: 'Connection lost — reconnecting…',
  disconnected: 'Disconnected.',
};

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function maybePromptConsent(state: LightState): void {
  const wantsFlash = state.flickerHz > 0 || (state.background?.hz ?? 0) > 0;
  if (wantsFlash && !flickerConsent && !consentAsked) {
    consentAsked = true;
    consentOverlay.classList.remove('hidden');
    // Move focus into the modal, landing on the safe (no-flicker) default so a
    // keyboard/AT user can't accidentally enable flicker by hitting Enter.
    declineBtn.focus();
  }
}

const connection = new ClientConnection(apiBase, {
  onState: (state) => {
    renderer.setState(state);
    maybePromptConsent(state);
  },
  onStatus: (status, detail) => {
    connStatus = status;
    if (status === 'connected') overlay.classList.add('hidden');
    setStatus(detail ? `${statusText[status]} (${detail})` : statusText[status]);
  },
  // The controller leaving leaves the client on a now-static frame with no UI;
  // surface the join screen so it can rejoin or enter a new code (not stuck).
  onControllerLeft: () => showJoinOverlay('Controller disconnected. Enter a code or scan to rejoin.'),
  onSessionEnded: (reason) => showJoinOverlay(`Session ended: ${reason}`),
});

async function connect(code: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  try {
    await connection.join(normalized);
  } catch (err) {
    setStatus(`Could not join: ${(err as Error)?.message ?? 'unknown error'}`);
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void connect(codeInput.value);
});

// --- QR scanning -----------------------------------------------------------
// Lets an installed PWA join by camera (no address bar to open a `?code=` link).
const scanner = new QrScanner(scannerVideo, scannerCanvas);

function closeScanner(): void {
  scanner.stop();
  scannerOverlay.classList.add('hidden');
}

async function startScan(): Promise<void> {
  scannerStatus.textContent = "Point the camera at the controller's QR code.";
  scannerOverlay.classList.remove('hidden');
  scannerCancel.focus();
  try {
    const payload = await scanner.scan();
    const code = codeFromScan(payload);
    closeScanner();
    if (code) {
      codeInput.value = code.trim().toUpperCase();
      void connect(code);
    } else {
      setStatus('That QR code did not contain a session code.');
    }
  } catch (err) {
    closeScanner();
    const message = (err as Error)?.name === 'NotAllowedError'
      ? 'Camera permission was denied. Enter the code instead.'
      : `Could not scan: ${(err as Error)?.message ?? 'unknown error'}`;
    setStatus(message);
  }
}

// Camera scanning needs getUserMedia (a secure context); reveal the button only
// when it's actually available, otherwise the manual code entry stands alone.
if (QrScanner.supported) {
  scanBtn.hidden = false;
  scanBtn.addEventListener('click', () => void startScan());
}

scannerCancel.addEventListener('click', closeScanner);

// Dismiss the summoned overlay and return to the live stimulus.
resumeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
// Hard refresh — the reliable escape hatch in a standalone PWA (no address bar).
reloadBtn.addEventListener('click', () => location.reload());

acceptBtn.addEventListener('click', () => {
  flickerConsent = true;
  renderer.setFlickerConsent(true);
  consentOverlay.classList.add('hidden');
});

declineBtn.addEventListener('click', () => {
  flickerConsent = false;
  renderer.setFlickerConsent(false);
  consentOverlay.classList.add('hidden');
});

// Escape closes whichever modal is open: declines consent (the safe default)
// or cancels an in-progress scan.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!consentOverlay.classList.contains('hidden')) {
    declineBtn.click();
  } else if (!scannerOverlay.classList.contains('hidden')) {
    closeScanner();
  }
});

// Default: never auto-enable flicker (consent gate handles it explicitly).
renderer.setFlickerConsent(false);

// Tap to go full-screen and keep the screen awake (both best-effort).
let wakeLock: { release: () => Promise<void> } | null = null;
async function requestWakeLock(): Promise<void> {
  try {
    const nav = navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (nav.wakeLock && wakeLock === null) {
      wakeLock = await nav.wakeLock.request('screen');
    }
  } catch {
    /* wake lock is optional */
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void requestWakeLock();
});

// Tap = full-screen + wake lock. Press-and-hold = summon the join overlay (the
// escape hatch for a standalone PWA, where there's no browser UI to reload).
const LONG_PRESS_MS = 700;
const MOVE_TOLERANCE_PX = 12;
let pressTimer: ReturnType<typeof setTimeout> | undefined;
let pressOrigin: { x: number; y: number } | null = null;
let longPressFired = false;

function cancelPress(): void {
  clearTimeout(pressTimer);
  pressOrigin = null;
}

canvas.addEventListener('pointerdown', (event) => {
  if (!overlay.classList.contains('hidden')) return; // overlay already open
  longPressFired = false;
  pressOrigin = { x: event.clientX, y: event.clientY };
  pressTimer = setTimeout(() => {
    longPressFired = true;
    showJoinOverlay();
  }, LONG_PRESS_MS);
});

canvas.addEventListener('pointermove', (event) => {
  if (!pressOrigin) return;
  if (Math.hypot(event.clientX - pressOrigin.x, event.clientY - pressOrigin.y) > MOVE_TOLERANCE_PX) {
    cancelPress();
  }
});
canvas.addEventListener('pointerup', cancelPress);
canvas.addEventListener('pointercancel', cancelPress);

canvas.addEventListener('click', () => {
  if (longPressFired) {
    longPressFired = false; // the hold already opened the overlay; skip full-screen
    return;
  }
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    void document.documentElement.requestFullscreen().catch(() => undefined);
  }
  void requestWakeLock();
});

// Auto-join when a code arrives via the URL (e.g. from scanning the QR).
const urlCode = new URLSearchParams(window.location.search).get('code');
if (urlCode) {
  codeInput.value = urlCode.toUpperCase();
  void connect(urlCode);
}

// Register the service worker for PWA install/offline (no-op on insecure origins).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
