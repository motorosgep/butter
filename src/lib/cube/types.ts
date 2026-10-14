/**
 * Types for the eWeLink CUBE Open API v2 as served by a SONOFF iHost.
 * Reference: https://cube.ewelink.cc/resources/developer-and-api-guide
 */

export type DisplayCategory =
  | 'plug'
  | 'switch'
  | 'light'
  | 'curtain'
  | 'contactSensor'
  | 'motionSensor'
  | 'temperatureSensor'
  | 'humiditySensor'
  | 'temperatureAndHumiditySensor'
  | 'waterLeakDetector'
  | 'smokeDetector'
  | 'button'
  | 'camera'
  | 'sensor'
  | 'fanLight'
  | 'airConditioner'
  | 'fan'
  | 'thermostat'
  | (string & {});

export interface Capability {
  capability: string;
  /** Sub-name for multi-instance capabilities such as `mode` or `thermostat-target-setpoint`. */
  name?: string;
  /** 4-bit permission string, e.g. "1100" = controllable + reportable. */
  permission: string;
  settings?: Record<string, CapabilitySetting>;
}

export interface CapabilitySetting {
  type: 'enum' | 'numeric' | 'object' | 'boolean' | 'string';
  permission: string;
  value?: unknown;
  values?: unknown[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  default?: unknown;
}

/** Device state is keyed by capability; multi-instance capabilities nest by `name`. */
export type DeviceState = Record<string, Record<string, unknown>>;

export interface Device {
  serial_number: string;
  name: string;
  manufacturer: string;
  model: string;
  firmware_version: string;
  display_category: DisplayCategory;
  capabilities: Capability[];
  protocol?: string;
  state: DeviceState;
  tags?: Record<string, unknown>;
  online: boolean;
  /** Present on third-party devices registered through the API. */
  third_serial_number?: string;
}

export interface BridgeInfo {
  deviceid: string;
  ip: string;
  mac: string;
  domain: string;
  fw_version: string;
  name: string;
}

/** As returned by GET /security: `{"sid":1,"name":"home_mode","enable":false}`. */
export interface SecurityMode {
  sid: number;
  name: 'home_mode' | 'away_mode' | 'sleep_mode' | (string & {});
  enable: boolean;
}

/** Payload of a `device#v2#updateDeviceState` event. */
export interface DeviceStateEvent {
  endpoint: { serial_number: string; third_serial_number?: string };
  payload: DeviceState;
}

/** Payload of a `device#v2#updateDeviceOnline` event. */
export interface DeviceOnlineEvent {
  endpoint: { serial_number: string; third_serial_number?: string };
  payload: { online: boolean };
}

export interface ApiEnvelope<T> {
  error: number;
  data: T;
  message: string;
}

/** Server-sent event names the gateway emits (module#version#type). */
export type CubeEventName =
  | 'device#v2#addDevice'
  | 'device#v2#updateDeviceState'
  | 'device#v2#updateDeviceInfo'
  | 'device#v2#deleteDevice'
  | 'device#v2#updateDeviceOnline'
  | 'bridge#v2#updateSecurityState'
  | 'security#v2#updateArmState'
  | (string & {});

export interface CubeEvent<T = unknown> {
  name: CubeEventName;
  data: T;
  raw: string;
}
