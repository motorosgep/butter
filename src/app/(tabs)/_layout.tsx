import { Tabs } from 'expo-router/tabs';

import { PillTabBar } from '@/components/tab-bar';
import { useColors } from '@/components/ui';

/**
 * Home, Security and Settings, under the floating pill tab bar the Butter
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
      <Tabs.Screen name="security" options={{ title: 'Security' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
