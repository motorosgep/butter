/**
 * Forecast cache shared by the Home tile and the weather screen: one request
 * per place every fifteen minutes, whichever screens are showing it.
 */

import { useEffect, useSyncExternalStore } from 'react';

import { fetchForecast, type Forecast, type Place } from './open-meteo';

const TTL_MS = 15 * 60_000;

export interface ForecastState {
  forecast?: Forecast;
  error?: string;
  loading: boolean;
}

const IDLE: ForecastState = { loading: false };
const cache = new Map<string, ForecastState>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function keyOf(place: Place): string {
  return `${place.lat.toFixed(4)},${place.lon.toFixed(4)}`;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(key: string, state: ForecastState): void {
  cache.set(key, state);
  for (const l of listeners) l();
}

function load(place: Place, force = false): Promise<void> {
  const key = keyOf(place);
  const current = cache.get(key) ?? IDLE;
  if (!force && current.forecast && Date.now() - current.forecast.fetchedAt < TTL_MS) return Promise.resolve();
  const pending = inflight.get(key);
  if (pending) return pending;
  publish(key, { ...current, loading: true });
  const task = fetchForecast(place)
    .then((forecast) => publish(key, { forecast, loading: false }))
    .catch((error: unknown) => publish(key, { ...current, loading: false, error: error instanceof Error ? error.message : String(error) }))
    .finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

/** The forecast for a place, refreshed in the background while something shows it. */
export function useForecast(place: Place | null | undefined): ForecastState {
  const key = place ? keyOf(place) : undefined;
  const state = useSyncExternalStore(subscribe, () => (key ? (cache.get(key) ?? IDLE) : IDLE));

  useEffect(() => {
    if (!place) return;
    void load(place);
    const timer = setInterval(() => void load(place), 60_000);
    return () => clearInterval(timer);
    // Re-run when the coordinates change, not when the object identity does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

/** Fetch again now, e.g. on pull to refresh. */
export function refreshForecast(place: Place): Promise<void> {
  return load(place, true);
}
