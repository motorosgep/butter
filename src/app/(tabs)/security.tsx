import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { StatusBanner } from '@/components/status-banner';
import { Body, Button, Card, Empty, Heading, Icon, Row, Screen, Title, useColors } from '@/components/ui';
import { useHub } from '@/lib/hub/store';

const LABEL: Record<string, [string, string]> = {
  home_mode: ['Home', 'home-lock'],
  away_mode: ['Away', 'shield-lock'],
  sleep_mode: ['Sleep', 'weather-night'],
};

export default function Security() {
  const c = useColors();
  const modes = useHub((s) => s.security);
  const setSecurity = useHub((s) => s.setSecurity);
  const disarm = useHub((s) => s.disarm);
  const [busy, setBusy] = useState(false);
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
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Title>Security</Title>
        <Body muted style={{ marginTop: 2, marginBottom: 14 }}>
          {armed ? `Armed: ${LABEL[armed.name]?.[0] ?? armed.name}` : 'Disarmed'}
        </Body>
        <StatusBanner />
        {modes.length === 0 ? <Empty icon="shield-off-outline" title="No security modes" body="Set up modes on the hub and arm or disarm them here." /> : null}
        {modes.map((mode) => {
          const [label, icon] = LABEL[mode.name] ?? [mode.name, 'shield'];
          return (
            <Card key={mode.sid} style={{ marginBottom: 10 }}>
              <Row between>
                <Row>
                  <View style={[styles.iconWrap, { backgroundColor: mode.enable ? c.accentSoft : c.backgroundSelected }]}>
                    <Icon name={icon} color={mode.enable ? c.accent : c.textSecondary} />
                  </View>
                  <Heading>{label}</Heading>
                </Row>
                <Switch value={mode.enable} disabled={busy} trackColor={{ true: c.accent }} onValueChange={(v) => void run(() => setSecurity(mode.sid, v))} />
              </Row>
            </Card>
          );
        })}
        {modes.length ? <Button title="Disarm" variant="secondary" icon="shield-off" busy={busy} onPress={() => void run(disarm)} style={{ marginTop: 6 }} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
