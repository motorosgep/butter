/**
 * App state: the hubs the user paired, the active hub's devices, the live
 * connection, and the actions screens call.
 *
 * Hub addresses and names live in AsyncStorage; tokens live in the secure
 * store, keyed by hub id. Device state is kept in memory and fed by the event
 * stream; commands are applied optimistically and corrected by the hub's
 * own update event.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { DemoHistory } from '../demo/history';
import { HistoryClient, defaultHistoryUrl, probeHistory, type HistorySource } from '../history/client';
import { clearSparklines } from '../history/sparkline';
import { discoveryAvailable, probeHub, scanForHubs } from './discovery';

import { PIN_TAG } from '../cube/appearance';
import { mergeState } from '../cube/capabilities';
import { CubeAuthError, CubeClient } from '../cube/client';
import type { Subscription } from '../cube/sse';
import type { BridgeInfo, CubeEvent, Device, DeviceState, DeviceStateEvent, SecurityMode } from '../cube/types';
import { DEMO_BASE_URL, DemoClient } from '../demo/client';
import type { Place } from '../weather/open-meteo';
import type { HubApi } from './api';

export interface Hub {
  id: string;
  name: string;
  baseUrl: string;
  demo?: boolean;
  info?: BridgeInfo;
  /** Where the history recorder lives; empty = next to the hub on port 9900. */
  historyUrl?: string;
  /** Where the home is, for the weather tile; `null` means the user hid the tile. */
  place?: Place | null;
}

/** The demo home's weather comes from a real place so the tile has something to show. */
const DEMO_PLACE: Place = { name: 'London', region: 'England', country: 'United Kingdom', lat: 51.5072, lon: -0.1276 };

export type HistoryStatus = 'unknown' | 'checking' | 'available' | 'unavailable';

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline' | 'unauthorised';

interface HubState {
  hydrated: boolean;
  hubs: Hub[];
  activeHubId?: string;
  client?: HubApi;
  devices: Record<string, Device>;
  security: SecurityMode[];
  status: ConnectionStatus;
  statusDetail?: string;
  lastError?: string;
  history?: HistorySource;
  historyStatus: HistoryStatus;

  hydrate(): Promise<void>;
  addHub(hub: Omit<Hub, 'id'>, token: string): Promise<Hub>;
  removeHub(id: string): Promise<void>;
  selectHub(id: string): Promise<void>;
  connect(): Promise<void>;
  disconnect(): void;
  refresh(): Promise<void>;
  control(serial: string, state: DeviceState): Promise<void>;
  rename(serial: string, name: string): Promise<void>;
  setRoom(serial: string, room: string | null): Promise<void>;
  /** Pin a device to the Favourites section at the top of Home (stored as a hub tag). */
  setPinned(serial: string, pinned: boolean): Promise<void>;
  setSecurity(sid: number, enable: boolean): Promise<void>;
  disarm(): Promise<void>;
  /** Find the history recorder for the active hub (auto or the hub's override). */
  detectHistory(): Promise<void>;
  setHistoryUrl(id: string, url: string | undefined): Promise<void>;
  /** Set the home's place for the weather tile; `null` hides the tile, `undefined` asks again. */
  setPlace(id: string, place: Place | null | undefined): Promise<void>;
  /** Point a hub at a new address (after a router change) and reconnect. */
  setHubAddress(id: string, baseUrl: string): Promise<void>;
  /** Look for the active hub on the network by its device id and adopt its new address. */
  relocateHub(): Promise<boolean>;
}

const HUBS_KEY = 'butter.hubs';
const ACTIVE_KEY = 'butter.activeHub';
const tokenKey = (id: string) => `butter.token.${id.replace(/[^A-Za-z0-9._-]/g, '_')}`;

let subscription: Subscription | undefined;

