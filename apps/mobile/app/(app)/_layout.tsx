import { Stack, useRouter } from 'expo-router';

import { HeaderBackButton } from '@/components/HeaderBackButton';
import { useAppHeaderOptions } from '@/components/useAppHeaderOptions';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function AppLayout() {
  const router = useRouter();
  const headerOptions = useAppHeaderOptions();

  return (
    <Stack
      screenOptions={{
        ...headerOptions,
        headerBackVisible: false,
        headerLeft: ({ canGoBack }) =>
          canGoBack ? <HeaderBackButton onPress={() => router.back()} /> : undefined,
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="modal"
        options={{ presentation: 'modal', title: 'Nueva salida' }}
      />
      <Stack.Screen
        name="community-new"
        options={{ presentation: 'modal', title: 'Crear grupo' }}
      />
      <Stack.Screen
        name="community-access"
        options={{ presentation: 'modal', title: 'Entrar con código' }}
      />
      <Stack.Screen
        name="settings"
        options={{ presentation: 'modal', title: 'Ajustes' }}
      />
      <Stack.Screen
        name="profile-edit"
        options={{ presentation: 'modal', title: 'Editar perfil' }}
      />
      <Stack.Screen
        name="runner/[username]"
        options={{ title: 'Runner' }}
      />
      <Stack.Screen
        name="crew/[id]"
        options={{ title: 'Grupo' }}
      />
    </Stack>
  );
}
