/**
 * The home network (TP-Link Deco mesh) as the ihost-bridge add-on serves it.
 * The bridge holds the Deco admin password and reads the mesh once a minute;
 * Butter shows who is connected and asks the bridge to pin fixed addresses.
 * These pages answer only apps paired with the hub, so every request carries
 * the hub's access token.
 */

export interface DecoUnit {
  mac: string;
  name: string;
  model: string;
  /** "master" is the main Deco, wired to the modem. */
  role: string;
  ip: string;
  firmware: string;
  online: boolean;
}

export interface NetClient {
  mac: string;
  name: string;
  ip: string;
  online: boolean;
  wired?: boolean;
  /** band2_4, band5, band6 */
  band?: string | null;
  deco?: string;
  deco_mac?: string;
  /** The fixed address the Deco keeps for it, if any. */
  reserved_ip?: string | null;
  /** What the bridge itself calls this address (the hub, a Midea unit). */
  known_as?: string | null;
  /** Looks like smart-home gear, worth a fixed address. */
  smart_home: boolean;
  last_seen?: number;
}

export interface Network {
  configured: boolean;
  error?: string | null;
  fetched_at?: number | null;
  internet?: { online: boolean; ipv4: string; ipv6: string; link: string; connect_type: string } | null;
  lan?: { address: string; network: string } | null;
  units: DecoUnit[];
  clients: NetClient[];
  reservations: { items: { mac: string; ip: string }[]; max: number | null };
  /** The home's traffic right now (absent on a bridge before 0.4.2). */
  traffic_now?: TrafficNow;
}

/** Rates in kB/s, as the Deco reports them (it refreshes them every minute or two). */
export interface TrafficNow {
  at: number | null;
  down: number;
  up: number;
  decos: Record<string, { down: number; up: number; devices: number }>;
}

export interface TrafficDay {
  day: string;
  /** Data moved, in kB, estimated from the rates. */
  down_kb: number;
  up_kb: number;
  devices: { mac: string; name: string; deco: string | null; down: number; up: number }[];
}

export interface Traffic {
  configured: boolean;
  now: TrafficNow;
  /** [epoch s, down kB/s, up kB/s], one per mesh read, the last 24 hours. */
  samples: [number, number, number][];
  /** [hour start, down avg, up avg, down peak, up peak, down kB, up kB], the last 30 days (kB from bridge 0.4.2's second build on). */
  hours: [number, number, number, number, number, number?, number?][];
  today: TrafficDay;
  yesterday: TrafficDay;
}

/** The bridge answered, but the network pages are not there or not for us. */
export class NetworkUnavailable extends Error {}

async function call<T>(url: string, token: string, init?: RequestInit, timeoutMs = 20_000): Promise<T> {
  const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined;
  const res = await fetch(url, { ...init, signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers } });
  // A bridge from before the network pages has no such route.
  if (res.status === 404 && (url.endsWith('/api/network') || url.endsWith('/api/network/traffic'))) throw new NetworkUnavailable('the bridge on the hub is too old for this page; update the add-on');
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401 || res.status === 403) throw new NetworkUnavailable(body.error ?? 'the bridge did not accept the hub token');
  if (!res.ok) throw new Error(body.error ?? `the bridge answered ${res.status}`);
  return body;
}

export function fetchNetwork(baseUrl: string, token: string): Promise<Network> {
  return call<Network>(`${baseUrl}/api/network`, token).then((n) => ({ ...n, units: n.units ?? [], clients: n.clients ?? [], reservations: n.reservations ?? { items: [], max: null } }));
}

export interface ReserveResult {
  added: number;
  changed: number;
  unchanged: number;
}

/** Pin each MAC to its IP on the Deco. The bridge checks every item before it writes anything. */
export function reserve(baseUrl: string, token: string, items: { mac: string; ip: string }[]): Promise<ReserveResult> {
  return call<ReserveResult>(`${baseUrl}/api/network/reservations`, token, { method: 'POST', body: JSON.stringify({ items }) });
}

export function fetchTraffic(baseUrl: string, token: string): Promise<Traffic> {
  return call<Traffic>(`${baseUrl}/api/network/traffic`, token);
}

/** A rate in kB/s as Mbit/s: "48", "8.2", "0.3". */
export function mbps(kBps: number): string {
  const v = (kBps * 8) / 1000;
  return v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(0) : v.toFixed(1);
}

/** A volume in kB: "830 MB", "4.2 GB". */
export function volume(kb: number): string {
  if (kb >= 1_000_000) return `${(kb / 1_000_000).toFixed(kb >= 10_000_000 ? 0 : 1)} GB`;
  if (kb >= 1000) return `${Math.round(kb / 1000)} MB`;
  return `${Math.round(kb)} kB`;
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function ago(epochSeconds: number, now = Date.now()): string {
  const s = Math.max(0, now / 1000 - epochSeconds);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 48 * 3600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

export function unreserve(baseUrl: string, token: string, mac: string): Promise<void> {
  return call<void>(`${baseUrl}/api/network/reservations/${encodeURIComponent(mac)}`, token, { method: 'DELETE' });
}

/** How the client is connected, for a row's subtitle. */
export function linkLabel(client: NetClient): string {
  if (client.wired) return 'Wired';
  switch (client.band) {
    case 'band2_4':
      return '2.4 GHz';
    case 'band5':
      return '5 GHz';
    case 'band6':
      return '6 GHz';
    default:
      return 'Wi-Fi';
  }
}

export function clientName(client: NetClient): string {
  return client.known_as || client.name || client.mac;
}

/** Smart-home devices online at an address the Deco does not keep for them yet. */
export function unpinnedSmartHome(network: Network): NetClient[] {
  return network.clients.filter((c) => c.smart_home && c.online && c.ip && c.reserved_ip !== c.ip);
}
