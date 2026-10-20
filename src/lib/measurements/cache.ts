/**
 * Cached access to the portal's station list and per-station series. The
 * historical archives never change once published, so their zips are kept in
 * AsyncStorage (as base64) and only this year's files and the hourly feed are
 * fetched again.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { fetchBytes, fetchStations, loadDaily, loadHourly, loadMonthly, unzipCsv, type DailyRow, type HourlyRow, type MonthlyRow, type Station, type ZipLoader } from './odp';

const ZIP_PREFIX = 'butter.odp.zip.';

export interface StationSeries {
  daily: DailyRow[];
  monthly: MonthlyRow[];
  /** When the daily and monthly files were fetched, ms. */
  at: number;
}

export interface Loadable<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

const IDLE: Loadable<never> = { loading: false };
const SERIES_TTL = 6 * 3600_000;
const HOURLY_TTL = 20 * 60_000;
const STATIONS_TTL = 24 * 3600_000;

const stationsCache: { state: Loadable<Station[]>; at: number; pending?: Promise<void> } = { state: IDLE, at: 0 };
const seriesCache = new Map<string, Loadable<StationSeries> & { pending?: Promise<void> }>();
const hourlyCache = new Map<string, Loadable<{ rows: HourlyRow[]; at: number }> & { pending?: Promise<void> }>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const l of listeners) l();
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ----- zip loader with a persistent cache for immutable archives ---------------------

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const cachingZipLoader: ZipLoader = async (url, immutable) => {
  const key = ZIP_PREFIX + url.slice(url.lastIndexOf('/') + 1);
  if (immutable) {
    const stored = await AsyncStorage.getItem(key).catch(() => null);
    if (stored) {
      try {
        return unzipCsv(fromBase64(stored));
      } catch {
        await AsyncStorage.removeItem(key).catch(() => undefined);
      }
    }
  }
  const bytes = await fetchBytes(url);
  const text = unzipCsv(bytes);
  if (immutable) await AsyncStorage.setItem(key, toBase64(bytes)).catch(() => undefined);
  return text;
};

/** Drop stored archives that belong to other stations, so the cache stays small. */
async function pruneArchives(keep: Station): Promise<void> {
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
  const stale = keys.filter((k) => k.startsWith(ZIP_PREFIX) && !k.includes(`_${keep.id}_`));
  if (stale.length) await AsyncStorage.multiRemove(stale).catch(() => undefined);
}

// ----- stations ---------------------------------------------------------------------

function ensureStations(): void {
  if (stationsCache.pending) return;
  if (stationsCache.state.data && Date.now() - stationsCache.at < STATIONS_TTL) return;
  stationsCache.state = { ...stationsCache.state, loading: true };
  emit();
  stationsCache.pending = fetchStations()
    .then((data) => {
      stationsCache.state = { data, loading: false };
      stationsCache.at = Date.now();
    })
    .catch((error: unknown) => {
      stationsCache.state = { ...stationsCache.state, loading: false, error: describe(error) };
    })
    .finally(() => {
      stationsCache.pending = undefined;
      emit();
    });
}

export function useStations(enabled = true): Loadable<Station[]> {
  const state = useSyncExternalStore(subscribe, () => stationsCache.state);
  useEffect(() => {
    if (enabled) ensureStations();
  }, [enabled]);
  return state;
}

// ----- series ---------------------------------------------------------------------

function seriesKey(station: Station): string {
  return `${station.kind}:${station.id}`;
}

function ensureSeries(station: Station, force = false): Promise<void> {
  const key = seriesKey(station);
  const entry = seriesCache.get(key) ?? { loading: false };
  if (entry.pending) return entry.pending;
  if (!force && entry.data && Date.now() - entry.data.at < SERIES_TTL) return Promise.resolve();
  const pending = (async () => {
    await pruneArchives(station);
    const daily = await loadDaily(station, cachingZipLoader);
    const monthly = await loadMonthly(station, daily, cachingZipLoader);
    seriesCache.set(key, { data: { daily, monthly, at: Date.now() }, loading: false });
  })()
    .catch((error: unknown) => {
      seriesCache.set(key, { ...entry, loading: false, error: describe(error), pending: undefined });
    })
    .finally(() => {
      const current = seriesCache.get(key);
      if (current) seriesCache.set(key, { ...current, pending: undefined });
      emit();
    });
  seriesCache.set(key, { ...entry, loading: true, error: undefined, pending });
  emit();
  return pending;
}

/** Daily and monthly series for a station, cached for a few hours. */
export function useStationSeries(station: Station | null | undefined): Loadable<StationSeries> {
  const key = station ? seriesKey(station) : undefined;
  const state = useSyncExternalStore(subscribe, () => (key ? (seriesCache.get(key) ?? IDLE) : IDLE));
  useEffect(() => {
    if (station) void ensureSeries(station);
    // The key captures what matters about the station.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function refreshSeries(station: Station): Promise<void> {
  return ensureSeries(station, true);
}

// ----- hourly ---------------------------------------------------------------------

function ensureHourly(station: Station, force = false): Promise<void> {
  if (station.kind !== 'auto') return Promise.resolve();
  const key = seriesKey(station);
  const entry = hourlyCache.get(key) ?? { loading: false };
  if (entry.pending) return entry.pending;
  if (!force && entry.data && Date.now() - entry.data.at < HOURLY_TTL) return Promise.resolve();
  const pending = loadHourly(station, cachingZipLoader)
    .then((rows) => {
      hourlyCache.set(key, { data: { rows, at: Date.now() }, loading: false });
    })
    .catch((error: unknown) => {
      hourlyCache.set(key, { ...entry, loading: false, error: describe(error), pending: undefined });
    })
    .finally(() => {
      const current = hourlyCache.get(key);
      if (current) hourlyCache.set(key, { ...current, pending: undefined });
      emit();
    });
  hourlyCache.set(key, { ...entry, loading: true, error: undefined, pending });
  emit();
  return pending;
}

/** The last two days hour by hour, refreshed every twenty minutes while shown. */
export function useStationHourly(station: Station | null | undefined, enabled = true): Loadable<{ rows: HourlyRow[]; at: number }> {
  const key = station && enabled ? seriesKey(station) : undefined;
  const state = useSyncExternalStore(subscribe, () => (key ? (hourlyCache.get(key) ?? IDLE) : IDLE));
  useEffect(() => {
    if (!station || !enabled) return;
    void ensureHourly(station);
    const timer = setInterval(() => void ensureHourly(station), 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function refreshHourly(station: Station): Promise<void> {
  return ensureHourly(station, true);
}
