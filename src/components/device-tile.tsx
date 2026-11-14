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
import { Alert, Pressable, StyleSheet, View } from 'react-native';


import { activeAccent, alpha, climateReading, heroReading, isPinned, mix, tileIcon, type Accent, type HeroReading } from '@/lib/cube/appearance';
import { capitalise, commandFor, controls, controlValue, hasCapability, isControllable, isOn, readouts, stateValue, summary, type Control } from '@/lib/cube/capabilities';
import type { Device } from '@/lib/cube/types';
import { useSparkline } from '@/lib/history/sparkline';
import { useHub } from '@/lib/hub/store';

import { Slider } from './slider';
import { Sparkline } from './sparkline';
import { Icon, caps, cardChrome, outlineIcon, useColors } from './ui';
import { Text } from '@/components/text';

type Palette = ReturnType<typeof useColors>;
type LevelControl = Extract<Control, { kind: 'level' }>;

/** A reading colour darkened as much as the theme asks, so it reads on a light tile. */
function legible(color: string, c: Palette): string {
  return c.readingShade ? mix(color, '#000000', c.readingShade) : color;
}

export function DeviceTile({ device, wide = false }: { device: Device; wide?: boolean }) {
  const c = useColors();
  const setPinned = useHub((s) => s.setPinned);
  const hero = useMemo(() => heroReading(device, c.readings), [device, c.readings]);
  const accent = activeAccent(device);
  const background = accent ? mix(c.backgroundElement, c.state[accent.tone], c.tint.tile) : c.backgroundElement;
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
        cardChrome(c, !!accent || !!hero),
        { borderRadius: c.shape.cardRadius },
        // Something that is on edges and lights its tile in themes that glow.
        accent && c.glow ? { borderColor: alpha(c.state[accent.tone], 0.4), boxShadow: `0px 0px 24px ${alpha(c.state[accent.tone], c.glow * 0.3)}` } : null,
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
  const color = legible(hero.color, c);
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
            <Text numberOfLines={1} style={[styles.label, { color: c.tileName }]}>
              {device.name}
            </Text>
            <View style={styles.heroRow}>
              <Text style={[styles.hero, styles.heroWide, { color, fontWeight: c.type.hero }]}>{hero.text}</Text>
              {detail ? (
                <Text numberOfLines={1} style={[styles.heroSmall, { color: c.textSecondary, flexShrink: 1 }]}>
                  {detail}
                </Text>
              ) : null}
            </View>
          </View>
          {battery ? <Small icon={batteryIcon(battery.value)} text={battery.value} c={c} /> : !device.online ? <Small icon="lan-disconnect" text="Offline" c={c} /> : null}
        </View>
        {trace ? <Sparkline points={trace.points} color={color} minSpan={hero.minSpan} height={22} line style={styles.spark} /> : null}
      </>
    );
  }

  const line = !device.online ? 'Offline' : (range ?? others.slice(1).map((o) => o.value).join(' · '));
  return (
    <>
      <View style={styles.top}>
        <Text numberOfLines={1} style={[styles.label, { color: c.tileName, flex: 1 }]}>
          {device.name}
        </Text>
        {battery ? <Small icon={batteryIcon(battery.value)} text={battery.value} c={c} /> : null}
      </View>
      <View>
        <View style={styles.heroRow}>
          <Text style={[styles.hero, { color, fontWeight: c.type.hero }]}>{hero.text}</Text>
          {others[0] ? <Text style={[styles.heroSmall, { color: c.textSecondary }]}>{others[0].value}</Text> : null}
        </View>
        {line ? (
          <Text numberOfLines={1} style={[styles.kv, { color: c.textSecondary }]}>
            {line}
          </Text>
        ) : null}
      </View>
      {trace ? <Sparkline points={trace.points} color={color} minSpan={hero.minSpan} height={24} line style={styles.spark} /> : null}
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

/**
 * The round icon at the top of a control tile. It is also the on/off switch:
 * filled with the state colour while the device is active, and glowing in
 * themes that glow.
 */
function IconWell({ device, accentColor, c }: { device: Device; accentColor: string | undefined; c: Palette }) {
  const control = useHub((s) => s.control);
  const on = isOn(device);
  const powerCap = hasCapability(device, 'power');
  const canToggle = powerCap !== undefined && isControllable(powerCap) && device.online;
  const well = [
    styles.well,
    { backgroundColor: accentColor ?? c.backgroundSelected, borderRadius: c.shape.well.radius },
    c.shape.well.border ? { borderWidth: c.shape.well.border, borderColor: c.line } : null,
    accentColor && c.glow ? { boxShadow: `0px 0px 16px ${alpha(accentColor, c.glow)}` } : null,
  ];
  const accent = activeAccent(device);
  const icon = <Icon name={outlineIcon(tileIcon(device, accent))} size={20} color={accent ? c.onState[accent.tone] : c.textSecondary} />;
  if (!canToggle) return <View style={well}>{icon}</View>;
  return (
    <Pressable
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${device.name} power`}
      onPress={() => void control(device.serial_number, { power: { powerState: on ? 'off' : 'on' } }).catch(() => undefined)}
      style={({ pressed }) => [...well, { opacity: pressed ? 0.7 : 1 }]}>
      {icon}
    </Pressable>
  );
}

function ControlBody({ device, accent, wide, c }: { device: Device; accent: Accent | undefined; wide: boolean; c: Palette }) {
  const on = isOn(device);
  const accentColor = accent ? c.state[accent.tone] : undefined;
  const subColor = accentColor ? legible(mix(accentColor, c.text, c.tint.label), c) : c.textSecondary;
  const activeColor = accentColor ?? c.accent;
  const brightness = on ? brightnessOf(device) : undefined;

  if (!wide) {
    return (
      <>
        <View style={styles.top}>
          <IconWell device={device} accentColor={accentColor} c={c} />
        </View>
        <View>
          <Text numberOfLines={1} style={[styles.name, { color: accentColor ? c.text : c.tileName }]}>
            {device.name}
          </Text>
          <Text numberOfLines={1} style={[styles.summary, caps(c), { color: subColor }]}>
            {summary(device)}
          </Text>
          {brightness !== undefined ? (
            <View style={[styles.bar, { backgroundColor: alpha(activeColor, 0.22) }]}>
              <View style={[styles.barFill, { width: `${brightness}%`, backgroundColor: legible(activeColor, c) }]} />
            </View>
          ) : null}
        </View>
      </>
    );
  }

  const climate = climateReading(device, c.readings);
  const setpoint = controls(device).find((x): x is SetpointControl => x.kind === 'setpoint');
  const level = device.online && !climate ? inlineLevel(device, on) : undefined;
  // While heating or cooling the room reading takes the state's colour; idle, the temperature scale's.
  // On light backgrounds the state colour itself, darkened to read; on dark ones its lighter blend with the text.
  const currentColor = accentColor ? (c.readingShade ? legible(accentColor, c) : subColor) : climate?.currentColor ? legible(climate.currentColor, c) : c.text;
  const nudging = !!setpoint && on !== false && device.online;
  const heroStyle = [styles.hero, styles.heroClimate, { fontWeight: c.type.hero }];

  return (
    <>
      <View style={[styles.top, { alignItems: 'center' }]}>
        <IconWell device={device} accentColor={accentColor} c={c} />
        <View style={styles.wideText}>
          <Text numberOfLines={1} style={[styles.name, { marginTop: 0, color: accentColor ? c.text : c.tileName }]}>
            {device.name}
          </Text>
          {climate?.current ? (
            <View style={styles.heroRow}>
              <Text style={[...heroStyle, { color: currentColor }]}>{climate.current}</Text>
              {climate.target ? <Text style={[styles.heroSmall, { color: subColor }]}>{climate.target}</Text> : null}
            </View>
          ) : climate?.target ? (
            // No room reading (a heat pump zone, say): the target is the number that matters.
            <View style={styles.heroRow}>
              <Text style={[...heroStyle, { color: c.text }]}>{climate.target.replace('→ ', '')}</Text>
              <Text style={[styles.heroSmall, { color: subColor }]}>target</Text>
            </View>
          ) : null}
          {nudging && climate?.current ? null : (
            <Text numberOfLines={1} style={[styles.summary, caps(c), { color: subColor }]}>
              {climate ? climateDetail(device) : summary(device)}
            </Text>
          )}
        </View>
        {nudging ? <SetpointButtons device={device} setpoint={setpoint} c={c} tint={subColor} /> : null}
      </View>
      {level ? <InlineLevel device={device} level={level} color={activeColor} c={c} /> : null}
    </>
  );
}

type SetpointControl = Extract<Control, { kind: 'setpoint' }>;

/** − and + for a climate device's target, a step at a time. */
function SetpointButtons({ device, setpoint, c, tint }: { device: Device; setpoint: SetpointControl; c: Palette; tint: string }) {
  const control = useHub((s) => s.control);
  const current = Number(controlValue(device, setpoint));
  const nudge = (dir: number) => {
    if (!Number.isFinite(current)) return;
    const next = Math.min(setpoint.max, Math.max(setpoint.min, Math.round((current + dir * setpoint.step) * 10) / 10));
    if (next !== current) void control(device.serial_number, commandFor(setpoint, next)).catch(() => undefined);
  };
  const button = [styles.round, { backgroundColor: c.raised }, c.cardOutline ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.cardOutline } : null];
  return (
    <View style={styles.roundRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Lower ${device.name} target`} onPress={() => nudge(-1)} style={({ pressed }) => [...button, { opacity: pressed ? 0.6 : 1 }]}>
        <Icon name="minus" size={22} color={tint} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Raise ${device.name} target`} onPress={() => nudge(1)} style={({ pressed }) => [...button, { opacity: pressed ? 0.6 : 1 }]}>
        <Icon name="plus" size={22} color={tint} />
      </Pressable>
    </View>
  );
}

/** A light's brightness in percent, for the bar under its name. */
function brightnessOf(device: Device): number | undefined {
  const level = controls(device).find((x): x is LevelControl => x.kind === 'level' && x.capability === 'brightness');
  if (!level) return undefined;
  const v = Number(controlValue(device, level));
  return Number.isFinite(v) ? Math.max(4, Math.min(100, ((v - level.min) / (level.max - level.min)) * 100)) : undefined;
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
  tile: { flex: 1, padding: 14, minHeight: 116, justifyContent: 'space-between', overflow: 'hidden' },
  heroTile: { minHeight: 140, paddingBottom: 44 },
  spark: { left: 14, right: 14, bottom: 14 },
  wide: { minHeight: 0, justifyContent: 'flex-start' },
  wideHero: { paddingBottom: 42 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  well: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '600' },
  summary: { fontSize: 12, marginTop: 2 },
  bar: { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  roundRow: { flexDirection: 'row', gap: 8 },
  wideText: { flex: 1, marginLeft: 12, marginRight: 10 },
  label: { fontSize: 13, fontWeight: '600' },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 6 },
  hero: { fontSize: 32, letterSpacing: -0.8, lineHeight: 38, fontVariant: ['tabular-nums'] },
  heroClimate: { fontSize: 26, lineHeight: 32 },
  heroWide: { fontSize: 34 },
  heroSmall: { fontSize: 13, fontWeight: '600' },
  kv: { fontSize: 12, marginTop: 4, fontVariant: ['tabular-nums'] },
  small: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  smallText: { fontSize: 12, fontVariant: ['tabular-nums'] },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  levelValue: { fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'right' },
});
