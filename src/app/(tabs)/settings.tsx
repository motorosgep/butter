import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { StatusBanner } from '@/components/status-banner';
import { Body, Button, Card, Chip, Heading, Row, Screen, Title, useColors } from '@/components/ui';
import { defaultHistoryUrl } from '@/lib/history/client';
import { selectActiveHub, useHub, type Hub, type HistoryStatus } from '@/lib/hub/store';

const REPO = 'https://github.com/motorosgep/butter';

export default function Settings() {
  const c = useColors();
  const hub = useHub(selectActiveHub);
  const hubs = useHub((s) => s.hubs);
  const status = useHub((s) => s.status);
  const refresh = useHub((s) => s.refresh);
  const selectHub = useHub((s) => s.selectHub);
  const removeHub = useHub((s) => s.removeHub);
  const historyStatus = useHub((s) => s.historyStatus);
  const version = Constants.expoConfig?.version ?? 'dev';

  const forget = () => {
    if (!hub) return;
    Alert.alert('Forget this hub?', `Butter will drop its token for ${hub.name}. The hub itself is not changed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: () => {
          void removeHub(hub.id).then(() => {
            if (!useHub.getState().activeHubId) router.replace('/onboarding');
          });
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Title>Settings</Title>
        <View style={{ height: 14 }} />
        <StatusBanner />

        <Heading style={styles.section}>Hub</Heading>
        <Card>
          <Heading>{hub?.name ?? 'No hub'}</Heading>
          {hub ? (
            <Body muted style={{ marginTop: 4 }}>
              {hub.demo ? 'Simulated home' : `${hub.baseUrl}${hub.info ? ` · CUBE ${hub.info.fw_version}` : ''}`}
            </Body>
          ) : null}
          <Body muted style={{ marginTop: 4 }}>
            {`Status: ${status}`}
          </Body>
          <Row style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <Button title="Refresh" variant="secondary" icon="refresh" onPress={() => void refresh().catch((e: Error) => Alert.alert('Refresh failed', e.message))} />
            <Button title="Forget hub" variant="danger" icon="link-off" onPress={forget} />
          </Row>
        </Card>

        {hub && !hub.demo ? <HistorySettings hub={hub} status={historyStatus} /> : null}

        {hubs.length > 1 ? (
          <>
            <Heading style={styles.section}>Switch hub</Heading>
            <Row style={{ flexWrap: 'wrap' }}>
              {hubs.map((h) => (
                <Chip key={h.id} label={h.name} selected={h.id === hub?.id} onPress={() => void selectHub(h.id)} />
              ))}
            </Row>
          </>
        ) : null}
        <Button title="Add another hub" variant="secondary" icon="plus" onPress={() => router.push('/onboarding')} style={{ marginTop: 14, alignSelf: 'flex-start' }} />

        <Heading style={styles.section}>Rooms</Heading>
        <Body muted>
          Rooms are stored on the hub as a tag on each device, so they follow you to every phone. Assign them from a device&apos;s page.
        </Body>

        <Heading style={styles.section}>About</Heading>
        <Card>
          <Heading>{`Butter ${version}`}</Heading>
          <Body muted style={{ marginTop: 4 }}>
            I can&apos;t believe it&apos;s not an iHost app. Open source, no cloud, no account.
          </Body>
          <Body muted style={{ marginTop: 4 }}>
            Not affiliated with SONOFF, ITEAD or CoolKit.
          </Body>
          <Button title="Source code" variant="secondary" icon="github" onPress={() => void Linking.openURL(REPO)} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
        </Card>
        <View style={{ height: 24 }} />
        <Body muted style={{ textAlign: 'center', color: c.textSecondary }}>
          Butter never sends your data anywhere. Everything stays between this phone and your hub.
        </Body>
      </ScrollView>
    </Screen>
  );
}

function HistorySettings({ hub, status }: { hub: Hub; status: HistoryStatus }) {
  const c = useColors();
  const setHistoryUrl = useHub((s) => s.setHistoryUrl);
  const detect = useHub((s) => s.detectHistory);
  const [draft, setDraft] = useState(hub.historyUrl ?? '');
  const label =
    status === 'available' ? 'Recorder found: charts are on' : status === 'checking' ? 'Looking for the recorder…' : status === 'unavailable' ? 'No recorder found next to the hub' : '';
  return (
    <Card style={{ marginTop: 10 }}>
      <Heading style={{ fontSize: 15 }}>History</Heading>
      <Body muted style={{ marginTop: 4 }}>
        {`${label}. The ihost-bridge add-on records readings for charts; it is found on the hub's address, port 9900, unless you point Butter elsewhere.`}
      </Body>
      <Row style={{ marginTop: 10 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={defaultHistoryUrl(hub.baseUrl)}
          placeholderTextColor={c.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          onSubmitEditing={() => void setHistoryUrl(hub.id, draft)}
          style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement }]}
        />
        <Button title="Save" variant="secondary" onPress={() => void setHistoryUrl(hub.id, draft)} />
      </Row>
      <Row style={{ marginTop: 8 }}>
        <Button title="Check again" variant="secondary" icon="refresh" onPress={() => void detect()} />
        {hub.historyUrl ? (
          <Button
            title="Use the hub's address"
            variant="secondary"
            onPress={() => {
              setDraft('');
              void setHistoryUrl(hub.id, undefined);
            }}
          />
        ) : null}
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  section: { marginTop: 22, marginBottom: 8, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.7 },
  input: { flex: 1, fontSize: 14, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10 },
});
