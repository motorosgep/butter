/**
 * Solar production as a wide tile on Home, under the weather. The tile is a
 * slab of warm toast while the panels produce and dusk-purple while they rest;
 * the day's output rises across it as a butter-coloured curve with a glowing
 * sun riding on the latest reading. Below: the energy for today, the month,
 * the year and the plant's life. Shown when the ihost-bridge add-on reads a
 * plant, or the home has its own FusionSolar kiosk link; tapping opens the
 * solar screen.
 */

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';


import { clock, formatEnergy, formatPower, type Solar, type SolarPoint } from '@/lib/solar/fusionsolar';
import { useHomeSolar } from '@/lib/solar/store';
import type { SolarPalette } from '@/theme';

import { svgUri } from './chart';
import { Body, Card, caps, useColors } from './ui';
import { Text } from '@/components/text';

/** The curve spans the hours the sun can be up, so it fills the tile in winter and summer alike. */
const DAWN = 4 * 60;
const DUSK = 22 * 60;
const HOURS = [6, 12, 18];
const CURVE_H = 84;
/** Room under the curve's baseline for the hour labels. */
const AXIS_H = 18;

const hourX = (minutes: number) => Math.min(1, Math.max(0, (minutes - DAWN) / (DUSK - DAWN)));

interface Box {
  w: number;
  h: number;
}

