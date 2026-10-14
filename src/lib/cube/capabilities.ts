/**
 * Turn a device's category, capabilities and state into something a screen can
 * render: an icon, a one-line summary, the controls to show and the readouts.
 *
 * Everything here is data-driven from what the hub reports, so a device type
 * Butter has never seen still gets a sensible tile.
 */

import type { Capability, Device, DeviceState, DisplayCategory } from './types';

// ----- categories -------------------------------------------------------------

export interface CategoryInfo {
  label: string;
  /** MaterialCommunityIcons name */
  icon: string;
}

const CATEGORIES: Record<string, CategoryInfo> = {
  plug: { label: 'Plug', icon: 'power-plug' },
  switch: { label: 'Switch', icon: 'light-switch' },
  light: { label: 'Light', icon: 'lightbulb' },
  curtain: { label: 'Curtain', icon: 'blinds' },
  contactSensor: { label: 'Door sensor', icon: 'door' },
  motionSensor: { label: 'Motion sensor', icon: 'motion-sensor' },
  temperatureSensor: { label: 'Temperature', icon: 'thermometer' },
  humiditySensor: { label: 'Humidity', icon: 'water-percent' },
  temperatureAndHumiditySensor: { label: 'Climate sensor', icon: 'thermometer' },
  waterLeakDetector: { label: 'Water leak', icon: 'water-alert' },
  smokeDetector: { label: 'Smoke', icon: 'smoke-detector' },
  button: { label: 'Button', icon: 'gesture-tap-button' },
  camera: { label: 'Camera', icon: 'cctv' },
  sensor: { label: 'Sensor', icon: 'radar' },
  fanLight: { label: 'Fan light', icon: 'ceiling-fan-light' },
  airConditioner: { label: 'Air conditioner', icon: 'air-conditioner' },
  fan: { label: 'Fan', icon: 'fan' },
  thermostat: { label: 'Thermostat', icon: 'thermostat' },
};

export function categoryInfo(category: DisplayCategory): CategoryInfo {
  return CATEGORIES[category] ?? { label: category, icon: 'help-circle-outline' };
}

// ----- state access ------------------------------------------------------------

export function stateValue(state: DeviceState, capability: string, attribute: string, name?: string): unknown {
  const block = state[capability];
  if (!block) return undefined;
  const scoped = name ? (block[name] as Record<string, unknown> | undefined) : block;
  return scoped?.[attribute];
}

export function hasCapability(device: Device, capability: string, name?: string): Capability | undefined {
  return device.capabilities.find((c) => c.capability === capability && (name === undefined || c.name === name));
}

/** Bit 3 of the permission string: the gateway lets clients control it. */
export function isControllable(cap: Capability): boolean {
  return cap.permission.length >= 4 && cap.permission[0] === '1';
}

export function isOn(device: Device): boolean | undefined {
  const v = stateValue(device.state, 'power', 'powerState');
  return v === undefined ? undefined : v === 'on';
}

/** Channels of a multi-gang switch: `[channel id, label]`. */
export function toggleChannels(device: Device): [string, string][] {
  const toggle = device.state.toggle;
  if (!toggle) return [];
  const names = (device.tags?.toggle ?? {}) as Record<string, string>;
  return Object.keys(toggle).map((id) => [id, names[id] || `Channel ${id}`]);
}

// ----- readouts ----------------------------------------------------------------

export interface Readout {
  key: string;
  label: string;
  value: string;
  /** MaterialCommunityIcons name */
  icon?: string;
}

const UNIT: Record<string, (v: unknown) => string> = {
  temperature: (v) => `${fmt(v, 1)}°`,
  humidity: (v) => `${fmt(v, 0)}%`,
  battery: (v) => `${fmt(v, 0)}%`,
  rssi: (v) => `${fmt(v, 0)} dBm`,
  lqi: (v) => `${fmt(v, 0)}`,
  illumination: (v) => `${fmt(v, 0)} lx`,
  'illumination-level': (v) => String(v),
  co2: (v) => `${fmt(v, 0)} ppm`,
  pm25: (v) => `${fmt(v, 0)} µg/m³`,
  'electric-power': (v) => `${fmt(Number(v) / 100, 1)} W`,
  voltage: (v) => `${fmt(Number(v) / 100, 1)} V`,
  'electric-current': (v) => `${fmt(Number(v) / 100, 2)} A`,
  'barometric-pressure': (v) => `${fmt(v, 0)} hPa`,
};

