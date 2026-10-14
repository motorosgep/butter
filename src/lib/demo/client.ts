/**
 * A hub that lives in memory. Lets the app run without hardware: for trying
 * Butter before buying a gateway, for store reviewers, and for UI work.
 */

import type { EventHandler, StreamStatus, Subscription } from '../cube/sse';
import type { BridgeInfo, Device, DeviceState, SecurityMode } from '../cube/types';
import { mergeState } from '../cube/capabilities';
import type { HubApi } from '../hub/api';
import { DEMO_DEVICES } from './fixtures';

export const DEMO_BASE_URL = 'demo://home';

export class DemoClient implements HubApi {
  readonly baseUrl = DEMO_BASE_URL;
  token: string | undefined = 'demo';
  private devices: Device[] = DEMO_DEVICES.map((d) => ({ ...d, state: structuredClone(d.state), tags: { ...d.tags } }));
  private security: SecurityMode[] = [
    { sid: 1, name: 'home_mode', enable: false },
    { sid: 2, name: 'away_mode', enable: false },
    { sid: 3, name: 'sleep_mode', enable: false },
  ];
  private listeners = new Set<EventHandler>();

  async bridgeInfo(): Promise<BridgeInfo> {
    return { deviceid: 'demo', ip: '192.168.1.2', mac: '00:00:00:00:00:00', domain: 'demo.local', fw_version: '2.9.0', name: 'Demo home' };
  }

  async listDevices(): Promise<Device[]> {
    await delay(150);
    return this.devices.map(clone);
  }

  async setState(serial: string, state: DeviceState): Promise<void> {
    await delay(120);
    const device = this.find(serial);
    device.state = mergeState(device.state, state);
    this.emit('device#v2#updateDeviceState', { endpoint: { serial_number: serial }, payload: state });
  }

  async renameDevice(serial: string, name: string): Promise<void> {
    this.find(serial).name = name;
    this.emit('device#v2#updateDeviceInfo', { endpoint: { serial_number: serial }, payload: { name } });
  }

  async setTags(serial: string, tags: Record<string, unknown>): Promise<void> {
    const device = this.find(serial);
    device.tags = { ...device.tags, ...tags };
    this.emit('device#v2#updateDeviceInfo', { endpoint: { serial_number: serial }, payload: { tags: device.tags } });
  }

  async listSecurityModes(): Promise<SecurityMode[]> {
    return this.security.map((s) => ({ ...s }));
  }

  async enableSecurityMode(sid: number): Promise<void> {
    for (const s of this.security) s.enable = s.sid === sid;
  }

  async disableSecurityMode(sid: number): Promise<void> {
    for (const s of this.security) if (s.sid === sid) s.enable = false;
  }

  async disarm(): Promise<void> {
    for (const s of this.security) s.enable = false;
  }

  subscribe(onEvent: EventHandler, onStatus?: (status: StreamStatus, detail?: string) => void): Subscription {
    this.listeners.add(onEvent);
    onStatus?.('open');
    // A little life: temperatures drift, the hall sees motion now and then.
    const timer = setInterval(() => {
      const sensor = this.devices.find((d) => d.serial_number === 'demo-th-bedroom');
      if (sensor) {
        const t = Number(sensor.state.temperature.temperature) + (Math.random() - 0.5) * 0.4;
        void this.setState(sensor.serial_number, { temperature: { temperature: Math.round(t * 10) / 10 } });
      }
      if (Math.random() < 0.3) {
        void this.setState('demo-motion-hall', { detect: { detected: true } });
        setTimeout(() => void this.setState('demo-motion-hall', { detect: { detected: false } }), 4_000);
      }
    }, 8_000);
    return {
      close: () => {
        clearInterval(timer);
        this.listeners.delete(onEvent);
        onStatus?.('closed');
      },
    };
  }

  private find(serial: string): Device {
    const device = this.devices.find((d) => d.serial_number === serial);
    if (!device) throw new Error(`no demo device ${serial}`);
    return device;
  }

  private emit(name: string, data: unknown): void {
    const event = { name, data, raw: JSON.stringify(data) };
    for (const l of this.listeners) l(event);
  }
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
