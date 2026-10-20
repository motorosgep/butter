/**
 * Measurements from HungaroMet's open data portal (odp.met.hu): the Hungarian
 * weather service's station observations, published as per-station CSV files
 * in small zip archives and free to use with attribution (CC BY 4.0).
 *
 * Two station networks matter here:
 *  - automatic stations ("auto"): daily values since 2002 up to yesterday,
 *    monthly summaries, and an hourly feed for the last two days; rain,
 *    temperatures, humidity, pressure, radiation and wind;
 *  - rain gauges ("rain"): a much denser network that reports daily rainfall
 *    only, published up to the end of the previous month.
 *
 * Files are fetched straight from the portal and unpacked on the phone, so no
 * server of ours sits in between and nothing but the station id goes out.
 */

import { strFromU8, unzipSync } from 'fflate';

export const ODP_BASE = 'https://odp.met.hu/climate/observations_hungary';
export const ODP_HOME = 'https://odp.met.hu/';
export const ODP_ATTRIBUTION = 'Source: HungaroMet, Meteorological Data Repository (odp.met.hu), CC BY 4.0';

export type StationKind = 'auto' | 'rain';

export interface Station {
  id: number;
  name: string;
  region?: string;
  lat: number;
  lon: number;
  elevation: number;
  kind: StationKind;
  /** First and last day with data, YYYYMMDD. */
  from: string;
  to: string;
}

export interface DailyRow {
  /** YYYYMMDD */
  date: string;
  rain?: number;
  tMean?: number;
  tMin?: number;
  tMax?: number;
  humidity?: number;
  pressure?: number;
  /** Global radiation, J/cm². */
  radiation?: number;
  wind?: number;
  gust?: number;
  gustAt?: string;
  /** Snow depth in cm, rain gauges only (negative codes mean patchy or thin). */
  snow?: number;
}

export interface MonthlyRow {
  /** YYYYMM */
  month: string;
  rain?: number;
  tMean?: number;
  tMin?: number;
  tMax?: number;
  humidity?: number;
  radiation?: number;
  wind?: number;
  gust?: number;
  /** Not a full month yet, or summed from an incomplete set of days. */
  partial?: boolean;
  /** Days that went into a client-side sum. */
  days?: number;
}

export interface HourlyRow {
  /** YYYYMMDDHHmm, UTC */
  time: string;
  rain?: number;
  temp?: number;
  tMin?: number;
  tMax?: number;
  humidity?: number;
  pressure?: number;
  seaPressure?: number;
  radiation?: number;
  wind?: number;
  windDir?: number;
  gust?: number;
  gustDir?: number;
  weatherCode?: number;
}

// ----- CSV ------------------------------------------------------------------------

export interface Table {
  columns: string[];
  rows: string[][];
}

/** Parse the portal's "formatted CSV": `#` metadata lines, then a header, then `;`-separated rows. */
export function parseTable(text: string): Table {
  let columns: string[] | undefined;
  const rows: string[][] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const cells = line.split(';').map((c) => c.trim());
    if (!columns) columns = cells;
    else rows.push(cells);
  }
  return { columns: columns ?? [], rows };
}

/** -999 is the portal's "no data". */
export function num(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n !== -999 ? n : undefined;
}

function picker(table: Table): (row: string[], name: string) => string | undefined {
  const index = new Map(table.columns.map((c, i) => [c, i]));
  return (row, name) => {
    const i = index.get(name);
    return i === undefined ? undefined : row[i];
  };
}

// ----- fetching ---------------------------------------------------------------------

function withTimeout(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(ms) : undefined;
}

