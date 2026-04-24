import { Stack } from 'expo-router';

import { useAppHeaderOptions } from '@/components/useAppHeaderOptions';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function AppLayout() {
  const headerOptions = useAppHeaderOptions();

  return (
    <Stack screenOptions={{ ...headerOptions }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="community-new" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="community-access" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="profile-edit" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="runner/[username]" options={{ headerShown: false }} />
      <Stack.Screen name="crew/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="meetup/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
