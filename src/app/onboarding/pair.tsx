import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Card, Heading, Icon, Row, Screen, Title, useColors } from '@/components/ui';
import { CubeClient } from '@/lib/cube/client';
import { useHub } from '@/lib/hub/store';

export default function Pair() {
  const c = useColors();
  const { baseUrl, name, deviceid, fw } = useLocalSearchParams<{ baseUrl: string; name?: string; deviceid?: string; fw?: string }>();
  const addHub = useHub((s) => s.addHub);
  const [seconds, setSeconds] = useState(0);
  const [failed, setFailed] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const cancelled = useRef(false);
  const consoleOpen = useRef(false);

  // Back from the console (Done, swipe, hardware back): nothing left to dismiss.
  useFocusEffect(
    useCallback(() => {
      consoleOpen.current = false;
    }, []),
  );

  useEffect(() => {
    cancelled.current = false;
    const client = new CubeClient({ baseUrl, appName: 'Butter' });
    client
      .waitForToken(300_000, 2_000, (n) => setSeconds(n * 2))
      .then(async (token) => {
        if (cancelled.current) return;
        const info = await client.bridgeInfo().catch(() => undefined);
        await addHub({ name: name || info?.name || 'My hub', baseUrl, info }, token);
        setDone(true);
        // Close the in-app console if it is still up; the user is done there.
        if (consoleOpen.current) router.back();
        router.replace('/(tabs)');
      })
      .catch((error: Error) => {
        if (!cancelled.current) setFailed(error.message);
      });
    return () => {
      cancelled.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  // The hub only shows its Allow dialog to a console page while token requests
  // keep arriving. A system browser tab pauses this app and stops the polling,
  // so the console is opened in a WebView inside the app, where polling continues.
  const openConsole = () => {
    consoleOpen.current = true;
    router.push({ pathname: '/onboarding/console', params: { baseUrl } });
  };

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Title>Allow Butter on the hub</Title>
        <Body muted style={{ marginTop: 6 }}>
          {`${name || 'Your hub'}${fw ? ` · CUBE ${fw}` : ''}${deviceid ? ` · ${deviceid}` : ''}`}
        </Body>

        <Card style={{ marginTop: 24 }}>
          <Step n={1} title="Open the hub's web console" body="It opens right here in Butter. Sign in if the hub asks you to. Keep Butter open: the hub only shows the dialog while Butter is asking." />
          <Button title="Open console" icon="open-in-new" variant="secondary" onPress={openConsole} style={{ alignSelf: 'flex-start', marginLeft: 38, marginTop: 8 }} />
          <View style={{ height: 18 }} />
          <Step n={2} title="Press Allow" body='A dialog titled "Get eWeLink CUBE access token" appears there. Press Allow within five minutes; the console closes on its own once Butter is paired.' />
        </Card>

        <Card style={{ marginTop: 14 }}>
          <Row>
            {done ? <Icon name="check-circle" color={c.ok} /> : failed ? <Icon name="alert-circle" color={c.danger} /> : <ActivityIndicator />}
            <Body style={{ flex: 1 }}>
              {done ? 'Paired. Opening your home…' : failed ? failed : `Waiting for Allow… ${seconds}s`}
            </Body>
          </Row>
        </Card>

        {failed ? <Button title="Try again" icon="refresh" onPress={() => router.replace({ pathname: '/onboarding/pair', params: { baseUrl, name, deviceid, fw } })} style={{ marginTop: 14 }} /> : null}
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} style={{ marginTop: 10 }} />
      </ScrollView>
    </Screen>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  const c = useColors();
  return (
    <Row style={{ alignItems: 'flex-start' }}>
      <View style={[styles.badge, { backgroundColor: c.accent }]}>
        <Body style={{ fontWeight: '700', color: '#1c1c1e' }}>{String(n)}</Body>
      </View>
      <View style={{ flex: 1 }}>
        <Heading>{title}</Heading>
        <Body muted style={{ marginTop: 2 }}>
          {body}
        </Body>
      </View>
    </Row>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
