import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { CONTROL_HUB_PATH, HubEvents, HubMethods, type LightState } from '@lights/protocol';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface ClientHandlers {
  onState: (state: LightState) => void;
  onStatus: (status: ConnectionStatus, detail?: string) => void;
  onControllerLeft?: () => void;
  onSessionEnded?: (reason: string) => void;
}

/** Thin SignalR wrapper for the headset client: connect, join as "client", relay state. */
export class ClientConnection {
  private readonly conn: HubConnection;
  private code = '';

  /** Echo-back throttle: don't ack faster than this (the controller only needs the latest). */
  private readonly ackIntervalMs = 100;
  private lastAck = 0;
  private pendingAckTs = 0;
  private ackTimer?: ReturnType<typeof setTimeout>;

  constructor(apiBase: string, private readonly handlers: ClientHandlers) {
    this.conn = new HubConnectionBuilder()
      .withUrl(`${apiBase}${CONTROL_HUB_PATH}`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    this.conn.on(HubEvents.receiveState, (state: LightState) => this.handlers.onState(state));
    this.conn.on(HubEvents.controllerLeft, () => this.handlers.onControllerLeft?.());
    this.conn.on(HubEvents.sessionEnded, (reason: string) => this.handlers.onSessionEnded?.(reason));

    this.conn.onreconnecting(() => this.handlers.onStatus('reconnecting'));
    this.conn.onreconnected(() => {
      this.handlers.onStatus('connected');
      void this.rejoin();
    });
    this.conn.onclose((err) => this.handlers.onStatus('disconnected', err?.message));
  }

  async join(code: string): Promise<void> {
    this.code = code;
    this.handlers.onStatus('connecting');
    if (this.conn.state === HubConnectionState.Disconnected) {
      await this.conn.start();
    }
    await this.rejoin();
    this.handlers.onStatus('connected');
  }

  private async rejoin(): Promise<void> {
    if (this.code) {
      await this.conn.invoke(HubMethods.joinSession, this.code, 'client');
    }
  }

  /**
   * Confirm to the controller (via the server) that we rendered the state
   * stamped `ts` — echo-back delivery confirmation. Throttled with a trailing
   * edge so the controller always learns about the most recent frame without
   * one ack per state at the controller's ~20 msg/s.
   */
  ackRendered(ts?: number): void {
    if (!ts) return;
    this.pendingAckTs = ts;
    const elapsed = Date.now() - this.lastAck;
    if (elapsed >= this.ackIntervalMs) {
      this.flushAck();
      return;
    }
    clearTimeout(this.ackTimer);
    this.ackTimer = setTimeout(() => this.flushAck(), this.ackIntervalMs - elapsed);
  }

  private flushAck(): void {
    if (this.conn.state !== HubConnectionState.Connected || !this.pendingAckTs) return;
    this.lastAck = Date.now();
    const ts = this.pendingAckTs;
    this.pendingAckTs = 0;
    void this.conn.invoke(HubMethods.ackState, ts).catch(() => undefined);
  }
}
