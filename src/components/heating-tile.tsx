/**
 * Room control at a glance, as a slim tile on Home while it is on: the rooms'
 * temperature against the target and whether heating runs. Tapping opens the
 * Heating screen.
 */

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useClimate } from '@/lib/climate/store';

import { Text } from './text';
import { Card, Icon, caps, useColors } from './ui';

export function HeatingTile() {
  const c = useColors();
  const { climate } = useClimate();
  if (!climate?.settings.enabled) return null;
  const on = climate.heating;
  return (
    <Card onPress={() => router.push('/heating')} style={styles.card}>
      <View style={styles.row}>
        <Icon name={on ? 'fire' : 'thermostat'} size={22} color={on ? c.accent : c.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: c.text }]}>Heating</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>{`Target ${climate.settings.target.toFixed(1)}°`}</Text>
        </View>
        <Text style={[styles.value, { color: c.text }]}>{climate.room !== null ? `${climate.room.toFixed(1)}°` : '—'}</Text>
        <View style={[styles.pill, { backgroundColor: on ? c.accentSoft : c.backgroundSelected }]}>
          <Text style={[styles.pillText, caps(c), { color: on ? c.accent : c.text }]}>{on === null ? '—' : on ? 'On' : 'Off'}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 14, paddingHorizontal: 18, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 1 },
  value: { fontSize: 26, fontWeight: '600', fontVariant: ['tabular-nums'] },
  pill: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12 },
  pillText: { fontSize: 12, fontWeight: '700' },
});
