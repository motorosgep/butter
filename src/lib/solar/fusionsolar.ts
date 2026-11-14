/**
 * Solar production from a Huawei FusionSolar kiosk link. The plant's owner
 * creates the link in FusionSolar ("Kiosk view"); anyone holding it can read
 * the plant's live figures without signing in, so Butter needs no Huawei
 * account. Only the link's key is sent, to the FusionSolar host in the link.
 */

/** Where a plant's kiosk lives: the regional FusionSolar host and the link's key. */
export interface SolarLink {
  host: string;
  kk: string;
}

export interface SolarPoint {
  /** Minutes after midnight, on the plant's clock. */
  t: number;
  /** Output in kW. */
  v: number;
}

export interface Solar {
  fetchedAt: number;
  name: string;
  /** Output right now, kW. */
  power: number;
  /** Energy produced, kWh. */
  today: number;
  month: number;
  year: number;
  lifetime: number;
  /** Today's output in five-minute steps, up to the latest reading. */
  curve: SolarPoint[];
  /** Highest output so far today, kW. */
  peak: number;
  /** When the plant last reported, minutes after midnight on its clock. */
  updated?: number;
  /** CO₂ avoided over the plant's life, kg. */
  co2?: number;
}

const HOST = /^[a-z0-9-]+\.fusionsolar\.huawei\.com$/;

/** Reads the host and key out of a pasted kiosk link; `undefined` when it is not one. */
export function parseSolarLink(input: string): SolarLink | undefined {
  const text = input.trim();
  const host = /^(?:https?:\/\/)?([^/\s]+)/i.exec(text)?.[1]?.toLowerCase();
  const kk = /[?&]kk=([A-Za-z0-9_-]+)/.exec(text)?.[1];
  if (!host || !kk || !HOST.test(host)) return undefined;
  return { host, kk };
}

export function solarLinkUrl(link: SolarLink): string {
  return `https://${link.host}/pvmswebsite/nologin/assets/build/cloud.html#/kiosk?kk=${link.kk}`;
}

interface RawKiosk {
  powerCurve?: { xAxis?: string[]; activePower?: string[] };
  stationOverview?: { stationName?: string };
  socialContribution?: { co2Reduction?: number };
  realKpi?: { realTimePower?: number; dailyEnergy?: number; monthEnergy?: number; yearEnergy?: number; cumulativeEnergy?: number };
}

const ENTITIES: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" };

/** The kiosk wraps its JSON in HTML escaping. */
function unescapeHtml(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, code: string) => {
    if (code[0] !== '#') return ENTITIES[code] ?? whole;
    const point = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
  });
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0);

/** Turns the kiosk's answer into figures. Exported for tests. */
export function parseKiosk(body: { success?: boolean; failCode?: number; data?: string }, fetchedAt = Date.now()): Solar {
  if (!body.success || typeof body.data !== 'string') throw new Error('The kiosk link was not accepted. It may have expired or been switched off in FusionSolar.');
  const raw = JSON.parse(unescapeHtml(body.data)) as RawKiosk;
  const kpi = raw.realKpi ?? {};
  const times = raw.powerCurve?.xAxis ?? [];
  const values = raw.powerCurve?.activePower ?? [];
  const curve: SolarPoint[] = [];
  for (let i = 0; i < Math.min(times.length, values.length); i++) {
    const [h, m] = times[i].split(':').map(Number);
    const v = Number(values[i]);
    // Slots the plant has not reported yet come as "-".
    if (!Number.isFinite(h) || !Number.isFinite(m) || values[i].trim() === '' || !Number.isFinite(v)) continue;
    curve.push({ t: h * 60 + m, v: Math.max(0, v) });
  }
  const co2 = raw.socialContribution?.co2Reduction;
  return {
    fetchedAt,
    name: raw.stationOverview?.stationName?.trim() || 'Solar',
    power: Math.max(0, num(kpi.realTimePower)),
    today: num(kpi.dailyEnergy),
    month: num(kpi.monthEnergy),
    year: num(kpi.yearEnergy),
    lifetime: num(kpi.cumulativeEnergy),
    curve,
    peak: curve.reduce((best, p) => Math.max(best, p.v), 0),
    updated: curve.length ? curve[curve.length - 1].t : undefined,
    co2: typeof co2 === 'number' && co2 > 0 ? co2 : undefined,
  };
}

export async function fetchSolar(link: SolarLink, timeoutMs = 12_000): Promise<Solar> {
  const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined;
  const res = await fetch(`https://${link.host}/rest/pvms/web/kiosk/v1/station-kiosk-file?kk=${encodeURIComponent(link.kk)}`, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`FusionSolar answered ${res.status}`);
  return parseKiosk((await res.json()) as { success?: boolean; data?: string });
}

// ----- wording ------------------------------------------------------------------

export function formatPower(kw: number): string {
  if (kw <= 0) return '0 kW';
  return kw < 1 ? `${Math.round(kw * 1000)} W` : `${kw.toFixed(kw >= 10 ? 1 : 2)} kW`;
}

export function formatEnergy(kwh: number): string {
  if (kwh >= 1000) return `${(kwh / 1000).toFixed(kwh >= 100_000 ? 0 : kwh >= 10_000 ? 1 : 2)} MWh`;
  return `${kwh.toFixed(kwh >= 100 ? 0 : 1)} kWh`;
}

/** Minutes after midnight as HH:MM. */
export function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
