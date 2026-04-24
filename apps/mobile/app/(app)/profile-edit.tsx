import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import {
  AvailabilityGrid,
  AvailabilitySlot,
  DISTANCE_OPTIONS,
  GOAL_OPTIONS,
  LEVEL_OPTIONS,
  OptionChips,
  formatAvailability,
  usernameCandidateFrom,
} from '@/components/ProfileForm';
import { useAppTheme } from '@/components/ThemeContext';
import {
  AppCard,
  ScreenScroll,
  SegmentedTabs,
} from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
import { trpc } from '@/lib/trpc';

type TabValue = 'identity' | 'running' | 'availability';

const profileSchema = z.object({
  availability: z.string().max(120).optional(),
  availabilitySlots: z
    .array(
      z.object({
        day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
        period: z.enum(['morning', 'midday', 'afternoon', 'evening']),
      }),
    )
    .max(28),
  bio: z.string().max(280).optional(),
  city: z.string().min(2, 'La ciudad es obligatoria'),
  citySelection: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      municipality: z.string().min(2),
      province: z.string().min(2),
      slug: z.string().min(2),
    })
    .optional(),
  pace: z.string().min(2, 'El ritmo es obligatorio'),
  level: z.string().optional(),
  distance: z.string().optional(),
  goals: z.string().optional(),
  area: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { data: session } = authClient.useSession();
  const utils = trpc.useUtils();
  const profileQuery = trpc.profile.me.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const profile = profileQuery.data?.profile;
  const [tab, setTab] = useState<TabValue>('identity');
  const username = useMemo(
    () => usernameCandidateFrom(profile?.username ?? session?.user.name),
    [profile?.username, session?.user.name],
  );

  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    defaultValues: {
      availability: '',
      availabilitySlots: [],
      bio: '',
      city: '',
      citySelection: undefined,
      pace: '',
      level: '',
      distance: '',
      goals: '',
      area: '',
    },
  });

  const upsertProfile = trpc.profile.upsert.useMutation({
    onSuccess: async () => {
      await utils.profile.me.invalidate();
      await utils.communities.recommended.invalidate();
      router.back();
    },
    onError: (error) => {
      Alert.alert('No se pudo guardar', error.message);
    },
  });

  useEffect(() => {
    if (profileQuery.isPending) {
      return;
    }

    reset({
      availability: profile?.availability ?? '',
      availabilitySlots: (profile?.availabilitySlots ?? []) as AvailabilitySlot[],
      bio: profile?.bio ?? '',
      city: profile?.city ?? '',
      citySelection:
        profile?.citySlug && profile?.cityProvince && profile.cityLat !== null && profile.cityLng !== null
          ? {
              latitude: profile.cityLat,
              longitude: profile.cityLng,
              municipality: profile.city ?? '',
              province: profile.cityProvince,
              slug: profile.citySlug,
            }
          : undefined,
      pace: profile?.pace ?? '',
      level: profile?.level ?? '',
      distance: profile?.distance ?? '',
      goals: profile?.goals ?? '',
      area: profile?.area ?? '',
    });
  }, [profile, profileQuery.isPending, reset]);

  // Tab-based error highlighting helper - shows dot on tab if any field has error
  const hasIdentityError = Boolean(errors.city);
  const hasRunningError = Boolean(errors.pace || errors.bio);

  const onSubmit = handleSubmit(async (values) => {
    const city = values.city.trim();
    const citySelection =
      values.citySelection?.municipality === city ? values.citySelection : undefined;

    if (!citySelection) {
      setError('city', { message: 'Elige una ciudad de la lista.', type: 'manual' });
      setTab('identity');
      return;
    }

    const parsed = profileSchema.safeParse({
      availability: formatAvailability(values.availabilitySlots),
      availabilitySlots: values.availabilitySlots,
      bio: values.bio?.trim() || undefined,
      city,
      citySelection,
      pace: values.pace.trim(),
      level: values.level?.trim() || undefined,
      distance: values.distance?.trim() || undefined,
      goals: values.goals?.trim() || undefined,
      area: values.area?.trim() || undefined,
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;

      if (flattened.city?.[0]) {
        setError('city', { message: flattened.city[0], type: 'manual' });
        setTab('identity');
      }
      if (flattened.pace?.[0]) {
        setError('pace', { message: flattened.pace[0], type: 'manual' });
        setTab('running');
      }
      if (flattened.bio?.[0]) {
        setError('bio', { message: flattened.bio[0], type: 'manual' });
        setTab('running');
      }

      return;
    }

    await upsertProfile.mutateAsync({
      ...parsed.data,
      username: username || undefined,
    });
  });

  const bottomPad = 24 + insets.bottom + 80; // extra room for sticky save bar
  const isPending = profileQuery.isPending || upsertProfile.isPending || isSubmitting;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}>
      <ScreenScroll title="Editar perfil" contentStyle={{ paddingBottom: bottomPad }}>
        <View className="gap-2">
          <Text className="text-xs font-black uppercase tracking-[1.1px] text-tint">
            Tu perfil runner
          </Text>
          <Text className="text-[28px] font-black leading-8 text-text">
            Ajusta tu ficha
          </Text>
          <Text className="text-[14px] leading-[21px] text-muted-text">
            Estos datos ayudan a ordenar crews y quedadas por compatibilidad. Puedes
            cambiarlos cuando quieras.
          </Text>
        </View>

        <SegmentedTabs<TabValue>
          value={tab}
          onChange={setTab}
          options={[
            { label: 'Identidad', value: 'identity', badge: hasIdentityError ? 1 : 0 },
            { label: 'Running', value: 'running', badge: hasRunningError ? 1 : 0 },
            { label: 'Horario', value: 'availability' },
          ]}
        />

        {tab === 'identity' ? (
          <IdentitySection
            colors={colors}
            control={control}
            errors={errors}
            setValue={setValue}
            username={username}
          />
        ) : null}

        {tab === 'running' ? (
          <RunningSection colors={colors} control={control} errors={errors} />
        ) : null}

        {tab === 'availability' ? <AvailabilitySection control={control} /> : null}
      </ScreenScroll>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            paddingBottom: 16 + insets.bottom,
          },
        ]}>
        <Pressable
          disabled={isPending}
          onPress={onSubmit}
          style={({ pressed }) => ({
            opacity: pressed ? 0.85 : isPending ? 0.6 : 1,
          })}
          className="flex-row items-center justify-center gap-2 rounded-[18px] bg-tint py-4">
          {upsertProfile.isPending ? (
            <ActivityIndicator color={colors.onTint} />
          ) : null}
          <Text className="text-[15px] font-black text-on-tint">
            {upsertProfile.isPending ? 'Guardando...' : 'Guardar perfil'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

type FormControl = ReturnType<typeof useForm<ProfileFormValues>>['control'];
type FormErrors = ReturnType<typeof useForm<ProfileFormValues>>['formState']['errors'];
type FormSetValue = ReturnType<typeof useForm<ProfileFormValues>>['setValue'];

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

function IdentitySection({
  colors,
  control,
  errors,
  setValue,
  username,
}: {
  colors: ThemeColors;
  control: FormControl;
  errors: FormErrors;
  setValue: FormSetValue;
  username: string;
}) {
  const cityQuery = useWatch({ control, name: 'city' });
  const selectedCity = useWatch({ control, name: 'citySelection' });
  const municipalityQuery = trpc.geo.searchMunicipalities.useQuery(
    { query: cityQuery ?? '', limit: 6 },
    {
      enabled: (cityQuery?.trim().length ?? 0) >= 2 && selectedCity?.municipality !== cityQuery,
      retry: false,
    },
  );

  return (
    <>
      <AppCard>
        <FieldLabel>Username</FieldLabel>
        <View
          style={[
            styles.lockedUsername,
            { backgroundColor: colors.chip, borderColor: colors.border },
          ]}>
          <Text className="text-[17px] font-black text-text">@{username || 'pendiente'}</Text>
          <Text className="text-[13px] font-bold leading-[18px] text-muted-text">
            Reservado al crear la cuenta. No se edita desde el perfil.
          </Text>
        </View>
      </AppCard>

      <AppCard>
        <FieldLabel>Ciudad</FieldLabel>
        <Controller
          control={control}
          name="city"
          render={({ field: { onChange, value } }) => (
            <>
              <TextInput
                autoCapitalize="words"
                onChangeText={(nextValue) => {
                  onChange(nextValue);
                  setValue('citySelection', undefined);
                }}
                placeholder="Madrid"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={value}
              />
              {selectedCity?.municipality === value ? (
                <Text className="mt-1.5 text-[13px] font-bold text-success">
                  {selectedCity.province} · ciudad normalizada
                </Text>
              ) : null}
              {municipalityQuery.data && municipalityQuery.data.length > 0 ? (
                <View
                  style={[
                    styles.suggestions,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}>
                  {municipalityQuery.data.map((suggestion) => (
                    <Pressable
                      key={suggestion.id}
                      onPress={() => {
                        onChange(suggestion.municipality);
                        setValue('citySelection', {
                          latitude: suggestion.latitude,
                          longitude: suggestion.longitude,
                          municipality: suggestion.municipality,
                          province: suggestion.province,
                          slug: suggestion.slug,
                        });
                      }}
                      className="px-4 py-3"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                      <Text className="text-[15px] font-black text-text">{suggestion.label}</Text>
                      <Text className="text-[13px] font-bold text-muted-text">
                        {suggestion.subtitle}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          )}
        />
        {errors.city ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{errors.city.message}</Text>
        ) : null}
      </AppCard>

      <AppCard>
        <FieldLabel>Zona o barrio</FieldLabel>
        <Controller
          control={control}
          name="area"
          render={({ field: { onChange, value } }) => (
            <TextInput
              autoCapitalize="words"
              onChangeText={onChange}
              placeholder="Retiro, Madrid Río..."
              placeholderTextColor={colors.mutedText}
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={value ?? ''}
            />
          )}
        />
        <Text className="mt-1 text-[12px] font-bold leading-[18px] text-muted-text">
          Opcional. Ayuda a matchear rutas cercanas.
        </Text>
      </AppCard>
    </>
  );
}

function RunningSection({
  colors,
  control,
  errors,
}: {
  colors: ThemeColors;
  control: FormControl;
  errors: FormErrors;
}) {
  return (
    <>
      <AppCard>
        <FieldLabel>Ritmo cómodo</FieldLabel>
        <Controller
          control={control}
          name="pace"
          render={({ field: { onChange, value } }) => (
            <TextInput
              autoCapitalize="none"
              onChangeText={onChange}
              placeholder="5:30/km"
              placeholderTextColor={colors.mutedText}
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={value}
            />
          )}
        />
        {errors.pace ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{errors.pace.message}</Text>
        ) : null}
      </AppCard>

      <AppCard>
        <FieldLabel>Nivel</FieldLabel>
        <Controller
          control={control}
          name="level"
          render={({ field: { onChange, value } }) => (
            <OptionChips onChange={onChange} options={LEVEL_OPTIONS} value={value} />
          )}
        />
      </AppCard>

      <AppCard>
        <FieldLabel>Distancia habitual</FieldLabel>
        <Controller
          control={control}
          name="distance"
          render={({ field: { onChange, value } }) => (
            <OptionChips onChange={onChange} options={DISTANCE_OPTIONS} value={value} />
          )}
        />
      </AppCard>

      <AppCard>
        <FieldLabel>Metas</FieldLabel>
        <Controller
          control={control}
          name="goals"
          render={({ field: { onChange, value } }) => (
            <OptionChips multiselect onChange={onChange} options={GOAL_OPTIONS} value={value} />
          )}
        />
      </AppCard>

      <AppCard>
        <FieldLabel>Qué buscas</FieldLabel>
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
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={value ?? ''}
            />
          )}
        />
        {errors.bio ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{errors.bio.message}</Text>
        ) : null}
      </AppCard>
    </>
  );
}

function AvailabilitySection({ control }: { control: FormControl }) {
  return (
    <AppCard>
      <FieldLabel>Cuándo sueles salir</FieldLabel>
      <Text className="text-[13px] leading-[20px] text-muted-text">
        Marca los días y franjas en que sueles correr. Cuantas más marques, más opciones
        te podremos recomendar.
      </Text>
      <View className="mt-2">
        <Controller
          control={control}
          name="availabilitySlots"
          render={({ field: { onChange, value } }) => (
            <AvailabilityGrid onChange={onChange} value={value} />
          )}
        />
      </View>
    </AppCard>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-[12px] font-black uppercase tracking-[0.8px] text-muted-text">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  footer: {
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  lockedUsername: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  suggestions: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
});
