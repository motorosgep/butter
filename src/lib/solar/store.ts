/**
 * Solar figures shared by the Home tile and the solar screen. They come from
 * the ihost-bridge add-on when it has solar set up (see `useHomeSolar`), and
 * otherwise straight from the kiosk link: one request per link every five
 * minutes, which is how often the plant reports.
 */

import { useEffect, useSyncExternalStore } from 'react';

import { selectActiveHub, useHub } from '../hub/store';
import { fetchBridgeSolar, fetchBridgeYields, type BridgeSolar, type Span, type YieldList } from './bridge';
import { fetchSolar, solarLinkUrl, type Solar, type SolarLink } from './fusionsolar';

const TTL_MS = 5 * 60_000;

export interface SolarState {
  solar?: Solar;
  error?: string;
  loading: boolean;
}

const IDLE: SolarState = { loading: false };
const cache = new Map<string, SolarState>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function keyOf(link: SolarLink): string {
  return `${link.host}/${link.kk}`;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(key: string, state: SolarState): void {
  cache.set(key, state);
  for (const l of listeners) l();
}

function load(link: SolarLink, force = false): Promise<void> {
  const key = keyOf(link);
  const current = cache.get(key) ?? IDLE;
  if (!force && current.solar && Date.now() - current.solar.fetchedAt < TTL_MS) return Promise.resolve();
  const pending = inflight.get(key);
  if (pending) return pending;
  publish(key, { ...current, loading: true });
  const task = fetchSolar(link)
    .then((solar) => publish(key, { solar, loading: false }))
    .catch((error: unknown) => publish(key, { ...current, loading: false, error: error instanceof Error ? error.message : String(error) }))
    .finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

/** The plant's figures, refreshed in the background while something shows them. */
export function useSolar(link: SolarLink | null | undefined): SolarState {
  const key = link ? keyOf(link) : undefined;
  const state = useSyncExternalStore(subscribe, () => (key ? (cache.get(key) ?? IDLE) : IDLE));

  useEffect(() => {
    if (!link) return;
    void load(link);
    const timer = setInterval(() => void load(link), 60_000);
    return () => clearInterval(timer);
    // Re-run when the link changes, not when the object identity does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

/** Fetch again now, e.g. on pull to refresh. */
export function refreshSolar(link: SolarLink): Promise<void> {
  return load(link, true);
}

// ----- through the bridge ---------------------------------------------------------

/** The bridge is on the home network and reads the plant itself, so asking it is cheap. */
const BRIDGE_TTL_MS = 60_000;

export interface BridgeState {
  bridge?: BridgeSolar;
  error?: string;
  loading: boolean;
  /** True once the bridge has answered or failed, so the caller knows whether to fall back. */
  settled: boolean;
  at?: number;
}

const BRIDGE_IDLE: BridgeState = { loading: false, settled: false };
const bridgeCache = new Map<string, BridgeState>();
const bridgeInflight = new Map<string, Promise<void>>();

function publishBridge(url: string, state: BridgeState): void {
  bridgeCache.set(url, state);
  for (const l of listeners) l();
}

function loadBridge(url: string, force = false): Promise<void> {
  const current = bridgeCache.get(url) ?? BRIDGE_IDLE;
  if (!force && current.at !== undefined && Date.now() - current.at < BRIDGE_TTL_MS) return Promise.resolve();
  const pending = bridgeInflight.get(url);
  if (pending) return pending;
  publishBridge(url, { ...current, loading: true });
  const task = fetchBridgeSolar(url)
    .then((bridge) => publishBridge(url, { bridge, loading: false, settled: true, at: Date.now() }))
    // Keep the last good answer on screen; a bridge that never answered counts as absent.
    .catch((error: unknown) => publishBridge(url, { ...current, loading: false, settled: true, at: Date.now(), error: error instanceof Error ? error.message : String(error) }))
    .finally(() => bridgeInflight.delete(url));
  bridgeInflight.set(url, task);
  return task;
}

function useBridgeSolar(url: string | undefined): BridgeState {
  const state = useSyncExternalStore(subscribe, () => (url ? (bridgeCache.get(url) ?? BRIDGE_IDLE) : BRIDGE_IDLE));
  useEffect(() => {
    if (!url) return;
    void loadBridge(url);
    const timer = setInterval(() => void loadBridge(url), 30_000);
    return () => clearInterval(timer);
  }, [url]);
  return state;
}

export interface HomeSolar extends SolarState {
  /** Whether the home has solar at all, from either source: show the tile. */
  available: boolean;
  /** Who is reading the plant: the bridge on the hub, or this phone through the kiosk link. */
  source?: 'bridge' | 'kiosk';
  /** The bridge's address, when it is the source. */
  bridgeUrl?: string;
  bridge?: BridgeSolar;
  /** The plant's kiosk page, whichever source knows it. */
  kioskUrl?: string;
}

/**
 * The home's solar figures. The ihost-bridge add-on is asked first, because it
 * also has the history; when there is no bridge, it has no solar set up, or it
 * cannot be reached, the phone reads the hub's own kiosk link instead.
 */
export function useHomeSolar(): HomeSolar {
  const hub = useHub(selectActiveHub);
  const history = useHub((s) => s.history);
  const historyStatus = useHub((s) => s.historyStatus);
  const bridgeUrl = history && /^https?:/.test(history.baseUrl) ? history.baseUrl : undefined;
  const viaBridge = useBridgeSolar(bridgeUrl);
  const bridgeHas = !!viaBridge.bridge?.configured && !!viaBridge.bridge.solar;
  // Hold the direct read back while the bridge is still being looked for, so the two do not race.
  const waiting = historyStatus === 'checking' || (!!bridgeUrl && !viaBridge.settled);
  const link = hub?.solar;
  const direct = useSolar(bridgeHas || waiting ? undefined : link);

  if (bridgeHas && bridgeUrl) {
    const bridge = viaBridge.bridge!;
    return { available: true, source: 'bridge', bridgeUrl, bridge, kioskUrl: bridge.kioskUrl, solar: bridge.solar, loading: viaBridge.loading, error: viaBridge.error ?? bridge.kioskError };
  }
  if (link) return { ...direct, loading: direct.loading || (waiting && !direct.solar), available: true, source: 'kiosk', kioskUrl: solarLinkUrl(link) };
  // Set up on the bridge, but it has not managed to read the plant yet.
  if (viaBridge.bridge?.configured && bridgeUrl) return { available: true, source: 'bridge', bridgeUrl, bridge: viaBridge.bridge, kioskUrl: viaBridge.bridge.kioskUrl, loading: viaBridge.loading, error: viaBridge.bridge.kioskError ?? viaBridge.error };
  return { available: false, loading: false };
}

/** Read the plant again now, from whichever source the home uses. */
export function refreshHomeSolar(home: HomeSolar, link: SolarLink | undefined): Promise<void> {
  if (home.source === 'bridge' && home.bridgeUrl) return loadBridge(home.bridgeUrl, true);
  return link ? load(link, true) : Promise.resolve();
}

// ----- history, from the bridge ------------------------------------------------------

const YIELD_TTL_MS = 5 * 60_000;

export interface YieldState {
  list?: YieldList;
  error?: string;
  loading: boolean;
  at?: number;
}

const YIELD_IDLE: YieldState = { loading: false };
const yieldCache = new Map<string, YieldState>();
const yieldInflight = new Map<string, Promise<void>>();

function loadYields(url: string, span: Span, year: number, month: number, force = false): Promise<void> {
  const key = `${url}|${span}|${span === 'year' ? '' : year}|${span === 'day' ? month : ''}`;
  const current = yieldCache.get(key) ?? YIELD_IDLE;
  if (!force && current.at !== undefined && Date.now() - current.at < YIELD_TTL_MS) return Promise.resolve();
  const pending = yieldInflight.get(key);
  if (pending) return pending;
  const publish = (state: YieldState) => {
    yieldCache.set(key, state);
    for (const l of listeners) l();
  };
  publish({ ...current, loading: true });
  const task = fetchBridgeYields(url, span, year, month)
    .then((list) => publish({ list, loading: false, at: Date.now() }))
    .catch((error: unknown) => publish({ ...current, loading: false, error: error instanceof Error ? error.message : String(error) }))
    .finally(() => yieldInflight.delete(key));
  yieldInflight.set(key, task);
  return task;
}

/** Production per day of a month, per month of a year, or per year, as the bridge has it. */
export function useSolarYields(url: string | undefined, span: Span, year: number, month: number): YieldState {
  const key = url ? `${url}|${span}|${span === 'year' ? '' : year}|${span === 'day' ? month : ''}` : undefined;
  const state = useSyncExternalStore(subscribe, () => (key ? (yieldCache.get(key) ?? YIELD_IDLE) : YIELD_IDLE));
  useEffect(() => {
    if (url) void loadYields(url, span, year, month);
  }, [url, span, year, month]);
  return state;
}
