/**
 * The home network at a glance, as a wide tile on Home: whether the internet
 * is up, the last speed test the bridge ran from the hub, and each Deco with
 * how many devices it is serving. Shown only when the ihost-bridge add-on
 * reads a Deco; tapping opens the Network tab.
 */

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ago, mbps, type Network } from '@/lib/network/bridge';
import { useNetwork } from '@/lib/network/store';

import { Text } from './text';
import { Card, caps, useColors } from './ui';

export function NetworkTile() {
  const { network } = useNetwork();
  if (!network?.configured) return null;
  return <Glance network={network} />;
}

function Glance({ network }: { network: Network }) {
  const c = useColors();
  const up = network.internet?.online;
  const last = network.speedtest?.last;
  const running = network.speedtest?.running;
  const tested = last && !last.error;
  const online = network.clients.filter((cl) => cl.online);
  const units = [...network.units].sort((a, b) => (a.role === 'master' ? -1 : b.role === 'master' ? 1 : a.name.localeCompare(b.name)));

  let caption: string;
  if (running) caption = 'Testing the speed…';
  else if (!last) caption = network.speedtest ? 'No speed test yet' : 'Speed tests come with the next bridge update';
  else if (last.error) caption = `Last speed test failed ${ago(last.at)}`;
  else caption = `${online.length} online · ${last.ping_ms ?? '—'} ms ping · tested ${ago(last.at)}`;

  return (
    <Card onPress={() => router.push('/network')} style={styles.card}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: c.text, flex: 1 }]}>Network</Text>
        <View style={[styles.pill, { backgroundColor: c.backgroundSelected }]}>
          <View style={[styles.dot, { backgroundColor: up === undefined ? c.textSecondary : up ? c.ok : c.danger }]} />
          <Text style={[styles.pillText, caps(c), { color: c.text }]}>{up === undefined ? 'No reading' : up ? 'Internet up' : 'Internet down'}</Text>
        </View>
      </View>

      <View style={[styles.row, { marginTop: 8, alignItems: 'flex-end' }]}>
        <Text style={[styles.hero, { color: c.text, fontWeight: c.type.hero }]}>{tested ? mbps(last.down_mbps) : String(online.length)}</Text>
        {tested ? (
          <View style={{ marginLeft: 6, marginBottom: 7 }}>
            <Text style={[styles.small, { color: c.textSecondary }]}>↓ Mbit/s</Text>
            <Text style={[styles.upload, { color: c.text }]}>{`↑ ${mbps(last.up_mbps)}`}</Text>
          </View>
        ) : (
          <Text style={[styles.upload, { color: c.text, marginBottom: 8, marginLeft: 4 }]}>{`device${online.length === 1 ? '' : 's'} online`}</Text>
        )}
      </View>
      <Text style={[styles.small, { color: c.textSecondary, marginTop: 2 }]}>{caption}</Text>

      <View style={styles.units}>
        {units.map((u) => {
          const count = online.filter((cl) => cl.deco === u.name).length;
          return (
            <View key={u.mac} style={[styles.unit, { backgroundColor: c.backgroundSelected }, c.shape.boxedCells ? { borderWidth: 2, borderColor: c.line } : null]}>
              <View style={styles.row}>
                <View style={[styles.dot, { backgroundColor: u.online ? c.ok : c.danger }]} />
                <Text numberOfLines={1} style={[styles.unitName, { color: c.text }]}>
                  {u.name}
                </Text>
              </View>
              <Text style={[styles.unitSub, { color: c.textSecondary }]}>{u.online ? `${count} device${count === 1 ? '' : 's'}` : 'Offline'}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 14, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  hero: { fontSize: 44, letterSpacing: -1.5, lineHeight: 50, fontVariant: ['tabular-nums'] },
  small: { fontSize: 12, fontVariant: ['tabular-nums'] },
  upload: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  unit: { flexGrow: 1, flexBasis: '30%', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
  unitName: { flex: 1, fontSize: 13, fontWeight: '700' },
  unitSub: { fontSize: 11, marginTop: 2, marginLeft: 13 },
});
