/**
 * The hub's security modes (Home, Away, Sleep), arm one or disarm. Rarely
 * used, so it is a card at the foot of the Network tab rather than a tab of
 * its own, and it hides when the hub has no modes.
 */

import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { Body, Button, Card, Heading, Icon, Row, useColors } from '@/components/ui';
import { Text } from '@/components/text';
import { useHub } from '@/lib/hub/store';

const LABEL: Record<string, [string, string]> = {
  home_mode: ['Home', 'home-lock'],
  away_mode: ['Away', 'shield-lock'],
  sleep_mode: ['Sleep', 'weather-night'],
};

export function SecurityCard() {
  const c = useColors();
  const modes = useHub((s) => s.security);
  const setSecurity = useHub((s) => s.setSecurity);
  const disarm = useHub((s) => s.disarm);
  const [busy, setBusy] = useState(false);
  if (modes.length === 0) return null;
  const armed = modes.find((m) => m.enable);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      Alert.alert('Security', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ marginTop: 18 }}>
      <Row between>
        <Row>
          <Icon name={armed ? 'shield-lock' : 'shield-off'} size={20} color={armed ? c.accent : c.textSecondary} />
          <Heading style={{ fontSize: 15 }}>Security</Heading>
        </Row>
        <Body muted>{armed ? `Armed: ${LABEL[armed.name]?.[0] ?? armed.name}` : 'Disarmed'}</Body>
      </Row>
      <Row style={{ marginTop: 12, flexWrap: 'wrap' }}>
        {modes.map((mode) => {
          const [label, icon] = LABEL[mode.name] ?? [mode.name, 'shield'];
          const on = mode.enable;
          return (
            <Pressable
              key={mode.sid}
              disabled={busy}
              accessibilityRole="switch"
              accessibilityState={{ checked: on, disabled: busy }}
              accessibilityLabel={`${label} mode`}
              onPress={() => void run(() => setSecurity(mode.sid, !on))}
              style={({ pressed }) => [styles.mode, { backgroundColor: on ? c.accentSoft : c.backgroundSelected, opacity: pressed || busy ? 0.7 : 1 }]}>
              <Icon name={icon} size={18} color={on ? c.accent : c.textSecondary} />
              <Text style={[styles.label, { color: on ? c.accent : c.text }]}>{label}</Text>
            </Pressable>
          );
        })}
      </Row>
      {armed ? <Button title="Disarm" variant="secondary" icon="shield-off" busy={busy} onPress={() => void run(disarm)} style={{ marginTop: 12 }} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  mode: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18 },
  label: { fontSize: 14, fontWeight: '600' },
});
