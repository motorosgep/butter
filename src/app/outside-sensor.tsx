/**
 * Settings → Weather → Outside sensor: which of the hub's temperature sensors
 * gives the "Outside" reading on the weather tile and forecast. Automatic picks
 * the first fresh sensor in an outdoor-named room; or pin one sensor. Each row
 * shows the sensor's reading and how long ago the hub last heard from it.
 */

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Body, Empty, Heading, Icon, cardChrome, useColors } from '@/components/ui';
import { roomOf } from '@/lib/cube/capabilities';
import { selectActiveHub, useDeviceList, useHub } from '@/lib/hub/store';
import { ago } from '@/lib/network/bridge';
import { isStale, outdoorReading, temperatureSensors, useNow, type TemperatureSensor } from '@/lib/weather/outdoor';

export default function OutsideSensorScreen() {
  const c = useColors();
  const hub = useHub(selectActiveHub);
  const setOutsideSensor = useHub((s) => s.setOutsideSensor);
  const devices = useDeviceList();
  const now = useNow(30_000);
  if (!hub) return <Empty icon="thermometer-off" title="No hub" />;

  const sensors = temperatureSensors(devices);
  const choice = hub.outsideSensor;
  const automatic = outdoorReading(devices, undefined, now);
  const missing = choice !== undefined && !sensors.some((s) => s.device.serial_number === choice);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <Option
        selected={!choice}
        title="Automatic"
        detail={automatic !== undefined ? `Now ${automatic.toFixed(1)}° · the first sensor in an outdoor room that reported in the last 30 min` : 'No sensor in an outdoor room has reported in the last 30 min'}
        onPress={() => void setOutsideSensor(hub.id, undefined)}
      />

      <Heading style={[styles.section, { color: c.textSecondary }]}>Temperature sensors</Heading>
      {sensors.length === 0 ? <Body muted>None of this hub’s devices report a temperature.</Body> : null}
      {missing ? <Body muted style={{ marginBottom: 8 }}>The chosen sensor is no longer on this hub, so Outside shows nothing. Pick another or go back to Automatic.</Body> : null}
      {sensors.map((s) => (
        <SensorOption key={s.device.serial_number} sensor={s} now={now} selected={choice === s.device.serial_number} onPress={() => void setOutsideSensor(hub.id, s.device.serial_number)} />
      ))}
      <Body muted style={styles.note}>
        Saved for this hub on this phone.
      </Body>
    </ScrollView>
  );
}

function SensorOption({ sensor, now, selected, onPress }: { sensor: TemperatureSensor; now: number; selected: boolean; onPress: () => void }) {
  const { device, value, at } = sensor;
  const stale = isStale(sensor, now);
  const parts = [roomOf(device), at !== undefined ? `updated ${ago(at / 1000, now)}` : 'no update time', device.online ? undefined : 'offline'].filter(Boolean);
  return <Option selected={selected} title={device.name} value={`${value.toFixed(1)}°`} detail={parts.join(' · ')} warn={stale || !device.online} onPress={onPress} />;
}

function Option({ selected, title, value, detail, warn, onPress }: { selected: boolean; title: string; value?: string; detail: string; warn?: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        cardChrome(c, false),
        { backgroundColor: c.backgroundElement, borderRadius: c.shape.cardRadius, borderWidth: Math.max(1.5, c.shape.borderWidth ?? 0), borderColor: selected ? c.accent : c.border, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={selected ? c.accent : c.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        <Text style={[styles.detail, { color: warn ? c.danger : c.textSecondary }]}>{detail}</Text>
      </View>
      {value ? <Text style={[styles.value, { color: warn ? c.textSecondary : c.text }]}>{value}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  section: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 13, marginTop: 2 },
  value: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  note: { marginTop: 12, fontSize: 13 },
});
