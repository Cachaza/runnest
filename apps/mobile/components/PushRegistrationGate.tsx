import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';

import { authClient } from '@/lib/auth-client';
import { trpc } from '@/lib/trpc';

const PUSH_REGISTRATION_PLATFORM = 'android';

type NotificationsModule = typeof import('expo-notifications');

let notificationHandlerConfigured = false;

async function loadNotifications() {
  const Notifications = await import('expo-notifications');

  if (!notificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerConfigured = true;
  }

  return Notifications;
}

function resolveExpoProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    null
  );
}

function isPushRegistrationSupported() {
  return Platform.OS === PUSH_REGISTRATION_PLATFORM && !isRunningInExpoGo();
}

function isPushBackendUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('user_push_devices') ||
    message.includes('relation "user_push_devices" does not exist') ||
    message.includes('notification_deliveries')
  );
}

async function getExpoPushToken(Notifications: NotificationsModule, projectId: string) {
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
  });

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (finalStatus !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  return token.data;
}

export function PushRegistrationGate() {
  const { data: session } = authClient.useSession();
  const registerDevice = trpc.notifications.registerDevice.useMutation();
  const tokenRef = useRef<string | null>(null);
  const disabledRef = useRef(false);
  const missingProjectIdLoggedRef = useRef(false);
  const backendUnavailableLoggedRef = useRef(false);
  const unsupportedRuntimeLoggedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const projectId = resolveExpoProjectId();

    async function syncPushToken() {
      if (!session || disabledRef.current) {
        return;
      }

      if (!isPushRegistrationSupported()) {
        if (
          Platform.OS === PUSH_REGISTRATION_PLATFORM &&
          isRunningInExpoGo() &&
          !unsupportedRuntimeLoggedRef.current
        ) {
          console.log(
            '[push] registration disabled in Expo Go on Android. Use a development build to test remote push.',
          );
          unsupportedRuntimeLoggedRef.current = true;
        }
        return;
      }

      if (!projectId) {
        if (!missingProjectIdLoggedRef.current) {
          console.log(
            '[push] registration disabled: missing Expo projectId. Set EXPO_PUBLIC_EAS_PROJECT_ID or add the EAS project config.',
          );
          missingProjectIdLoggedRef.current = true;
        }
        return;
      }

      try {
        const Notifications = await loadNotifications();
        const expoPushToken = await getExpoPushToken(Notifications, projectId);

        if (!isMounted || !expoPushToken || tokenRef.current === expoPushToken) {
          return;
        }

        await registerDevice.mutateAsync({
          expoPushToken,
          platform: PUSH_REGISTRATION_PLATFORM,
        });

        tokenRef.current = expoPushToken;
      } catch (error) {
        if (isPushBackendUnavailable(error)) {
          disabledRef.current = true;
          if (!backendUnavailableLoggedRef.current) {
            console.log(
              '[push] registration disabled: backend push tables are unavailable. Run the latest DB migration.',
            );
            backendUnavailableLoggedRef.current = true;
          }
          return;
        }

        console.log('[push] registration skipped', error);
      }
    }

    void syncPushToken();

    if (!session || !projectId || !isPushRegistrationSupported() || disabledRef.current) {
      return () => {
        isMounted = false;
      };
    }

    let subscription: { remove: () => void } | null = null;
    void loadNotifications().then((Notifications) => {
      if (!isMounted || !session || disabledRef.current) {
        return;
      }

      subscription = Notifications.addPushTokenListener(async ({ data }) => {
        if (!session || !data || disabledRef.current) {
          return;
        }

        try {
          if (tokenRef.current === data) {
            return;
          }

          await registerDevice.mutateAsync({
            expoPushToken: data,
            platform: PUSH_REGISTRATION_PLATFORM,
          });
          tokenRef.current = data;
        } catch (error) {
          if (isPushBackendUnavailable(error)) {
            disabledRef.current = true;
            if (!backendUnavailableLoggedRef.current) {
              console.log(
                '[push] token sync disabled: backend push tables are unavailable. Run the latest DB migration.',
              );
              backendUnavailableLoggedRef.current = true;
            }
            return;
          }

          console.log('[push] token refresh failed', error);
        }
      });
    });

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [registerDevice, session?.user?.id]);

  return null;
}
