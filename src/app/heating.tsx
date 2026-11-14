/**
 * Heating: the bridge's room control. It switches the heat pump's space
 * heating on and off from indoor sensors (hot water is left alone), so the
 * house holds a target temperature even when the heat pump's lowest water
 * temperature is more than the rooms need. Here: on or off, the target, which
 * sensors count, what it is doing now and its recent switches.
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/text';
import { Body, Button, Card, Empty, Heading, Icon, Row, Screen, useColors } from '@/components/ui';
import type { Climate } from '@/lib/climate/bridge';
import { useClimate, type ClimateState } from '@/lib/climate/store';
import { ago } from '@/lib/network/bridge';

const STEP = 0.5;

export default function HeatingScreen() {
  const state = useClimate();
  const { climate, unavailable, error, loading } = state;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await state.refresh();
    setRefreshing(false);
  };

  let body;
  if (unavailable) body = <Empty icon="thermostat" title="Room control not available" body={unavailable} />;
  else if (climate) body = <HeatingView climate={climate} state={state} />;
  else if (loading) body = <ActivityIndicator style={{ marginTop: 40 }} />;
  else body = <Empty icon="alert-circle-outline" title="Could not read the heating" body={error} />;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
        {body}
      </ScrollView>
    </Screen>
  );
}

function HeatingView({ climate, state }: { climate: Climate; state: ClimateState }) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const s = climate.settings;
  const chosen = new Set(s.sensors);

  const save = async (change: Parameters<ClimateState['save']>[0]) => {
    setBusy(true);
    try {
      await state.save(change);
    } catch (e) {
      Alert.alert('Heating', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (on: boolean) => {
    if (on) {
      void save({ enabled: true });
      return;
    }
    Alert.alert('Switch room control off?', 'Heating is switched back on and runs on the heat pump’s own setting, as before.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Switch off', style: 'destructive', onPress: () => void save({ enabled: false }) },
    ]);
  };

  const pick = (serial: string) => {
    const next = chosen.has(serial) ? s.sensors.filter((x) => x !== serial) : [...s.sensors, serial];
    if (!next.length && s.enabled) {
      Alert.alert('Heating', 'Keep at least one sensor while room control is on.');
      return;
    }
    void save({ sensors: next });
  };

  const heating = climate.heating;
  return (
    <View>
      <Card>
        <Row between>
          <View style={{ flex: 1 }}>
            <Heading>Room control</Heading>
            <Body muted style={{ marginTop: 2 }}>{s.enabled ? 'The bridge switches heating from your rooms' : 'Off: the heat pump runs on its own setting'}</Body>
          </View>
          <Switch value={s.enabled} disabled={busy} trackColor={{ true: c.accent }} onValueChange={toggle} />
        </Row>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Row between style={{ alignItems: 'flex-end' }}>
          <View>
            <Body muted style={{ fontSize: 12 }}>Rooms</Body>
            <Text style={[styles.big, { color: c.text }]}>{climate.room !== null ? `${climate.room.toFixed(1)}°` : '—'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Body muted style={{ fontSize: 12 }}>Target</Body>
            <Row>
              <Button title="" icon="minus" variant="secondary" disabled={busy || s.target - STEP < 10} onPress={() => void save({ target: s.target - STEP })} />
              <Text style={[styles.target, { color: c.text }]}>{`${s.target.toFixed(1)}°`}</Text>
              <Button title="" icon="plus" variant="secondary" disabled={busy || s.target + STEP > 28} onPress={() => void save({ target: s.target + STEP })} />
            </Row>
          </View>
        </Row>
        <Row style={{ marginTop: 12 }}>
          <Icon name={heating ? 'fire' : 'power'} size={18} color={heating ? c.accent : c.textSecondary} />
          <Body style={{ flex: 1, fontWeight: '600' }}>{heating === null ? 'Heat pump not found' : heating ? 'Heating on' : 'Heating off'}</Body>
        </Row>
        <Body muted style={{ marginTop: 6 }}>{climate.reason}</Body>
        <Body muted style={{ fontSize: 12, marginTop: 8 }}>
          {`On at ${climate.on_at.toFixed(1)}°, off at ${climate.off_at.toFixed(1)}°. Once switched it stays on at least ${Math.round(s.min_run / 60)} min, or off at least ${Math.round(s.min_rest / 60)} min, to spare the compressor. Hot water is not touched.`}
        </Body>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Heading style={{ fontSize: 15 }}>Indoor sensors</Heading>
        <Body muted style={{ marginTop: 4 }}>The room temperature is the average of the ticked ones that reported in the last half hour.</Body>
        {climate.candidates.map((cand) => {
          const on = chosen.has(cand.serial);
          const inUse = climate.sensors.find((x) => x.serial === cand.serial);
          const stale = on && inUse && !inUse.used;
          return (
            <Pressable key={cand.serial} disabled={busy} onPress={() => pick(cand.serial)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
              <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={on ? c.accent : c.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: c.text }]}>{cand.name}</Text>
                <Body muted style={{ fontSize: 13 }}>
                  {[`${cand.value.toFixed(1)}°`, cand.at ? ago(cand.at) : null, stale ? 'not counted: no recent reading' : null, cand.online ? null : 'offline'].filter(Boolean).join(' · ')}
                </Body>
              </View>
            </Pressable>
          );
        })}
      </Card>

      {climate.log.length ? (
        <Card style={{ marginTop: 10 }}>
          <Heading style={{ fontSize: 15 }}>Recent switches</Heading>
          {[...climate.log].reverse().slice(0, 12).map((e) => (
            <Row key={e.at} between style={{ marginTop: 8 }}>
              <Body>{`${new Date(e.at * 1000).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · heating ${e.on ? 'on' : 'off'}`}</Body>
              <Body muted>{e.room !== null ? `${e.room.toFixed(1)}°` : 'no reading'}</Body>
            </Row>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  big: { fontSize: 44, fontWeight: '300', fontVariant: ['tabular-nums'] },
  target: { fontSize: 22, fontWeight: '700', minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  name: { fontSize: 15, fontWeight: '600' },
});
