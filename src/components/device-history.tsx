/**
 * History section of a device page: charts for the readings the recorder has
 * for this device (temperature, humidity, power, battery) and energy per
 * interval, over the last day, week or month.
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import type { Device } from '@/lib/cube/types';
import type { EnergyResult, HistorySource, MetricInfo, SamplesResult } from '@/lib/history/client';
import { useHub } from '@/lib/hub/store';

import { BarChart, LineChart, type Tick, type XY } from './chart';
import { Body, Button, Card, Chip, Heading, Row, useColors } from './ui';

type RangeKey = '24h' | '7d' | '30d';

const RANGES: { key: RangeKey; label: string; seconds: number; resolution: number; energyResolution: number }[] = [
  { key: '24h', label: '24 hours', seconds: 24 * 3600, resolution: 900, energyResolution: 3600 },
  { key: '7d', label: '7 days', seconds: 7 * 86400, resolution: 3600, energyResolution: 86400 },
  { key: '30d', label: '30 days', seconds: 30 * 86400, resolution: 4 * 3600, energyResolution: 86400 },
];

interface Series {
  key: string;
  title: string;
  color: string;
  format: (v: number) => string;
  scale: number;
  minSpan: number;
  zeroBased?: boolean;
  max?: number;
  order: number;
}

/** Metrics worth a chart, by capability prefix. */
function seriesFor(metric: string, c: ReturnType<typeof useColors>): Series | undefined {
  const [cap] = metric.split('.');
  switch (cap) {
    case 'temperature':
      return { key: metric, title: 'Temperature', color: c.accent, format: (v) => `${v.toFixed(1)}°`, scale: 1, minSpan: 2, order: 0 };
    case 'humidity':
      return { key: metric, title: 'Humidity', color: '#4FA3E0', format: (v) => `${Math.round(v)}%`, scale: 1, minSpan: 10, max: 100, order: 1 };
    case 'electric-power':
      return { key: metric, title: 'Power', color: '#F0803C', format: fmtWatts, scale: 0.01, minSpan: 10, zeroBased: true, order: 2 };
    case 'battery':
      return { key: metric, title: 'Battery', color: '#4CBB7A', format: (v) => `${Math.round(v)}%`, scale: 1, minSpan: 10, zeroBased: true, max: 100, order: 9 };
    case 'illumination-level':
    case 'illuminance':
      return { key: metric, title: 'Light', color: '#E8C547', format: (v) => `${Math.round(v)} lx`, scale: 1, minSpan: 10, zeroBased: true, order: 3 };
    case 'co2':
      return { key: metric, title: 'CO₂', color: '#9B7BDA', format: (v) => `${Math.round(v)} ppm`, scale: 1, minSpan: 100, zeroBased: true, order: 4 };
    case 'pm25':
      return { key: metric, title: 'PM2.5', color: '#9B7BDA', format: (v) => `${Math.round(v)} µg/m³`, scale: 1, minSpan: 10, zeroBased: true, order: 5 };
    default:
      return undefined;
  }
}

function hasEnergy(device: Device, metrics: MetricInfo[]): boolean {
  return device.capabilities.some((x) => x.capability === 'power-consumption') || metrics.some((m) => m.metric.startsWith('electric-power.'));
}

