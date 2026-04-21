import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAppTheme } from '@/components/ThemeContext';
import { AppCard, HeroPanel, ScreenScroll } from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
import { queryClient, trpc } from '@/lib/trpc';

const profileSchema = z.object({
  availability: z.string().max(120).optional(),
  bio: z.string().max(280).optional(),
  city: z.string().min(2, 'La ciudad es obligatoria'),
  pace: z.string().min(2, 'El ritmo es obligatorio'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { data: session } = authClient.useSession();
  const utils = trpc.useUtils();
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const profileQuery = trpc.profile.me.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const upsertProfile = trpc.profile.upsert.useMutation({
    onSuccess: async () => {
      await utils.profile.me.invalidate();
      await utils.crews.recommended.invalidate();
      setSavedMessage('Perfil guardado. Tus recomendaciones ya usan estos datos.');
    },
    onError: (error) => {
      Alert.alert('No se pudo guardar', error.message);
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    defaultValues: {
      availability: '',
      bio: '',
      city: '',
      pace: '',
    },
  });
  const profile = profileQuery.data?.profile;

  useEffect(() => {
    if (!profile) {
      return;
    }

    reset({
      availability: profile.availability ?? '',
      bio: profile.bio ?? '',
      city: profile.city,
      pace: profile.pace,
    });
  }, [profile, reset]);

  async function handleSignOut() {
    const result = await authClient.signOut();

    if (result.error) {
      Alert.alert('No se pudo cerrar sesión', result.error.message);
      return;
    }

    queryClient.clear();
    router.replace('/');
  }

  const onSubmit = handleSubmit(async (values) => {
    setSavedMessage(null);

    const parsed = profileSchema.safeParse({
      availability: values.availability?.trim() || undefined,
      bio: values.bio?.trim() || undefined,
      city: values.city.trim(),
      pace: values.pace.trim(),
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;

      if (flattened.city?.[0]) {
        setError('city', { message: flattened.city[0], type: 'manual' });
      }

      if (flattened.pace?.[0]) {
        setError('pace', { message: flattened.pace[0], type: 'manual' });
      }

      if (flattened.bio?.[0]) {
        setError('bio', { message: flattened.bio[0], type: 'manual' });
      }

      if (flattened.availability?.[0]) {
        setError('availability', { message: flattened.availability[0], type: 'manual' });
      }

      return;
    }

    await upsertProfile.mutateAsync(parsed.data);
  });

  return (
    <ScreenScroll>
      <HeroPanel kicker="Tu cuenta" title={session?.user.name ?? 'Runner'} body={session?.user.email}>
        <View style={[styles.statusPill, { backgroundColor: colors.heroAccent }]}>
          <Text style={styles.statusPillText}>
            {profile ? `Perfil listo · ${profile.city} · ${profile.pace}` : 'Perfil pendiente'}
          </Text>
        </View>
      </HeroPanel>

      <AppCard>
        <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Onboarding</Text>
        <Text className="text-[25px] font-black text-text">Tu perfil runner</Text>
        <Text className="text-[15px] leading-[23px] text-muted-text">
          Estos datos ayudan a ordenar crews y quedadas por compatibilidad. Puedes cambiarlos cuando quieras.
        </Text>

        <View className="mt-3 gap-4">
          <View className="gap-1.5">
            <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Ciudad</Text>
            <Controller
              control={control}
              name="city"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  autoCapitalize="words"
                  onChangeText={onChange}
                  placeholder="Madrid"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={value}
                />
              )}
            />
            {errors.city ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.city.message}</Text> : null}
          </View>

          <View className="gap-1.5">
            <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Ritmo cómodo</Text>
            <Controller
              control={control}
              name="pace"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  autoCapitalize="none"
                  onChangeText={onChange}
                  placeholder="5:30/km"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={value}
                />
              )}
            />
            {errors.pace ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.pace.message}</Text> : null}
          </View>

          <View className="gap-1.5">
            <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Disponibilidad</Text>
            <Controller
              control={control}
              name="availability"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  autoCapitalize="sentences"
                  onChangeText={onChange}
                  placeholder="Martes y jueves tarde, domingos mañana"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={value}
                />
              )}
            />
            {errors.availability ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{errors.availability.message}</Text>
            ) : null}
          </View>

          <View className="gap-1.5">
            <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Qué buscas</Text>
            <Controller
              control={control}
              name="bio"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  autoCapitalize="sentences"
                  multiline
                  onChangeText={onChange}
                  placeholder="Rodajes sociales, preparar 10K, encontrar crew de barrio..."
                  placeholderTextColor={colors.mutedText}
                  style={[
                    styles.input,
                    styles.textArea,
                    { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                  ]}
                  value={value}
                />
              )}
            />
            {errors.bio ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.bio.message}</Text> : null}
          </View>
        </View>

        {savedMessage ? (
          <View style={[styles.successCard, { backgroundColor: colors.chip }]}>
            <Text className="text-sm font-extrabold leading-5 text-success">{savedMessage}</Text>
          </View>
        ) : null}

        <Pressable
          disabled={upsertProfile.isPending || profileQuery.isPending}
          onPress={onSubmit}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : upsertProfile.isPending ? 0.7 : 1 })}
          className={`mt-3 items-center rounded-[18px] bg-tint py-4`}>
          <Text className="text-base font-black text-[#FFF8EC]">
            {upsertProfile.isPending ? 'Guardando...' : 'Guardar perfil'}
          </Text>
        </Pressable>
      </AppCard>

      <AppCard>
        <Text className="text-[25px] font-black text-text">Sesión</Text>
        <Text className="text-[15px] leading-[23px] text-muted-text">
          Cierra sesión si estás usando un dispositivo compartido o quieres entrar con otra cuenta.
        </Text>
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          className="mt-2 items-center rounded-[18px] bg-chip py-[15px]">
          <Text className="text-[15px] font-black text-danger">Cerrar sesión</Text>
        </Pressable>
      </AppCard>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 22,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  statusPillText: {
    color: '#1A1410',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  successCard: {
    borderRadius: 16,
    marginTop: 4,
    padding: 14,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
});
