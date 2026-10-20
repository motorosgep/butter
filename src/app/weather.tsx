/**
 * The forecast for the home: current conditions, the next 24 hours as a chart
 * and a strip, and the week ahead. Also where the place is chosen.
 */

import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { LineChart, type Tick } from '@/components/chart';
import { Body, Button, Card, Empty, Heading, Icon, Row, Screen, useColors } from '@/components/ui';
import { SKY_RAIN, SKY_TEXT, SKY_TEXT_SOFT, SkyBackdrop, outdoorReading } from '@/components/weather-tile';
import { mix, temperatureColor } from '@/lib/cube/appearance';
import { selectActiveHub, useDeviceList, useHub } from '@/lib/hub/store';
import { refreshForecast, useForecast } from '@/lib/weather/forecast';
import { compass, dayLabel, describeCode, localHour, placeLabel, searchPlaces, type Forecast, type Place } from '@/lib/weather/open-meteo';

export default function WeatherScreen() {
  const hub = useHub(selectActiveHub);
  const setPlace = useHub((s) => s.setPlace);
  const place = hub?.place ?? undefined;
  const [picking, setPicking] = useState(!place);
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
  // The forecast's own clock keeps this pure; it is at most a quarter hour behind.
  const now = current.time;

  const day = useMemo(() => {
    const from = now - 3600;
    const to = from + 25 * 3600;
    const points = hourly.filter((h) => h.time >= from && h.time <= to).map((h) => ({ t: h.time, v: h.temperature }));
    const ticks: Tick[] = hourly
      .filter((h) => h.time >= from && h.time <= to && localHour(h.time, utcOffset) % 6 === 0)
      .map((h) => ({ t: h.time, label: `${String(localHour(h.time, utcOffset)).padStart(2, '0')}:00` }));
    return { from, to, points, ticks };
  }, [hourly, utcOffset, now]);

  const strip = hourly.filter((h) => h.time > now).slice(0, 24);
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
      <Card style={{ marginTop: 10 }}>
        <View style={styles.facts}>
          <Fact icon="water-percent" label="Humidity" value={`${Math.round(current.humidity)}%`} />
          <Fact icon="weather-windy" label="Wind" value={`${Math.round(current.windSpeed)} km/h ${compass(current.windDirection)}`} />
          {daily[0] ? <Fact icon="weather-rainy" label="Rain today" value={`${daily[0].rainChance}%${daily[0].precipitationSum > 0 ? ` · ${daily[0].precipitationSum.toFixed(1)} mm` : ''}`} /> : null}
          {sensor !== undefined ? <Fact icon="home-thermometer-outline" label="Outside sensor" value={`${sensor.toFixed(1)}°`} /> : null}
          {daily[0] ? <Fact icon="weather-sunset" label="Sun" value={`${hhmm(daily[0].sunrise, utcOffset)} – ${hhmm(daily[0].sunset, utcOffset)}`} /> : null}
        </View>
      </Card>

      <Heading style={styles.section}>Next 24 hours</Heading>
      <Card>
        <LineChart points={day.points} from={day.from} to={day.to} ticks={day.ticks} color={c.accent} format={(v) => `${Math.round(v)}°`} height={140} minSpan={4} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 14 }}>
          {strip.map((h) => {
            const hc = describeCode(h.code, h.isDay);
            return (
              <View key={h.time} style={styles.hour}>
                <Text style={[styles.hourLabel, { color: c.textSecondary }]}>{`${String(localHour(h.time, utcOffset)).padStart(2, '0')}`}</Text>
                <Icon name={hc.icon} size={22} color={h.rainChance >= 50 ? rainTint : c.text} />
                <Text style={[styles.hourTemp, { color: c.text }]}>{`${Math.round(h.temperature)}°`}</Text>
                <Text style={[styles.rain, { color: h.rainChance >= 30 ? rainTint : c.textSecondary }]}>{h.rainChance >= 10 ? `${h.rainChance}%` : ' '}</Text>
              </View>
            );
          })}
        </ScrollView>
      </Card>

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

function Fact({ icon, label, value }: { icon: string; label: string; value: string }) {
  const c = useColors();
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={16} color={c.textSecondary} />
      <View>
        <Text style={[styles.factLabel, { color: c.textSecondary }]}>{label}</Text>
        <Text style={[styles.factValue, { color: c.text }]}>{value}</Text>
      </View>
    </View>
  );
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
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: '44%' },
  factLabel: { fontSize: 11 },
  factValue: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  section: { marginTop: 22, marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.7 },
  hour: { alignItems: 'center', gap: 3, width: 40 },
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