const READOUT_LABEL: Record<string, [string, string]> = {
  temperature: ['Temperature', 'thermometer'],
  humidity: ['Humidity', 'water-percent'],
  battery: ['Battery', 'battery'],
  rssi: ['Signal', 'wifi'],
  lqi: ['Link quality', 'signal'],
  illumination: ['Light level', 'brightness-6'],
  'illumination-level': ['Light level', 'brightness-6'],
  co2: ['CO₂', 'molecule-co2'],
  pm25: ['PM2.5', 'blur'],
  'electric-power': ['Power', 'flash'],
  voltage: ['Voltage', 'flash-outline'],
  'electric-current': ['Current', 'current-ac'],
  'barometric-pressure': ['Pressure', 'gauge'],
  detect: ['Detection', 'radar'],
  contact: ['Door', 'door'],
  motion: ['Motion', 'motion-sensor'],
  'water-leak': ['Water leak', 'water-alert'],
  smoke: ['Smoke', 'smoke-detector'],
  tamper: ['Tamper', 'alert'],
  press: ['Last press', 'gesture-tap-button'],
  fault: ['Fault', 'alert-circle'],
};

function fmt(v: unknown, digits: number): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : String(v);
}

function booleanWord(capability: string, value: boolean): string {
  switch (capability) {
    case 'contact':
      return value ? 'Open' : 'Closed';
    case 'motion':
      return value ? 'Motion' : 'Clear';
    case 'water-leak':
      return value ? 'Leak!' : 'Dry';
    case 'smoke':
      return value ? 'Smoke!' : 'Clear';
    case 'tamper':
      return value ? 'Tampered' : 'OK';
    default:
      return value ? 'Detected' : 'Clear';
  }
}

/** Sensor-style values worth showing on a tile or in the detail screen. */
export function readouts(device: Device): Readout[] {
  const out: Readout[] = [];
  for (const cap of device.capabilities) {
    const key = cap.capability;
    if (!(key in READOUT_LABEL)) continue;
    const block = device.state[key];
    if (!block) continue;
    const [label, icon] = READOUT_LABEL[key];
    const raw = firstScalar(block);
    if (raw === undefined) continue;
    let value: string;
    if (typeof raw === 'boolean') value = booleanWord(key, raw);
    else if (key in UNIT) value = UNIT[key](raw);
    else value = String(raw);
    out.push({ key, label, value, icon });
  }
  return out;
}

function firstScalar(block: Record<string, unknown>): string | number | boolean | undefined {
  for (const [k, v] of Object.entries(block)) {
    if (k === 'updated_at') continue;
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  }
  return undefined;
}

// ----- summary line ---------------------------------------------------------------

export function summary(device: Device): string {
  if (!device.online) return 'Offline';
  const parts: string[] = [];
  const on = isOn(device);
  const category = device.display_category;

  if (category === 'airConditioner' || category === 'thermostat') {
    const mode = stateValue(device.state, 'mode', 'modeValue', 'airConditionerMode');
    const target = firstSetpoint(device.state);
    if (on === false) parts.push('Off');
    else if (mode) parts.push(capitalise(String(mode)));
    else if (on) parts.push('On');
    if (target !== undefined) parts.push(`→ ${fmt(target, 1)}°`);
  } else if (on !== undefined) {
    parts.push(on ? 'On' : 'Off');
    const b = stateValue(device.state, 'brightness', 'brightness');
    if (on && b !== undefined) parts.push(`${fmt(b, 0)}%`);
  } else {
    const channels = toggleChannels(device);
    if (channels.length) {
      const onCount = channels.filter(([id]) => stateValue(device.state, 'toggle', 'toggleState', id) === 'on').length;
      parts.push(`${onCount}/${channels.length} on`);
    }
  }
  const pct = stateValue(device.state, 'percentage', 'percentage');
  if (pct !== undefined) parts.push(`${fmt(pct, 0)}%`);

  for (const r of readouts(device).slice(0, 3)) parts.push(r.value);
  return parts.join(' · ') || categoryInfo(category).label;
}

export function firstSetpoint(state: DeviceState): number | undefined {
  const block = state['thermostat-target-setpoint'];
  if (!block) return undefined;
  for (const name of ['manual-mode', 'auto-mode', 'eco-mode', ...Object.keys(block)]) {
    const v = (block[name] as Record<string, unknown> | undefined)?.targetSetpoint;
    if (typeof v === 'number') return v;
  }
  return undefined;
}

export function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// ----- controls ---------------------------------------------------------------------

export type Control =
  | { kind: 'power'; label: string }
  | { kind: 'toggle'; channel: string; label: string }
  | { kind: 'switch'; capability: string; label: string }
  | { kind: 'level'; capability: string; attribute: string; label: string; min: number; max: number; step: number; unit: string }
  | { kind: 'mode'; name: string; label: string; values: string[] }
  | { kind: 'setpoint'; name: string; label: string; min: number; max: number; step: number }
  | { kind: 'motor'; label: string };

const SWITCH_LABEL: Record<string, string> = {
  eco: 'ECO',
  'child-lock': 'Child lock',
  'vertical-swing': 'Vertical swing',
  'horizontal-swing': 'Horizontal swing',
  'anti-direct-blow': 'Anti direct blow',
  'window-detection': 'Window detection',
};

