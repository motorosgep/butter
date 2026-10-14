/**
 * Client for the history recorder that ships with the ihost-bridge add-on.
 *
 * The gateway keeps sensor history for its own console only, so the add-on
 * records readings from the gateway's event stream and serves them next to the
 * hub, on port 9900 by default.
 */

export interface HistoryInfo {
  recorder: boolean;
  version?: string;
  samples?: number;
  devices?: number;
  oldest?: number | null;
  newest?: number | null;
  stream?: string;
}

export interface MetricInfo {
  metric: string;
  count: number;
  first: number;
  last: number;
  last_value: number | null;
}

export interface RawPoint {
  t: number;
  v: number;
}

export interface BucketPoint {
  t: number;
  avg: number;
  min: number;
  max: number;
  n: number;
}

export interface SamplesResult {
  serial: string;
  metric: string;
  from: number;
  to: number;
  resolution: number;
  before: RawPoint | null;
  points: (RawPoint | BucketPoint)[];
}

export interface EnergyInterval {
  start: number;
  end: number;
  kwh: number;
}

export interface EnergyResult {
  serial: string;
  from: number;
  to: number;
  resolution: number;
  source: 'counter' | 'power';
  intervals: EnergyInterval[];
  total_kwh: number;
}

export interface HistorySource {
  readonly baseUrl: string;
  info(): Promise<HistoryInfo>;
  metrics(serial: string): Promise<MetricInfo[]>;
  samples(serial: string, metric: string, from: number, to: number, resolution: number): Promise<SamplesResult>;
  energy(serial: string, from: number, to: number, resolution: number): Promise<EnergyResult>;
}

export const HISTORY_PORT = 9900;

/** Where the recorder lives when it runs as the add-on on the hub itself. */
export function defaultHistoryUrl(hubBaseUrl: string): string {
  const m = /^(https?:\/\/)([^/:]+)/i.exec(hubBaseUrl.trim());
  if (m) return `${m[1]}${m[2]}:${HISTORY_PORT}`;
  return `${hubBaseUrl.replace(/\/+$/, '')}:${HISTORY_PORT}`;
}

export class HistoryClient implements HistorySource {
  constructor(
    readonly baseUrl: string,
    private readonly timeoutMs = 8_000,
  ) {}

  info(): Promise<HistoryInfo> {
    return this.get<HistoryInfo>('/api/history');
  }

  async metrics(serial: string): Promise<MetricInfo[]> {
    const res = await this.get<{ metrics: MetricInfo[] }>(`/api/history/metrics?serial=${encodeURIComponent(serial)}`);
    return res.metrics;
  }

  samples(serial: string, metric: string, from: number, to: number, resolution: number): Promise<SamplesResult> {
    const q = `serial=${encodeURIComponent(serial)}&metric=${encodeURIComponent(metric)}&from=${Math.floor(from)}&to=${Math.floor(to)}&resolution=${Math.floor(resolution)}`;
    return this.get<SamplesResult>(`/api/history/samples?${q}`);
  }

  energy(serial: string, from: number, to: number, resolution: number): Promise<EnergyResult> {
    const q = `serial=${encodeURIComponent(serial)}&from=${Math.floor(from)}&to=${Math.floor(to)}&resolution=${Math.floor(resolution)}`;
    return this.get<EnergyResult>(`/api/history/energy?${q}`);
  }

  private async get<T>(path: string): Promise<T> {
    const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(this.timeoutMs) : undefined;
    const res = await fetch(`${this.baseUrl}${path}`, { signal });
    if (!res.ok) throw new Error(`history service answered ${res.status}`);
    return (await res.json()) as T;
  }
}

/** Probe a base URL; resolves with the recorder info or throws. */
export async function probeHistory(baseUrl: string): Promise<HistoryInfo> {
  const info = await new HistoryClient(baseUrl, 4_000).info();
  if (!info.recorder) throw new Error('no recorder at this address');
  return info;
}
