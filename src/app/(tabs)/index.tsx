import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeviceTile } from '@/components/device-tile';
import { HomeHeader } from '@/components/home-header';
import { SolarTile } from '@/components/solar-tile';
import { StatusBanner } from '@/components/status-banner';
import { WeatherTile } from '@/components/weather-tile';
import { Body, Empty, Screen, useColors } from '@/components/ui';
import { pinnedAt } from '@/lib/cube/appearance';
import { isOn, roomOf } from '@/lib/cube/capabilities';
import type { Device } from '@/lib/cube/types';
import { selectActiveHub, useDeviceList, useHub } from '@/lib/hub/store';

const UNASSIGNED = 'Unassigned';

export default function Home() {
  const c = useColors();
  const hub = useHub(selectActiveHub);
  const devices = useDeviceList();
  const refresh = useHub((s) => s.refresh);
  const status = useHub((s) => s.status);
  const [refreshing, setRefreshing] = useState(false);

  const { favourites, sections } = useMemo(() => {
    const pinned = devices.filter((d) => pinnedAt(d) !== undefined).sort((a, b) => (pinnedAt(a) ?? 0) - (pinnedAt(b) ?? 0));
    const rest = devices.filter((d) => pinnedAt(d) === undefined);
    return { favourites: pinned, sections: groupByRoom(rest) };
  }, [devices]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh().catch(() => undefined);
    setRefreshing(false);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.textSecondary} />}>
        <HomeHeader hubName={hub?.name} devices={devices} status={status} />
        <StatusBanner />
        <WeatherTile />
        <SolarTile />
        {devices.length === 0 && status === 'online' ? (
          <Empty icon="home-search" title="No devices yet" body="Pair devices on the hub and they appear here automatically." />
        ) : null}
        {favourites.length ? (
          <View style={styles.section}>
            <RoomHeading title="Favourites" />
            {favourites.map((device) => (
              <View key={device.serial_number} style={styles.gridRow}>
                <DeviceTile device={device} wide />
              </View>
            ))}
          </View>
        ) : null}
        {sections.map(([room, list]) => (
          <View key={room} style={styles.section}>
            <RoomHeading title={room} devices={list} />
            {chunk(list, 2).map((pair, i) => (
              <View key={i} style={styles.gridRow}>
                {pair.map((device) => (
                  <DeviceTile key={device.serial_number} device={device} />
                ))}
                {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}
          </View>
        ))}
        {devices.length > 1 && favourites.length === 0 ? (
          <Body muted style={styles.hint}>
            Long-press a tile to pin it to Favourites.
          </Body>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** A room's name over its tiles, with how many of its switchable devices are on. */
function RoomHeading({ title, devices }: { title: string; devices?: Device[] }) {
  const c = useColors();
  const switchable = devices?.filter((d) => isOn(d) !== undefined) ?? [];
  const on = switchable.filter((d) => isOn(d)).length;
  return (
    <View style={styles.roomRow}>
      <Text style={[styles.room, { color: c.textSecondary }]}>{title}</Text>
      {switchable.length > 1 ? <Text style={[styles.roomCount, { color: c.textSecondary }]}>{`${on} of ${switchable.length} on`}</Text> : null}
    </View>
  );
}

function groupByRoom(devices: Device[]): [string, Device[]][] {
  const groups = new Map<string, Device[]>();
  for (const d of devices) {
    const room = roomOf(d) ?? UNASSIGNED;
    groups.set(room, [...(groups.get(room) ?? []), d]);
  }
  const rooms = [...groups.keys()].sort((a, b) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b)));
  return rooms.map((room) => [room, (groups.get(room) ?? []).sort((a, b) => a.name.localeCompare(b.name))]);
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 40 },
  section: { marginBottom: 18 },
  roomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, marginBottom: 10, marginHorizontal: 4 },
  room: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  roomCount: { fontSize: 12, fontWeight: '600' },
  gridRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  hint: { fontSize: 13, textAlign: 'center', marginTop: 6 },
});
