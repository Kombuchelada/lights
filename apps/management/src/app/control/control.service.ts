import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';
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
  type StateRendered,
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

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private conn?: HubConnection;
  private lastSent = 0;
  private trailing?: ReturnType<typeof setTimeout>;

  readonly status = signal<ConnStatus>('idle');
  readonly clientConnected = signal(false);
  readonly session = signal<CreateSessionResponse | null>(null);
  readonly state = signal<LightState>(defaultLightState());

  /** Echo-back: `ts` of the last state we sent, and the last one the client confirmed rendering. */
  readonly lastSentTs = signal(0);
  readonly lastRenderedTs = signal(0);
  /** Round-trip time (ms) of the last confirmed frame: controller → server → client → back. */
  readonly roundTripMs = signal(0);

  async startSession(): Promise<void> {
    this.status.set('connecting');
    try {
      // Via HttpClient so the Auth0 interceptor attaches the access token; the
      // server requires an authenticated clinician to create a session.
      const session = await firstValueFrom(
        this.http.post<CreateSessionResponse>(`${this.apiBase}/api/sessions`, {}),
      );
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
      .withUrl(`${this.apiBase}${CONTROL_HUB_PATH}`, {
        // The controller authenticates to the hub; the token rides in the query
        // string on the WebSocket handshake (the server reads it for /hubs/*).
        accessTokenFactory: () => firstValueFrom(this.auth.getAccessTokenSilently()),
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    this.conn = conn;

    conn.on(HubEvents.clientJoined, () => {
      this.clientConnected.set(true);
      void this.pushState(); // resync the freshly joined client
    });
    conn.on(HubEvents.clientLeft, () => {
      this.clientConnected.set(false);
      this.lastRenderedTs.set(0); // no headset to confirm renders anymore
    });

    // Echo-back: the client confirms it rendered a frame (round-trip latency).
    conn.on(HubEvents.stateRendered, (payload: StateRendered) => {
      const ts = payload?.ts ?? 0;
      if (ts <= this.lastRenderedTs()) return; // ignore stale/out-of-order acks
      this.lastRenderedTs.set(ts);
      this.roundTripMs.set(Math.max(0, Date.now() - ts));
    });

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
    const ts = Date.now();
    this.lastSentTs.set(ts);
    try {
      await this.conn.invoke(HubMethods.sendState, { ...this.state(), ts });
    } catch {
      /* transient send failures are recovered by the next update */
    }
  }
}
