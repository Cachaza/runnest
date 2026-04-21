import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { useAppTheme } from '@/components/ThemeContext';
import { AppCard, Chip } from '@/components/ui/AppUI';
import { trpc } from '@/lib/trpc';

type RunnerProfile = {
  area?: string | null;
  availability?: string | null;
  availabilitySlots?: AvailabilitySlot[] | null;
  bio?: string | null;
  city?: string | null;
  cityLat?: number | null;
  cityLng?: number | null;
  cityProvince?: string | null;
  citySlug?: string | null;
  distance?: string | null;
  goals?: string | null;
  level?: string | null;
  pace?: string | null;
  username?: string | null;
};

type ChoiceOption = {
  label: string;
  value: string;
};

export type AvailabilityDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type AvailabilityPeriod = 'morning' | 'midday' | 'afternoon' | 'evening';
export type AvailabilitySlot = {
  day: AvailabilityDay;
  period: AvailabilityPeriod;
};

type CitySelection = {
  latitude: number;
  longitude: number;
  municipality: string;
  province: string;
  slug: string;
};

type ProfileFormProps = {
  description: string;
  fallbackUsername?: string | null;
  isLoading?: boolean;
  lockedUsernameCopy?: string;
  onSaved?: () => void;
  profile?: RunnerProfile | null;
  savedMessage?: string;
  submitLabel: string;
  title: string;
};

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

export const LEVEL_OPTIONS: ChoiceOption[] = [
  { label: 'Empiezo ahora', value: 'Principiante' },
  { label: 'Salgo semanal', value: 'Intermedio' },
  { label: 'Plan constante', value: 'Avanzado' },
  { label: 'Competitivo', value: 'Competitivo' },
];

export const DISTANCE_OPTIONS: ChoiceOption[] = [
  { label: '5K', value: '5K' },
  { label: '10K', value: '10K' },
  { label: '15K', value: '15K' },
  { label: 'Media', value: 'Media maratón' },
  { label: 'Maratón', value: 'Maratón' },
];

export const GOAL_OPTIONS: ChoiceOption[] = [
  { label: 'Social', value: 'Conocer gente' },
  { label: 'Primer 10K', value: 'Primer 10K' },
  { label: 'Constancia', value: 'Ser constante' },
  { label: 'Mejorar ritmo', value: 'Mejorar ritmo' },
  { label: 'Carreras', value: 'Preparar carreras' },
];

export const AVAILABILITY_DAYS: { label: string; value: AvailabilityDay }[] = [
  { label: 'L', value: 'mon' },
  { label: 'M', value: 'tue' },
  { label: 'X', value: 'wed' },
  { label: 'J', value: 'thu' },
  { label: 'V', value: 'fri' },
  { label: 'S', value: 'sat' },
  { label: 'D', value: 'sun' },
];

export const AVAILABILITY_PERIODS: { label: string; value: AvailabilityPeriod }[] = [
  { label: 'Mañana', value: 'morning' },
  { label: 'Mediodía', value: 'midday' },
  { label: 'Tarde', value: 'afternoon' },
  { label: 'Noche', value: 'evening' },
];

export function usernameCandidateFrom(value?: string | null) {
  return (
    value
      ?.trim()
      .replace(/^@+/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30) ?? ''
  );
}