function ticksFor(range: RangeKey, from: number, to: number): Tick[] {
  const out: Tick[] = [];
  if (range === '24h') {
    const first = new Date(from * 1000);
    first.setMinutes(0, 0, 0);
    for (let t = first.getTime() / 1000 + 3600; t < to; t += 3600) {
      const d = new Date(t * 1000);
      if (d.getHours() % 6 === 0) out.push({ t, label: `${String(d.getHours()).padStart(2, '0')}:00` });
    }
  } else {
    const first = new Date(from * 1000);
    first.setHours(0, 0, 0, 0);
    const step = range === '7d' ? 1 : 7;
    for (let d = new Date(first.getTime() + 86400e3); d.getTime() / 1000 < to; d.setDate(d.getDate() + step)) {
      out.push({ t: d.getTime() / 1000, label: range === '7d' ? d.toLocaleDateString(undefined, { weekday: 'short' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) });
    }
  }
  return out;
}

/** Start of the window: aligned to the local midnight for day-based ranges. */
function windowFor(range: RangeKey): { from: number; to: number } {
  const to = Math.floor(Date.now() / 1000);
  const r = RANGES.find((x) => x.key === range)!;
  if (range === '24h') return { from: to - r.seconds, to };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return { from: Math.floor(start.getTime() / 1000) - (r.seconds - 86400), to };
}

function toXY(result: SamplesResult, scale: number): XY[] {
  const pts: XY[] = result.points.map((p) => ('avg' in p ? { t: p.t, v: p.avg * scale } : { t: p.t, v: p.v * scale }));
  if (result.before && pts.length && pts[0].t > result.from) pts.unshift({ t: result.from, v: result.before.v * scale });
  return pts;
}

export function DeviceHistory({ device }: { device: Device }) {
  const c = useColors();
  const history = useHub((s) => s.history);
  const status = useHub((s) => s.historyStatus);
  const [range, setRange] = useState<RangeKey>('24h');
  const [metrics, setMetrics] = useState<MetricInfo[] | undefined>();
  const [data, setData] = useState<{ range: RangeKey; samples: Record<string, SamplesResult>; energy?: EnergyResult } | undefined>();
  const [error, setError] = useState<string | undefined>();

  const chartable = useMemo(() => {
    // Only chart readings the device actually reports; the recorder may hold
    // metrics from a capability the device no longer has.
    const caps = new Set(device.capabilities.map((x) => x.capability));
    const out: Series[] = [];
    for (const m of metrics ?? []) {
      if (!caps.has(m.metric.split('.')[0])) continue;
      const s = seriesFor(m.metric, c);
      if (s && !out.some((x) => x.title === s.title) && m.count > 1) out.push(s);
    }
    return out.sort((a, b) => a.order - b.order);
  }, [metrics, c, device.capabilities]);
  const energy = metrics !== undefined && hasEnergy(device, metrics);
  const sensorLike = device.capabilities.some((x) => ['temperature', 'humidity', 'electric-power', 'power-consumption', 'battery'].includes(x.capability));

  useEffect(() => {
    if (!history) return;
    let cancelled = false;
    history
      .metrics(device.serial_number)
      .then((m) => {
        if (!cancelled) setMetrics(m);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [history, device.serial_number]);

  useEffect(() => {
    if (!history || metrics === undefined) return;
    if (chartable.length === 0 && !energy) return;
    let cancelled = false;
    const r = RANGES.find((x) => x.key === range)!;
    const { from, to } = windowFor(range);
    void load(history, device, chartable, energy, from, to, r.resolution, r.energyResolution)
      .then((d) => {
        if (cancelled) return;
        setData({ range, ...d });
        setError(undefined);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [history, device, metrics, chartable, energy, range]);

  const wantsData = chartable.length > 0 || energy;
  const loading = metrics !== undefined && wantsData && data?.range !== range && !error;

  if (status === 'unavailable' || status === 'unknown') {
    if (!sensorLike) return null;
    return (
      <>
        <Heading style={styles.section}>History</Heading>
        <Card>
          <Body muted>
            The hub keeps history for its own console only. Run the free ihost-bridge add-on on the hub and Butter will chart temperature, humidity, power and energy here.
          </Body>
          <Button
            title="How to set it up"
            icon="open-in-new"
            variant="secondary"
            onPress={() => void Linking.openURL('https://github.com/motorosgep/ihost-bridge#history-for-butter')}
            style={{ alignSelf: 'flex-start', marginTop: 10 }}
          />
        </Card>
      </>
    );
  }
  if (metrics === undefined) return null;
  if (chartable.length === 0 && !energy) return null;

  const { from, to } = windowFor(range);
  const ticks = ticksFor(range, from, to);
  const current = data?.range === range ? data : undefined;

  return (
    <>
      <Row between style={{ alignItems: 'flex-end' }}>
        <Heading style={styles.section}>History</Heading>
        {loading ? <ActivityIndicator style={{ marginBottom: 10 }} /> : null}
      </Row>
      <Row style={{ marginBottom: 6 }}>
        {RANGES.map((r) => (
          <Chip key={r.key} label={r.label} selected={r.key === range} onPress={() => setRange(r.key)} />
        ))}
      </Row>
      {error ? <Body muted>{error}</Body> : null}
      {chartable.map((s) => {
        const result = current?.samples[s.key];
        const pts = result ? toXY(result, s.scale) : [];
        const stats = pts.length ? summary(pts) : undefined;
        return (
          <Card key={s.key} style={styles.chartCard}>
            <Row between>
              <Body muted>{s.title}</Body>
              {stats ? <Body muted>{`min ${s.format(stats.min)} · avg ${s.format(stats.avg)} · max ${s.format(stats.max)}`}</Body> : null}
            </Row>
            <View style={{ marginTop: 8, opacity: current ? 1 : 0.4 }}>
              {pts.length ? (
                <LineChart points={pts} from={from} to={to} ticks={ticks} color={s.color} format={s.format} minSpan={s.minSpan} zeroBased={s.zeroBased} max={s.max} />
              ) : (
                <Body muted style={{ paddingVertical: 24, textAlign: 'center' }}>
                  {current ? 'No readings in this period yet' : ' '}
                </Body>
              )}
            </View>
          </Card>
        );
      })}
      {energy ? (
        <Card style={styles.chartCard}>
          <Row between>
            <Body muted>Energy</Body>
            {current?.energy ? <Body muted>{`${fmtKwh(current.energy.total_kwh)} in ${RANGES.find((r) => r.key === range)!.label}`}</Body> : null}
          </Row>
          <View style={{ marginTop: 8, opacity: current ? 1 : 0.4 }}>
            {current?.energy && current.energy.intervals.length ? (
              <BarChart
                bars={current.energy.intervals.map((i) => ({ start: i.start, end: i.end, v: i.kwh }))}
                from={from}
                to={to}
                ticks={ticks}
                color={c.accent}
                format={fmtKwh}
              />
            ) : (
              <Body muted style={{ paddingVertical: 24, textAlign: 'center' }}>
                {current ? 'No energy data in this period yet' : ' '}
              </Body>
            )}
          </View>
        </Card>
      ) : null}
    </>
  );
}

async function load(
  history: HistorySource,
  device: Device,
  series: Series[],
  energy: boolean,
  from: number,
  to: number,
  resolution: number,
  energyResolution: number,
): Promise<{ samples: Record<string, SamplesResult>; energy?: EnergyResult }> {
  const samples: Record<string, SamplesResult> = {};
  await Promise.all(
    series.map(async (s) => {
      samples[s.key] = await history.samples(device.serial_number, s.key, from, to, resolution);
    }),
  );
  const energyResult = energy ? await history.energy(device.serial_number, from, to, energyResolution) : undefined;
  return { samples, energy: energyResult };
}

function summary(pts: XY[]): { min: number; max: number; avg: number } {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const p of pts) {
    min = Math.min(min, p.v);
    max = Math.max(max, p.v);
    sum += p.v;
  }
  return { min, max, avg: sum / pts.length };
}

function fmtWatts(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} kW`;
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} W`;
}

function fmtKwh(v: number): string {
  return v >= 10 ? `${v.toFixed(1)} kWh` : v >= 1 ? `${v.toFixed(2)} kWh` : `${Math.round(v * 1000)} Wh`;
}

const styles = StyleSheet.create({
  section: { marginTop: 24, marginBottom: 10, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.7 },
  chartCard: { marginTop: 10 },
});
