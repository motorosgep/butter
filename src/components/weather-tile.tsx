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
import { compass, describeCode, localHour, type Forecast } from '@/lib/weather/open-meteo';

import { Body, Card, Heading, Icon, useColors } from './ui';

const OUTDOOR_ROOM = /out(side|door)|garden|balcony|terrace|patio|yard/i;

/** Type colours over the sky backdrop, the same in both schemes. */
export const SKY_TEXT = '#FFFFFF';
export const SKY_TEXT_SOFT = 'rgba(255,255,255,0.78)';
export const SKY_RAIN = '#A9D6FF';

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

interface Sky {
  top: string;
  bottom: string;
  /** Sun or moon glow colour and strength. */
  glow?: [string, number];
  stars?: boolean;
}

/** Background colours for a WMO weather code, day or night. */
export function skyFor(code: number, isDay: boolean): Sky {
  if (code <= 1) return isDay ? { top: '#2B74C9', bottom: '#6FB5E6', glow: ['#FFE39A', 0.95] } : { top: '#0B1230', bottom: '#1F2F5C', glow: ['#E3EAFF', 0.35], stars: true };
  if (code === 2) return isDay ? { top: '#3A7CC0', bottom: '#8CB9DB', glow: ['#FFE39A', 0.6] } : { top: '#141C3A', bottom: '#2E3D63', glow: ['#E3EAFF', 0.2], stars: true };
  if (code === 3) return isDay ? { top: '#4B5663', bottom: '#6E7A87' } : { top: '#272D36', bottom: '#3E4650' };
  if (code === 45 || code === 48) return isDay ? { top: '#5A6671', bottom: '#8C969F' } : { top: '#2A3139', bottom: '#454C55' };
  if (code >= 95) return isDay ? { top: '#1E2331', bottom: '#3A4154' } : { top: '#101320', bottom: '#262B3A' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return isDay ? { top: '#4F6F8E', bottom: '#93B0C7' } : { top: '#243245', bottom: '#3C4F66' };
  return isDay ? { top: '#2C4664', bottom: '#4B6B8C' } : { top: '#141F2E', bottom: '#2A3A50' };
}

function svgUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function skySvg(w: number, h: number, sky: Sky): string {
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
      parts.push(`<circle cx="${(x * w).toFixed(1)}" cy="${(y * h).toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" fill-opacity="${o.toFixed(2)}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;
}

/** Fills its parent with the sky for the given weather. The parent needs `overflow: 'hidden'`. */
export function SkyBackdrop({ code, isDay }: { code: number; isDay: boolean }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sky = skyFor(code, isDay);
  const uri = useMemo(() => (size.w && size.h ? svgUri(skySvg(Math.round(size.w), Math.round(size.h), sky)) : undefined), [size, sky]);
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
  const { current, daily, hourly, utcOffset } = forecast;
  const condition = describeCode(current.code, current.isDay);
  const today = daily[0];
  // The forecast's own clock keeps this pure; it is at most a quarter hour behind.
  const now = current.time;
  const next = hourly.filter((h) => h.time > now).slice(0, 6);

  return (
    <Card onPress={() => router.push('/weather')} style={[styles.card, styles.sky]}>
      <SkyBackdrop code={current.code} isDay={current.isDay} />
      <View style={styles.row}>
        <Text numberOfLines={1} style={[styles.place, { color: SKY_TEXT, flex: 1 }]}>
          {forecast.place.name}
        </Text>
        {sensor !== undefined ? (
          <View style={styles.pill}>
            <Icon name="home-thermometer-outline" size={13} color={SKY_TEXT} />
            <Text style={styles.pillText}>{`Outside ${sensor.toFixed(1)}°`}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.row, { marginTop: 4, alignItems: 'center' }]}>
        <Icon name={condition.icon} size={46} color={SKY_TEXT} />
        <Text style={styles.hero}>{`${Math.round(current.temperature)}°`}</Text>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.condition}>{condition.label}</Text>
          {today ? <Text style={styles.small}>{`H ${Math.round(today.max)}°  L ${Math.round(today.min)}°`}</Text> : null}
          <Text style={styles.small}>{`Feels like ${Math.round(current.feelsLike)}°`}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={[styles.small, { marginTop: 2 }]}>
        {`${Math.round(current.humidity)}% humidity · wind ${Math.round(current.windSpeed)} km/h ${compass(current.windDirection)}${today && today.rainChance >= 20 ? ` · ${today.rainChance}% rain today` : ''}`}
      </Text>
      {next.length ? (
        <View style={styles.hours}>
          {next.map((h) => {
            const hc = describeCode(h.code, h.isDay);
            const wet = h.rainChance >= 50;
            return (
              <View key={h.time} style={styles.hour}>
                <Text style={styles.hourLabel}>{`${String(localHour(h.time, utcOffset)).padStart(2, '0')}`}</Text>
                <Icon name={hc.icon} size={22} color={wet ? SKY_RAIN : SKY_TEXT} />
                <Text style={styles.hourTemp}>{`${Math.round(h.temperature)}°`}</Text>
                <Text style={[styles.rain, { color: SKY_RAIN }]}>{h.rainChance >= 30 ? `${h.rainChance}%` : ' '}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 14, marginBottom: 18 },
  sky: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  place: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.16)' },
  pillText: { fontSize: 12, fontWeight: '600', color: SKY_TEXT, fontVariant: ['tabular-nums'] },
  hero: { fontSize: 48, fontWeight: '700', letterSpacing: -1.2, lineHeight: 54, color: SKY_TEXT, fontVariant: ['tabular-nums'] },
  condition: { fontSize: 15, fontWeight: '600', color: SKY_TEXT },
  small: { fontSize: 13, color: SKY_TEXT_SOFT, fontVariant: ['tabular-nums'] },
  hours: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.25)' },
  hour: { alignItems: 'center', gap: 3, minWidth: 40 },
  hourLabel: { fontSize: 11, color: SKY_TEXT_SOFT, fontVariant: ['tabular-nums'] },
  hourTemp: { fontSize: 13, fontWeight: '600', color: SKY_TEXT, fontVariant: ['tabular-nums'] },
  rain: { fontSize: 10, fontVariant: ['tabular-nums'] },
});
