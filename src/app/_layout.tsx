import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useColors } from '@/components/ui';
import { useHub } from '@/lib/hub/store';

export default function RootLayout() {
  const c = useColors();
  const hydrated = useHub((s) => s.hydrated);
  const hydrate = useHub((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerTintColor: c.text,
        headerStyle: { backgroundColor: c.background },
        contentStyle: { backgroundColor: c.background },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
      <Stack.Screen name="onboarding/index" options={{ title: 'Add a hub' }} />
      <Stack.Screen name="onboarding/pair" options={{ title: 'Pair' }} />
      <Stack.Screen name="onboarding/console" options={{ title: 'Hub console', presentation: 'modal' }} />
      <Stack.Screen name="device/[serial]" options={{ title: '' }} />
      <Stack.Screen name="weather" options={{ title: 'Weather' }} />
      <Stack.Screen name="measurements" options={{ title: 'Measurements' }} />
    </Stack>
  );
}
