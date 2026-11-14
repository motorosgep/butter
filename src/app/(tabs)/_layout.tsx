import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useColors } from '@/components/ui';

export default function TabLayout() {
  const c = useColors();
  return (
    // The tab bar stays native; it only takes the theme's colours (the background shows on iOS 18 and earlier, iOS 26 draws glass).
    <NativeTabs tintColor={c.accent} backgroundColor={c.background}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="security">
        <NativeTabs.Trigger.Icon sf="shield.fill" md="security" />
        <NativeTabs.Trigger.Label>Security</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gear" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
