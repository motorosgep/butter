import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { categoryInfo, hasCapability, isControllable, isOn, summary } from '@/lib/cube/capabilities';
import type { Device } from '@/lib/cube/types';
import { useHub } from '@/lib/hub/store';

import { Body, Heading, Icon, useColors } from './ui';

export function DeviceTile({ device }: { device: Device }) {
  const c = useColors();
  const control = useHub((s) => s.control);
  const on = isOn(device);
  const powerCap = hasCapability(device, 'power');
  const canToggle = powerCap !== undefined && isControllable(powerCap) && device.online;
  const info = categoryInfo(device.display_category);
  const lit = on === true && device.online;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/device/[serial]', params: { serial: device.serial_number } })}
      style={({ pressed }) => [styles.tile, { backgroundColor: c.backgroundElement, opacity: pressed ? 0.8 : device.online ? 1 : 0.55 }]}>
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: lit ? c.accentSoft : c.backgroundSelected }]}>
          <Icon name={info.icon} size={22} color={lit ? c.accent : c.textSecondary} />
        </View>
        {canToggle ? (
          <Pressable
            hitSlop={8}
            accessibilityRole="switch"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${device.name} power`}
            onPress={() => void control(device.serial_number, { power: { powerState: on ? 'off' : 'on' } }).catch(() => undefined)}
            style={({ pressed }) => [styles.power, { backgroundColor: on ? c.accent : c.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
            <Icon name="power" size={18} color={on ? '#1c1c1e' : c.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <Heading numberOfLines={1} style={styles.name}>
        {device.name}
      </Heading>
      <Body muted numberOfLines={1} style={styles.summary}>
        {summary(device)}
      </Body>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, borderRadius: 18, padding: 14, minHeight: 124, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  power: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 14, fontSize: 15 },
  summary: { fontSize: 13, marginTop: 2 },
});
