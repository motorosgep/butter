import { Redirect } from 'expo-router';

import { useHub } from '@/lib/hub/store';

export default function Index() {
  const activeHubId = useHub((s) => s.activeHubId);
  return <Redirect href={activeHubId ? '/(tabs)' : '/onboarding'} />;
}
