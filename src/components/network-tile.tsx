/**
 * The home network at a glance, as a slim card on Home: whether the internet
 * is up, and the Deco mesh (each unit online or not, with how many devices it
 * serves). Shown only when the ihost-bridge add-on reads a Deco; tapping opens
 * the Network tab, where traffic and devices live.
 */

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Network } from '@/lib/network/bridge';
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
  const online = network.clients.filter((cl) => cl.online);
  const units = [...network.units].sort((a, b) => (a.role === 'master' ? -1 : b.role === 'master' ? 1 : a.name.localeCompare(b.name)));
  const unitsUp = units.filter((u) => u.online).length;
  const meshOk = units.length > 0 && unitsUp === units.length;

  return (
    <Card onPress={() => router.navigate('/network')} style={styles.card}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: c.text }]}>Network</Text>
        <Text style={[styles.sub, { color: c.textSecondary, flex: 1 }]}>
          {`${meshOk ? 'Mesh OK' : `Mesh ${unitsUp}/${units.length}`} · ${online.length} devices`}
        </Text>
        <View style={[styles.pill, { backgroundColor: c.backgroundSelected }]}>
          <View style={[styles.dot, { backgroundColor: up === undefined ? c.textSecondary : up ? c.ok : c.danger }]} />
          <Text style={[styles.pillText, caps(c), { color: c.text }]}>{up === undefined ? 'No reading' : up ? 'Internet up' : 'Internet down'}</Text>
        </View>
      </View>

      <View style={styles.units}>
        {units.map((u) => {
          const count = online.filter((cl) => cl.deco === u.name).length;
          return (
            <View key={u.mac} style={[styles.unit, { backgroundColor: c.backgroundSelected }, c.shape.boxedCells ? { borderWidth: 2, borderColor: c.line } : null]}>
              <View style={[styles.dot, { backgroundColor: u.online ? c.ok : c.danger }]} />
              <Text numberOfLines={1} style={[styles.unitName, { color: c.text }]}>
                {u.name}
              </Text>
              <Text style={[styles.unitSub, { color: c.textSecondary }]}>{u.online ? String(count) : 'off'}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, fontVariant: ['tabular-nums'] },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 12 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  unit: { flexGrow: 1, flexBasis: '30%', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 9 },
  unitName: { flex: 1, fontSize: 13, fontWeight: '700' },
  unitSub: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
