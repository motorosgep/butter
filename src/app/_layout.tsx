import {
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useColors } from '@/components/ui';
import { useHub } from '@/lib/hub/store';
import { useAppearance, useSyncSystemScheme } from '@/theme';

export default function RootLayout() {
  const c = useColors();
  const hydrated = useHub((s) => s.hydrated);
  const hydrate = useHub((s) => s.hydrate);
  const lookHydrated = useAppearance((s) => s.hydrated);
  const hydrateLook = useAppearance((s) => s.hydrate);
  useSyncSystemScheme();
  // Butter's typeface. If a file fails to load, screens fall back to the system font rather than wait.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    void hydrate();
    void hydrateLook();
  }, [hydrate, hydrateLook]);

  if (!hydrated || !lookHydrated || (!fontsLoaded && !fontError)) {
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
      <Stack.Screen name="solar" options={{ title: 'Solar' }} />
    </Stack>
  );
}
