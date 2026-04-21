import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import '../global.css';
import 'react-native-reanimated';

import { AppProviders } from '@/components/AppProviders';
import { useAppTheme } from '@/components/ThemeContext';
import { authClient } from '@/lib/auth-client';
import { trpc } from '@/lib/trpc';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(app)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) {
    return null;
  }

  return (
    <AppProviders>
      <RootLayoutNav />
    </AppProviders>
  );
}

function RootLayoutNav() {
  const { colorScheme, colors } = useAppTheme();
  const { data: session, isPending } = authClient.useSession();
  const isAuthenticated = Boolean(session);
  const profileQuery = trpc.profile.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const isCheckingProfile = isAuthenticated && profileQuery.isPending;
  const hasCompletedOnboarding = Boolean(profileQuery.data?.profile);
  const canUseApp = isAuthenticated && hasCompletedOnboarding;
  const needsOnboarding = isAuthenticated && !isCheckingProfile && !hasCompletedOnboarding;
  const theme =
    colorScheme === 'dark'
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: colors.background,
            card: colors.surface,
            primary: colors.tint,
            text: colors.text,
            border: colors.border,
            notification: colors.tint,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: colors.background,
            card: colors.surface,
            primary: colors.tint,
            text: colors.text,
            border: colors.border,
            notification: colors.tint,
          },
        };

  useEffect(() => {
    if (!isPending && !isCheckingProfile) {
      SplashScreen.hideAsync();
    }
  }, [isCheckingProfile, isPending]);

  if (isPending || isCheckingProfile) {
    return null;
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack>
        <Stack.Protected guard={canUseApp}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={needsOnboarding}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
