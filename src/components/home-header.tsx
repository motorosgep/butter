/**
 * The top of Home: today's date and the hub, a greeting, and a row of chips
 * that sum up the house at a glance (how many devices are live, what is on,
 * what is heating or cooling, whether the doors are shut). The round button
 * opens Settings, where hubs live.
 */

import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';


import { activeAccent, alpha, legibleOn, mix } from '@/lib/cube/appearance';
import { hasCapability, stateValue } from '@/lib/cube/capabilities';
import type { Device } from '@/lib/cube/types';
import type { StateTone } from '@/theme';

import { Icon, Title, cardChrome, useColors } from './ui';
import { Text } from '@/components/text';

type Status = 'online' | 'connecting' | 'offline' | string;

function greeting(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

interface Chip {
  key: string;
  label: string;
  tone?: StateTone;
  dot?: boolean;
}

/** The chips under the greeting, from the devices' current state. */
function chipsFor(devices: Device[], status: Status): Chip[] {
  const chips: Chip[] = [];
  chips.push({ key: 'live', label: status === 'online' ? `${devices.length} live` : status === 'connecting' ? 'Connecting…' : 'Not connected', dot: true });
  const count = (tone: StateTone) => devices.filter((d) => activeAccent(d)?.tone === tone).length;
  const on = count('on');
  if (on) chips.push({ key: 'on', label: `${on} on`, tone: 'on' });
  const heating = count('heat');
  if (heating) chips.push({ key: 'heat', label: `${heating} heating`, tone: 'heat' });
  const cooling = count('cool');
  if (cooling) chips.push({ key: 'cool', label: `${cooling} cooling`, tone: 'cool' });
  const doors = devices.filter((d) => d.online && hasCapability(d, 'contact'));
  if (doors.length) {
    const open = doors.filter((d) => stateValue(d.state, 'contact', 'contact') === true);
    if (!open.length) chips.push({ key: 'doors', label: 'Doors closed' });
    else chips.push({ key: 'doors', label: open.length === 1 ? `${open[0].name} open` : `${open.length} doors open`, tone: 'alert' });
  }
  return chips;
}

export function HomeHeader({ hubName, devices, status }: { hubName?: string; devices: Device[]; status: Status }) {
  const c = useColors();
  const now = new Date();
  const date = `${now.toLocaleDateString('en-GB', { weekday: 'long' })}, ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
  const chips = chipsFor(devices, status);
  const liveDot = status === 'online' ? c.ok : status === 'connecting' ? c.accent : c.danger;

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.date, { color: legibleOn(c.accent, c.readingShade) }]}>
            {hubName ? `${date} · ${hubName}` : date}
          </Text>
          <Title style={styles.title}>{greeting(now.getHours())}</Title>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hubs and settings"
          onPress={() => router.navigate('/settings')}
          style={({ pressed }) => [styles.hubButton, { backgroundColor: c.state.on, opacity: pressed ? 0.75 : 1 }, c.glow ? { boxShadow: `0px 0px 20px ${alpha(c.state.on, c.glow * 0.8)}` } : null]}>
          <Icon name="home-outline" size={22} color={c.onState.on} />
        </Pressable>
      </View>
      <View style={styles.chips}>
        {chips.map((chip) => {
          const tone = chip.tone ? c.state[chip.tone] : undefined;
          const bg = tone ? alpha(tone, c.chipTint.fill) : c.backgroundElement;
          const edge = tone && c.chipTint.edge ? { borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(tone, c.chipTint.edge) } : null;
          const fg = tone ? legibleOn(mix(tone, c.text, c.tint.label), c.readingShade) : c.text;
          return (
            <View key={chip.key} style={[styles.chip, cardChrome(c), { backgroundColor: bg, boxShadow: undefined }, edge]}>
              {chip.dot ? <View style={[styles.dot, { backgroundColor: liveDot }]} /> : null}
              <Text style={[styles.chipText, { color: fg }]}>{chip.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  date: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 32, letterSpacing: -0.6, marginTop: 2 },
  hubButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 14 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: '600' },
});
