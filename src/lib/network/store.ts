/**
 * The home network for the screen that shows it: read from the ihost-bridge
 * add-on next to the hub, every 30 seconds while the screen is open (the
 * bridge itself asks the Deco once a minute).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { hubToken, selectActiveHub, useHub } from '../hub/store';
import { fetchNetwork, NetworkUnavailable, reserve, unreserve, type Network, type ReserveResult } from './bridge';

const POLL_MS = 30_000;

export interface NetworkState {
  network?: Network;
  error?: string;
  /** The bridge has no network pages for us: too old, not there, or the token was refused. */
  unavailable?: string;
  loading: boolean;
  /** The bridge's address, once known. */
  bridgeUrl?: string;
  refresh(): Promise<void>;
  pin(items: { mac: string; ip: string }[]): Promise<ReserveResult>;
  unpin(mac: string): Promise<void>;
}

export function useNetwork(): NetworkState {
  const hub = useHub(selectActiveHub);
  const history = useHub((s) => s.history);
  const historyStatus = useHub((s) => s.historyStatus);
  const bridgeUrl = history && /^https?:/.test(history.baseUrl) ? history.baseUrl : undefined;
  const [network, setNetwork] = useState<Network>();
  const [error, setError] = useState<string>();
  const [unavailable, setUnavailable] = useState<string>();
  const [loading, setLoading] = useState(true);
  const live = useRef(true);

  const token = useCallback(async () => {
    const t = hub && !hub.demo ? await hubToken(hub.id) : null;
    if (!t) throw new NetworkUnavailable('no hub token on this phone; pair the hub again');
    return t;
  }, [hub]);

  const refresh = useCallback(async () => {
    if (!bridgeUrl) return;
    // `loading` covers the first read only; pull to refresh shows its own spinner.
    try {
      const next = await fetchNetwork(bridgeUrl, await token());
      if (!live.current) return;
      setNetwork(next);
      setError(undefined);
      setUnavailable(undefined);
    } catch (e) {
      if (!live.current) return;
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof NetworkUnavailable) setUnavailable(message);
      else setError(message);
    } finally {
      if (live.current) setLoading(false);
    }
  }, [bridgeUrl, token]);

  // A demo home, or no bridge next to the hub: nothing to ask, so nothing to keep in state.
  const missing = hub?.demo ? 'The demo home has no network to show.' : !bridgeUrl && historyStatus !== 'checking' ? 'No ihost-bridge add-on found next to the hub.' : undefined;

  useEffect(() => {
    live.current = true;
    if (!bridgeUrl || hub?.demo) {
      return () => {
        live.current = false;
      };
    }
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => {
      live.current = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [bridgeUrl, hub?.demo, refresh]);

  const pin = useCallback(
    async (items: { mac: string; ip: string }[]) => {
      if (!bridgeUrl) throw new Error('no bridge');
      const result = await reserve(bridgeUrl, await token(), items);
      await refresh();
      return result;
    },
    [bridgeUrl, refresh, token],
  );

  const unpin = useCallback(
    async (mac: string) => {
      if (!bridgeUrl) throw new Error('no bridge');
      await unreserve(bridgeUrl, await token(), mac);
      await refresh();
    },
    [bridgeUrl, refresh, token],
  );

  return { network, error, unavailable: missing ?? unavailable, loading: missing ? false : loading, bridgeUrl, refresh, pin, unpin };
}
