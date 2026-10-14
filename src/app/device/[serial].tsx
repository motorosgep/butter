import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { DeviceControls } from '@/components/device-controls';
import { Body, Button, Card, Chip, Empty, Heading, Icon, Row, Screen, useColors } from '@/components/ui';
import { categoryInfo, isOn, readouts, roomOf } from '@/lib/cube/capabilities';
import { selectDeviceList, useHub } from '@/lib/hub/store';

export default function DeviceScreen() {
  const c = useColors();
  const { serial } = useLocalSearchParams<{ serial: string }>();
  const device = useHub((s) => s.devices[serial]);
  const all = useHub(selectDeviceList);
  const rename = useHub((s) => s.rename);
  const setRoom = useHub((s) => s.setRoom);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const rooms = useMemo(() => [...new Set(all.map(roomOf).filter((r): r is string => !!r))].sort(), [all]);

  if (!device) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Device' }} />
        <Empty icon="help-circle-outline" title="Device not found" body="It may have been removed from the hub." />
      </Screen>
    );
  }

  const info = categoryInfo(device.display_category);
  const room = roomOf(device);
  const on = isOn(device);
  const values = readouts(device);

  const saveName = async () => {
    const name = draftName.trim();
    setEditingName(false);
    if (!name || name === device.name) return;
    await rename(device.serial_number, name).catch((e: Error) => Alert.alert('Rename failed', e.message));
  };

  const assignRoom = async (value: string | null) => {
    setNewRoom('');
    await setRoom(device.serial_number, value).catch((e: Error) => Alert.alert('Could not set room', e.message));
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: device.name }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={[styles.iconWrap, { backgroundColor: on && device.online ? c.accentSoft : c.backgroundSelected }]}>
            <Icon name={info.icon} size={30} color={on && device.online ? c.accent : c.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            {editingName ? (
              <TextInput
                autoFocus
                value={draftName}
                onChangeText={setDraftName}
                onSubmitEditing={() => void saveName()}
                onBlur={() => void saveName()}
                returnKeyType="done"
                style={[styles.nameInput, { color: c.text, backgroundColor: c.backgroundElement }]}
              />
            ) : (
              <Heading style={{ fontSize: 22 }}>{device.name}</Heading>
            )}
            <Body muted style={{ marginTop: 2 }}>
              {`${info.label} · ${device.online ? 'online' : 'offline'}${room ? ` · ${room}` : ''}`}
            </Body>
          </View>
          {!editingName ? (
            <Button
              title="Rename"
              variant="secondary"
              onPress={() => {
                setDraftName(device.name);
                setEditingName(true);
              }}
            />
          ) : null}
        </Row>

        {values.length ? (
          <View style={styles.readouts}>
            {values.map((r) => (
              <Card key={r.key} style={styles.readout}>
                <Row>
                  {r.icon ? <Icon name={r.icon} size={18} color={c.textSecondary} /> : null}
                  <Body muted>{r.label}</Body>
                </Row>
                <Heading style={{ fontSize: 20, marginTop: 4 }}>{r.value}</Heading>
              </Card>
            ))}
          </View>
        ) : null}

        <View style={{ marginTop: 18 }}>
          <DeviceControls device={device} />
        </View>

        <Heading style={styles.section}>Room</Heading>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label="None" selected={!room} onPress={() => void assignRoom(null)} />
          {rooms.map((r) => (
            <Chip key={r} label={r} selected={r === room} onPress={() => void assignRoom(r)} />
          ))}
        </Row>
        <Row style={{ marginTop: 10 }}>
          <TextInput
            value={newRoom}
            onChangeText={setNewRoom}
            placeholder="New room"
            placeholderTextColor={c.textSecondary}
            returnKeyType="done"
            onSubmitEditing={() => newRoom.trim() && void assignRoom(newRoom.trim())}
            style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement }]}
          />
          <Button title="Add" variant="secondary" disabled={!newRoom.trim()} onPress={() => void assignRoom(newRoom.trim())} />
        </Row>

        <Heading style={styles.section}>Details</Heading>
        <Card>
          <Detail label="Manufacturer" value={device.manufacturer} />
          <Detail label="Model" value={device.model} />
          <Detail label="Firmware" value={device.firmware_version} />
          {device.protocol ? <Detail label="Protocol" value={device.protocol} /> : null}
          <Detail label="Serial" value={device.serial_number} />
          <Detail label="Capabilities" value={device.capabilities.map((x) => (x.name ? `${x.capability}/${x.name}` : x.capability)).join(', ')} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Row between style={{ paddingVertical: 5, alignItems: 'flex-start' }}>
      <Body muted>{label}</Body>
      <Body style={{ flex: 1, textAlign: 'right', marginLeft: 16 }}>{value}</Body>
    </Row>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  nameInput: { fontSize: 20, fontWeight: '600', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
  readouts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  readout: { minWidth: '45%', flexGrow: 1 },
  section: { marginTop: 24, marginBottom: 10, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.7 },
  input: { flex: 1, fontSize: 15, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
});
