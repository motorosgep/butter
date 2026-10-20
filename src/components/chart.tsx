/**
 * Small charts drawn as SVG and rendered with expo-image, so they need no
 * native chart module and can ship over the air. Axis labels are native text
 * laid out around the plot; the SVG only carries geometry.
 */

import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from './ui';

export interface XY {
  t: number;
  v: number;
}

export interface Tick {
  t: number;
  label: string;
}

const GUTTER_LEFT = 56;
const GUTTER_BOTTOM = 18;

export function svgUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function niceDomain(values: number[], padFraction = 0.12, minSpan = 1): [number, number] {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const pad = (hi - lo) * padFraction;
  return [lo - pad, hi + pad];
}

export interface Band {
  t: number;
  lo: number;
  hi: number;
}

export function LineChart({
  points,
  from,
  to,
  ticks,
  color,
  format,
  height = 150,
  minSpan = 1,
  zeroBased = false,
  max,
  secondary,
  secondaryColor,
  band,
}: {
  points: XY[];
  from: number;
  to: number;
  ticks: Tick[];
  color: string;
  format: (v: number) => string;
  height?: number;
  minSpan?: number;
  zeroBased?: boolean;
  /** Hard ceiling for the axis, e.g. 100 for percentages. */
  max?: number;
  /** A comparison series, drawn dashed. */
  secondary?: XY[];
  secondaryColor?: string;
  /** A shaded range around the line, e.g. the day's minimum and maximum. */
  band?: Band[];
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const plotW = Math.max(0, width - GUTTER_LEFT);
  const plotH = height - GUTTER_BOTTOM;

  const { uri, lo, hi } = useMemo(() => {
    if (!plotW || points.length === 0) return { uri: undefined, lo: 0, hi: 1 };
    const values = [...points.map((p) => p.v), ...(secondary ?? []).map((p) => p.v), ...(band ?? []).flatMap((b) => [b.lo, b.hi])];
    let [lo, hi] = niceDomain(values, 0.12, minSpan);
    if (zeroBased && Math.min(...values) >= 0) lo = 0;
    if (max !== undefined) hi = Math.min(hi, max);
    const x = (t: number) => ((t - from) / Math.max(1, to - from)) * plotW;
    const y = (v: number) => plotH - ((v - lo) / (hi - lo)) * plotH;
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const first = points[0];
    const last = points[points.length - 1];
    const area = `${path} L${x(last.t).toFixed(1)} ${plotH} L${x(first.t).toFixed(1)} ${plotH} Z`;
    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((f) => `<line x1="0" y1="${(plotH * f).toFixed(1)}" x2="${plotW}" y2="${(plotH * f).toFixed(1)}" stroke="${c.gridHex}" stroke-opacity="0.35" stroke-width="1"/>`)
      .join('');
    const tickLines = ticks
      .map((tk) => `<line x1="${x(tk.t).toFixed(1)}" y1="0" x2="${x(tk.t).toFixed(1)}" y2="${plotH}" stroke="${c.gridHex}" stroke-opacity="0.25" stroke-width="1"/>`)
      .join('');
    let bandPath = '';
    if (band && band.length > 1) {
      const top = band.map((b, i) => `${i ? 'L' : 'M'}${x(b.t).toFixed(1)} ${y(b.hi).toFixed(1)}`).join(' ');
      const bottom = [...band].reverse().map((b) => `L${x(b.t).toFixed(1)} ${y(b.lo).toFixed(1)}`).join(' ');
      bandPath = `<path d="${top} ${bottom} Z" fill="${color}" fill-opacity="0.14"/>`;
    }
    let secondaryPath = '';
    if (secondary && secondary.length > 1) {
      const d = secondary.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
      secondaryPath = `<path d="${d}" fill="none" stroke="${secondaryColor ?? c.gridHex}" stroke-opacity="${secondaryColor ? 0.9 : 0.6}" stroke-width="1.6" stroke-dasharray="4 4" stroke-linejoin="round"/>`;
    }
    const fill = band ? '' : `<path d="${area}" fill="${color}" fill-opacity="0.18"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${plotW}" height="${plotH}" viewBox="0 0 ${plotW} ${plotH}">${grid}${tickLines}${bandPath}${fill}${secondaryPath}<path d="${path}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(last.t).toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="3.5" fill="${color}"/></svg>`;
    return { uri: svgUri(svg), lo, hi };
  }, [points, from, to, ticks, color, plotW, plotH, minSpan, zeroBased, max, c.gridHex, secondary, secondaryColor, band]);

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.yAxis, { width: GUTTER_LEFT, height: plotH }]}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.axis, { color: c.textSecondary }]}>{format(hi)}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.axis, { color: c.textSecondary }]}>{format((hi + lo) / 2)}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.axis, { color: c.textSecondary }]}>{format(lo)}</Text>
      </View>
      {uri ? <Image source={{ uri }} style={{ position: 'absolute', left: GUTTER_LEFT, top: 0, width: plotW, height: plotH }} contentFit="fill" /> : null}
      <XAxis ticks={ticks} from={from} to={to} plotW={plotW} top={plotH} />
    </View>
  );
}

