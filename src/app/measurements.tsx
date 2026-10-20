/**
 * Browse HungaroMet's measurements for the station nearest home: rainfall by
 * day, month and year against the station's own long-term averages, the
 * temperatures, and the last two days hour by hour.
 */

import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BarChart, LineChart, type Band, type Bar, type Tick, type XY } from '@/components/chart';
import { Body, Button, Card, Chip, Empty, Heading, Icon, Row, Screen, useColors } from '@/components/ui';
import { selectActiveHub, useHub } from '@/lib/hub/store';
import { refreshHourly, refreshSeries, useStationHourly, useStationSeries, useStations, type Loadable } from '@/lib/measurements/cache';
import {
  ODP_ATTRIBUTION,
  ODP_HOME,
  annualTotals,
  daysInMonth,
  distanceKm,
  monthLabel,
  monthlyNormals,
  nearestStations,
  round1,
  ymd,
  type DailyRow,
  type HourlyRow,
  type MonthlyRow,
  type Station,
} from '@/lib/measurements/odp';
import type { Place } from '@/lib/weather/open-meteo';
import { compass } from '@/lib/weather/open-meteo';

type Tab = 'rain' | 'temperature' | 'latest';

const RAIN = '#4FA3E0';
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function MeasurementsScreen() {
  const hub = useHub(selectActiveHub);
  const setStation = useHub((s) => s.setStation);
  const station = hub?.station ?? undefined;
  const place = hub?.place ?? undefined;
  const [picking, setPicking] = useState(!station);
  const [refreshing, setRefreshing] = useState(false);

  if (!hub) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: 'Measurements' }} />
        <Empty icon="chart-bar" title="No hub selected" />
      </Screen>
    );
  }

  const onRefresh = async () => {
    if (!station) return;
    setRefreshing(true);
    await Promise.all([refreshSeries(station), refreshHourly(station)]);
    setRefreshing(false);
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: station ? station.name : 'Measurements' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={station && !picking ? <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} /> : undefined}>
        {picking || !station ? (
          <StationPicker
            place={place}
            current={station}
            onPick={(s) => {
              void setStation(hub.id, s);
              setPicking(false);
            }}
            onCancel={station ? () => setPicking(false) : undefined}
          />
        ) : (
          <StationView station={station} place={place} onChange={() => setPicking(true)} />
        )}
        <Pressable onPress={() => void Linking.openURL(ODP_HOME)} style={{ marginTop: 18 }}>
          <Body muted style={{ fontSize: 12, textAlign: 'center' }}>
            {ODP_ATTRIBUTION}
          </Body>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

// ----- station picker ------------------------------------------------------------------

function StationPicker({ place, current, onPick, onCancel }: { place?: Place; current?: Station; onPick: (s: Station) => void; onCancel?: () => void }) {
  const c = useColors();
  const stations = useStations();
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const all = stations.data ?? [];
    const q = query.trim().toLowerCase();
    if (q) {
      return all
        .filter((s) => s.name.toLowerCase().includes(q) || (s.region ?? '').toLowerCase().includes(q))
        .map((s) => ({ ...s, km: place ? distanceKm(place.lat, place.lon, s.lat, s.lon) : undefined }))
        .sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
        .slice(0, 30);
    }
    return place ? nearestStations(all, place.lat, place.lon, 15) : [];
  }, [stations.data, query, place]);

  return (
    <View>
      <Heading>Which station?</Heading>
      <Body muted style={{ marginTop: 4 }}>
        {place ? `Nearest to ${place.name} first. ` : 'Set the home’s place on the weather screen to see the nearest stations, or search by name. '}
        Automatic stations have everything up to yesterday; rain gauges are denser but publish about a month behind.
      </Body>
      <Row style={{ marginTop: 12 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by town or county"
          placeholderTextColor={c.textSecondary}
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement }]}
        />
        {stations.loading ? <ActivityIndicator /> : null}
        {onCancel ? <Button title="Cancel" variant="secondary" onPress={onCancel} /> : null}
      </Row>
      {stations.error ? (
        <Body muted style={{ marginTop: 10 }}>
          {`Could not load the station list: ${stations.error}`}
        </Body>
      ) : null}
      {!stations.loading && !stations.error && list.length === 0 ? (
        <Body muted style={{ marginTop: 10 }}>
          {query.trim() ? 'No station by that name.' : 'No place set for this home yet.'}
        </Body>
      ) : null}
      <View style={{ marginTop: 10, gap: 8 }}>
        {list.map((s) => (
          <Card key={`${s.kind}-${s.id}`} onPress={() => onPick(plainStation(s))}>
            <Row between>
              <View style={[styles.badge, { backgroundColor: s.kind === 'auto' ? c.accentSoft : 'rgba(79,163,224,0.2)' }]}>
                <Icon name={s.kind === 'auto' ? 'broadcast' : 'cup-water'} size={20} color={s.kind === 'auto' ? c.accent : RAIN} />
              </View>
              <View style={{ flex: 1 }}>
                <Body>{s.name}</Body>
                <Body muted style={{ fontSize: 13 }}>
                  {[s.kind === 'auto' ? 'Automatic station' : 'Rain gauge', s.km !== undefined ? `${s.km.toFixed(1)} km` : undefined, `${Math.round(s.elevation)} m`, `since ${s.from.slice(0, 4)}`]
                    .filter(Boolean)
                    .join(' · ')}
                </Body>
              </View>
              <Icon name={current?.id === s.id && current.kind === s.kind ? 'check-circle' : 'chevron-right'} size={20} color={current?.id === s.id ? c.accent : c.textSecondary} />
            </Row>
          </Card>
        ))}
      </View>
    </View>
  );
}

