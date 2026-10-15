import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { capitalise, commandFor, controlValue, controls, type Control } from '@/lib/cube/capabilities';
import type { Device } from '@/lib/cube/types';
import { useHub } from '@/lib/hub/store';

import { Slider } from './slider';
import { Body, Button, Card, Chip, Heading, Icon, Row, useColors } from './ui';

export function DeviceControls({ device }: { device: Device }) {
  const list = controls(device);
  if (!list.length) return null;
  return (
    <View style={{ gap: 10 }}>
      {list.map((control, i) => (
        <ControlRow key={`${control.kind}-${i}`} device={device} control={control} />
      ))}
    </View>
  );
}

function useSend(device: Device) {
  const control = useHub((s) => s.control);
  const [busy, setBusy] = useState(false);
  const send = async (c: Control, value: unknown) => {
    setBusy(true);
    try {
      await control(device.serial_number, commandFor(c, value));
    } catch (error) {
      Alert.alert('Command failed', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return { send, busy };
}

function ControlRow({ device, control }: { device: Device; control: Control }) {
  const c = useColors();
  const { send, busy } = useSend(device);
  const [dragValue, setDragValue] = useState<number | undefined>();
  const value = controlValue(device, control);
  const disabled = !device.online || busy;

  switch (control.kind) {
    case 'power':
    case 'toggle':
    case 'switch':
      return (
        <Card>
          <Row between>
            <Heading>{control.label}</Heading>
            <Switch value={value === true} disabled={disabled} onValueChange={(v) => void send(control, v)} trackColor={{ true: c.accent }} />
          </Row>
        </Card>
      );
    case 'level': {
      const num = typeof value === 'number' ? value : undefined;
      return (
        <Card>
          <Row between>
            <Heading>{control.label}</Heading>
            <Text style={[styles.big, { color: c.text }]}>{`${dragValue ?? num ?? '–'}${control.unit}`}</Text>
          </Row>
          <Slider
            value={num ?? control.min}
            min={control.min}
            max={control.max}
            step={1}
            disabled={disabled || num === undefined}
            onChange={setDragValue}
            onRelease={(v) => {
              setDragValue(undefined);
              if (v !== num) void send(control, v);
            }}
          />
        </Card>
      );
    }
    case 'setpoint': {
      const num = typeof value === 'number' ? value : undefined;
      const step = control.step;
      const unit = '°';
      const clamp = (n: number) => Math.min(control.max, Math.max(control.min, Math.round(n / step) * step));
      return (
        <Card>
          <Row between>
            <View>
              <Heading>{control.label}</Heading>
              <Text style={[styles.big, { color: c.text }]}>
                {num === undefined ? '–' : `${Number.isInteger(num) ? num : num.toFixed(1)}${unit}`}
              </Text>
            </View>
            <Row>
              <StepButton icon="minus" disabled={disabled || num === undefined || num <= control.min} onPress={() => num !== undefined && void send(control, clamp(num - step))} />
              <StepButton icon="plus" disabled={disabled || num === undefined || num >= control.max} onPress={() => num !== undefined && void send(control, clamp(num + step))} />
            </Row>
          </Row>
        </Card>
      );
    }
    case 'mode':
      return (
        <Card>
          <Heading style={{ marginBottom: 10 }}>{control.label}</Heading>
          <Row style={{ flexWrap: 'wrap' }}>
            {control.values.map((v) => (
              <Chip key={v} label={capitalise(v)} selected={value === v} onPress={() => !disabled && void send(control, v)} />
            ))}
          </Row>
        </Card>
      );
    case 'motor':
      return (
        <Card>
          <Heading style={{ marginBottom: 10 }}>{control.label}</Heading>
          <Row>
            <Button title="Open" variant="secondary" icon="arrow-up" disabled={disabled} onPress={() => void send(control, 'open')} style={{ flex: 1 }} />
            <Button title="Stop" variant="secondary" icon="stop" disabled={disabled} onPress={() => void send(control, 'stop')} style={{ flex: 1 }} />
            <Button title="Close" variant="secondary" icon="arrow-down" disabled={disabled} onPress={() => void send(control, 'close')} style={{ flex: 1 }} />
          </Row>
          {typeof value === 'string' ? <Body muted style={{ marginTop: 8 }}>{`Last command: ${value}`}</Body> : null}
        </Card>
      );
  }
}

function StepButton({ icon, disabled, onPress }: { icon: string; disabled?: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.step, { backgroundColor: c.backgroundSelected, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 28, fontWeight: '700', marginTop: 2 },
  step: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