const MODE_LABEL: Record<string, string> = {
  airConditionerMode: 'Mode',
  fanLevel: 'Fan',
  fanMode: 'Fan mode',
  thermostatMode: 'Mode',
  horizontalAngle: 'Horizontal angle',
  verticalAngle: 'Vertical angle',
};

/** Controls the detail screen should render, in display order. */
export function controls(device: Device): Control[] {
  const out: Control[] = [];
  for (const cap of device.capabilities) {
    if (!isControllable(cap)) continue;
    switch (cap.capability) {
      case 'power':
        out.push({ kind: 'power', label: 'Power' });
        break;
      case 'toggle':
        for (const [channel, label] of toggleChannels(device)) out.push({ kind: 'toggle', channel, label });
        break;
      case 'brightness':
        out.push({ kind: 'level', capability: 'brightness', attribute: 'brightness', label: 'Brightness', min: 1, max: 100, step: 10, unit: '%' });
        break;
      case 'color-temperature':
        out.push({ kind: 'level', capability: 'color-temperature', attribute: 'colorTemperature', label: 'Colour temperature', min: 0, max: 100, step: 10, unit: '%' });
        break;
      case 'percentage':
        out.push({ kind: 'level', capability: 'percentage', attribute: 'percentage', label: 'Position', min: 0, max: 100, step: 10, unit: '%' });
        break;
      case 'motor-control':
        out.push({ kind: 'motor', label: 'Motor' });
        break;
      case 'mode': {
        const values = (cap.settings?.supportedValues?.values ?? []).map(String);
        if (cap.name && values.length) out.push({ kind: 'mode', name: cap.name, label: MODE_LABEL[cap.name] ?? cap.name, values });
        break;
      }
      case 'thermostat-target-setpoint': {
        const range = cap.settings?.temperatureRange;
        out.push({
          kind: 'setpoint',
          name: cap.name ?? 'manual-mode',
          label: cap.name && cap.name !== 'manual-mode' ? `Target (${cap.name.replace('-mode', '')})` : 'Target',
          min: range?.min ?? 5,
          max: range?.max ?? 35,
          step: range?.step ?? 0.5,
        });
        break;
      }
      default:
        if (cap.capability in SWITCH_LABEL) out.push({ kind: 'switch', capability: cap.capability, label: SWITCH_LABEL[cap.capability] });
    }
  }
  return out;
}

/** Build the state fragment for a control change. */
export function commandFor(control: Control, value: unknown): DeviceState {
  switch (control.kind) {
    case 'power':
      return { power: { powerState: value ? 'on' : 'off' } };
    case 'toggle':
      return { toggle: { [control.channel]: { toggleState: value ? 'on' : 'off' } } };
    case 'switch':
      return { [control.capability]: { powerState: value ? 'on' : 'off' } };
    case 'level':
      return { [control.capability]: { [control.attribute]: value } };
    case 'mode':
      return { mode: { [control.name]: { modeValue: value } } };
    case 'setpoint':
      return { 'thermostat-target-setpoint': { [control.name]: { targetSetpoint: value } } };
    case 'motor':
      return { 'motor-control': { motorControl: value } };
  }
}

/** Current value of a control, read from device state. */
export function controlValue(device: Device, control: Control): unknown {
  switch (control.kind) {
    case 'power':
      return isOn(device);
    case 'toggle':
      return stateValue(device.state, 'toggle', 'toggleState', control.channel) === 'on';
    case 'switch':
      return stateValue(device.state, control.capability, 'powerState') === 'on';
    case 'level':
      return stateValue(device.state, control.capability, control.attribute);
    case 'mode':
      return stateValue(device.state, 'mode', 'modeValue', control.name);
    case 'setpoint':
      return stateValue(device.state, 'thermostat-target-setpoint', 'targetSetpoint', control.name);
    case 'motor':
      return stateValue(device.state, 'motor-control', 'motorControl');
  }
}

/** Merge a state fragment (from an event or an optimistic update) into device state. */
export function mergeState(state: DeviceState, fragment: DeviceState): DeviceState {
  const next: DeviceState = { ...state };
  for (const [cap, block] of Object.entries(fragment)) {
    const current = next[cap] ?? {};
    const merged: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(block)) {
      const existing = current[k];
      merged[k] = isObject(v) && isObject(existing) ? { ...existing, ...v } : v;
    }
    next[cap] = merged;
  }
  return next;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Room name stored on the hub as a device tag. */
export const ROOM_TAG = 'room';

export function roomOf(device: Device): string | undefined {
  const room = device.tags?.[ROOM_TAG];
  return typeof room === 'string' && room.trim() ? room.trim() : undefined;
}
