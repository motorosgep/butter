/**
 * Find gateways on the local network.
 *
 * eWeLink CUBE gateways advertise `_ewelink._tcp` over mDNS with an instance
 * name like `ihost-1002290bab`. Discovery needs a native module, so in Expo Go
 * it degrades to "type the address" (the caller sees `available: false`).
 */

import { CubeClient } from '../cube/client';
import type { BridgeInfo } from '../cube/types';

export interface FoundHub {
  /** mDNS instance name, e.g. ihost-1002290bab */
  name: string;
  host: string;
  address: string;
  baseUrl: string;
  info?: BridgeInfo;
}

type ZeroconfLike = {
  on(event: 'resolved', cb: (service: { name: string; host: string; addresses: string[]; ipv4: string[]; port: number }) => void): void;
  on(event: 'error', cb: (error: unknown) => void): void;
  scan(options: { type: string; protocol?: string; domain?: string }): void;
  stop(): void;
  removeDeviceListeners?(): void;
};

function loadZeroconf(): (new () => ZeroconfLike) | undefined {
  try {
    // Resolved at runtime so Expo Go (which lacks the native module) still runs the app.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-zeroconf') as { default?: new () => ZeroconfLike } | (new () => ZeroconfLike);
    return (typeof mod === 'function' ? mod : mod.default) ?? undefined;
  } catch {
    return undefined;
  }
}

export function discoveryAvailable(): boolean {
  return loadZeroconf() !== undefined;
}

/**
 * Scan for `durationMs`, probing each resolved gateway for its bridge info.
 * Calls `onFound` as hubs appear and resolves with the final list.
 */
export async function scanForHubs(durationMs = 6_000, onFound?: (hub: FoundHub) => void): Promise<FoundHub[]> {
  const Zeroconf = loadZeroconf();
  if (!Zeroconf) return [];
  const zeroconf = new Zeroconf();
  const found = new Map<string, FoundHub>();

  zeroconf.on('resolved', (service) => {
    const address = service.ipv4?.[0] ?? service.addresses?.find((a) => a.includes('.'));
    if (!address || found.has(service.name)) return;
    const hub: FoundHub = { name: service.name, host: service.host, address, baseUrl: `http://${address}` };
    found.set(service.name, hub);
    void new CubeClient({ baseUrl: hub.baseUrl, timeoutMs: 4_000 })
      .bridgeInfo()
      .then((info) => {
        hub.info = info;
        onFound?.(hub);
      })
      .catch(() => onFound?.(hub));
  });
  zeroconf.on('error', () => {
    /* keep scanning; a resolve timeout for one service is not fatal */
  });
  zeroconf.scan({ type: 'ewelink', protocol: 'tcp', domain: 'local.' });

  await new Promise((resolve) => setTimeout(resolve, durationMs));
  try {
    zeroconf.stop();
    zeroconf.removeDeviceListeners?.();
  } catch {
    // ignore
  }
  return [...found.values()];
}

/** Normalise what a user typed into a base URL. */
export function normaliseAddress(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

/** Probe a base URL: resolves with the gateway's info or throws. */
export async function probeHub(baseUrl: string): Promise<BridgeInfo> {
  return new CubeClient({ baseUrl, timeoutMs: 5_000 }).bridgeInfo();
}
