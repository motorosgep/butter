/**
 * Solar as the ihost-bridge add-on serves it. The bridge runs on the hub, reads
 * the plant around the clock (the FusionSolar kiosk link, and Huawei's API when
 * an account was added there) and keeps the production by day, month and year.
 * Butter prefers it over reading the kiosk link itself, because the bridge has
 * the history.
 */

import type { Solar } from './fusionsolar';

/** What the bridge knows about the plant right now. */
export interface BridgeSolar {
  /** Whether solar is set up on the bridge at all. */
  configured: boolean;
  /** Absent until the bridge has read the plant once. */
  solar?: Solar;
  /** The plant's kiosk page, when the bridge reads one. */
  kioskUrl?: string;
  /** Whether a Huawei API account feeds the history, and what went wrong with it last. */
  api: boolean;
  apiError?: string;
  kioskError?: string;
}

interface RawLive {
  configured?: boolean;
  sources?: { kiosk?: boolean; api?: boolean };
  kiosk_error?: string | null;
  api_error?: string | null;
  kiosk_url?: string | null;
  name?: string;
  fetched_at?: number;
  power_kw?: number | null;
  today_kwh?: number | null;
  month_kwh?: number | null;
  year_kwh?: number | null;
  lifetime_kwh?: number | null;
  co2_kg?: number | null;
  peak_kw?: number;
  updated?: number | null;
  curve?: [number, number][];
}

export type Span = 'day' | 'month' | 'year';

/** Energy produced in one day ("2026-11-14"), month ("2026-11") or year ("2026"). */
export interface Yield {
  key: string;
  kwh: number;
  /** Where the figure came from: Huawei's API, or the totals the bridge wrote down from the kiosk. */
  source: 'api' | 'kiosk';
}

export interface YieldList {
  items: Yield[];
  api: boolean;
  apiError?: string;
}

async function getJson<T>(url: string, timeoutMs = 8_000): Promise<T | undefined> {
  const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined;
  const res = await fetch(url, { signal });
  // A bridge from before solar was added has no such page.
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`the bridge answered ${res.status}`);
  return (await res.json()) as T;
}

const n = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export async function fetchBridgeSolar(baseUrl: string): Promise<BridgeSolar> {
  const raw = await getJson<RawLive>(`${baseUrl}/api/solar`);
  if (!raw?.configured) return { configured: false, api: false };
  const curve = (raw.curve ?? []).map(([t, v]) => ({ t, v }));
  return {
    configured: true,
    kioskUrl: raw.kiosk_url ?? undefined,
    api: !!raw.sources?.api,
    apiError: raw.api_error ?? undefined,
    kioskError: raw.kiosk_error ?? undefined,
    solar:
      raw.fetched_at === undefined
        ? undefined
        : {
            fetchedAt: raw.fetched_at * 1000,
            name: raw.name?.trim() || 'Solar',
            power: Math.max(0, n(raw.power_kw)),
            today: n(raw.today_kwh),
            month: n(raw.month_kwh),
            year: n(raw.year_kwh),
            lifetime: n(raw.lifetime_kwh),
            curve,
            peak: n(raw.peak_kw),
            updated: raw.updated ?? undefined,
            co2: raw.co2_kg ?? undefined,
          },
  };
}

/** `day`: each day of that month; `month`: each month of that year; `year`: every year on record. */
export async function fetchBridgeYields(baseUrl: string, span: Span, year: number, month: number): Promise<YieldList> {
  const raw = await getJson<{ items?: Yield[]; api?: boolean; api_error?: string | null }>(`${baseUrl}/api/solar/history?span=${span}&year=${year}&month=${month}`);
  return { items: raw?.items ?? [], api: !!raw?.api, apiError: raw?.api_error ?? undefined };
}
