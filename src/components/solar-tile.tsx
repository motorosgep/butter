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
import { StyleSheet, Text, View } from 'react-native';

import { clock, formatEnergy, formatPower, type Solar, type SolarPoint } from '@/lib/solar/fusionsolar';
import { useHomeSolar } from '@/lib/solar/store';
import type { SolarPalette } from '@/theme';

import { svgUri } from './chart';
import { Body, Card, Icon, useColors } from './ui';

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
  const { top, bottom } = making ? p.making : p.resting;
  const base = curveTop + CURVE_H - AXIS_H;
  const hi = Math.max(0.5, ...points.map((p) => p.v)) * 1.12;
  const x = (t: number) => hourX(t) * w;
  const y = (v: number) => base - (v / hi) * (CURVE_H - AXIS_H - 6);
  const parts: string[] = [];
  parts.push(
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>` +
      `<linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${gold}" stop-opacity="${making ? 0.5 : 0.22}"/><stop offset="1" stop-color="${gold}" stop-opacity="0.02"/></linearGradient>` +
      `<radialGradient id="sun"><stop offset="0" stop-color="${p.glow}" stop-opacity="0.85"/><stop offset="0.35" stop-color="${gold}" stop-opacity="0.32"/><stop offset="1" stop-color="${gold}" stop-opacity="0"/></radialGradient></defs>`,
  );
  parts.push(`<rect width="${w}" height="${h}" fill="url(#bg)"/>`);
  // The day's baseline, with a notch at each labelled hour.
  parts.push(`<line x1="0" y1="${base}" x2="${w}" y2="${base}" stroke="${p.baseline}" stroke-opacity="0.22" stroke-width="1"/>`);
  for (const hour of HOURS) parts.push(`<line x1="${x(hour * 60).toFixed(1)}" y1="${base}" x2="${x(hour * 60).toFixed(1)}" y2="${base + 4}" stroke="${p.baseline}" stroke-opacity="0.35" stroke-width="1"/>`);
  if (points.length > 1) {
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const first = points[0];
    const last = points[points.length - 1];
    const lx = x(last.t).toFixed(1);
    const ly = y(last.v).toFixed(1);
    if (making) parts.push(`<circle cx="${lx}" cy="${ly}" r="${(h * 0.55).toFixed(1)}" fill="url(#sun)"/>`);
    parts.push(`<path d="${path} L${lx} ${base} L${x(first.t).toFixed(1)} ${base} Z" fill="url(#area)"/>`);
    parts.push(`<path d="${path}" fill="none" stroke="${gold}" stroke-opacity="${making ? 1 : 0.6}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`);
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
  const p = useColors().solar;
  const ink = { color: p.text };
  const soft = { color: p.textSoft };
  const [size, setSize] = useState<Box>({ w: 0, h: 0 });
  const [curveTop, setCurveTop] = useState<number>();
  const making = solar.power > 0;
  const peakAt = solar.curve.find((p) => p.v === solar.peak)?.t;

  const uri = useMemo(
    () => (size.w && size.h && curveTop !== undefined ? svgUri(backdropSvg({ w: Math.round(size.w), h: Math.round(size.h) }, Math.round(curveTop), solar.curve, making, p)) : undefined),
    [size, curveTop, solar.curve, making, p],
  );

  return (
    <Card onPress={() => router.push('/solar')} style={[styles.card, styles.clip]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: making ? p.making.fill : p.resting.fill }]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {uri ? <Image source={{ uri }} style={{ width: size.w, height: size.h }} contentFit="fill" /> : null}
      </View>

      <View style={styles.row}>
        <Text numberOfLines={1} style={[styles.label, ink, { flex: 1 }]}>
          {solar.name === 'Solar' ? 'Solar' : `Solar · ${solar.name}`}
        </Text>
        <View style={[styles.pill, { backgroundColor: p.chip }]}>
          <View style={[styles.dot, { backgroundColor: making ? p.gold : p.textSoft }]} />
          <Text style={[styles.pillText, ink]}>{making ? 'Producing' : 'Resting'}</Text>
        </View>
      </View>

      <View style={[styles.row, { marginTop: 4, alignItems: 'center' }]}>
        <Icon name={making ? 'solar-power-variant' : 'solar-power-variant-outline'} size={44} color={making ? p.gold : p.text} />
        <Text style={[styles.hero, ink]}>{formatPower(solar.power)}</Text>
        <View style={{ flex: 1 }} />
        {solar.peak > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.side, ink]}>{`Peak ${formatPower(solar.peak)}`}</Text>
            {peakAt !== undefined ? <Text style={[styles.small, soft]}>{`at ${clock(peakAt)}`}</Text> : null}
          </View>
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

      <View style={[styles.stats, { borderTopColor: p.divider }]}>
        <Stat value={formatEnergy(solar.today)} label="Today" strong />
        <Stat value={formatEnergy(solar.month)} label="Month" />
        <Stat value={formatEnergy(solar.year)} label="Year" />
        <Stat value={formatEnergy(solar.lifetime)} label="Lifetime" />
      </View>
    </Card>
  );
}

function Stat({ value, label, strong }: { value: string; label: string; strong?: boolean }) {
  const p = useColors().solar;
  return (
    <View style={styles.stat}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: strong ? p.highlight : p.text }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: p.textSoft }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 18 },
  clip: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '600' },
  hero: { fontSize: 44, fontWeight: '700', letterSpacing: -1.2, lineHeight: 54, fontVariant: ['tabular-nums'] },
  side: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  small: { fontSize: 13, fontVariant: ['tabular-nums'] },
  curve: { height: CURVE_H, marginHorizontal: -14, marginTop: 2 },
  hourLabel: { position: 'absolute', bottom: 0, width: 44, marginLeft: -22, textAlign: 'center', fontSize: 11, fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  stat: { flex: 1, alignItems: 'center', gap: 1, paddingHorizontal: 2 },
  statValue: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11 },
});
