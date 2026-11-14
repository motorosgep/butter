/**
 * The weather at home, as a wide tile at the top of Home: current conditions,
 * today's range, the next few hours, and the outdoor sensor's reading when the
 * house has one. The tile's background is the sky itself: navy with stars at
 * night, blue with a sun glow on a clear day, slate when it rains. Tapping
 * opens the forecast screen.
 */

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { roomOf, stateValue } from '@/lib/cube/capabilities';
import type { Device } from '@/lib/cube/types';
import { selectActiveHub, useDeviceList, useHub } from '@/lib/hub/store';
import { useForecast } from '@/lib/weather/forecast';
import { describeCode, localHour, type Forecast } from '@/lib/weather/open-meteo';
import type { Sky, SkyKind } from '@/theme';

import { Body, Card, Heading, Icon, useColors } from './ui';

const OUTDOOR_ROOM = /out(side|door)|garden|balcony|terrace|patio|yard/i;

/** First online sensor in an outdoor room that reports a temperature. */
export function outdoorReading(devices: Device[]): number | undefined {
  for (const d of devices) {
    if (!d.online || !OUTDOOR_ROOM.test(roomOf(d) ?? '')) continue;
    const t = stateValue(d.state, 'temperature', 'temperature');
    if (typeof t === 'number') return t;
  }
  return undefined;
}

// ----- the sky ------------------------------------------------------------------

