import { Tabs } from 'expo-router/tabs';

import { PillTabBar } from '@/components/tab-bar';
import { useColors } from '@/components/ui';

/**
 * Home, Network (with the rarely used security modes at its foot) and Settings, under the floating pill tab bar the Butter
 * design draws (icons only, the current tab in butter). The bar is ours, so it
 * follows the theme in every scheme.
 */
export default function TabLayout() {
  const c = useColors();
  return (
    <Tabs
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background } }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="network" options={{ title: 'Network' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