function backdropSvg(size: Box, curveTop: number, points: SolarPoint[], making: boolean, p: SolarPalette): string {
  const gold = p.gold;
  const { w, h } = size;
  const { fill } = making ? p.making : p.resting;
  const base = curveTop + CURVE_H - AXIS_H;
  const hi = Math.max(0.5, ...points.map((p) => p.v)) * 1.12;
  const x = (t: number) => hourX(t) * w;
  const y = (v: number) => base - (v / hi) * (CURVE_H - AXIS_H - 6);
  const parts: string[] = [];
  // Flat colours only, no gradients or glow behind the figures, so the type stays easy to read.
  parts.push(`<rect width="${w}" height="${h}" fill="${fill}"/>`);
  // The day's baseline, with a notch at each labelled hour.
  parts.push(`<line x1="0" y1="${base}" x2="${w}" y2="${base}" stroke="${p.baseline}" stroke-opacity="0.22" stroke-width="1"/>`);
  for (const hour of HOURS) parts.push(`<line x1="${x(hour * 60).toFixed(1)}" y1="${base}" x2="${x(hour * 60).toFixed(1)}" y2="${base + 4}" stroke="${p.baseline}" stroke-opacity="0.35" stroke-width="1"/>`);
  if (points.length > 1) {
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const first = points[0];
    const last = points[points.length - 1];
    const lx = x(last.t).toFixed(1);
    const ly = y(last.v).toFixed(1);
    parts.push(`<path d="${path} L${lx} ${base} L${x(first.t).toFixed(1)} ${base} Z" fill="${p.area}" fill-opacity="${making ? p.areaOpacity : p.areaOpacity / 2}" stroke="${gold}" stroke-opacity="${p.areaOpacity === 1 ? 1 : 0}" stroke-width="2"/>`);
    parts.push(`<path d="${path}" fill="none" stroke="${gold}" stroke-opacity="${making ? 1 : 0.6}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`);
    // The rest of the day, sketched: a dashed fall from now to the baseline.
    if (making) parts.push(`<path d="M${lx} ${ly} Q ${x(last.t + 110).toFixed(1)} ${ly} ${x(last.t + 220).toFixed(1)} ${base}" fill="none" stroke="${gold}" stroke-opacity="0.4" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round"/>`);
    if (making) parts.push(`<circle cx="${lx}" cy="${ly}" r="5" fill="${p.dot}"/><circle cx="${lx}" cy="${ly}" r="5" fill="none" stroke="${gold}" stroke-width="1.5"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;
}

export function SolarTile() {
  const c = useColors();
  const { available, solar, error, loading } = useHomeSolar();
  if (!available) return null;

  if (!solar) {
    return (
      <Card onPress={() => router.push('/solar')} style={styles.card}>
        <Text style={[styles.label, { color: c.textSecondary }]}>Solar</Text>
        <Body muted style={{ marginTop: 6 }}>
          {loading ? 'Reading the panels…' : (error ?? 'No figures yet')}
        </Body>
      </Card>
    );
  }

  return <ProductionTile solar={solar} />;
}

function ProductionTile({ solar }: { solar: Solar }) {
  const c = useColors();
  const p = c.solar;
  const ink = { color: p.text };
  const soft = { color: p.textSoft };
  const [size, setSize] = useState<Box>({ w: 0, h: 0 });
  const [curveTop, setCurveTop] = useState<number>();
  const making = solar.power > 0;
  const peakAt = solar.curve.find((pt) => pt.v === solar.peak)?.t;
  // "4.89 kW" → the number big and light, the unit small and bold. At rest, today's energy takes its place.
  const [value, unit] = making ? formatPower(solar.power).split(' ') : formatEnergy(solar.today).split(' ');

  const uri = useMemo(
    () => (size.w && size.h && curveTop !== undefined ? svgUri(backdropSvg({ w: Math.round(size.w), h: Math.round(size.h) }, Math.round(curveTop), solar.curve, making, p)) : undefined),
    [size, curveTop, solar.curve, making, p],
  );

  return (
    <Card onPress={() => router.push('/solar')} style={[styles.card, styles.clip]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: making ? p.making.fill : p.resting.fill }]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {uri ? <Image source={{ uri }} style={{ width: size.w, height: size.h }} contentFit="fill" /> : null}
      </View>

      <View style={[styles.row, { alignItems: 'center' }]}>
        <Text numberOfLines={1} style={[styles.label, ink, { flex: 1 }]}>
          {solar.name === 'Solar' ? 'Solar' : `Solar · ${solar.name}`}
        </Text>
        <View style={[styles.pill, { backgroundColor: making ? p.pill : p.chip }]}>
          <View style={[styles.dot, { backgroundColor: making ? p.pillDot : p.textSoft }]} />
          <Text style={[styles.pillText, caps(c), { color: making ? p.pillText : p.text }]}>{making ? 'Producing' : 'Resting'}</Text>
        </View>
      </View>

      <View style={[styles.row, { marginTop: 4, alignItems: 'flex-end' }]}>
        <Text style={[styles.hero, { color: making ? p.text : p.highlight, fontWeight: c.type.hero }]}>{value}</Text>
        {unit ? <Text style={[styles.unit, ink]}>{making ? unit : `${unit} today`}</Text> : null}
        <View style={{ flex: 1 }} />
        {solar.peak > 0 ? (
          <Text style={[styles.small, soft, { textAlign: 'right' }]}>{`Peak ${formatPower(solar.peak)}${peakAt !== undefined ? `\nat ${clock(peakAt)}` : ''}`}</Text>
        ) : null}
      </View>

      {/* The curve itself is painted on the backdrop; this keeps its place and carries the hour labels. */}
      <View style={styles.curve} onLayout={(e) => setCurveTop(e.nativeEvent.layout.y)}>
        {HOURS.map((hour) => (
          <Text key={hour} style={[styles.hourLabel, soft, { left: `${hourX(hour * 60) * 100}%` }]}>
            {`${String(hour).padStart(2, '0')}:00`}
          </Text>
        ))}
      </View>

      <View style={styles.stats}>
        <Stat value={formatEnergy(solar.today)} label="Today" strong />
        <Stat value={formatEnergy(solar.month)} label="Month" />
        <Stat value={formatEnergy(solar.year)} label="Year" />
        <Stat value={formatEnergy(solar.lifetime)} label="Lifetime" />
      </View>
    </Card>
  );
}

function Stat({ value, label, strong }: { value: string; label: string; strong?: boolean }) {
  const c = useColors();
  const p = c.solar;
  return (
    <View style={[styles.stat, { backgroundColor: strong ? p.statStrong : p.stat }, c.shape.boxedCells ? { borderWidth: 2, borderColor: c.line } : null]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: strong ? p.highlight : p.text }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: strong ? p.highlight : p.textSoft, opacity: strong ? 0.8 : 1 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, marginBottom: 12 },
  clip: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  label: { fontSize: 14, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  hero: { fontSize: 50, letterSpacing: -2, lineHeight: 56, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 18, fontWeight: '700', marginBottom: 9 },
  small: { fontSize: 12, lineHeight: 17, marginBottom: 8, fontVariant: ['tabular-nums'] },
  curve: { height: CURVE_H, marginHorizontal: -18, marginTop: 2 },
  hourLabel: { position: 'absolute', bottom: 0, width: 44, marginLeft: -22, textAlign: 'center', fontSize: 11, fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', gap: 6, marginTop: 12 },
  stat: { flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 8 },
  statValue: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, marginTop: 1 },
});
