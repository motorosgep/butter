/**
 * The hub's web console inside the app, for the Allow step of pairing.
 *
 * A system browser tab (Safari view controller, Chrome custom tab) pauses the
 * app, which stops the token polling, and the hub only shows its dialog while
 * requests keep arriving. A WebView keeps Butter in the foreground.
 */

import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { WebViewProps } from 'react-native-webview';

import { Body, Button, useColors } from '@/components/ui';

type WebViewComponent = React.ComponentType<WebViewProps>;

/** The WebView needs its native module; builds made before it was added fall back to a browser tab. */
function loadWebView(): WebViewComponent | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-webview') as { WebView?: WebViewComponent; default?: WebViewComponent };
    return mod.WebView ?? mod.default;
  } catch {
    return undefined;
  }
}

export default function ConsoleScreen() {
  const c = useColors();
  const { baseUrl } = useLocalSearchParams<{ baseUrl: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [WebView] = useState(() => loadWebView());

  useEffect(() => {
    if (WebView) return;
    // No WebView in this build: open a browser tab instead and leave this screen.
    void WebBrowser.openBrowserAsync(baseUrl, { dismissButtonStyle: 'done' }).finally(() => router.back());
  }, [WebView, baseUrl]);

  if (!WebView) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: 'Hub console', presentation: 'modal' }} />
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          title: 'Hub console',
          presentation: 'modal',
          headerRight: () => <Button title="Done" variant="secondary" onPress={() => router.back()} />,
        }}
      />
      {error ? (
        <View style={styles.center}>
          <Body muted style={{ textAlign: 'center' }}>{`The console did not load: ${error}`}</Body>
          <Button title="Try again" icon="refresh" onPress={() => setError(undefined)} style={{ marginTop: 14 }} />
        </View>
      ) : (
        <WebView
          source={{ uri: baseUrl }}
          style={{ flex: 1, backgroundColor: c.background }}
          onLoadEnd={() => setLoading(false)}
          onError={(e) => setError(e.nativeEvent.description || 'network error')}
          allowsBackForwardNavigationGestures
          sharedCookiesEnabled
          setSupportMultipleWindows={false}
        />
      )}
      {loading && !error ? (
        <View style={[styles.center, StyleSheet.absoluteFill]} pointerEvents="none">
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
