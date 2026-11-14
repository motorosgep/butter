/**
 * Home internet traffic, from the rates the Deco reports per device (read by
 * the ihost-bridge add-on once a minute): what is in use now and on which
 * Deco, the last 24 hours, the data moved per day for 30 days, and which
 * devices moved the most today or yesterday. The Deco refreshes its rates
 * every minute or two, so volumes are estimates and short bursts are missed.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { BarChart, LineChart, type Bar, type Tick } from '@/components/chart';
import { Text } from '@/components/text';
import { Body, Button, Card, Chip, Empty, Heading, Row, Screen, useColors } from '@/components/ui';
import { ago, mbps, volume, type Traffic, type TrafficDay } from '@/lib/network/bridge';
import { useTraffic } from '@/lib/network/store';

const HOUR = 3600;
const DAY = 24 * HOUR;
const toMbit = (kBps: number) => (kBps * 8) / 1000;
const formatMbit = (v: number) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1));

export default function TrafficScreen() {
  const { traffic, error, loading, refresh } = useTraffic();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  let body;
  if (traffic?.configured) body = <TrafficView traffic={traffic} />;
  else if (loading) body = <ActivityIndicator style={{ marginTop: 40 }} />;
  else if (traffic && !traffic.configured) body = <Empty icon="router-wireless" title="No router set up" body="Add your TP-Link Deco on the ihost-bridge add-on's web page; traffic shows here from then on." />;
  else body = <Empty icon="alert-circle-outline" title="Could not read the traffic" body={error} />;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
        {body}
      </ScrollView>
    </Screen>
  );
}

function TrafficView({ traffic }: { traffic: Traffic }) {
  const c = useColors();
  const [which, setWhich] = useState<'today' | 'yesterday'>('today');
  const { now } = traffic;
  const decos = Object.entries(now.decos).sort((a, b) => b[1].down + b[1].up - (a[1].down + a[1].up));

  const day = useMemo(() => {
    const end = traffic.samples.length ? traffic.samples[traffic.samples.length - 1][0] : (traffic.now.at ?? 0);
    const from = end - DAY;
    const down = traffic.samples.map(([t, d]) => ({ t, v: toMbit(d) }));
    const up = traffic.samples.map(([t, , u]) => ({ t, v: toMbit(u) }));
    // A tick on every sixth local hour.
    const ticks: Tick[] = [];
    const first = new Date(from * 1000);
    first.setMinutes(0, 0, 0);
    for (let t = first.getTime() / 1000 + HOUR; t < end; t += HOUR) {
      const h = new Date(t * 1000).getHours();
      if (h % 6 === 0) ticks.push({ t, label: `${String(h).padStart(2, '0')}:00` });
    }
    return { from, to: end, down, up, ticks };
  }, [traffic.samples, traffic.now.at]);

  const month = useMemo(() => {
    // Data per local day, from the data the bridge counted per hour (bridges before
    // the per-hour counts send none: those hours count as nothing rather than as a guess).
    const perDay = new Map<number, number>();
    for (const [t, , , , , d = 0, u = 0] of traffic.hours) {
      const start = new Date(t * 1000);
      start.setHours(0, 0, 0, 0);
      const key = start.getTime() / 1000;
      perDay.set(key, (perDay.get(key) ?? 0) + d + u);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.getTime() / 1000;
    const bars: Bar[] = [...perDay.entries()].map(([t, kb]) => ({ start: t, end: t + DAY, v: kb / 1_000_000, muted: t === todayKey }));
    const from = Math.min(todayKey - 29 * DAY, ...bars.map((b) => b.start));
    const ticks: Tick[] = [];
    for (let t = todayKey; t >= from; t -= 7 * DAY) {
      const d = new Date(t * 1000);
      ticks.unshift({ t: t + DAY / 2, label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    return { bars, from, to: todayKey + DAY, ticks };
  }, [traffic.hours]);

  const shown: TrafficDay = which === 'today' ? traffic.today : traffic.yesterday;

  return (
    <View>
      <Card>
        <Row between>
          <Heading style={{ fontSize: 15 }}>Right now</Heading>
          <Body muted style={{ fontSize: 13 }}>{now.at ? ago(now.at) : '—'}</Body>
        </Row>
        <Row style={{ marginTop: 8, gap: 22 }}>
          <Figure label="Down" value={mbps(now.down)} unit="Mbit/s" />
          <Figure label="Up" value={mbps(now.up)} unit="Mbit/s" />
        </Row>
        {decos.map(([name, d]) => (
          <Row key={name} style={{ marginTop: 10 }}>
            <Body style={{ flex: 1 }}>{`${name} · ${d.devices} device${d.devices === 1 ? '' : 's'}`}</Body>
            <Body muted style={{ fontVariant: ['tabular-nums'] }}>{`↓ ${mbps(d.down)}  ↑ ${mbps(d.up)}`}</Body>
          </Row>
        ))}
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Heading style={{ fontSize: 15 }}>Last 24 hours</Heading>
        <Body muted style={{ fontSize: 13, marginTop: 2, marginBottom: 10 }}>Mbit/s · download solid, upload dashed</Body>
        {day.down.length > 1 ? (
          <LineChart points={day.down} secondary={day.up} secondaryColor={c.info} from={day.from} to={day.to} ticks={day.ticks} color={c.accent} format={formatMbit} zeroBased minSpan={1} height={170} />
        ) : (
          <Body muted>The chart fills in as the bridge reads the Deco, once a minute.</Body>
        )}
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Heading style={{ fontSize: 15 }}>Data per day</Heading>
        <Body muted style={{ fontSize: 13, marginTop: 2, marginBottom: 10 }}>Down and up together, the last 30 days</Body>
        {month.bars.some((b) => b.v > 0) ? (
          <BarChart bars={month.bars} from={month.from} to={month.to} ticks={month.ticks} color={c.accent} format={(v) => (v >= 10 ? `${Math.round(v)} GB` : v >= 1 ? `${v.toFixed(1)} GB` : `${Math.round(v * 1000)} MB`)} height={150} />
        ) : (
          <Body muted>Fills in from today, an hour at a time.</Body>
        )}
      </Card>

      <Row style={{ marginTop: 18 }}>
        <Chip label="Today" selected={which === 'today'} onPress={() => setWhich('today')} />
        <Chip label="Yesterday" selected={which === 'yesterday'} onPress={() => setWhich('yesterday')} />
      </Row>
      <Card style={{ marginTop: 10 }}>
        <Row between>
          <Heading style={{ fontSize: 15 }}>By device</Heading>
          <Body muted style={{ fontSize: 13 }}>{`↓ ${volume(shown.down_kb)} · ↑ ${volume(shown.up_kb)}`}</Body>
        </Row>
        {shown.devices.length === 0 ? <Body muted style={{ marginTop: 8 }}>Nothing recorded for this day yet.</Body> : null}
        <DeviceBars day={shown} />
      </Card>

      <Body muted style={{ fontSize: 12, marginTop: 12 }}>
        The Deco refreshes each device’s rate every minute or two, so short bursts are missed and the amounts are estimates. The Deco app’s speed test runs through TP-Link’s cloud and cannot be read here.
      </Body>
      <Row style={{ marginTop: 10 }}>
        <Button title="Open network" variant="secondary" icon="router-wireless" onPress={() => router.navigate('/network')} />
      </Row>
    </View>
  );
}

function DeviceBars({ day }: { day: TrafficDay }) {
  const c = useColors();
  const top = day.devices.slice(0, 20);
  const most = Math.max(1, ...top.map((d) => d.down + d.up));
  return (
    <View style={{ marginTop: 6 }}>
      {top.map((d) => (
        <View key={d.mac} style={{ marginTop: 10 }}>
          <Row between>
            <Text numberOfLines={1} style={[styles.name, { color: c.text, flex: 1 }]}>
              {d.name || d.mac}
            </Text>
            <Body muted style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}>{volume(d.down + d.up)}</Body>
          </Row>
          <View style={[styles.track, { backgroundColor: c.backgroundSelected }]}>
            <View style={{ width: `${((d.down + d.up) / most) * 100}%`, flexDirection: 'row', height: '100%' }}>
              <View style={{ flex: Math.max(d.down, 0.0001), backgroundColor: c.accent }} />
              <View style={{ flex: Math.max(d.up, 0.0001), backgroundColor: c.info }} />
            </View>
          </View>
        </View>
      ))}
      {day.devices.length > top.length ? <Body muted style={{ fontSize: 12, marginTop: 10 }}>{`and ${day.devices.length - top.length} more`}</Body> : null}
    </View>
  );
}

function Figure({ label, value, unit }: { label: string; value: string; unit: string }) {
  const c = useColors();
  return (
    <View>
      <Body muted style={{ fontSize: 12 }}>{label}</Body>
      <Text style={[styles.figure, { color: c.text }]}>
        {value}
        <Text style={[styles.figureUnit, { color: c.textSecondary }]}>{` ${unit}`}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  figure: { fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
  figureUnit: { fontSize: 13, fontWeight: '600' },
  name: { fontSize: 14, fontWeight: '600' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 5 },
});