function plainStation(s: Station & { km?: number }): Station {
  return { id: s.id, name: s.name, region: s.region, lat: s.lat, lon: s.lon, elevation: s.elevation, kind: s.kind, from: s.from, to: s.to };
}

// ----- station view -------------------------------------------------------------------

function StationView({ station, place, onChange }: { station: Station; place?: Place; onChange: () => void }) {
  const [tab, setTab] = useState<Tab>('rain');
  const series = useStationSeries(station);
  const hourly = useStationHourly(station, station.kind === 'auto' && tab === 'latest');
  const km = place ? distanceKm(place.lat, place.lon, station.lat, station.lon) : undefined;

  return (
    <View>
      <Card>
        <Row between style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Heading style={{ fontSize: 18 }}>{station.name}</Heading>
            <Body muted style={{ marginTop: 2, fontSize: 13 }}>
              {[
                station.kind === 'auto' ? 'Automatic station' : 'Rain gauge',
                station.region,
                km !== undefined ? `${km.toFixed(1)} km from home` : undefined,
                `${Math.round(station.elevation)} m`,
                `records since ${station.from.slice(0, 4)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Body>
          </View>
          <Button title="Change" variant="secondary" icon="map-marker-outline" onPress={onChange} />
        </Row>
      </Card>

      <Row style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <Chip label="Rain" selected={tab === 'rain'} onPress={() => setTab('rain')} />
        {station.kind === 'auto' ? <Chip label="Temperature" selected={tab === 'temperature'} onPress={() => setTab('temperature')} /> : null}
        {station.kind === 'auto' ? <Chip label="Last 48 hours" selected={tab === 'latest'} onPress={() => setTab('latest')} /> : null}
      </Row>

      {tab !== 'latest' && !series.data ? <Loading state={series} what="the station's records" /> : null}
      {tab === 'rain' && series.data ? <RainView daily={series.data.daily} monthly={series.data.monthly} /> : null}
      {tab === 'temperature' && series.data ? <TemperatureView daily={series.data.daily} monthly={series.data.monthly} /> : null}
      {tab === 'latest' ? hourly.data ? <LatestView rows={hourly.data.rows} /> : <Loading state={hourly} what="the last two days" /> : null}
    </View>
  );
}

function Loading({ state, what }: { state: Loadable<unknown>; what: string }) {
  return (
    <Card style={{ marginTop: 12 }}>
      <Row>
        {state.loading ? <ActivityIndicator /> : <Icon name="cloud-alert" size={20} />}
        <Body style={{ flex: 1 }}>
          {state.loading
            ? `Fetching ${what} from odp.met.hu… The first time takes a moment; the history is a few hundred kilobytes and is kept on the phone afterwards.`
            : (state.error ?? 'Nothing loaded yet.')}
        </Body>
      </Row>
    </Card>
  );
}

// ----- rain ---------------------------------------------------------------------------

function RainView({ daily, monthly }: { daily: DailyRow[]; monthly: MonthlyRow[] }) {
  const c = useColors();
  const thisMonth = ymd(new Date()).slice(0, 6);
  const [month, setMonth] = useState(thisMonth);
  const [year, setYear] = useState(thisMonth.slice(0, 4));
  const normals = useMemo(() => monthlyNormals(monthly, (r) => r.rain), [monthly]);
  const years = useMemo(() => annualTotals(monthly), [monthly]);
  const firstMonth = daily[0]?.date.slice(0, 6) ?? thisMonth;

  // --- by day
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(4, 6));
  const monthDays = daily.filter((d) => d.date.startsWith(month));
  const n = daysInMonth(month);
  const dayBars: Bar[] = Array.from({ length: n }, (_, i) => {
    const date = `${month}${String(i + 1).padStart(2, '0')}`;
    const row = monthDays.find((d) => d.date === date);
    return { start: local(y, m - 1, i + 1), end: local(y, m - 1, i + 2), v: row?.rain ?? 0 };
  });
  const dayTicks: Tick[] = [1, 8, 15, 22, 29].filter((d) => d <= n).map((d) => ({ t: local(y, m - 1, d, 12), label: String(d) }));
  const reported = monthDays.filter((d) => d.rain !== undefined);
  const total = round1(reported.reduce((a, d) => a + (d.rain ?? 0), 0));
  const wet = reported.filter((d) => (d.rain ?? 0) >= 0.1).length;
  const wettest = reported.reduce<DailyRow | undefined>((best, d) => ((d.rain ?? 0) > (best?.rain ?? 0) ? d : best), undefined);
  const normal = normals[m - 1];
  const monthName = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long' });

  // --- by month
  const Y = Number(year);
  const yearRows = monthly.filter((r) => r.month.startsWith(year));
  const monthBars: Bar[] = Array.from({ length: 12 }, (_, i) => {
    const row = yearRows.find((r) => Number(r.month.slice(4, 6)) === i + 1);
    return { start: local(Y, i, 1), end: local(Y, i + 1, 1), v: row?.rain ?? 0, muted: row?.partial };
  });
  const monthRef = normals.map((nrm, i) => ({ start: local(Y, i, 1), end: local(Y, i + 1, 1), v: nrm.value }));
  const monthTicks: Tick[] = MONTH_INITIALS.map((label, i) => ({ t: local(Y, i, 15), label }));
  const yearTotal = round1(yearRows.reduce((a, r) => a + (r.rain ?? 0), 0));
  const yearPartial = yearRows.length < 12 || yearRows.some((r) => r.partial);
  const normalYear = normals.every((nrm) => nrm.years > 0) ? Math.round(normals.reduce((a, nrm) => a + nrm.value, 0)) : undefined;
  const wettestMonth = yearRows.reduce<MonthlyRow | undefined>((best, r) => ((r.rain ?? -1) > (best?.rain ?? -1) ? r : best), undefined);
  const driestMonth = yearRows.filter((r) => !r.partial && r.rain !== undefined).reduce<MonthlyRow | undefined>((best, r) => ((r.rain ?? 0) < (best?.rain ?? Infinity) ? r : best), undefined);
  const yearsOnRecord = Math.max(0, ...normals.map((nrm) => nrm.years));

  // --- by year
  const yearBars: Bar[] = years.map((yr) => ({ start: local(Number(yr.year), 0, 1), end: local(Number(yr.year) + 1, 0, 1), v: yr.rain, muted: yr.partial }));
  const yearTicks: Tick[] = years.filter((_, i) => i % Math.max(1, Math.ceil(years.length / 6)) === 0).map((yr) => ({ t: local(Number(yr.year), 6, 1), label: yr.year }));
  const complete = years.filter((yr) => !yr.partial);
  const wettestYear = complete.reduce<(typeof years)[number] | undefined>((best, yr) => (yr.rain > (best?.rain ?? -1) ? yr : best), undefined);
  const driestYear = complete.reduce<(typeof years)[number] | undefined>((best, yr) => (yr.rain < (best?.rain ?? Infinity) ? yr : best), undefined);

  return (
    <View>
      <Heading style={styles.section}>By day</Heading>
      <Card>
        <Nav label={monthLabel(month)} onPrev={month > firstMonth ? () => setMonth(shiftMonth(month, -1)) : undefined} onNext={month < thisMonth ? () => setMonth(shiftMonth(month, 1)) : undefined} />
        <BarChart bars={dayBars} from={local(y, m - 1, 1)} to={local(y, m, 1)} ticks={dayTicks} color={RAIN} format={(v) => `${Math.round(v)} mm`} height={150} />
        {reported.length ? (
          <Stats
            items={[
              ['Total', `${total} mm`],
              ['Wet days', `${wet} of ${reported.length}`],
              wettest && wettest.rain ? ['Wettest day', `${wettest.rain} mm on ${dayLabel(wettest.date)}`] : undefined,
              normal.years ? [`Average ${monthName}`, `${Math.round(normal.value)} mm`] : undefined,
            ]}
          />
        ) : (
          <Body muted style={{ marginTop: 10 }}>
            Nothing reported for this month yet.
          </Body>
        )}
      </Card>

      <Heading style={styles.section}>By month</Heading>
      <Card>
        <Nav label={year} onPrev={year > firstMonth.slice(0, 4) ? () => setYear(String(Y - 1)) : undefined} onNext={year < thisMonth.slice(0, 4) ? () => setYear(String(Y + 1)) : undefined} />
        <BarChart bars={monthBars} from={local(Y, 0, 1)} to={local(Y + 1, 0, 1)} ticks={monthTicks} color={RAIN} format={(v) => `${Math.round(v)} mm`} height={150} reference={monthRef} referenceColor={c.accent} />
        <Stats
          items={[
            ['Year total', `${yearTotal} mm${yearPartial ? ' so far' : ''}`],
            normalYear !== undefined ? ['Average year', `${normalYear} mm`] : undefined,
            wettestMonth?.rain !== undefined ? ['Wettest month', `${monthLabel(wettestMonth.month, 'short').split(' ')[0]} · ${wettestMonth.rain} mm`] : undefined,
            driestMonth?.rain !== undefined ? ['Driest month', `${monthLabel(driestMonth.month, 'short').split(' ')[0]} · ${driestMonth.rain} mm`] : undefined,
          ]}
        />
        {yearsOnRecord ? (
          <Body muted style={{ fontSize: 12, marginTop: 8 }}>
            {`The butter marks are each month's average over ${yearsOnRecord} years at this station. Faint bars are months not over yet.`}
          </Body>
        ) : null}
      </Card>

      {years.length > 1 ? (
        <>
          <Heading style={styles.section}>By year</Heading>
          <Card>
            <BarChart
              bars={yearBars}
              from={local(Number(years[0].year), 0, 1)}
              to={local(Number(years[years.length - 1].year) + 1, 0, 1)}
              ticks={yearTicks}
              color={RAIN}
              format={(v) => `${Math.round(v)} mm`}
              height={150}
              reference={normalYear !== undefined ? [{ start: local(Number(years[0].year), 0, 1), end: local(Number(years[years.length - 1].year) + 1, 0, 1), v: normalYear }] : undefined}
              referenceColor={c.accent}
            />
            <Stats
              items={[
                wettestYear ? ['Wettest year', `${wettestYear.year} · ${Math.round(wettestYear.rain)} mm`] : undefined,
                driestYear ? ['Driest year', `${driestYear.year} · ${Math.round(driestYear.rain)} mm`] : undefined,
                normalYear !== undefined ? ['Average', `${normalYear} mm`] : undefined,
                ['Complete years', String(complete.length)],
              ]}
            />
          </Card>
        </>
      ) : null}
    </View>
  );
}

