/**
 * The surface the app needs from a hub. The real client (`CubeClient`) and the
 * demo client both satisfy it, so every screen works without hardware.
 */

import type { EventHandler, StreamStatus, Subscription } from '../cube/sse';
import type { BridgeInfo, Device, DeviceState, SecurityMode } from '../cube/types';

export interface HubApi {
  readonly baseUrl: string;
  token: string | undefined;
  bridgeInfo(): Promise<BridgeInfo>;
  listDevices(): Promise<Device[]>;
  setState(serial: string, state: DeviceState): Promise<void>;
  renameDevice(serial: string, name: string): Promise<void>;
  setTags(serial: string, tags: Record<string, unknown>): Promise<void>;
  listSecurityModes(): Promise<SecurityMode[]>;
  enableSecurityMode(sid: number): Promise<void>;
  disableSecurityMode(sid: number): Promise<void>;
  disarm(): Promise<void>;
  subscribe(onEvent: EventHandler, onStatus?: (status: StreamStatus, detail?: string) => void): Subscription;
}