export const useHub = create<HubState>((set, get) => ({
  hydrated: false,
  hubs: [],
  devices: {},
  security: [],
  status: 'idle',
  historyStatus: 'unknown',

  async hydrate() {
    try {
      const [hubsJson, active] = await Promise.all([AsyncStorage.getItem(HUBS_KEY), AsyncStorage.getItem(ACTIVE_KEY)]);
      const hubs: Hub[] = hubsJson ? JSON.parse(hubsJson) : [];
      set({ hubs, activeHubId: active && hubs.some((h) => h.id === active) ? active : hubs[0]?.id, hydrated: true });
    } catch (error) {
      set({ hydrated: true, lastError: message(error) });
    }
    if (get().activeHubId) void get().connect();
  },

  async addHub(partial, token) {
    const id = partial.demo ? 'demo' : partial.info?.deviceid ?? partial.baseUrl.replace(/[^A-Za-z0-9]/g, '-');
    const hub: Hub = { ...partial, id };
    if (hub.demo && hub.place === undefined) hub.place = DEMO_PLACE;
    if (!hub.demo) await SecureStore.setItemAsync(tokenKey(id), token);
    const hubs = [...get().hubs.filter((h) => h.id !== id), hub];
    await AsyncStorage.multiSet([
      [HUBS_KEY, JSON.stringify(hubs)],
      [ACTIVE_KEY, id],
    ]);
    get().disconnect();
    set({ hubs, activeHubId: id, devices: {}, security: [] });
    await get().connect();
    return hub;
  },

  async removeHub(id) {
    const hubs = get().hubs.filter((h) => h.id !== id);
    await AsyncStorage.setItem(HUBS_KEY, JSON.stringify(hubs));
    if (id !== 'demo') await SecureStore.deleteItemAsync(tokenKey(id)).catch(() => undefined);
    if (get().activeHubId === id) {
      get().disconnect();
      const next = hubs[0]?.id;
      await (next ? AsyncStorage.setItem(ACTIVE_KEY, next) : AsyncStorage.removeItem(ACTIVE_KEY));
      set({ hubs, activeHubId: next, devices: {}, security: [], status: 'idle' });
      if (next) await get().connect();
    } else {
      set({ hubs });
    }
  },

  async selectHub(id) {
    if (id === get().activeHubId) return;
    get().disconnect();
    await AsyncStorage.setItem(ACTIVE_KEY, id);
    set({ activeHubId: id, devices: {}, security: [], status: 'idle' });
    await get().connect();
  },

  async connect() {
    const hub = get().hubs.find((h) => h.id === get().activeHubId);
    if (!hub) return;
    get().disconnect();
    let client: HubApi;
    if (hub.demo) {
      client = new DemoClient();
    } else {
      const token = await SecureStore.getItemAsync(tokenKey(hub.id));
      if (!token) {
        set({ status: 'unauthorised', statusDetail: 'no token stored for this hub' });
        return;
      }
      client = new CubeClient({ baseUrl: hub.baseUrl, token, appName: 'Butter' });
    }
    set({ client, status: 'connecting', statusDetail: undefined, lastError: undefined });
    try {
      await get().refresh();
    } catch (error) {
      if (error instanceof CubeAuthError) {
        set({ status: 'unauthorised', statusDetail: message(error) });
        return;
      }
      set({ status: 'offline', statusDetail: `${message(error)}. Looking for the hub on the network…` });
      // Routers hand out new addresses; the hub keeps its device id, so follow it.
      if (await get().relocateHub()) return;
      set({ status: 'offline', statusDetail: message(error) });
      return;
    }
    subscription = client.subscribe(
      (event) => applyEvent(event, set, get),
      (status, detail) => {
        if (status === 'open') set({ status: 'online', statusDetail: undefined });
        else if (status === 'closed') set({ status: 'offline', statusDetail: detail });
      },
    );
    void get().detectHistory();
  },

  async detectHistory() {
    const hub = get().hubs.find((h) => h.id === get().activeHubId);
    if (!hub) return;
    if (hub.demo) {
      set({ history: new DemoHistory(), historyStatus: 'available' });
      return;
    }
    const url = hub.historyUrl?.trim() || defaultHistoryUrl(hub.baseUrl);
    set({ history: undefined, historyStatus: 'checking' });
    try {
      await probeHistory(url);
      if (get().activeHubId === hub.id) set({ history: new HistoryClient(url), historyStatus: 'available' });
    } catch {
      if (get().activeHubId === hub.id) set({ history: undefined, historyStatus: 'unavailable' });
    }
  },

  async setHubAddress(id, baseUrl) {
    const info = await probeHub(baseUrl);
    const hubs = get().hubs.map((h) => (h.id === id ? { ...h, baseUrl, info } : h));
    await AsyncStorage.setItem(HUBS_KEY, JSON.stringify(hubs));
    set({ hubs });
    if (get().activeHubId === id) await get().connect();
  },

  async relocateHub() {
    const hub = get().hubs.find((h) => h.id === get().activeHubId);
    const deviceid = hub?.info?.deviceid;
    if (!hub || hub.demo || !deviceid || !discoveryAvailable()) return false;
    const found = await scanForHubs(5_000).catch(() => []);
    const match = found.find((f) => f.info?.deviceid === deviceid && f.baseUrl !== hub.baseUrl);
    if (!match) return false;
    const hubs = get().hubs.map((h) => (h.id === hub.id ? { ...h, baseUrl: match.baseUrl, info: match.info ?? h.info } : h));
    await AsyncStorage.setItem(HUBS_KEY, JSON.stringify(hubs));
    set({ hubs });
    await get().connect();
    return get().status !== 'offline';
  },

  async setPlace(id, place) {
    const hubs = get().hubs.map((h) => (h.id === id ? { ...h, place } : h));
    await AsyncStorage.setItem(HUBS_KEY, JSON.stringify(hubs));
    set({ hubs });
  },

  async setHistoryUrl(id, url) {
    const hubs = get().hubs.map((h) => (h.id === id ? { ...h, historyUrl: url?.trim() || undefined } : h));
    await AsyncStorage.setItem(HUBS_KEY, JSON.stringify(hubs));
    set({ hubs });
    if (get().activeHubId === id) await get().detectHistory();
  },

  disconnect() {
    subscription?.close();
    subscription = undefined;
    clearSparklines();
    set({ client: undefined, status: 'idle', history: undefined, historyStatus: 'unknown' });
  },

  async refresh() {
    const client = get().client;
    if (!client) return;
    const [devices, security] = await Promise.all([client.listDevices(), client.listSecurityModes().catch(() => [] as SecurityMode[])]);
    set({ devices: Object.fromEntries(devices.map((d) => [d.serial_number, d])), security, status: 'online' });
  },

  async control(serial, state) {
    const { client, devices } = get();
    if (!client) throw new Error('not connected');
    const device = devices[serial];
    if (device) set({ devices: { ...devices, [serial]: { ...device, state: mergeState(device.state, state) } } });
    try {
      await client.setState(serial, state);
    } catch (error) {
      set({ lastError: message(error) });
      await get().refresh().catch(() => undefined);
      throw error;
    }
  },

  async rename(serial, name) {
    const { client, devices } = get();
    if (!client) throw new Error('not connected');
    await client.renameDevice(serial, name);
    const device = devices[serial];
    if (device) set({ devices: { ...devices, [serial]: { ...device, name } } });
  },

  async setRoom(serial, room) {
    const { client, devices } = get();
    if (!client) throw new Error('not connected');
    const device = devices[serial];
    const tags = { ...(device?.tags ?? {}), room: room ?? '' };
    await client.setTags(serial, tags);
    if (device) set({ devices: { ...devices, [serial]: { ...device, tags } } });
  },

  async setPinned(serial, pinned) {
    const { client, devices } = get();
    if (!client) throw new Error('not connected');
    const device = devices[serial];
    // An empty string unpins: the hub may merge tags rather than replace them.
    const tags = { ...(device?.tags ?? {}), [PIN_TAG]: pinned ? String(Math.floor(Date.now() / 1000)) : '' };
    await client.setTags(serial, tags);
    if (device) set({ devices: { ...devices, [serial]: { ...device, tags } } });
  },

  async setSecurity(sid, enable) {
    const client = get().client;
    if (!client) throw new Error('not connected');
    if (enable) await client.enableSecurityMode(sid);
    else await client.disableSecurityMode(sid);
    set({ security: await client.listSecurityModes() });
  },

  async disarm() {
    const client = get().client;
    if (!client) throw new Error('not connected');
    await client.disarm();
    set({ security: await client.listSecurityModes() });
  },
}));

