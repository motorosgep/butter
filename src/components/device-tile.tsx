/**
 * A device on the Home grid, in one of three looks:
 *
 *  - a control tile for things you switch (lights, plugs, climate), which fills
 *    with a state colour while the device is active and stays neutral when idle;
 *  - a hero tile for sensors, where the reading is the biggest element, coloured
 *    by a cold–comfortable–hot scale, with a 24-hour sparkline along the bottom
 *    when a recorder is available;
 *  - a wide version of either for pinned devices in Favourites, with room for an
 *    inline slider or the climate readings.
 *
 * Long-pressing any tile pins or unpins it.
 */

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { activeAccent, climateReading, heroReading, INK, isPinned, mix, tileIcon, type Accent, type HeroReading } from '@/lib/cube/appearance';
import { capitalise, commandFor, controls, controlValue, hasCapability, isControllable, isOn, readouts, stateValue, summary, type Control } from '@/lib/cube/capabilities';
import type { Device } from '@/lib/cube/types';
import { useSparkline } from '@/lib/history/sparkline';
import { useHub } from '@/lib/hub/store';

import { Slider } from './slider';
import { Sparkline } from './sparkline';
import { Body, Heading, Icon, useColors } from './ui';

type Palette = ReturnType<typeof useColors>;
type LevelControl = Extract<Control, { kind: 'level' }>;

