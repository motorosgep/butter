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
}

/** The bridge answered, but the network pages are not there or not for us. */
export class NetworkUnavailable extends Error {}

async function call<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(20_000) : undefined;
  const res = await fetch(url, { ...init, signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers } });
  // A bridge from before the network pages has no such route.
  if (res.status === 404 && url.endsWith('/api/network')) throw new NetworkUnavailable('the bridge on the hub is too old for the network page; update the add-on');
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