export async function fetchBytes(url: string, timeoutMs = 30_000): Promise<Uint8Array> {
  const res = await fetch(url, { signal: withTimeout(timeoutMs) });
  if (!res.ok) throw new Error(`odp.met.hu answered ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function fetchText(url: string, timeoutMs = 30_000): Promise<string> {
  const res = await fetch(url, { signal: withTimeout(timeoutMs) });
  if (!res.ok) throw new Error(`odp.met.hu answered ${res.status}`);
  return res.text();
}

/** The CSV inside one of the portal's zip archives. */
export function unzipCsv(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  const name = names.find((n) => n.toLowerCase().endsWith('.csv')) ?? names[0];
  if (!name) throw new Error('empty archive');
  return strFromU8(files[name]);
}

/** Names of the historical archives for a station in a dataset directory, newest span last. */
export async function historicalArchives(dir: string, code: string, stationId: number): Promise<string[]> {
  const html = await fetchText(`${ODP_BASE}/${dir}/historical/`);
  const re = new RegExp(`href="(HABP_${code}_${stationId}_\\d+_\\d+_hist\\.zip)"`, 'g');
  const names = new Set<string>();
  for (const m of html.matchAll(re)) names.add(m[1]);
  return [...names].sort();
}

// ----- stations ---------------------------------------------------------------------

function parseStations(text: string, kind: StationKind): Station[] {
  const table = parseTable(text);
  const get = picker(table);
  const byId = new Map<number, Station>();
  for (const row of table.rows) {
    const id = num(get(row, 'StationNumber'));
    const lat = num(get(row, 'Latitude'));
    const lon = num(get(row, 'Longitude'));
    if (id === undefined || lat === undefined || lon === undefined) continue;
    const from = get(row, 'StartDate') ?? '';
    const to = get(row, 'EndDate') ?? '';
    const existing = byId.get(id);
    if (existing && existing.to >= to) {
      if (from < existing.from) existing.from = from;
      continue;
    }
    byId.set(id, {
      id,
      name: get(row, 'StationName') ?? String(id),
      region: get(row, 'RegioName') || undefined,
      lat,
      lon,
      elevation: num(get(row, 'Elevation')) ?? 0,
      kind,
      from: existing ? (existing.from < from ? existing.from : from) : from,
      to,
    });
  }
  return [...byId.values()];
}

/** Every station of both kinds that still reported within the last couple of months. */
export async function fetchStations(): Promise<Station[]> {
  const [auto, rain] = await Promise.all([
    fetchText(`${ODP_BASE}/meta/station_meta_auto.csv`),
    fetchText(`${ODP_BASE}/meta/station_meta_daily_rain.csv`),
  ]);
  const cutoff = ymd(new Date(Date.now() - 75 * 86400e3));
  const all = [...parseStations(auto, 'auto'), ...parseStations(rain, 'rain')];
  return all.filter((s) => s.to >= cutoff);
}

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function nearestStations(stations: Station[], lat: number, lon: number, count = 15): (Station & { km: number })[] {
  return stations
    .map((s) => ({ ...s, km: distanceKm(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, count);
}

// ----- series ---------------------------------------------------------------------

function dailyFromAuto(text: string): DailyRow[] {
  const table = parseTable(text);
  const get = picker(table);
  return table.rows
    .map((row) => ({
      date: get(row, 'Time') ?? '',
      rain: num(get(row, 'rau')),
      tMean: num(get(row, 't')),
      tMin: num(get(row, 'tn')),
      tMax: num(get(row, 'tx')),
      humidity: num(get(row, 'u')),
      pressure: num(get(row, 'p')),
      radiation: num(get(row, 'sr')),
      wind: num(get(row, 'fs')) ?? num(get(row, 'f')),
      gust: num(get(row, 'fx')),
      gustAt: get(row, 'fxdat') || undefined,
    }))
    .filter((r) => r.date.length === 8);
}

function dailyFromGauge(text: string): DailyRow[] {
  const table = parseTable(text);
  const get = picker(table);
  return table.rows
    .map((row) => ({ date: get(row, 'Time') ?? '', rain: num(get(row, 'r')), snow: num(get(row, 'rh')) }))
    .filter((r) => r.date.length === 8);
}

function monthlyFromAuto(text: string): MonthlyRow[] {
  const table = parseTable(text);
  const get = picker(table);
  return table.rows
    .map((row) => ({
      month: get(row, 'Time') ?? '',
      rain: num(get(row, 'rau')),
      tMean: num(get(row, 't')),
      tMin: num(get(row, 'tn')),
      tMax: num(get(row, 'tx')),
      humidity: num(get(row, 'u')),
      radiation: num(get(row, 'sr')),
      wind: num(get(row, 'fs')) ?? num(get(row, 'f')),
      gust: num(get(row, 'fx')),
    }))
    .filter((r) => r.month.length === 6);
}

function hourlyFromAuto(text: string): HourlyRow[] {
  const table = parseTable(text);
  const get = picker(table);
  return table.rows
    .map((row) => ({
      time: get(row, 'Time') ?? '',
      rain: num(get(row, 'r')),
      temp: num(get(row, 't')),
      tMin: num(get(row, 'tn')),
      tMax: num(get(row, 'tx')),
      humidity: num(get(row, 'u')),
      pressure: num(get(row, 'p')),
      seaPressure: num(get(row, 'p0')),
      radiation: num(get(row, 'sr')),
      wind: num(get(row, 'fs')) ?? num(get(row, 'f')),
      windDir: num(get(row, 'fsd')) ?? num(get(row, 'fd')),
      gust: num(get(row, 'fx')),
      gustDir: num(get(row, 'fxd')),
      weatherCode: num(get(row, 'we')),
    }))
    .filter((r) => r.time.length === 12);
}

/** A zip fetcher; the cache layer supplies one that remembers immutable archives. */
export type ZipLoader = (url: string, immutable: boolean) => Promise<string>;

export const plainZipLoader: ZipLoader = async (url) => unzipCsv(await fetchBytes(url));

function mergeByKey<T>(parts: T[][], key: (row: T) => string): T[] {
  const out = new Map<string, T>();
  for (const part of parts) for (const row of part) out.set(key(row), row);
  return [...out.values()].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/** Every day on record: the historical archives plus this year's file. */
export async function loadDaily(station: Station, zip: ZipLoader = plainZipLoader): Promise<DailyRow[]> {
  const dir = station.kind === 'auto' ? 'daily' : 'daily_rain';
  const code = station.kind === 'auto' ? '1D' : '1RD';
  const parse = station.kind === 'auto' ? dailyFromAuto : dailyFromGauge;
  const hist = await historicalArchives(dir, code, station.id).catch(() => [] as string[]);
  const parts = await Promise.all([
    ...hist.map((name) => zip(`${ODP_BASE}/${dir}/historical/${name}`, true).then(parse)),
    zip(`${ODP_BASE}/${dir}/recent/HABP_${code}_${station.id}_akt.zip`, false)
      .then(parse)
      .catch(() => [] as DailyRow[]),
  ]);
  return mergeByKey(parts, (r) => r.date);
}

/** Every month on record. Automatic stations publish these; gauges are summed from their days. */
export async function loadMonthly(station: Station, daily: DailyRow[], zip: ZipLoader = plainZipLoader): Promise<MonthlyRow[]> {
  let rows: MonthlyRow[] = [];
  if (station.kind === 'auto') {
    const hist = await historicalArchives('monthly', '1MO', station.id).catch(() => [] as string[]);
    const parts = await Promise.all([
      ...hist.map((name) => zip(`${ODP_BASE}/monthly/historical/${name}`, true).then(monthlyFromAuto)),
      zip(`${ODP_BASE}/monthly/recent/HABP_1MO_${station.id}_akt.zip`, false)
        .then(monthlyFromAuto)
        .catch(() => [] as MonthlyRow[]),
    ]);
    rows = mergeByKey(parts, (r) => r.month);
  }
  // Months the monthly files do not cover (the current one, all of them for a gauge,
  // or a month whose sum the service left empty) are summed from the days we have,
  // flagged as partial when the month is not over or days are missing.
  const have = new Map(rows.map((r) => [r.month, r]));
  const today = ymd(new Date());
  const byMonth = new Map<string, DailyRow[]>();
  for (const d of daily) {
    const m = d.date.slice(0, 6);
    const existing = have.get(m);
    if (existing && existing.rain !== undefined) continue;
    byMonth.set(m, [...(byMonth.get(m) ?? []), d]);
  }
  for (const [month, days] of byMonth) {
    const rain = days.filter((d) => d.rain !== undefined);
    const temps = days.filter((d) => d.tMean !== undefined);
    if (!rain.length && !temps.length) continue;
    const complete = month < today.slice(0, 6) && rain.length >= daysInMonth(month) - 1;
    const summed: MonthlyRow = {
      month,
      rain: rain.length ? round1(rain.reduce((a, d) => a + (d.rain ?? 0), 0)) : undefined,
      tMean: temps.length ? round1(temps.reduce((a, d) => a + (d.tMean ?? 0), 0) / temps.length) : undefined,
      tMin: minOf(days.map((d) => d.tMin)),
      tMax: maxOf(days.map((d) => d.tMax)),
      partial: !complete,
      days: rain.length,
    };
    const existing = have.get(month);
    if (existing) {
      // Keep the service's own values where it has them; fill only the gaps.
      existing.rain = summed.rain;
      existing.tMean ??= summed.tMean;
      existing.tMin ??= summed.tMin;
      existing.tMax ??= summed.tMax;
      existing.partial = summed.partial;
      existing.days = summed.days;
    } else {
      rows.push(summed);
    }
  }
  return rows.sort((a, b) => (a.month < b.month ? -1 : 1));
}

/** The last two days, hour by hour (automatic stations only). */
export async function loadHourly(station: Station, zip: ZipLoader = plainZipLoader): Promise<HourlyRow[]> {
  if (station.kind !== 'auto') return [];
  const text = await zip(`${ODP_BASE}/hourly/now/HABP_1H_${station.id}_now.zip`, false);
  return hourlyFromAuto(text);
}

// ----- small date helpers ---------------------------------------------------------

export function ymd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function daysInMonth(yyyymm: string): number {
  return new Date(Number(yyyymm.slice(0, 4)), Number(yyyymm.slice(4, 6)), 0).getDate();
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function minOf(values: (number | undefined)[]): number | undefined {
  const v = values.filter((x): x is number => x !== undefined);
  return v.length ? Math.min(...v) : undefined;
}

function maxOf(values: (number | undefined)[]): number | undefined {
  const v = values.filter((x): x is number => x !== undefined);
  return v.length ? Math.max(...v) : undefined;
}

/** `202610` → "October 2026". */
export function monthLabel(yyyymm: string, style: 'long' | 'short' = 'long'): string {
  const d = new Date(Number(yyyymm.slice(0, 4)), Number(yyyymm.slice(4, 6)) - 1, 1);
  return d.toLocaleDateString(undefined, { month: style, year: 'numeric' });
}

/** Average of a value per calendar month over all complete months on record. */
export function monthlyNormals(rows: MonthlyRow[], pick: (r: MonthlyRow) => number | undefined): { value: number; years: number }[] {
  const sums = Array.from({ length: 12 }, () => ({ total: 0, n: 0 }));
  for (const r of rows) {
    if (r.partial) continue;
    const v = pick(r);
    if (v === undefined) continue;
    const m = Number(r.month.slice(4, 6)) - 1;
    sums[m].total += v;
    sums[m].n += 1;
  }
  return sums.map((s) => ({ value: s.n ? s.total / s.n : NaN, years: s.n }));
}

/** Rain per year, flagged partial when any month is missing or incomplete. */
export function annualTotals(rows: MonthlyRow[]): { year: string; rain: number; partial: boolean; months: number }[] {
  const byYear = new Map<string, MonthlyRow[]>();
  for (const r of rows) byYear.set(r.month.slice(0, 4), [...(byYear.get(r.month.slice(0, 4)) ?? []), r]);
  return [...byYear.entries()]
    .map(([year, list]) => {
      const withRain = list.filter((r) => r.rain !== undefined);
      return {
        year,
        rain: round1(withRain.reduce((a, r) => a + (r.rain ?? 0), 0)),
        partial: withRain.length < 12 || withRain.some((r) => r.partial),
        months: withRain.length,
      };
    })
    .sort((a, b) => (a.year < b.year ? -1 : 1));
}
