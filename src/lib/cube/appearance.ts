/**
 * How a device looks on the Home grid: the colour it takes while it is doing
 * something, the reading that deserves to be big, and whether the user pinned
 * it to Favourites. Pure functions over device state; no React in here.
 *
 * The rule for colour is that it always means state, never decoration: a page
 * of idle devices stays calm and anything active stands out.
 */

import { categoryInfo, controls, firstScalarEntry, formatValue, isOn, readouts, stateValue, toggleChannels, type Readout } from './capabilities';
import type { Device } from './types';

// ----- colours ------------------------------------------------------------------

export const STATE_COLORS = {
  /** A light, plug or switch that is on. */
  on: '#F2B544',
  cool: '#4FA3E0',
  heat: '#F0803C',
  fan: '#4CBB7A',
  dry: '#3FB8AF',
  /** A leak, smoke or fault. */
  alert: '#E05A5A',
} as const;

/** Ink for icons drawn on top of a state colour. */
export const INK = '#1a1a1c';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
}

/** Blend two hex colours; k = 0 gives `a`, k = 1 gives `b`. */
export function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
}

const TEMPERATURE_STOPS: [number, string][] = [
  [6, '#5B9DF2'],
  [15, '#79C4EC'],
  [19, '#8FD6A3'],
  [23, '#A9DC8E'],
  [26, '#F2B544'],
  [31, '#F0803C'],
  [38, '#E05A5A'],
];

/** Cold–comfortable–hot scale for a temperature in °C. */
export function temperatureColor(t: number): string {
  if (!Number.isFinite(t)) return '#8FD6A3';
  if (t <= TEMPERATURE_STOPS[0][0]) return TEMPERATURE_STOPS[0][1];
  for (let i = 1; i < TEMPERATURE_STOPS.length; i++) {
    const [t1, c1] = TEMPERATURE_STOPS[i];
    if (t <= t1) {
      const [t0, c0] = TEMPERATURE_STOPS[i - 1];
      return mix(c0, c1, (t - t0) / (t1 - t0));
    }
  }
  return TEMPERATURE_STOPS[TEMPERATURE_STOPS.length - 1][1];
}

function bandColor(v: number, bands: [number, string][], above: string): string {
  for (const [limit, color] of bands) if (v < limit) return color;
  return above;
}

// ----- state colour (B) -------------------------------------------------------------

export interface Accent {
  color: string;
  /** Icon that explains the colour, e.g. a snowflake while cooling. */
  icon?: string;
}

const ALERT_CAPABILITIES = new Set(['water-leak', 'smoke', 'fault']);
const ALERT_CATEGORIES = new Set(['waterLeakDetector', 'smokeDetector']);
const EVENT_CAPABILITIES = ['detect', 'contact', 'motion', 'water-leak', 'smoke', 'fault'];

/** The colour a tile takes while the device is active, or nothing when idle. */
export function activeAccent(device: Device): Accent | undefined {
  if (!device.online) return undefined;
  const on = isOn(device);
  const category = device.display_category;

  if (category === 'airConditioner' || category === 'thermostat') {
    if (on === false) return undefined;
    const raw = stateValue(device.state, 'mode', 'modeValue', 'airConditionerMode') ?? stateValue(device.state, 'mode', 'modeValue', 'thermostatMode');
    const mode = String(raw ?? '').toLowerCase();
    if (mode.includes('cool')) return { color: STATE_COLORS.cool, icon: 'snowflake' };
    if (mode.includes('heat')) return { color: STATE_COLORS.heat, icon: 'fire' };
    if (mode.includes('fan')) return { color: STATE_COLORS.fan, icon: 'fan' };
    if (mode.includes('dry')) return { color: STATE_COLORS.dry, icon: 'water-percent' };
    if (on === undefined && !mode) return undefined;
    return { color: category === 'thermostat' ? STATE_COLORS.heat : STATE_COLORS.on };
  }
  if (category === 'fan' || category === 'fanLight') {
    return on ? { color: STATE_COLORS.fan, icon: 'fan' } : undefined;
  }
  if (on !== undefined) return on ? { color: STATE_COLORS.on } : undefined;

  const channels = toggleChannels(device);
  if (channels.length) {
    const anyOn = channels.some(([id]) => stateValue(device.state, 'toggle', 'toggleState', id) === 'on');
    return anyOn ? { color: STATE_COLORS.on } : undefined;
  }

  for (const cap of EVENT_CAPABILITIES) {
    const block = device.state[cap];
    if (!block) continue;
    const entry = firstScalarEntry(block);
    if (entry?.[1] !== true) continue;
    const alert = ALERT_CAPABILITIES.has(cap) || ALERT_CATEGORIES.has(category);
    return alert ? { color: STATE_COLORS.alert, icon: 'alert' } : { color: STATE_COLORS.on };
  }
  return undefined;
}

