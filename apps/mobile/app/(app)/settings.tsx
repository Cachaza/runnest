import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { AppButton, AppCard, ScreenScroll } from '@/components/ui/AppUI';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { authClient } from '@/lib/auth-client';
import { queryClient, trpc } from '@/lib/trpc';

type SettingsState = {
  notificationMeetups: boolean;
  notificationReminders: boolean;
  publicProfile: boolean;
  showArea: boolean;
  showCity: boolean;
};

const DEFAULT_SETTINGS: SettingsState = {
  notificationMeetups: true,
  notificationReminders: true,
  publicProfile: true,
  showArea: true,
  showCity: true,
};

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const utils = trpc.useUtils();
  const profileQuery = trpc.profile.me.useQuery(undefined, {
    retry: false,
  });
  const updateSettings = trpc.profile.updateSettings.useMutation({
    onSuccess: async () => {
      await utils.profile.me.invalidate();
      Alert.alert('Ajustes guardados', 'Tus preferencias se han actualizado.');
    },
    onError: (error) => {
      Alert.alert('No se pudieron guardar', error.message);
    },
  });
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const profile = profileQuery.data?.profile;

  useEffect(() => {
    if (!profile) {
      return;
    }

    setSettings({
      notificationMeetups: profile.notificationMeetups,
      notificationReminders: profile.notificationReminders,
      publicProfile: profile.publicProfile,
      showArea: profile.showArea,
      showCity: profile.showCity,
    });
  }, [profile]);

  function updateLocalSetting(key: keyof SettingsState, value: boolean) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSignOut() {
    const result = await authClient.signOut();

    if (result.error) {
      Alert.alert('No se pudo cerrar sesión', result.error.message);
      return;
    }

    queryClient.clear();
    router.replace('/');
  }

  return (
    <ScreenScroll title="Ajustes">
      <AppCard>
        <Text className="text-[25px] font-black text-text">Apariencia</Text>
        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-[15px] font-bold text-text">Modo oscuro</Text>
          <ThemeToggle />
        </View>
      </AppCard>

      <AppCard>
        <Text className="text-[25px] font-black text-text">Notificaciones</Text>
        <Text className="text-[15px] leading-[23px] text-muted-text">
          Controla los avisos que AppRunners podrá usar para quedadas y recordatorios.
        </Text>
        <SettingSwitch
          label="Nuevas quedadas"
          value={settings.notificationMeetups}
          onValueChange={(value) => updateLocalSetting('notificationMeetups', value)}
        />
        <SettingSwitch
          label="Recordatorios antes de correr"
          value={settings.notificationReminders}
          onValueChange={(value) => updateLocalSetting('notificationReminders', value)}
        />
      </AppCard>

      <AppCard>
        <Text className="text-[25px] font-black text-text">Privacidad</Text>
        <Text className="text-[15px] leading-[23px] text-muted-text">
          Decide qué ven otros runners cuando abren tu perfil desde crews o quedadas.
        </Text>
        <SettingSwitch
          label="Perfil público"
          value={settings.publicProfile}
          onValueChange={(value) => updateLocalSetting('publicProfile', value)}
        />
        <SettingSwitch
          disabled={!settings.publicProfile}
          label="Mostrar ciudad"
          value={settings.publicProfile && settings.showCity}
          onValueChange={(value) => updateLocalSetting('showCity', value)}
        />
        <SettingSwitch
          disabled={!settings.publicProfile}
          label="Mostrar zona/barrio"
          value={settings.publicProfile && settings.showArea}
          onValueChange={(value) => updateLocalSetting('showArea', value)}
        />
        <AppButton
          disabled={profileQuery.isPending || updateSettings.isPending}
          onPress={() => updateSettings.mutate(settings)}
          style={{ marginTop: 10 }}>
          {updateSettings.isPending ? 'Guardando...' : 'Guardar ajustes'}
        </AppButton>
      </AppCard>

      <AppCard>
        <Text className="text-[25px] font-black text-text">Sesión</Text>
        <Text className="text-[15px] leading-[23px] text-muted-text mt-2">
          Cierra sesión si estás usando un dispositivo compartido o quieres entrar con otra cuenta.
        </Text>
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          className="mt-4 items-center rounded-[18px] bg-chip py-[15px]">
          <Text className="text-[15px] font-black text-danger">Cerrar sesión</Text>
        </Pressable>
      </AppCard>
    </ScreenScroll>
  );
}

function SettingSwitch({
  disabled = false,
  label,
  onValueChange,
  value,
}: {
  disabled?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View className="mt-4 flex-row items-center justify-between gap-4">
      <Text className={`flex-1 text-[15px] font-bold ${disabled ? 'text-muted-text' : 'text-text'}`}>{label}</Text>
      <Switch
        disabled={disabled}
        onValueChange={onValueChange}
        thumbColor={value ? '#FFF8EC' : colors.surface}
        trackColor={{ false: colors.chip, true: colors.tint }}
        value={value}
      />
    </View>
  );
}