/** Which sky a WMO weather code paints; the theme holds the colours for each. */
export function skyKind(code: number): SkyKind {
  if (code <= 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'rain';
}

function svgUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function skySvg(w: number, h: number, sky: Sky, star: string): string {
  const parts: string[] = [];
  parts.push(`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.top}"/><stop offset="1" stop-color="${sky.bottom}"/></linearGradient>`);
  if (sky.glow) {
    parts.push(`<radialGradient id="glow"><stop offset="0" stop-color="${sky.glow[0]}" stop-opacity="${sky.glow[1]}"/><stop offset="0.55" stop-color="${sky.glow[0]}" stop-opacity="${(sky.glow[1] * 0.25).toFixed(2)}"/><stop offset="1" stop-color="${sky.glow[0]}" stop-opacity="0"/></radialGradient>`);
  }
  parts.push('</defs>');
  parts.push(`<rect width="${w}" height="${h}" fill="url(#g)"/>`);
  if (sky.glow) parts.push(`<circle cx="${(w * 0.84).toFixed(1)}" cy="${(h * 0.22).toFixed(1)}" r="${(h * 0.75).toFixed(1)}" fill="url(#glow)"/>`);
  if (sky.stars) {
    // A fixed scatter so the sky does not twinkle on every re-render.
    for (let i = 0; i < 18; i++) {
      const x = ((i * 137.5) % 100) / 100;
      const y = ((i * 73.3) % 42) / 100;
      const r = 0.7 + ((i * 7) % 3) * 0.3;
      const o = 0.3 + ((i * 5) % 4) * 0.1;
      parts.push(`<circle cx="${(x * w).toFixed(1)}" cy="${(y * h).toFixed(1)}" r="${r.toFixed(2)}" fill="${star}" fill-opacity="${o.toFixed(2)}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;
}

/** Fills its parent with the sky for the given weather. The parent needs `overflow: 'hidden'`. */
export function SkyBackdrop({ code, isDay }: { code: number; isDay: boolean }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const palette = useColors().sky;
  const kind = palette.kinds[skyKind(code)];
  const sky = isDay ? kind.day : kind.night;
  const uri = useMemo(() => (size.w && size.h ? svgUri(skySvg(Math.round(size.w), Math.round(size.h), sky, palette.star)) : undefined), [size, sky, palette.star]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: sky.bottom }]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {uri ? <Image source={{ uri }} style={{ width: size.w, height: size.h }} contentFit="fill" /> : null}
    </View>
  );
}

// ----- the tile ------------------------------------------------------------------

export function WeatherTile() {
  const c = useColors();
  const hub = useHub(selectActiveHub);
  const devices = useDeviceList();
  const place = hub?.place;
  const { forecast, error, loading } = useForecast(place);
  if (!hub || place === null) return null;

  if (!place) {
    return (
      <Card onPress={() => router.push('/weather')} style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.badge, { backgroundColor: c.backgroundSelected }]}>
            <Icon name="weather-partly-cloudy" size={24} color={c.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Heading style={{ fontSize: 15 }}>Weather at home</Heading>
            <Body muted style={{ fontSize: 13, marginTop: 2 }}>
              Pick your town and the forecast shows here.
            </Body>
          </View>
          <Icon name="chevron-right" size={22} color={c.textSecondary} />
        </View>
      </Card>
    );
  }

  if (!forecast) {
    return (
      <Card onPress={() => router.push('/weather')} style={styles.card}>
        <Text style={[styles.place, { color: c.textSecondary }]}>{place.name}</Text>
        <Body muted style={{ marginTop: 6 }}>
          {loading ? 'Loading the forecast…' : (error ?? 'No forecast yet')}
        </Body>
      </Card>
    );
  }

  return <ForecastTile forecast={forecast} sensor={outdoorReading(devices)} />;
}

function ForecastTile({ forecast, sensor }: { forecast: Forecast; sensor?: number }) {
  const c = useColors();
  const sky = c.sky;
  const { current, daily, hourly, utcOffset } = forecast;
  const condition = describeCode(current.code, current.isDay);
  const today = daily[0];
  // The forecast's own clock keeps this pure; it is at most a quarter hour behind.
  const now = current.time;
  const next = hourly.filter((h) => h.time > now).slice(0, 6);
  const ink = { color: sky.text };
  const soft = { color: sky.textSoft };

  return (
    <Card onPress={() => router.push('/weather')} style={[styles.card, styles.sky]}>
      <SkyBackdrop code={current.code} isDay={current.isDay} />
      <View style={[styles.row, { alignItems: 'center' }]}>
        <Text numberOfLines={1} style={[styles.place, ink, { flex: 1 }]}>
          {forecast.place.name}
        </Text>
        {sensor !== undefined ? (
          <View style={[styles.pill, { backgroundColor: sky.chip }]}>
            <Text style={[styles.pillText, ink]}>{`Outside ${sensor.toFixed(1)}°`}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.row, { marginTop: 8, alignItems: 'center' }]}>
        <Icon name={condition.icon} size={52} color={sky.text} />
        <Text style={[styles.hero, ink, { fontWeight: c.type.hero }]}>{`${Math.round(current.temperature)}°`}</Text>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.condition, ink]}>{condition.label}</Text>
          {today ? <Text style={[styles.small, ink]}>{`H ${Math.round(today.max)}° · L ${Math.round(today.min)}°`}</Text> : null}
          <Text style={[styles.small, soft]}>{`Feels like ${Math.round(current.feelsLike)}°`}</Text>
        </View>
      </View>
      {next.length ? (
        <View style={[styles.hours, { borderTopColor: sky.divider }]}>
          {next.map((h) => {
            const hc = describeCode(h.code, h.isDay);
            const wet = h.rainChance >= 30;
            return (
              <View key={h.time} style={styles.hour}>
                <Text style={[styles.hourLabel, soft]}>{`${String(localHour(h.time, utcOffset)).padStart(2, '0')}`}</Text>
                <Icon name={hc.icon} size={20} color={wet ? sky.rain : sky.text} />
                <Text style={[styles.hourTemp, ink]}>{`${Math.round(h.temperature)}°`}</Text>
                {wet ? <Text style={[styles.rain, { color: sky.rain }]}>{`${h.rainChance}%`}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, marginBottom: 12 },
  sky: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  place: { fontSize: 14, fontWeight: '700' },
  pill: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12 },
  pillText: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hero: { fontSize: 64, letterSpacing: -3, lineHeight: 70, fontVariant: ['tabular-nums'] },
  condition: { fontSize: 15, fontWeight: '700' },
  small: { fontSize: 13, lineHeight: 19, fontVariant: ['tabular-nums'] },
  hours: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  hour: { alignItems: 'center', gap: 5, minWidth: 36 },
  hourLabel: { fontSize: 12, fontVariant: ['tabular-nums'] },
  hourTemp: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rain: { fontSize: 11, fontWeight: '700', marginTop: -3, fontVariant: ['tabular-nums'] },
});