// ----- temperature ----------------------------------------------------------------------

function TemperatureView({ daily, monthly }: { daily: DailyRow[]; monthly: MonthlyRow[] }) {
  const c = useColors();
  const thisMonth = ymd(new Date()).slice(0, 6);
  const [month, setMonth] = useState(thisMonth);
  const [year, setYear] = useState(thisMonth.slice(0, 4));
  const normals = useMemo(() => monthlyNormals(monthly, (r) => r.tMean), [monthly]);
  const firstMonth = daily[0]?.date.slice(0, 6) ?? thisMonth;

  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(4, 6));
  const monthDays = daily.filter((d) => d.date.startsWith(month));
  const points: XY[] = monthDays.filter((d) => d.tMean !== undefined).map((d) => ({ t: local(y, m - 1, Number(d.date.slice(6, 8)), 12), v: d.tMean as number }));
  const band: Band[] = monthDays
    .filter((d) => d.tMin !== undefined && d.tMax !== undefined)
    .map((d) => ({ t: local(y, m - 1, Number(d.date.slice(6, 8)), 12), lo: d.tMin as number, hi: d.tMax as number }));
  const n = daysInMonth(month);
  const dayTicks: Tick[] = [1, 8, 15, 22, 29].filter((d) => d <= n).map((d) => ({ t: local(y, m - 1, d, 12), label: String(d) }));
  const mean = points.length ? round1(points.reduce((a, p) => a + p.v, 0) / points.length) : undefined;
  const warmest = monthDays.reduce<DailyRow | undefined>((best, d) => ((d.tMax ?? -Infinity) > (best?.tMax ?? -Infinity) ? d : best), undefined);
  const coldest = monthDays.reduce<DailyRow | undefined>((best, d) => ((d.tMin ?? Infinity) < (best?.tMin ?? Infinity) ? d : best), undefined);
  const normal = normals[m - 1];
  const monthName = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long' });

  const Y = Number(year);
  const yearRows = monthly.filter((r) => r.month.startsWith(year) && r.tMean !== undefined);
  const yearPoints: XY[] = yearRows.map((r) => ({ t: local(Y, Number(r.month.slice(4, 6)) - 1, 15), v: r.tMean as number }));
  const normalPoints: XY[] = normals.map((nrm, i) => ({ t: local(Y, i, 15), v: nrm.value })).filter((p) => Number.isFinite(p.v));
  const monthTicks: Tick[] = MONTH_INITIALS.map((label, i) => ({ t: local(Y, i, 15), label }));
  const warmestMonth = yearRows.reduce<MonthlyRow | undefined>((best, r) => ((r.tMean ?? -Infinity) > (best?.tMean ?? -Infinity) ? r : best), undefined);
  const coldestMonth = yearRows.reduce<MonthlyRow | undefined>((best, r) => ((r.tMean ?? Infinity) < (best?.tMean ?? Infinity) ? r : best), undefined);

  return (
    <View>
      <Heading style={styles.section}>By day</Heading>
      <Card>
        <Nav label={monthLabel(month)} onPrev={month > firstMonth ? () => setMonth(shiftMonth(month, -1)) : undefined} onNext={month < thisMonth ? () => setMonth(shiftMonth(month, 1)) : undefined} />
        {points.length ? (
          <>
            <LineChart points={points} from={local(y, m - 1, 1)} to={local(y, m, 1)} ticks={dayTicks} color={c.accent} format={(v) => `${Math.round(v)}°`} height={160} minSpan={6} band={band} />
            <Stats
              items={[
                mean !== undefined ? ['Mean', `${mean}°`] : undefined,
                warmest?.tMax !== undefined ? ['Warmest day', `${warmest.tMax}° on ${dayLabel(warmest.date)}`] : undefined,
                coldest?.tMin !== undefined ? ['Coldest night', `${coldest.tMin}° on ${dayLabel(coldest.date)}`] : undefined,
                normal.years ? [`Average ${monthName}`, `${normal.value.toFixed(1)}°`] : undefined,
              ]}
            />
            <Body muted style={{ fontSize: 12, marginTop: 8 }}>
              The line is the daily mean; the shaded band runs from the night&apos;s minimum to the day&apos;s maximum.
            </Body>
          </>
        ) : (
          <Body muted style={{ marginTop: 10 }}>
            Nothing reported for this month yet.
          </Body>
        )}
      </Card>

      <Heading style={styles.section}>By month</Heading>
      <Card>
        <Nav label={year} onPrev={year > firstMonth.slice(0, 4) ? () => setYear(String(Y - 1)) : undefined} onNext={year < thisMonth.slice(0, 4) ? () => setYear(String(Y + 1)) : undefined} />
        {yearPoints.length ? (
          <>
            <LineChart points={yearPoints} from={local(Y, 0, 1)} to={local(Y + 1, 0, 1)} ticks={monthTicks} color={c.accent} format={(v) => `${Math.round(v)}°`} height={160} minSpan={6} secondary={normalPoints} />
            <Stats
              items={[
                warmestMonth?.tMean !== undefined ? ['Warmest month', `${monthLabel(warmestMonth.month, 'short').split(' ')[0]} · ${warmestMonth.tMean}°`] : undefined,
                coldestMonth?.tMean !== undefined ? ['Coldest month', `${monthLabel(coldestMonth.month, 'short').split(' ')[0]} · ${coldestMonth.tMean}°`] : undefined,
              ]}
            />
            <Body muted style={{ fontSize: 12, marginTop: 8 }}>
              Monthly mean temperature; the dashed line is the station&apos;s long-term average for each month.
            </Body>
          </>
        ) : (
          <Body muted style={{ marginTop: 10 }}>
            No monthly values for this year yet.
          </Body>
        )}
      </Card>
    </View>
  );
}

