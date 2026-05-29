import { Injectable, signal } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import {
  CONTROL_HUB_PATH,
  HubEvents,
  HubMethods,
  defaultLightState,
  sanitizeLightState,
  type CreateSessionResponse,
  type LightState,
} from '@lights/protocol';

export type ConnStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

/**
 * Controller-side realtime service. Creates a session over REST, joins the
 * SignalR hub as the controller, and relays the working {@link LightState}
 * (throttled). Exposes everything the UI needs as signals — a natural fit for
 * zoneless change detection.
 */
@Injectable({ providedIn: 'root' })
export class ControlService {
  /** Same-origin in dev; the Angular dev-server proxies /api and /hubs to the backend. */
  private readonly apiBase = '';
  private readonly minIntervalMs = 50;

  private conn?: HubConnection;
  private lastSent = 0;
  private trailing?: ReturnType<typeof setTimeout>;

  readonly status = signal<ConnStatus>('idle');
  readonly clientConnected = signal(false);
  readonly session = signal<CreateSessionResponse | null>(null);
  readonly state = signal<LightState>(defaultLightState());

  async startSession(): Promise<void> {
    this.status.set('connecting');
    try {
      const res = await fetch(`${this.apiBase}/api/sessions`, { method: 'POST' });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const session = (await res.json()) as CreateSessionResponse;
      this.session.set(session);
      await this.connect(session.code);
    } catch (err) {
      this.status.set('disconnected');
      throw err;
    }
  }

  /** Merge a partial update into the working state and relay it (throttled). */
  update(patch: Partial<LightState>): void {
    const next = sanitizeLightState({ ...this.state(), ...patch });
    this.state.set(next);
    this.scheduleSend();
  }

  private async connect(code: string): Promise<void> {
    const conn = new HubConnectionBuilder()
      .withUrl(`${this.apiBase}${CONTROL_HUB_PATH}`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    this.conn = conn;

    conn.on(HubEvents.clientJoined, () => {
      this.clientConnected.set(true);
      void this.pushState(); // resync the freshly joined client
    });
    conn.on(HubEvents.clientLeft, () => this.clientConnected.set(false));

    conn.onreconnecting(() => this.status.set('reconnecting'));
    conn.onreconnected(async () => {
      await conn.invoke(HubMethods.joinSession, code, 'controller');
      this.status.set('connected');
    });
    conn.onclose(() => this.status.set('disconnected'));

    await conn.start();
    await conn.invoke(HubMethods.joinSession, code, 'controller');
    this.status.set('connected');
  }

  private scheduleSend(): void {
    const now = Date.now();
    const elapsed = now - this.lastSent;
    if (elapsed >= this.minIntervalMs) {
      this.lastSent = now;
      void this.pushState();
      return;
    }
    clearTimeout(this.trailing);
    this.trailing = setTimeout(() => {
      this.lastSent = Date.now();
      void this.pushState();
    }, this.minIntervalMs - elapsed);
  }

  private async pushState(): Promise<void> {
    if (this.conn?.state !== HubConnectionState.Connected) return;
    try {
      await this.conn.invoke(HubMethods.sendState, { ...this.state(), ts: Date.now() });
    } catch {
      /* transient send failures are recovered by the next update */
    }
  }
}
