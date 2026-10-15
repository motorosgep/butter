/**
 * Last-24-hour sparklines for Home tiles, shared and cached so a screen full of
 * sensors makes one request per sensor every ten minutes rather than one per
 * render. Failures are remembered for the same ten minutes, so a hub without a
 * recorder is not asked again and again.
 */

import { useEffect, useSyncExternalStore } from 'react';

import type { HistorySource } from './client';

export interface SparkPoint {
  t: number;
  v: number;
}

export interface Spark {
  points: SparkPoint[];
  min: number;
  max: number;
  /** When it was fetched, in ms. */
  at: number;
}

const TTL_MS = 10 * 60_000;
const WINDOW_S = 24 * 3600;
const RESOLUTION_S = 900;

interface Entry {
  spark?: Spark;
  loading?: Promise<void>;
}

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const l of listeners) l();
}

async function load(history: HistorySource, serial: string, metric: string, scale: number): Promise<Spark> {
  const to = Math.floor(Date.now() / 1000);
  const res = await history.samples(serial, metric, to - WINDOW_S, to, RESOLUTION_S);
  const points: SparkPoint[] = res.points.map((p) => ({ t: p.t, v: ('avg' in p ? p.avg : p.v) * scale }));
  const values = points.map((p) => p.v);
  return { points, min: Math.min(...values), max: Math.max(...values), at: Date.now() };
}

function ensureFresh(key: string, history: HistorySource, serial: string, metric: string, scale: number): void {
  const entry = cache.get(key) ?? {};
  if (entry.loading) return;
  if (entry.spark && Date.now() - entry.spark.at < TTL_MS) return;
  const loading = load(history, serial, metric, scale)
    .catch((): Spark => ({ points: [], min: NaN, max: NaN, at: Date.now() }))
    .then((spark) => {
      cache.set(key, { spark });
      emit();
    });
  cache.set(key, { ...entry, loading });
}

/** Points for the last 24 hours of a metric, or undefined until the first fetch answers. */
export function useSparkline(history: HistorySource | undefined, serial: string, metric: string | undefined, scale = 1): Spark | undefined {
  const key = history && metric ? `${history.baseUrl}|${serial}|${metric}|${scale}` : undefined;
  const spark = useSyncExternalStore(subscribe, () => (key ? cache.get(key)?.spark : undefined));

  useEffect(() => {
    if (!key || !history || !metric) return;
    ensureFresh(key, history, serial, metric, scale);
    const timer = setInterval(() => ensureFresh(key, history, serial, metric, scale), 60_000);
    return () => clearInterval(timer);
  }, [key, history, serial, metric, scale]);

  return spark;
}

/** Drop everything, e.g. when the active hub changes. */
export function clearSparklines(): void {
  cache.clear();
  emit();
}