// ----- last 48 hours ---------------------------------------------------------------------

function LatestView({ rows }: { rows: HourlyRow[] }) {
  const c = useColors();
  const points: XY[] = rows.filter((r) => r.temp !== undefined).map((r) => ({ t: utc(r.time), v: r.temp as number }));
  if (!points.length) {
    return (
      <Card style={{ marginTop: 12 }}>
        <Body muted>No hourly values yet.</Body>
      </Card>
    );
  }
  const from = points[0].t;
  const to = points[points.length - 1].t + 3600;
  const ticks: Tick[] = rows
    .map((r) => utc(r.time))
    .filter((t) => new Date(t * 1000).getHours() % 6 === 0)
    .map((t) => ({ t, label: `${String(new Date(t * 1000).getHours()).padStart(2, '0')}:00` }));
  const rainBars: Bar[] = rows.map((r) => ({ start: utc(r.time), end: utc(r.time) + 3600, v: r.rain ?? 0 }));
  const anyRain = rainBars.some((b) => b.v > 0);
  const last24 = rows.filter((r) => utc(r.time) >= to - 24 * 3600);
  const rain24 = round1(last24.reduce((a, r) => a + (r.rain ?? 0), 0));
  const gust = last24.reduce<HourlyRow | undefined>((best, r) => ((r.gust ?? -1) > (best?.gust ?? -1) ? r : best), undefined);
  const temps = last24.map((r) => r.temp).filter((t): t is number => t !== undefined);
  const latest = rows[rows.length - 1];
  const recent = [...rows].reverse().slice(0, 12);

  return (
    <View>
      <Heading style={styles.section}>Temperature</Heading>
      <Card>
        <LineChart points={points} from={from} to={to} ticks={ticks} color={c.accent} format={(v) => `${Math.round(v)}°`} height={150} minSpan={4} />
        <Stats
          items={[
            latest?.temp !== undefined ? ['Now', `${latest.temp}° at ${hhmm(latest.time)}`] : undefined,
            temps.length ? ['Last 24 h', `${Math.min(...temps)}° to ${Math.max(...temps)}°`] : undefined,
            ['Rain, last 24 h', `${rain24} mm`],
            gust?.gust !== undefined ? ['Strongest gust', `${gust.gust} m/s ${gust.gustDir !== undefined ? compass(gust.gustDir) : ''} at ${hhmm(gust.time)}`] : undefined,
          ]}
        />
      </Card>

      {anyRain ? (
        <>
          <Heading style={styles.section}>Rain per hour</Heading>
          <Card>
            <BarChart bars={rainBars} from={from} to={to} ticks={ticks} color={RAIN} format={(v) => `${v.toFixed(1)} mm`} height={120} />
          </Card>
        </>
      ) : null}

      <Heading style={styles.section}>Hour by hour</Heading>
      <Card>
        <View style={[styles.tr, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
          {['Time', 'Temp', 'Rain', 'Hum.', 'Wind', 'Press.'].map((h) => (
            <Text key={h} style={[styles.th, { color: c.textSecondary }]}>
              {h}
            </Text>
          ))}
        </View>
        {recent.map((r) => (
          <View key={r.time} style={styles.tr}>
            <Text style={[styles.td, { color: c.text }]}>{hhmm(r.time)}</Text>
            <Text style={[styles.td, { color: c.text }]}>{r.temp !== undefined ? `${r.temp.toFixed(1)}°` : '–'}</Text>
            <Text style={[styles.td, { color: (r.rain ?? 0) > 0 ? RAIN : c.textSecondary }]}>{r.rain !== undefined ? `${r.rain.toFixed(1)}` : '–'}</Text>
            <Text style={[styles.td, { color: c.text }]}>{r.humidity !== undefined ? `${Math.round(r.humidity)}%` : '–'}</Text>
            <Text style={[styles.td, { color: c.text }]}>{r.wind !== undefined ? `${r.wind.toFixed(1)}${r.gust !== undefined ? `/${r.gust.toFixed(0)}` : ''}` : '–'}</Text>
            <Text style={[styles.td, { color: c.text }]}>{r.seaPressure ?? r.pressure ? `${Math.round((r.seaPressure ?? r.pressure) as number)}` : '–'}</Text>
          </View>
        ))}
        <Body muted style={{ fontSize: 12, marginTop: 8 }}>
          Rain in mm per hour, wind as mean/gust in m/s, pressure in hPa. Times are local.
        </Body>
      </Card>
    </View>
  );
}

// ----- shared bits ----------------------------------------------------------------------

function Nav({ label, onPrev, onNext }: { label: string; onPrev?: () => void; onNext?: () => void }) {
  const c = useColors();
  return (
    <Row between style={{ marginBottom: 10 }}>
      <Pressable onPress={onPrev} disabled={!onPrev} hitSlop={8} accessibilityRole="button" accessibilityLabel="Earlier" style={[styles.navBtn, { backgroundColor: c.backgroundSelected, opacity: onPrev ? 1 : 0.35 }]}>
        <Icon name="chevron-left" size={20} />
      </Pressable>
      <Heading style={{ fontSize: 15 }}>{label}</Heading>
      <Pressable onPress={onNext} disabled={!onNext} hitSlop={8} accessibilityRole="button" accessibilityLabel="Later" style={[styles.navBtn, { backgroundColor: c.backgroundSelected, opacity: onNext ? 1 : 0.35 }]}>
        <Icon name="chevron-right" size={20} />
      </Pressable>
    </Row>
  );
}

function Stats({ items }: { items: ([string, string] | undefined)[] }) {
  const c = useColors();
  const list = items.filter((x): x is [string, string] => !!x);
  if (!list.length) return null;
  return (
    <View style={styles.stats}>
      {list.map(([label, value]) => (
        <View key={label} style={styles.stat}>
          <Text style={[styles.statLabel, { color: c.textSecondary }]}>{label}</Text>
          <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Local midnight (or hour) as epoch seconds; month is 0-based and may overflow. */
function local(year: number, month: number, day: number, hour = 0): number {
  return new Date(year, month, day, hour).getTime() / 1000;
}

/** `YYYYMMDDHHmm` in UTC as epoch seconds. */
function utc(time: string): number {
  return Date.UTC(Number(time.slice(0, 4)), Number(time.slice(4, 6)) - 1, Number(time.slice(6, 8)), Number(time.slice(8, 10)), Number(time.slice(10, 12))) / 1000;
}

function hhmm(time: string): string {
  const d = new Date(utc(time) * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function shiftMonth(yyyymm: string, delta: number): string {
  const d = new Date(Number(yyyymm.slice(0, 4)), Number(yyyymm.slice(4, 6)) - 1 + delta, 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dayLabel(yyyymmdd: string): string {
  const d = new Date(Number(yyyymmdd.slice(0, 4)), Number(yyyymmdd.slice(4, 6)) - 1, Number(yyyymmdd.slice(6, 8)));
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  badge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 22, marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.7 },
  navBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  stat: { minWidth: '44%', flexGrow: 1 },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'], marginTop: 1 },
  tr: { flexDirection: 'row', paddingVertical: 5 },
  th: { flex: 1, fontSize: 11, fontWeight: '600' },
  td: { flex: 1, fontSize: 13, fontVariant: ['tabular-nums'] },
});
