/**
 * The forecast for the home: current conditions, the next 24 hours as a chart
 * and a strip, and the week ahead. Also where the place is chosen.
 */

import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Image } from 'expo-image';

import { svgUri } from '@/components/chart';
import { Body, Button, Card, Empty, Heading, Icon, Row, Screen, useColors } from '@/components/ui';
import { SKY_RAIN, SKY_TEXT, SKY_TEXT_SOFT, SkyBackdrop, outdoorReading } from '@/components/weather-tile';
import { mix, temperatureColor } from '@/lib/cube/appearance';
import { selectActiveHub, useDeviceList, useHub } from '@/lib/hub/store';
import { refreshForecast, useForecast } from '@/lib/weather/forecast';
import { compass, dayLabel, describeCode, localHour, placeLabel, searchPlaces, type Forecast, type HourPoint, type Place } from '@/lib/weather/open-meteo';

export default function WeatherScreen() {
  const hub = useHub(selectActiveHub);
  const setPlace = useHub((s) => s.setPlace);
  const place = hub?.place ?? undefined;
  const [picking, setPicking] = useState(!place);
  // HungaroMet's measurements cover Hungary; show the way in when the home is there or a station was chosen.
  const showMeasurements = !!hub && (hub.station !== undefined && hub.station !== null ? true : place?.country === 'Hungary');
  const { forecast, error, loading } = useForecast(place);
  const [refreshing, setRefreshing] = useState(false);

  if (!hub) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: 'Weather' }} />
        <Empty icon="weather-cloudy-alert" title="No hub selected" />
      </Screen>
    );
  }

  const choose = async (p: Place) => {
    await setPlace(hub.id, p);
    setPicking(false);
  };

  const onRefresh = async () => {
    if (!place) return;
    setRefreshing(true);
    await refreshForecast(place);
    setRefreshing(false);
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: place ? place.name : 'Weather' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={place ? <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} /> : undefined}>
        {picking || !place ? (
          <PlacePicker current={place} onPick={(p) => void choose(p)} onCancel={place ? () => setPicking(false) : undefined} />
        ) : forecast ? (
          <ForecastView forecast={forecast} onChangePlace={() => setPicking(true)} />
        ) : (
          <Card>
            <Row>
              {loading ? <ActivityIndicator /> : <Icon name="weather-cloudy-alert" size={20} />}
              <Body style={{ flex: 1 }}>{loading ? `Loading the forecast for ${place.name}…` : (error ?? 'No forecast yet')}</Body>
            </Row>
            <Row style={{ marginTop: 12 }}>
              <Button title="Try again" variant="secondary" icon="refresh" onPress={() => void onRefresh()} />
              <Button title="Change place" variant="secondary" onPress={() => setPicking(true)} />
            </Row>
          </Card>
        )}
        {!picking && place && showMeasurements ? (
          <Card onPress={() => router.push('/measurements')} style={{ marginTop: 16 }}>
            <Row>
              <View style={styles.linkBadge}>
                <Icon name="chart-bar" size={22} color="#4FA3E0" />
              </View>
              <View style={{ flex: 1 }}>
                <Heading style={{ fontSize: 15 }}>Measurements</Heading>
                <Body muted style={{ fontSize: 13, marginTop: 2 }}>
                  {hub?.station ? `${hub.station.name} · rain by day, month and year, temperatures, last 48 hours` : 'HungaroMet station records near home: rain by day, month and year'}
                </Body>
              </View>
              <Icon name="chevron-right" size={22} />
            </Row>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// ----- place picker ------------------------------------------------------------------

function PlacePicker({ current, onPick, onCancel }: { current?: Place; onPick: (p: Place) => void; onCancel?: () => void }) {
  const c = useColors();
  const [query, setQuery] = useState('');
  // The answer is tied to the query it was for, so stale results and messages
  // never show under a newer query.
  const [found, setFound] = useState<{ q: string; list: Place[]; error?: string } | undefined>();
  const q = query.trim();
  const answer = found && found.q === q ? found : undefined;
  const busy = q.length >= 3 && !answer;
  const results = answer?.list ?? [];
  const error = answer?.error ?? (answer && results.length === 0 ? 'No place by that name' : undefined);

  // Search as the user types, a moment after the last keystroke. The geocoder
  // only does exact matches below three characters, so wait for the third.
  useEffect(() => {
    if (q.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPlaces(q)
        .then((list) => !cancelled && setFound({ q, list }))
        .catch((e: Error) => !cancelled && setFound({ q, list: [], error: e.message }));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  return (
    <View>
      <Heading>Where is this home?</Heading>
      <Body muted style={{ marginTop: 4 }}>
        {current ? `Currently ${placeLabel(current)}. ` : ''}
        Type a town or city; the forecast uses its coordinates and nothing else leaves the phone.
      </Body>
      <Row style={{ marginTop: 12 }}>
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Town or city"
          placeholderTextColor={c.textSecondary}
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement }]}
        />
        {busy ? <ActivityIndicator /> : null}
        {onCancel ? <Button title="Cancel" variant="secondary" onPress={onCancel} /> : null}
      </Row>
      {error ? (
        <Body muted style={{ marginTop: 10 }}>
          {error}
        </Body>
      ) : null}
      <View style={{ marginTop: 10, gap: 8 }}>
        {results.map((p) => (
          <Card key={`${p.lat},${p.lon}`} onPress={() => onPick(p)}>
            <Row between>
              <View style={{ flex: 1 }}>
                <Body>{p.name}</Body>
                <Body muted style={{ fontSize: 13 }}>
                  {[p.region, p.country].filter(Boolean).join(', ')}
                </Body>
              </View>
              <Icon name="chevron-right" size={20} color={c.textSecondary} />
            </Row>
          </Card>
        ))}
      </View>
    </View>
  );
}

// ----- forecast -------------------------------------------------------------------

function ForecastView({ forecast, onChangePlace }: { forecast: Forecast; onChangePlace: () => void }) {
  const c = useColors();
  const devices = useDeviceList();
  const sensor = outdoorReading(devices);
  const { current, hourly, daily, utcOffset } = forecast;
  const condition = describeCode(current.code, current.isDay);
  const tone = (t: number) => (c.scheme === 'dark' ? temperatureColor(t) : mix(temperatureColor(t), '#000000', 0.3));
  const rainTint = c.scheme === 'dark' ? SKY_RAIN : '#2F7FC4';
  const today = daily[0];
  // The forecast's own clock keeps this pure; it is at most a quarter hour behind.
  const now = current.time;

  const strip = useMemo(() => hourly.filter((h) => h.time > now).slice(0, 24), [hourly, now]);
  const weekMin = Math.min(...daily.map((d) => d.min));
  const weekMax = Math.max(...daily.map((d) => d.max));
  const updated = new Date(forecast.fetchedAt);

  return (
    <View>
      <Card style={styles.sky}>
        <SkyBackdrop code={current.code} isDay={current.isDay} />
        <Row between style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.skyPlace}>{placeLabel(forecast.place)}</Text>
            <Row style={{ marginTop: 6, alignItems: 'center' }}>
              <Icon name={condition.icon} size={52} color={SKY_TEXT} />
              <Text style={styles.hero}>{`${Math.round(current.temperature)}°`}</Text>
            </Row>
            <Text style={styles.skyCondition}>{`${condition.label} · feels like ${Math.round(current.feelsLike)}°`}</Text>
          </View>
          <Pressable onPress={onChangePlace} accessibilityRole="button" style={({ pressed }) => [styles.change, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon name="map-marker-outline" size={15} color={SKY_TEXT} />
            <Text style={styles.changeText}>Change</Text>
          </Pressable>
        </Row>
      </Card>
      <View style={styles.tiles}>
        <Tile icon="water-percent" value={`${Math.round(current.humidity)}%`} label="Humidity" />
        <Tile icon="weather-windy" value={`${Math.round(current.windSpeed)} km/h`} label={`Wind ${compass(current.windDirection)}`} />
        <Tile icon="weather-rainy" value={today ? `${today.rainChance}%` : '–'} label={today && today.precipitationSum > 0 ? `Rain · ${today.precipitationSum.toFixed(1)} mm` : 'Rain today'} tint={today && today.rainChance >= 50 ? rainTint : undefined} />
      </View>
      <View style={styles.tiles}>
        <Tile icon="weather-sunset-up" value={today ? hhmm(today.sunrise, utcOffset) : '–'} label="Sunrise" />
        <Tile icon="weather-sunset-down" value={today ? hhmm(today.sunset, utcOffset) : '–'} label="Sunset" />
        {sensor !== undefined ? (
          <Tile icon="home-thermometer-outline" value={`${sensor.toFixed(1)}°`} label="Outside sensor" />
        ) : (
          <Tile icon="white-balance-sunny" value={today ? duration(today.sunset - today.sunrise) : '–'} label="Daylight" />
        )}
      </View>

      <Heading style={styles.section}>Next 24 hours</Heading>
      <HourlyStrip hours={strip} utcOffset={utcOffset} color={c.accent} rainTint={rainTint} />

      <Heading style={styles.section}>This week</Heading>
      <Card>
        {daily.map((d, i) => {
          const dc = describeCode(d.code, true);
          const span = Math.max(1, weekMax - weekMin);
          const left = ((d.min - weekMin) / span) * 100;
          const width = Math.max(6, ((d.max - d.min) / span) * 100);
          return (
            <View key={d.time} style={[styles.dayRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
              <Text style={[styles.dayName, { color: c.text }]}>{dayLabel(d.time, utcOffset, now)}</Text>
              <Icon name={dc.icon} size={22} color={d.rainChance >= 50 ? rainTint : c.text} />
              <Text style={[styles.rainDay, { color: d.rainChance >= 30 ? rainTint : c.textSecondary }]}>{d.rainChance >= 10 ? `${d.rainChance}%` : ''}</Text>
              <Text style={[styles.dayTemp, { color: c.textSecondary }]}>{`${Math.round(d.min)}°`}</Text>
              <View style={[styles.bar, { backgroundColor: c.backgroundSelected }]}>
                <View style={[styles.barFill, { left: `${left}%`, width: `${width}%`, backgroundColor: tone((d.min + d.max) / 2) }]} />
              </View>
              <Text style={[styles.dayTemp, { color: c.text }]}>{`${Math.round(d.max)}°`}</Text>
            </View>
          );
        })}
      </Card>

      <Pressable onPress={() => void Linking.openURL('https://open-meteo.com/')} style={{ marginTop: 16 }}>
        <Body muted style={{ fontSize: 12, textAlign: 'center' }}>
          {`Forecast by Open-Meteo · updated ${String(updated.getHours()).padStart(2, '0')}:${String(updated.getMinutes()).padStart(2, '0')}`}
        </Body>
      </Pressable>
    </View>
  );
}

const COL = 52;
const CURVE = 48;
const LABEL = 18;
const STRIP_PAD = 14;

/** The coming hours as one scrolling panel: icons on top, the temperature curve with each hour's number riding on it, rain chance below. */
function HourlyStrip({ hours, utcOffset, color, rainTint }: { hours: HourPoint[]; utcOffset: number; color: string; rainTint: string }) {
  const c = useColors();
  const width = hours.length * COL;
  const temps = hours.map((h) => h.temperature);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const span = Math.max(4, hi - lo);
  const bottom = (hi + lo) / 2 - span / 2;
  const y = (v: number) => CURVE - 6 - ((v - bottom) / span) * (CURVE - 12);

  const uri = useMemo(() => {
    if (hours.length < 2) return undefined;
    const pts = hours.map((h, i) => [i * COL + COL / 2, y(h.temperature)] as const);
    const path = pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}`).join(' ');
    const area = `${path} L${pts[pts.length - 1][0].toFixed(1)} ${CURVE} L${pts[0][0].toFixed(1)} ${CURVE} Z`;
    const dots = pts.map(([x, yy]) => `<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="3" fill="${color}"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${CURVE}" viewBox="0 0 ${width} ${CURVE}"><path d="${area}" fill="${color}" fill-opacity="0.14"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>`;
    return svgUri(svg);
    // y depends only on the hours and the constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, color, width]);

  if (!hours.length) return null;
  const anyRain = hours.some((h) => h.rainChance >= 10);
  // The card itself is what scrolls: it slides past both screen edges with its own rounded ends.
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll} contentContainerStyle={styles.stripContent}>
      <View style={[styles.stripCard, { width: width + 2 * STRIP_PAD, backgroundColor: c.backgroundElement }]}>
      <View style={{ width }}>
        <View style={{ flexDirection: 'row' }}>
          {hours.map((h, i) => {
            const hc = describeCode(h.code, h.isDay);
            const hour = localHour(h.time, utcOffset);
            return (
              <View key={h.time} style={styles.col}>
                <Text style={[styles.hourLabel, { color: hour === 0 && i > 0 ? c.text : c.textSecondary }]}>{hour === 0 && i > 0 ? dayLabel(h.time, utcOffset, h.time - 1) : String(hour).padStart(2, '0')}</Text>
                <Icon name={hc.icon} size={22} color={h.rainChance >= 50 ? rainTint : c.text} />
              </View>
            );
          })}
        </View>
        <View style={{ height: CURVE + LABEL, marginTop: -2 }}>
          {uri ? <Image source={{ uri }} style={{ position: 'absolute', left: 0, top: LABEL, width, height: CURVE }} contentFit="fill" /> : null}
          {hours.map((h, i) => (
            <Text key={h.time} style={[styles.hourTemp, { position: 'absolute', left: i * COL, width: COL, top: LABEL + y(h.temperature) - 22, textAlign: 'center', color: c.text }]}>
              {`${Math.round(h.temperature)}°`}
            </Text>
          ))}
        </View>
        {anyRain ? (
          <View style={{ flexDirection: 'row', marginTop: 2 }}>
            {hours.map((h) => (
              <View key={h.time} style={styles.col}>
                <Text style={[styles.rain, { color: h.rainChance >= 30 ? rainTint : c.textSecondary }]}>{h.rainChance >= 10 ? `${h.rainChance}%` : ' '}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      </View>
    </ScrollView>
  );
}

function Tile({ icon, value, label, tint }: { icon: string; value: string; label: string; tint?: string }) {
  const c = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: c.backgroundElement }]}>
      <Icon name={icon} size={20} color={tint ?? c.textSecondary} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tileValue, { color: tint ?? c.text }]}>
        {value}
      </Text>
      <Text numberOfLines={1} style={[styles.tileLabel, { color: c.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function hhmm(time: number, utcOffset: number): string {
  const d = new Date((time + utcOffset) * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  sky: { overflow: 'hidden', paddingVertical: 18 },
  skyPlace: { fontSize: 13, fontWeight: '600', color: SKY_TEXT_SOFT, letterSpacing: 0.2 },
  skyCondition: { fontSize: 15, fontWeight: '600', color: SKY_TEXT, marginTop: 2 },
  hero: { fontSize: 54, fontWeight: '700', letterSpacing: -1.5, lineHeight: 60, color: SKY_TEXT, fontVariant: ['tabular-nums'] },
  change: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)' },
  changeText: { fontSize: 13, fontWeight: '600', color: SKY_TEXT },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tile: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  tileValue: { fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tileLabel: { fontSize: 11 },
  section: { marginTop: 22, marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.7 },
  linkBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(79,163,224,0.18)' },
  col: { width: COL, alignItems: 'center', gap: 4 },
  stripScroll: { marginHorizontal: -16 },
  stripContent: { paddingHorizontal: 16 },
  stripCard: { borderRadius: 16, padding: STRIP_PAD },
  hourLabel: { fontSize: 11, fontVariant: ['tabular-nums'] },
  hourTemp: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rain: { fontSize: 10, fontVariant: ['tabular-nums'] },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  dayName: { width: 48, fontSize: 15, fontWeight: '500' },
  rainDay: { width: 36, fontSize: 12, fontVariant: ['tabular-nums'] },
  dayTemp: { width: 34, fontSize: 14, fontVariant: ['tabular-nums'], textAlign: 'right' },
  bar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
});
