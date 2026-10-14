import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { DeviceTile } from '@/components/device-tile';
import { StatusBanner } from '@/components/status-banner';
import { Body, Empty, Heading, Screen, Title, useColors } from '@/components/ui';
import { roomOf } from '@/lib/cube/capabilities';
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

  const sections = useMemo(() => groupByRoom(devices), [devices]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh().catch(() => undefined);
    setRefreshing(false);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.textSecondary} />}>
        <Title>{hub?.name ?? 'Home'}</Title>
        <Body muted style={{ marginTop: 2, marginBottom: 14 }}>
          {status === 'online' ? `${devices.length} devices · live` : status === 'connecting' ? 'Connecting…' : 'Not connected'}
        </Body>
        <StatusBanner />
        {devices.length === 0 && status === 'online' ? (
          <Empty icon="home-search" title="No devices yet" body="Pair devices on the hub and they appear here automatically." />
        ) : null}
        {sections.map(([room, list]) => (
          <View key={room} style={styles.section}>
            <Heading style={styles.room}>{room}</Heading>
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
      </ScrollView>
    </Screen>
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
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 18 },
  room: { marginBottom: 10, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.7 },
  gridRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
});