export interface Bar {
  start: number;
  end: number;
  v: number;
  /** Drawn fainter, e.g. a month or year that is not over. */
  muted?: boolean;
}

export function BarChart({
  bars,
  from,
  to,
  ticks,
  color,
  format,
  height = 150,
  reference,
  referenceColor,
}: {
  bars: Bar[];
  from: number;
  to: number;
  ticks: Tick[];
  color: string;
  format: (v: number) => string;
  height?: number;
  /** Comparison values drawn as a short dash across each span, e.g. the long-term average. */
  reference?: { start: number; end: number; v: number }[];
  referenceColor?: string;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const plotW = Math.max(0, width - GUTTER_LEFT);
  const plotH = height - GUTTER_BOTTOM;

  const { uri, hi } = useMemo(() => {
    if (!plotW || bars.length === 0) return { uri: undefined, hi: 1 };
    const hi = Math.max(0.001, ...bars.map((b) => b.v), ...(reference ?? []).map((r) => r.v)) * 1.1;
    const x = (t: number) => ((t - from) / Math.max(1, to - from)) * plotW;
    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((f) => `<line x1="0" y1="${(plotH * f).toFixed(1)}" x2="${plotW}" y2="${(plotH * f).toFixed(1)}" stroke="${c.gridHex}" stroke-opacity="0.35" stroke-width="1"/>`)
      .join('');
    const rects = bars
      .map((b) => {
        const x0 = x(b.start);
        const w = Math.max(1, x(b.end) - x0 - 2);
        const h = (b.v / hi) * plotH;
        const opacity = b.v > 0 ? (b.muted ? 0.45 : 0.9) : 0.25;
        return `<rect x="${(x0 + 1).toFixed(1)}" y="${(plotH - h).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2" fill="${color}" fill-opacity="${opacity}"/>`;
      })
      .join('');
    const marks = (reference ?? [])
      .filter((r) => Number.isFinite(r.v))
      .map((r) => {
        const yy = (plotH - (r.v / hi) * plotH).toFixed(1);
        return `<line x1="${(x(r.start) + 1).toFixed(1)}" y1="${yy}" x2="${(x(r.end) - 1).toFixed(1)}" y2="${yy}" stroke="${referenceColor ?? c.gridHex}" stroke-opacity="0.85" stroke-width="2" stroke-linecap="round"/>`;
      })
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${plotW}" height="${plotH}" viewBox="0 0 ${plotW} ${plotH}">${grid}${rects}${marks}</svg>`;
    return { uri: svgUri(svg), hi };
  }, [bars, from, to, color, plotW, plotH, c.gridHex, reference, referenceColor]);

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.yAxis, { width: GUTTER_LEFT, height: plotH }]}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.axis, { color: c.textSecondary }]}>{format(hi)}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.axis, { color: c.textSecondary }]}>{format(hi / 2)}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.axis, { color: c.textSecondary }]}>{format(0)}</Text>
      </View>
      {uri ? <Image source={{ uri }} style={{ position: 'absolute', left: GUTTER_LEFT, top: 0, width: plotW, height: plotH }} contentFit="fill" /> : null}
      <XAxis ticks={ticks} from={from} to={to} plotW={plotW} top={plotH} />
    </View>
  );
}

function XAxis({ ticks, from, to, plotW, top }: { ticks: Tick[]; from: number; to: number; plotW: number; top: number }) {
  const c = useColors();
  if (!plotW) return null;
  return (
    <View style={{ position: 'absolute', left: GUTTER_LEFT, top, width: plotW, height: GUTTER_BOTTOM }}>
      {ticks.map((tk) => {
        const x = ((tk.t - from) / Math.max(1, to - from)) * plotW;
        return (
          <Text key={tk.t} numberOfLines={1} style={[styles.axis, styles.xLabel, { color: c.textSecondary, left: Math.min(Math.max(0, x - 24), plotW - 48) }]}>
            {tk.label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  yAxis: { position: 'absolute', left: 0, top: 0, justifyContent: 'space-between', paddingRight: 6, alignItems: 'flex-end' },
  axis: { fontSize: 11, fontVariant: ['tabular-nums'] },
  xLabel: { position: 'absolute', top: 3, width: 48, textAlign: 'center' },
});