function listFromValue(value?: string) {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function toggleListValue(value: string | undefined, nextValue: string) {
  const currentValues = listFromValue(value);
  const nextValues = currentValues.includes(nextValue)
    ? currentValues.filter((item) => item !== nextValue)
    : [...currentValues, nextValue];

  return nextValues.join(', ');
}

function slotKey(slot: AvailabilitySlot) {
  return `${slot.day}:${slot.period}`;
}

function toggleAvailabilitySlot(slots: AvailabilitySlot[], nextSlot: AvailabilitySlot) {
  const nextSlotKey = slotKey(nextSlot);

  if (slots.some((slot) => slotKey(slot) === nextSlotKey)) {
    return slots.filter((slot) => slotKey(slot) !== nextSlotKey);
  }

  return [...slots, nextSlot];
}

function normalizeAvailabilitySlots(slots?: AvailabilitySlot[] | null) {
  return Array.isArray(slots) ? slots : [];
}

export function formatAvailability(slots: AvailabilitySlot[]) {
  if (slots.length === 0) {
    return undefined;
  }

  const dayLabels = new Map(AVAILABILITY_DAYS.map((day) => [day.value, day.label]));
  const periodLabels = new Map(AVAILABILITY_PERIODS.map((period) => [period.value, period.label.toLowerCase()]));

  return AVAILABILITY_DAYS
    .map((day) => {
      const periods = slots
        .filter((slot) => slot.day === day.value)
        .map((slot) => periodLabels.get(slot.period))
        .filter(Boolean);

      return periods.length > 0 ? `${dayLabels.get(day.value)} ${periods.join('/')}` : null;
    })
    .filter(Boolean)
    .join(', ');
}

export function ProfileForm({
  description,
  fallbackUsername,
  isLoading = false,
  lockedUsernameCopy = 'Reservado al crear la cuenta. No se edita desde el perfil.',
  onSaved,
  profile,
  savedMessage = 'Perfil guardado. Tus recomendaciones ya usan estos datos.',
  submitLabel,
  title,
}: ProfileFormProps) {
  const { colors } = useAppTheme();
  const utils = trpc.useUtils();
  const [localSavedMessage, setLocalSavedMessage] = useState<string | null>(null);
  const username = useMemo(
    () => usernameCandidateFrom(profile?.username ?? fallbackUsername),
    [fallbackUsername, profile?.username],
  );
  const upsertProfile = trpc.profile.upsert.useMutation({
    onSuccess: async () => {
      await utils.profile.me.invalidate();
      await utils.communities.recommended.invalidate();
      setLocalSavedMessage(savedMessage);
      onSaved?.();
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
    setValue,
    formState: { errors },
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
  const cityQuery = useWatch({ control, name: 'city' });
  const selectedCity = useWatch({ control, name: 'citySelection' });
  const municipalityQuery = trpc.geo.searchMunicipalities.useQuery(
    { query: cityQuery ?? '', limit: 6 },
    {
      enabled: (cityQuery?.trim().length ?? 0) >= 2 && selectedCity?.municipality !== cityQuery,
      retry: false,
    },
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    reset({
      availability: profile?.availability ?? '',
      availabilitySlots: normalizeAvailabilitySlots(profile?.availabilitySlots),
      bio: profile?.bio ?? '',
      city: profile?.city ?? '',
      citySelection:
        profile?.citySlug && profile.cityProvince && profile.cityLat !== null && profile.cityLng !== null
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
  }, [isLoading, profile, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setLocalSavedMessage(null);
    const city = values.city.trim();
    const citySelection = values.citySelection?.municipality === city ? values.citySelection : undefined;

    if (!citySelection) {
      setError('city', { message: 'Elige una ciudad de la lista.', type: 'manual' });
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

    await upsertProfile.mutateAsync({
      ...parsed.data,
      username: username || undefined,
    });
  });

  return (
    <AppCard>
      <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Perfil runner</Text>
      <Text className="text-[25px] font-black text-text">{title}</Text>
      <Text className="text-[15px] leading-[23px] text-muted-text">{description}</Text>

      <View className="mt-2 gap-1.5">
        <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Username</Text>
        <View style={[styles.lockedUsername, { backgroundColor: colors.chip, borderColor: colors.border }]}>
          <Text className="text-[17px] font-black text-text">@{username || 'pendiente'}</Text>
          <Text className="text-[13px] font-bold leading-[18px] text-muted-text">{lockedUsernameCopy}</Text>
        </View>
      </View>

      <View className="mt-3 gap-4">
        <View className="gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Ciudad</Text>
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
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={value}
                />
                {selectedCity?.municipality === value ? (
                  <Text className="text-[13px] font-bold text-success">
                    {selectedCity.province} · ciudad normalizada
                  </Text>
                ) : null}
                {municipalityQuery.data && municipalityQuery.data.length > 0 ? (
                  <View style={[styles.suggestions, { borderColor: colors.border, backgroundColor: colors.surface }]}>
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
                        <Text className="text-[13px] font-bold text-muted-text">{suggestion.subtitle}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
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
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Nivel</Text>
          <Controller
            control={control}
            name="level"
            render={({ field: { onChange, value } }) => (
              <OptionChips onChange={onChange} options={LEVEL_OPTIONS} value={value} />
            )}
          />
        </View>

        <View className="gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Distancia</Text>
          <Controller
            control={control}
            name="distance"
            render={({ field: { onChange, value } }) => (
              <OptionChips onChange={onChange} options={DISTANCE_OPTIONS} value={value} />
            )}
          />
        </View>

        <View className="gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Zona/Barrio</Text>
          <Controller
            control={control}
            name="area"
            render={({ field: { onChange, value } }) => (
              <TextInput
                autoCapitalize="words"
                onChangeText={onChange}
                placeholder="Retiro, Madrid Río..."
                placeholderTextColor={colors.mutedText}
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={value}
              />
            )}
          />
        </View>

        <View className="gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Metas</Text>
          <Controller
            control={control}
            name="goals"
            render={({ field: { onChange, value } }) => (
              <OptionChips multiselect onChange={onChange} options={GOAL_OPTIONS} value={value} />
            )}
          />
        </View>

        <View className="gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Disponibilidad</Text>
          <Controller
            control={control}
            name="availabilitySlots"
            render={({ field: { onChange, value } }) => (
              <AvailabilityGrid onChange={onChange} value={value} />
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

      {localSavedMessage ? (
        <View style={[styles.successCard, { backgroundColor: colors.chip }]}>
          <Text className="text-sm font-extrabold leading-5 text-success">{localSavedMessage}</Text>
        </View>
      ) : null}

      <Pressable
        disabled={upsertProfile.isPending || isLoading}
        onPress={onSubmit}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : upsertProfile.isPending ? 0.7 : 1 })}
        className="mt-3 items-center rounded-[18px] bg-tint py-4">
        <Text className="text-base font-black text-on-tint">
          {upsertProfile.isPending ? 'Guardando...' : submitLabel}
        </Text>
      </Pressable>
    </AppCard>
  );
}

export function AvailabilityGrid({
  onChange,
  value = [],
}: {
  onChange: (value: AvailabilitySlot[]) => void;
  value?: AvailabilitySlot[];
}) {
  const selectedKeys = new Set(value.map(slotKey));

  return (
    <View className="gap-2">
      <View className="ml-[86px] flex-row gap-1.5">
        {AVAILABILITY_DAYS.map((day) => (
          <View key={day.value} className="h-8 flex-1 items-center justify-center">
            <Text className="text-[11px] font-black text-muted-text">{day.label}</Text>
          </View>
        ))}
      </View>
      {AVAILABILITY_PERIODS.map((period) => (
        <View key={period.value} className="flex-row items-center gap-1.5">
          <Text className="w-20 text-[12px] font-black text-muted-text">{period.label}</Text>
          {AVAILABILITY_DAYS.map((day) => {
            const slot = { day: day.value, period: period.value };
            const selected = selectedKeys.has(slotKey(slot));

            return (
              <Pressable
                key={`${day.value}:${period.value}`}
                accessibilityLabel={`${day.label} ${period.label}`}
                onPress={() => onChange(toggleAvailabilitySlot(value, slot))}
                className={`h-9 flex-1 rounded-xl ${selected ? 'bg-tint' : 'bg-chip'}`}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function OptionChips({
  multiselect = false,
  onChange,
  options,
  value,
}: {
  multiselect?: boolean;
  onChange: (value: string) => void;
  options: ChoiceOption[];
  value?: string;
}) {
  const selectedValues = listFromValue(value);

  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const selected = multiselect ? selectedValues.includes(option.value) : value === option.value;

        return (
          <Chip
            key={option.value}
            selected={selected}
            tone="neutral"
            onPress={() => onChange(multiselect ? toggleListValue(value, option.value) : selected ? '' : option.value)}>
            {option.label}
          </Chip>
        );
      })}
    </View>
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
  lockedUsername: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  successCard: {
    borderRadius: 16,
    marginTop: 4,
    padding: 14,
  },
  suggestions: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
});
