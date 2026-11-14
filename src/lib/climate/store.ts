/**
 * Room control for the Heating screen and the Home card: read from the
 * ihost-bridge add-on once a minute while mounted (the bridge decides once a
 * minute too), and changed through it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { hubToken, selectActiveHub, useHub } from '../hub/store';
import { ClimateUnavailable, fetchClimate, saveClimate, type Climate, type ClimateSettings } from './bridge';

export interface ClimateState {
  climate?: Climate;
  error?: string;
  /** No bridge, a demo home, or a bridge without room control. */
  unavailable?: string;
  loading: boolean;
  refresh(): Promise<void>;
  save(change: Partial<ClimateSettings>): Promise<void>;
}

export function useClimate(): ClimateState {
  const hub = useHub(selectActiveHub);
  const history = useHub((s) => s.history);
  const historyStatus = useHub((s) => s.historyStatus);
  const bridgeUrl = history && /^https?:/.test(history.baseUrl) ? history.baseUrl : undefined;
  const [climate, setClimate] = useState<Climate>();
  const [error, setError] = useState<string>();
  const [unavailable, setUnavailable] = useState<string>();
  const [loading, setLoading] = useState(true);
  const live = useRef(true);

  const token = useCallback(async () => {
    const t = hub && !hub.demo ? await hubToken(hub.id) : null;
    if (!t) throw new ClimateUnavailable('no hub token on this phone; pair the hub again');
    return t;
  }, [hub]);

  const refresh = useCallback(async () => {
    if (!bridgeUrl) return;
    try {
      const next = await fetchClimate(bridgeUrl, await token());
      if (!live.current) return;
      setClimate(next);
      setError(undefined);
      setUnavailable(undefined);
    } catch (e) {
      if (!live.current) return;
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof ClimateUnavailable) setUnavailable(message);
      else setError(message);
    } finally {
      if (live.current) setLoading(false);
    }
  }, [bridgeUrl, token]);

  const missing = hub?.demo ? 'The demo home has no heat pump to control.' : !bridgeUrl && historyStatus !== 'checking' ? 'No ihost-bridge add-on found next to the hub.' : undefined;

  useEffect(() => {
    live.current = true;
    if (!bridgeUrl || hub?.demo) {
      return () => {
        live.current = false;
      };
    }
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 60_000);
    return () => {
      live.current = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [bridgeUrl, hub?.demo, refresh]);

  const save = useCallback(
    async (change: Partial<ClimateSettings>) => {
      if (!bridgeUrl) throw new Error('no bridge');
      const next = await saveClimate(bridgeUrl, await token(), change);
      if (live.current) setClimate(next);
    },
    [bridgeUrl, token],
  );

  return { climate, error, unavailable: missing ?? unavailable, loading: missing ? false : loading, refresh, save };
}
