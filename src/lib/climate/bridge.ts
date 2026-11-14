/**
 * Room control as the ihost-bridge add-on serves it: the bridge switches the
 * heat pump's space heating on and off from the average of chosen indoor
 * sensors, with a gap around the target and minimum run and rest times. Butter
 * shows what it is doing and changes its settings. The routes answer only apps
 * paired with the hub, so every request carries the hub's access token.
 */

export interface ClimateSettings {
  enabled: boolean;
  /** °C */
  target: number;
  /** Heating goes on at target - below, off at target + above. */
  below: number;
  above: number;
  /** Seconds heating stays on, or off, once switched. */
  min_run: number;
  min_rest: number;
  /** Hub serial numbers of the indoor sensors. */
  sensors: string[];
}

export interface ClimateSensor {
  serial: string;
  name: string;
  value: number | null;
  /** When it last reported, epoch seconds, if the hub says. */
  at: number | null;
  /** Counted in the room temperature (fresh and online). */
  used: boolean;
}

export interface Climate {
  settings: ClimateSettings;
  on_at: number;
  off_at: number;
  /** Average of the sensors in use; null when none is fresh. */
  room: number | null;
  sensors: ClimateSensor[];
  /** The heat pump's heating zone is on; null when the heat pump is not known. */
  heating: boolean | null;
  /** What it is doing and why, in a sentence or two. */
  reason: string;
  checked_at?: number;
  next_switch_at?: number;
  last_switch: number | null;
  log: { at: number; on: boolean; room: number | null }[];
  /** Every hub sensor with a temperature, for the picker. */
  candidates: { serial: string; name: string; value: number; at: number | null; online: boolean }[];
}

/** The bridge answered, but has no room control (too old) or did not take the token. */
export class ClimateUnavailable extends Error {}

async function call(url: string, token: string, init?: RequestInit): Promise<Climate> {
  const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(20_000) : undefined;
  const res = await fetch(url, { ...init, signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers } });
  if (res.status === 404) throw new ClimateUnavailable('the bridge on the hub is too old for room control; update the add-on');
  const body = (await res.json().catch(() => ({}))) as Climate & { error?: string };
  if (res.status === 401 || res.status === 403) throw new ClimateUnavailable(body.error ?? 'the bridge did not accept the hub token');
  if (!res.ok) throw new Error(body.error ?? `the bridge answered ${res.status}`);
  return body;
}

export function fetchClimate(baseUrl: string, token: string): Promise<Climate> {
  return call(`${baseUrl}/api/climate`, token);
}

export function saveClimate(baseUrl: string, token: string, change: Partial<ClimateSettings>): Promise<Climate> {
  return call(`${baseUrl}/api/climate`, token, { method: 'POST', body: JSON.stringify(change) });
}
