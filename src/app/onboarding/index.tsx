import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Card, Heading, Icon, Row, Screen, Title, useColors } from '@/components/ui';
import { DEMO_BASE_URL } from '@/lib/demo/client';
import { discoveryAvailable, normaliseAddress, probeHub, scanForHubs, type FoundHub } from '@/lib/hub/discovery';
import { useHub } from '@/lib/hub/store';

export default function Onboarding() {
  const c = useColors();
  const addHub = useHub((s) => s.addHub);
  const canScan = discoveryAvailable();
  const [found, setFound] = useState<FoundHub[]>([]);
  const [scanning, setScanning] = useState(canScan);
  const [address, setAddress] = useState('');
  const [probing, setProbing] = useState(false);

  const addFound = (hub: FoundHub) =>
    setFound((list) => (list.some((h) => h.name === hub.name) ? list.map((h) => (h.name === hub.name ? hub : h)) : [...list, hub]));

  const scan = () => {
    if (!canScan) return;
    setScanning(true);
    setFound([]);
    void scanForHubs(6_000, addFound).finally(() => setScanning(false));
  };

  useEffect(() => {
    // Initial scan: state is already "scanning"; results and completion arrive asynchronously.
    if (!canScan) return;
    void scanForHubs(6_000, addFound).finally(() => setScanning(false));
  }, [canScan]);

  const connectTo = async (baseUrl: string, name?: string) => {
    setProbing(true);
    try {
      const info = await probeHub(baseUrl);
      router.push({ pathname: '/onboarding/pair', params: { baseUrl, name: name ?? info.name, deviceid: info.deviceid, fw: info.fw_version } });
    } catch (error) {
      Alert.alert('No hub found there', error instanceof Error ? error.message : String(error));
    } finally {
      setProbing(false);
    }
  };

  const tryDemo = async () => {
    await addHub({ name: 'Demo home', baseUrl: DEMO_BASE_URL, demo: true }, 'demo');
    router.replace('/(tabs)');
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Title>Find your hub</Title>
        <Body muted style={{ marginTop: 6 }}>
          Butter talks to your eWeLink CUBE gateway directly over your network. Nothing goes through a cloud.
        </Body>

        <Row between style={{ marginTop: 24 }}>
          <Heading>On this network</Heading>
          {scanning ? <ActivityIndicator /> : canScan ? <Button title="Scan again" variant="secondary" icon="refresh" onPress={scan} /> : null}
        </Row>
        {!canScan ? (
          <Body muted style={{ marginTop: 8 }}>
            Automatic discovery needs the full app build. Type the hub&apos;s address below instead.
          </Body>
        ) : null}
        {found.map((hub) => (
          <Card key={hub.name} onPress={() => void connectTo(hub.baseUrl, hub.info?.name)} style={{ marginTop: 10 }}>
            <Row between>
              <Row>
                <Icon name="home-automation" size={26} color={c.accent} />
                <View>
                  <Heading>{hub.info?.name ?? hub.name}</Heading>
                  <Body muted>{`${hub.address}${hub.info ? ` · CUBE ${hub.info.fw_version}` : ''}`}</Body>
                </View>
              </Row>
              <Icon name="chevron-right" color={c.textSecondary} />
            </Row>
          </Card>
        ))}
        {!scanning && canScan && found.length === 0 ? (
          <Body muted style={{ marginTop: 8 }}>
            No gateway answered. Make sure the phone is on the same Wi‑Fi as the hub, or enter its address.
          </Body>
        ) : null}

        <Heading style={{ marginTop: 28 }}>Enter an address</Heading>
        <Body muted style={{ marginTop: 4 }}>
          The hub&apos;s IP or hostname, or a VPN / remote-access URL.
        </Body>
        <Row style={{ marginTop: 10 }}>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="192.168.1.20 or ihost.local"
            placeholderTextColor={c.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={() => address && void connectTo(normaliseAddress(address))}
            style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement }]}
          />
          <Button title="Connect" busy={probing} disabled={!address.trim()} onPress={() => void connectTo(normaliseAddress(address))} />
        </Row>

        <Heading style={{ marginTop: 32 }}>No hub yet?</Heading>
        <Body muted style={{ marginTop: 4 }}>
          Explore Butter with a simulated home.
        </Body>
        <Button title="Try the demo home" variant="secondary" icon="home-heart" onPress={() => void tryDemo()} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
});
