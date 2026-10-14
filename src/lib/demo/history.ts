/** Synthetic history for the demo home, so the charts can be explored without hardware. */

import type { EnergyResult, HistoryInfo, HistorySource, MetricInfo, SamplesResult } from '../history/client';

function wave(t: number, base: number, amp: number, period: number, seed: number): number {
  const x = (t / period) * 2 * Math.PI + seed;
  return base + amp * Math.sin(x) + amp * 0.25 * Math.sin(3.1 * x + seed);
}

export class DemoHistory implements HistorySource {
  readonly baseUrl = 'demo://history';

  async info(): Promise<HistoryInfo> {
    return { recorder: true, version: 'demo', samples: 1, devices: 1, stream: 'connected' };
  }

  async metrics(serial: string): Promise<MetricInfo[]> {
    const now = Math.floor(Date.now() / 1000);
    const list = ['temperature.temperature', 'humidity.humidity'];
    if (/ac|plug|heat/.test(serial)) list.push('electric-power.electric-power');
    return list.map((metric) => ({ metric, count: 1000, first: now - 40 * 86400, last: now, last_value: null }));
  }

  async samples(serial: string, metric: string, from: number, to: number, resolution: number): Promise<SamplesResult> {
    const seed = [...serial].reduce((a, c) => a + c.charCodeAt(0), 0) % 7;
    const step = Math.max(resolution, 300);
    const points = [];
    for (let t = Math.ceil(from / step) * step; t <= to; t += step) {
      const v = metric.startsWith('temperature')
        ? wave(t, 21.5, 2.2, 86400, seed)
        : metric.startsWith('humidity')
          ? wave(t, 48, 9, 86400 * 1.3, seed + 1)
          : Math.max(0, wave(t, 60000, 70000, 86400, seed + 2));
      points.push({ t, avg: Math.round(v * 10) / 10, min: v - 0.2, max: v + 0.2, n: 1 });
    }
    return { serial, metric, from, to, resolution: step, before: null, points };
  }

  async energy(serial: string, from: number, to: number, resolution: number): Promise<EnergyResult> {
    const seed = serial.length % 5;
    const intervals = [];
    for (let t = from; t < to; t += resolution) {
      const hours = resolution / 3600;
      const kwh = Math.max(0, wave(t, 0.35, 0.3, 86400, seed)) * hours;
      intervals.push({ start: t, end: Math.min(t + resolution, to), kwh: Math.round(kwh * 1000) / 1000 });
    }
    return { serial, from, to, resolution, source: 'counter', intervals, total_kwh: intervals.reduce((a, i) => a + i.kwh, 0) };
  }
}