// ----- hero reading (A) -------------------------------------------------------------

export interface HeroReading {
  capability: string;
  /** Recorder metric key, `<capability>.<attribute>`. */
  metric: string;
  /** Value in display units. */
  value: number;
  text: string;
  color: string;
  /** Multiply recorder samples by this to get display units. */
  scale: number;
  /** Smallest span the sparkline shows, so a steady reading looks steady. */
  minSpan: number;
  format: (v: number) => string;
  /** The other readouts, battery last. */
  rest: Readout[];
}

interface HeroSpec {
  scale: number;
  minSpan: number;
  color: (v: number) => string;
  format: (v: number) => string;
}

const HERO_ORDER: [string, HeroSpec][] = [
  ['temperature', { scale: 1, minSpan: 1.5, color: temperatureColor, format: (v) => `${v.toFixed(1)}°` }],
  ['humidity', { scale: 1, minSpan: 6, color: (v) => bandColor(v, [[30, '#F2B544'], [65, '#4FA3E0']], '#5B9DF2'), format: (v) => `${Math.round(v)}%` }],
  ['co2', { scale: 1, minSpan: 150, color: (v) => bandColor(v, [[800, '#8FD6A3'], [1200, '#F2B544']], '#F0803C'), format: (v) => `${Math.round(v)} ppm` }],
  ['pm25', { scale: 1, minSpan: 10, color: (v) => bandColor(v, [[12, '#8FD6A3'], [35, '#F2B544']], '#F0803C'), format: (v) => `${Math.round(v)} µg/m³` }],
  ['illumination', { scale: 1, minSpan: 20, color: () => '#E8C547', format: (v) => `${Math.round(v)} lx` }],
  ['electric-power', { scale: 0.01, minSpan: 10, color: (v) => (v > 0.5 ? '#F0803C' : '#9a9a9f'), format: fmtWatts }],
  ['barometric-pressure', { scale: 1, minSpan: 10, color: () => '#9B7BDA', format: (v) => `${Math.round(v)} hPa` }],
];

export function fmtWatts(w: number): string {
  return Math.abs(w) >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${w.toFixed(w >= 100 ? 0 : 1)} W`;
}

/**
 * The one number a sensor tile is about. Only devices with nothing to control
 * get one; a lamp's tile is about the lamp, not its power meter.
 */
export function heroReading(device: Device): HeroReading | undefined {
  if (controls(device).length) return undefined;
  for (const [capability, spec] of HERO_ORDER) {
    const block = device.state[capability];
    if (!block || !device.capabilities.some((x) => x.capability === capability)) continue;
    const entry = firstScalarEntry(block);
    if (!entry || typeof entry[1] !== 'number') continue;
    const value = entry[1] * spec.scale;
    const rest = readouts(device)
      .filter((r) => r.key !== capability)
      .sort((a, b) => Number(a.key === 'battery') - Number(b.key === 'battery'));
    return {
      capability,
      metric: `${capability}.${entry[0]}`,
      value,
      text: spec.format(value),
      color: spec.color(value),
      scale: spec.scale,
      minSpan: spec.minSpan,
      format: spec.format,
      rest,
    };
  }
  return undefined;
}

/** Current temperature and target of a climate device, for the wide tile. */
export function climateReading(device: Device): { current?: string; currentColor?: string; target?: string } | undefined {
  const category = device.display_category;
  if (category !== 'airConditioner' && category !== 'thermostat') return undefined;
  const t = stateValue(device.state, 'temperature', 'temperature');
  const block = device.state['thermostat-target-setpoint'];
  let target: number | undefined;
  if (block) {
    for (const name of ['manual-mode', 'auto-mode', 'eco-mode', ...Object.keys(block)]) {
      const v = (block[name] as Record<string, unknown> | undefined)?.targetSetpoint;
      if (typeof v === 'number') {
        target = v;
        break;
      }
    }
  }
  return {
    current: typeof t === 'number' ? formatValue('temperature', t) : undefined,
    currentColor: typeof t === 'number' ? temperatureColor(t) : undefined,
    target: target !== undefined ? `→ ${target.toFixed(1)}°` : undefined,
  };
}

export function tileIcon(device: Device, accent?: Accent): string {
  return accent?.icon ?? categoryInfo(device.display_category).icon;
}

// ----- favourites (E) -------------------------------------------------------------

/** Hub tag that marks a device as pinned; the value is when it was pinned, as epoch seconds. */
export const PIN_TAG = 'pinned';

export function pinnedAt(device: Device): number | undefined {
  const v = device.tags?.[PIN_TAG];
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function isPinned(device: Device): boolean {
  return pinnedAt(device) !== undefined;
}