export function DeviceTile({ device, wide = false }: { device: Device; wide?: boolean }) {
  const c = useColors();
  const setPinned = useHub((s) => s.setPinned);
  const hero = useMemo(() => heroReading(device), [device]);
  const accent = activeAccent(device);
  const background = accent ? mix(c.backgroundElement, accent.color, c.scheme === 'dark' ? 0.24 : 0.22) : c.backgroundElement;
  const pinned = isPinned(device);

  const open = () => router.push({ pathname: '/device/[serial]', params: { serial: device.serial_number } });
  const menu = () => {
    Alert.alert(device.name, pinned ? 'Pinned to Favourites at the top of Home.' : 'Pin it to show it bigger at the top of Home, on every phone.', [
      {
        text: pinned ? 'Unpin' : 'Pin to Favourites',
        onPress: () => void setPinned(device.serial_number, !pinned).catch((e: Error) => Alert.alert('Could not update Favourites', e.message)),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable
      onPress={open}
      onLongPress={menu}
      accessibilityRole="button"
      accessibilityLabel={device.name}
      accessibilityHint="Opens the device. Long press to pin or unpin."
      style={({ pressed }) => [
        styles.tile,
        wide ? [styles.wide, hero && styles.wideHero] : hero ? styles.heroTile : null,
        { backgroundColor: background, opacity: pressed ? 0.8 : device.online ? 1 : 0.55 },
      ]}>
      {hero ? <HeroBody device={device} hero={hero} wide={wide} c={c} /> : <ControlBody device={device} accent={accent} wide={wide} c={c} />}
    </Pressable>
  );
}

// ----- hero (sensors) ---------------------------------------------------------------

function HeroBody({ device, hero, wide, c }: { device: Device; hero: HeroReading; wide: boolean; c: Palette }) {
  const history = useHub((s) => s.history);
  const spark = useSparkline(history, device.serial_number, hero.metric, hero.scale);
  const color = c.scheme === 'dark' ? hero.color : mix(hero.color, '#000000', 0.3);
  const battery = hero.rest.find((r) => r.key === 'battery');
  const others = hero.rest.filter((r) => !['battery', 'rssi', 'lqi'].includes(r.key));
  const trace = spark && spark.points.length > 1 ? spark : undefined;
  const range = trace ? `↓ ${hero.format(trace.min)} · ↑ ${hero.format(trace.max)}` : undefined;

  if (wide) {
    const detail = [...others.map((o) => o.value), range].filter(Boolean).join(' · ');
    return (
      <>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[styles.label, { color: c.textSecondary }]}>
              {device.name}
            </Text>
            <View style={styles.heroRow}>
              <Text style={[styles.hero, styles.heroWide, { color }]}>{hero.text}</Text>
              {detail ? (
                <Text numberOfLines={1} style={[styles.heroSmall, { color: c.textSecondary, flexShrink: 1 }]}>
                  {detail}
                </Text>
              ) : null}
            </View>
          </View>
          {battery ? <Small icon={batteryIcon(battery.value)} text={battery.value} c={c} /> : !device.online ? <Small icon="lan-disconnect" text="Offline" c={c} /> : null}
        </View>
        {trace ? <Sparkline points={trace.points} color={color} minSpan={hero.minSpan} height={26} /> : null}
      </>
    );
  }

  const line = !device.online ? 'Offline' : (range ?? others.slice(1).map((o) => o.value).join(' · '));
  return (
    <>
      <View style={styles.top}>
        <Text numberOfLines={1} style={[styles.label, { color: c.textSecondary, flex: 1 }]}>
          {device.name}
        </Text>
        {battery ? <Small icon={batteryIcon(battery.value)} text={battery.value} c={c} /> : null}
      </View>
      <View>
        <View style={styles.heroRow}>
          <Text style={[styles.hero, { color }]}>{hero.text}</Text>
          {others[0] ? <Text style={[styles.heroSmall, { color: c.textSecondary }]}>{others[0].value}</Text> : null}
        </View>
        {line ? (
          <Text numberOfLines={1} style={[styles.kv, { color: c.textSecondary }]}>
            {line}
          </Text>
        ) : null}
      </View>
      {trace ? <Sparkline points={trace.points} color={color} minSpan={hero.minSpan} height={32} /> : null}
    </>
  );
}

function Small({ icon, text, c }: { icon: string; text: string; c: Palette }) {
  return (
    <View style={styles.small}>
      <Icon name={icon} size={13} color={c.textSecondary} />
      <Text style={[styles.smallText, { color: c.textSecondary }]}>{text}</Text>
    </View>
  );
}

function batteryIcon(text: string): string {
  const n = parseInt(text, 10);
  if (!Number.isFinite(n)) return 'battery';
  if (n <= 10) return 'battery-alert-variant-outline';
  if (n <= 30) return 'battery-20';
  if (n <= 60) return 'battery-50';
  if (n <= 85) return 'battery-80';
  return 'battery';
}

// ----- control (switchable devices) -------------------------------------------------

function ControlBody({ device, accent, wide, c }: { device: Device; accent: Accent | undefined; wide: boolean; c: Palette }) {
  const control = useHub((s) => s.control);
  const on = isOn(device);
  const powerCap = hasCapability(device, 'power');
  const canToggle = powerCap !== undefined && isControllable(powerCap) && device.online;
  const badgeBg = accent ? accent.color : c.backgroundSelected;
  const badgeFg = accent ? INK : c.textSecondary;
  const subColor = accent ? mix(accent.color, c.text, c.scheme === 'dark' ? 0.45 : 0.55) : c.textSecondary;
  const activeColor = accent?.color ?? c.accent;

  const powerButton = canToggle ? (
    <Pressable
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${device.name} power`}
      onPress={() => void control(device.serial_number, { power: { powerState: on ? 'off' : 'on' } }).catch(() => undefined)}
      style={({ pressed }) => [styles.power, { backgroundColor: on ? activeColor : c.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name="power" size={18} color={on ? INK : c.textSecondary} />
    </Pressable>
  ) : null;

  const badge = (
    <View style={[styles.badge, { backgroundColor: badgeBg }]}>
      <Icon name={tileIcon(device, accent)} size={22} color={badgeFg} />
    </View>
  );

  if (!wide) {
    return (
      <>
        <View style={styles.top}>
          {badge}
          {powerButton}
        </View>
        <View>
          <Heading numberOfLines={1} style={styles.name}>
            {device.name}
          </Heading>
          <Body numberOfLines={1} style={[styles.summary, { color: subColor }]}>
            {summary(device)}
          </Body>
        </View>
      </>
    );
  }

  const climate = climateReading(device);
  const level = device.online ? inlineLevel(device, on) : undefined;
  const currentColor = climate?.currentColor ? (c.scheme === 'dark' ? climate.currentColor : mix(climate.currentColor, '#000000', 0.3)) : c.text;

  return (
    <>
      <View style={styles.top}>
        {badge}
        <View style={styles.wideText}>
          <Heading numberOfLines={1} style={{ fontSize: 15 }}>
            {device.name}
          </Heading>
          {climate?.current ? (
            <View style={styles.heroRow}>
              <Text style={[styles.hero, { fontSize: 28, color: currentColor }]}>{climate.current}</Text>
              {climate.target ? <Text style={[styles.heroSmall, { color: subColor }]}>{climate.target}</Text> : null}
            </View>
          ) : climate?.target ? (
            // No room reading (a heat pump zone, say): the target is the number that matters.
            <View style={styles.heroRow}>
              <Text style={[styles.hero, { fontSize: 28, color: c.text }]}>{climate.target.replace('→ ', '')}</Text>
              <Text style={[styles.heroSmall, { color: subColor }]}>target</Text>
            </View>
          ) : null}
          <Body numberOfLines={1} style={[styles.summary, { color: subColor }]}>
            {climate ? climateDetail(device) : summary(device)}
          </Body>
        </View>
        {powerButton}
      </View>
      {level ? <InlineLevel device={device} level={level} color={activeColor} c={c} /> : null}
    </>
  );
}

/** The one slider a wide tile shows: brightness while the light is on, else position, else colour temperature. */
function inlineLevel(device: Device, on: boolean | undefined): LevelControl | undefined {
  const levels = controls(device).filter((x): x is LevelControl => x.kind === 'level');
  const rank = (x: LevelControl) => (x.capability === 'brightness' ? (on === false ? 9 : 0) : x.capability === 'percentage' ? 1 : x.capability === 'color-temperature' ? (on === false ? 9 : 2) : 3);
  const best = [...levels].sort((p, q) => rank(p) - rank(q))[0];
  return best && rank(best) < 9 ? best : undefined;
}

/** Mode, fan and the non-temperature readings of a climate device. */
function climateDetail(device: Device): string {
  if (!device.online) return 'Offline';
  const parts: string[] = [];
  if (isOn(device) === false) parts.push('Off');
  else {
    const mode = stateValue(device.state, 'mode', 'modeValue', 'airConditionerMode') ?? stateValue(device.state, 'mode', 'modeValue', 'thermostatMode');
    if (mode) parts.push(capitalise(String(mode)));
    const fan = stateValue(device.state, 'mode', 'modeValue', 'fanLevel') ?? stateValue(device.state, 'mode', 'modeValue', 'fanMode');
    if (fan) parts.push(`Fan ${String(fan)}`);
  }
  for (const r of readouts(device)) if (r.key !== 'temperature' && r.key !== 'rssi' && r.key !== 'lqi') parts.push(r.value);
  if (!parts.length) parts.push(isOn(device) ? 'On' : summary(device));
  return parts.join(' · ');
}

function InlineLevel({ device, level, color, c }: { device: Device; level: LevelControl; color: string; c: Palette }) {
  const control = useHub((s) => s.control);
  const current = Number(controlValue(device, level) ?? level.min);
  const [drag, setDrag] = useState<number | undefined>();
  return (
    <View style={styles.levelRow}>
      <Icon name={level.capability === 'brightness' ? 'brightness-6' : level.capability === 'color-temperature' ? 'thermometer' : 'arrow-expand-vertical'} size={16} color={c.textSecondary} />
      <View style={{ flex: 1 }}>
        <Slider
          value={Number.isFinite(current) ? current : level.min}
          min={level.min}
          max={level.max}
          step={1}
          color={color}
          onChange={setDrag}
          onRelease={(v) => {
            setDrag(undefined);
            void control(device.serial_number, commandFor(level, v)).catch(() => undefined);
          }}
        />
      </View>
      <Text style={[styles.levelValue, { color: c.textSecondary }]}>
        {Math.round(drag ?? current)}
        {level.unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, borderRadius: 18, padding: 14, minHeight: 124, justifyContent: 'space-between', overflow: 'hidden' },
  heroTile: { minHeight: 140, paddingBottom: 36 },
  wide: { minHeight: 0, justifyContent: 'flex-start' },
  wideHero: { paddingBottom: 30 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  power: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 14, fontSize: 15 },
  summary: { fontSize: 13, marginTop: 2 },
  wideText: { flex: 1, marginLeft: 12, marginRight: 10 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 6 },
  hero: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, lineHeight: 36, fontVariant: ['tabular-nums'] },
  heroWide: { fontSize: 34 },
  heroSmall: { fontSize: 14, fontWeight: '600' },
  kv: { fontSize: 12, marginTop: 4, fontVariant: ['tabular-nums'] },
  small: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  smallText: { fontSize: 12, fontVariant: ['tabular-nums'] },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  levelValue: { fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'right' },
});