function applyEvent(event: CubeEvent, set: (partial: Partial<HubState>) => void, get: () => HubState): void {
  const devices = get().devices;
  switch (event.name) {
    case 'device#v2#updateDeviceState': {
      const { endpoint, payload } = event.data as DeviceStateEvent;
      const device = devices[endpoint.serial_number];
      if (device) set({ devices: { ...devices, [endpoint.serial_number]: { ...device, state: mergeState(device.state, payload) } } });
      break;
    }
    case 'device#v2#updateDeviceOnline': {
      const { endpoint, payload } = event.data as { endpoint: { serial_number: string }; payload: { online: boolean } };
      const device = devices[endpoint.serial_number];
      if (device) set({ devices: { ...devices, [endpoint.serial_number]: { ...device, online: payload.online } } });
      break;
    }
    case 'device#v2#updateDeviceInfo': {
      const { endpoint, payload } = event.data as { endpoint: { serial_number: string }; payload: Partial<Device> };
      const device = devices[endpoint.serial_number];
      if (device) set({ devices: { ...devices, [endpoint.serial_number]: { ...device, ...payload } } });
      break;
    }
    case 'device#v2#addDevice':
    case 'device#v2#deleteDevice':
      void get().refresh().catch(() => undefined);
      break;
    case 'bridge#v2#updateSecurityState':
    case 'security#v2#updateArmState':
      void get().client?.listSecurityModes().then((security) => set({ security })).catch(() => undefined);
      break;
    default:
      break;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ----- selectors ------------------------------------------------------------------

export const selectActiveHub = (s: HubState): Hub | undefined => s.hubs.find((h) => h.id === s.activeHubId);
export const selectDeviceList = (s: HubState): Device[] => Object.values(s.devices);
/**
 * Devices as an array. `Object.values` makes a fresh array on every call, which
 * zustand's snapshot comparison would treat as a change on every render, so the
 * array is compared element by element.
 */
export const useDeviceList = (): Device[] => useHub(useShallow(selectDeviceList));
export const isDemoUrl = (url: string): boolean => url === DEMO_BASE_URL;
