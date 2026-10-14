/**
 * Minimal client for the eWeLink CUBE Open API v2.
 *
 * Plain `fetch`, no platform dependencies, so it runs in the app, on the web
 * and under Node for spikes and tests. Transport for the event stream lives in
 * `sse.ts` because it differs per platform.
 */

import { subscribe, type EventHandler, type StreamStatus, type Subscription } from './sse';
import type { ApiEnvelope, BridgeInfo, Device, DeviceState, SecurityMode } from './types';

export class CubeError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'CubeError';
  }
}

export class CubeAuthError extends CubeError {
  constructor(message = 'not authorised') {
    super(message, 401, 401);
    this.name = 'CubeAuthError';
  }
}

export interface CubeClientOptions {
  /** Base URL of the gateway, e.g. `http://192.168.68.55` or a VPN/remote-link address. */
  baseUrl: string;
  token?: string;
  /** Shown to the user in the gateway's "Allow access token" dialog. */
  appName?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class CubeClient {
  readonly baseUrl: string;
  readonly appName: string;
  token: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: CubeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.appName = options.appName ?? 'Butter';
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  get apiBase(): string {
    return `${this.baseUrl}/open-api/v2/rest`;
  }

  get sseUrl(): string {
    if (!this.token) throw new CubeAuthError('no token');
    return `${this.baseUrl}/open-api/v2/sse/bridge?access_token=${encodeURIComponent(this.token)}`;
  }

  // ----- gateway -------------------------------------------------------------

  /** Unauthenticated: identifies the gateway (name, firmware, ip). Good as a "is this a hub?" probe. */
  async bridgeInfo(): Promise<BridgeInfo> {
    return this.request<BridgeInfo>('GET', '/bridge', { auth: false });
  }

  /**
   * One attempt at the token endpoint. Returns the token only inside the window
   * after the user pressed Allow on the gateway; otherwise `undefined`.
   */
  async tryGetToken(): Promise<string | undefined> {
    const url = `${this.apiBase}/bridge/access_token?app_name=${encodeURIComponent(this.appName)}`;
    const res = await this.fetchImpl(url, { signal: this.signal() });
    const body = (await res.json()) as ApiEnvelope<{ token?: string }>;
    if (body.error === 0 && body.data?.token) {
      this.token = body.data.token;
      return this.token;
    }
    return undefined;
  }

  /** Poll for the token until the user approves or `timeoutMs` passes. */
  async waitForToken(timeoutMs = 300_000, intervalMs = 2_000, onAttempt?: (n: number) => void): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    let attempt = 0;
    while (Date.now() < deadline) {
      attempt += 1;
      onAttempt?.(attempt);
      try {
        const token = await this.tryGetToken();
        if (token) return token;
      } catch {
        // gateway unreachable for a moment; keep polling
      }
      await sleep(intervalMs);
    }
    throw new CubeError('timed out waiting for the gateway token');
  }

  // ----- devices ---------------------------------------------------------------

  async listDevices(): Promise<Device[]> {
    const data = await this.request<{ device_list: Device[] }>('GET', '/devices');
    return data.device_list;
  }

  /** Send a state fragment in CUBE format, e.g. `{ power: { powerState: 'on' } }`. */
  async setState(serial: string, state: DeviceState): Promise<void> {
    await this.request('PUT', `/devices/${encodeURIComponent(serial)}`, { body: { state } });
  }

  async renameDevice(serial: string, name: string): Promise<void> {
    await this.request('PUT', `/devices/${encodeURIComponent(serial)}`, { body: { name } });
  }

  /** Tags are free-form and persist on the hub; Butter keeps room assignments here. */
  async setTags(serial: string, tags: Record<string, unknown>): Promise<void> {
    await this.request('PUT', `/devices/${encodeURIComponent(serial)}`, { body: { tags } });
  }

  async deleteDevice(serial: string): Promise<void> {
    await this.request('DELETE', `/devices/${encodeURIComponent(serial)}`);
  }

  // ----- security ----------------------------------------------------------------

  async listSecurityModes(): Promise<SecurityMode[]> {
    const data = await this.request<{ security_list: SecurityMode[] }>('GET', '/security');
    return data.security_list;
  }

  async enableSecurityMode(sid: number): Promise<void> {
    await this.request('PUT', `/security/${sid}/enable`);
  }

  async disableSecurityMode(sid: number): Promise<void> {
    await this.request('PUT', `/security/${sid}/disable`);
  }

  async disarm(): Promise<void> {
    await this.request('PUT', '/security/disable');
  }

  // ----- events ------------------------------------------------------------------------

  /** Live state changes from the gateway; see `sse.ts` / `sse.native.ts` for the transport. */
  subscribe(onEvent: EventHandler, onStatus?: (status: StreamStatus, detail?: string) => void): Subscription {
    return subscribe(this.sseUrl, onEvent, { fetch: this.fetchImpl, onStatus });
  }

  // ----- plumbing ------------------------------------------------------------------

  private async request<T>(
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    path: string,
    options: { body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.auth !== false) {
      if (!this.token) throw new CubeAuthError('no token');
      headers.Authorization = `Bearer ${this.token}`;
    }
    const res = await this.fetchImpl(`${this.apiBase}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: this.signal(),
    });
    if (res.status === 401) throw new CubeAuthError('token rejected');
    let body: ApiEnvelope<T>;
    try {
      body = (await res.json()) as ApiEnvelope<T>;
    } catch {
      throw new CubeError(`gateway answered ${res.status} without JSON`, undefined, res.status);
    }
    if (body.error === 401) throw new CubeAuthError(body.message);
    if (body.error !== 0) throw new CubeError(body.message || `gateway error ${body.error}`, body.error, res.status);
    return body.data;
  }

  private signal(): AbortSignal | undefined {
    return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(this.timeoutMs) : undefined;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
