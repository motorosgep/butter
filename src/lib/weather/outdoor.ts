/**
 * Which hub sensor supplies the "Outside" temperature on the weather tile and
 * the forecast screen. Each hub stores a choice: a sensor's serial number, or
 * nothing for Automatic, which takes the first online sensor in an outdoor-named
 * room whose reading is recent. Some sensors go quiet when nothing changes and
 * the hub keeps showing their last value, so Automatic skips readings older
 * than half an hour.
 */

import { useEffect, useState } from 'react';

import { roomOf, stateValue } from '../cube/capabilities';
import type { Device } from '../cube/types';

const OUTDOOR_ROOM = /out(side|door)|garden|balcony|terrace|patio|yard/i;

/** Automatic mode ignores a reading older than this. */
export const STALE_MS = 30 * 60 * 1000;

export interface TemperatureSensor {
  device: Device;
  value: number;
  /** When the hub last heard a temperature from it, in ms since the epoch, if it says. */
  at?: number;
  outdoor: boolean;
}

/** The hub's `updated_at` arrives in milliseconds; accept seconds too. */
function epochMs(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return undefined;
  return v < 1e12 ? v * 1000 : v;
}

/** Every device that reports a temperature, outdoor rooms first, then by name. */
export function temperatureSensors(devices: Device[]): TemperatureSensor[] {
  const out: TemperatureSensor[] = [];
  for (const device of devices) {
    const value = stateValue(device.state, 'temperature', 'temperature');
    if (typeof value !== 'number') continue;
    const at = epochMs(device.state.temperature?.updated_at);
    out.push({ device, value, at, outdoor: OUTDOOR_ROOM.test(roomOf(device) ?? '') });
  }
  return out.sort((a, b) => Number(b.outdoor) - Number(a.outdoor) || a.device.name.localeCompare(b.device.name));
}

export function isStale(sensor: TemperatureSensor, now: number): boolean {
  return sensor.at !== undefined && now - sensor.at > STALE_MS;
}

/**
 * The outside reading. With a chosen sensor it is that sensor's value, whatever
 * its age (the user picked it); Automatic takes the first fresh online sensor in
 * an outdoor room.
 */
export function outdoorReading(devices: Device[], choice: string | undefined, now: number): number | undefined {
  const sensors = temperatureSensors(devices);
  if (choice) return sensors.find((s) => s.device.serial_number === choice)?.value;
  return sensors.find((s) => s.outdoor && s.device.online && !isStale(s, now))?.value;
}

/** The current time, ticking every `everyMs`, so readings can age on screen. */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
