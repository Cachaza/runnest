import { useState } from 'react';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { useAppTheme } from '@/components/ThemeContext';
import { AppButton, AppCard, Chip, ScreenScroll } from '@/components/ui/AppUI';
import { invalidateCommunityMembershipState } from '@/lib/community-membership-cache';
import { labelForVisibility } from '@/lib/community-labels';
import { trpc } from '@/lib/trpc';

const communitySchema = z.object({
  city: z.string().min(2, 'La ciudad es obligatoria'),
  citySelection: z.object({
    latitude: z.number(),
    longitude: z.number(),
    municipality: z.string().min(2),
    province: z.string().min(2),
    slug: z.string().min(2),
  }),
  description: z.string().min(8, 'La descripción es obligatoria'),
  name: z.string().min(2, 'El nombre es obligatorio'),
  visibility: z.enum(['public', 'private']),
});

type CommunityFormValues = z.infer<typeof communitySchema>;

function slugify(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export default function CommunityNewScreen() {
  const { colors } = useAppTheme();
  const utils = trpc.useUtils();
  const [formError, setFormError] = useState<string | null>(null);
  const createCommunity = trpc.communities.create.useMutation({
    onSuccess: async (createdCommunity) => {
      await invalidateCommunityMembershipState(utils, { communityId: createdCommunity.id });
      router.replace(`/crew/${createdCommunity.id}` as any);
    },
    onError: (error) => {
      setFormError(error.message);
    },
  });
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CommunityFormValues>({
    defaultValues: {
      city: '',
      description: '',
      name: '',
      visibility: 'public',
    },
  });
  const cityQuery = useWatch({ control, name: 'city' });
  const selectedCity = useWatch({ control, name: 'citySelection' });
  const selectedVisibility = useWatch({ control, name: 'visibility' });
  const municipalityQuery = trpc.geo.searchMunicipalities.useQuery(
    { query: cityQuery ?? '', limit: 6 },
    {
      enabled: (cityQuery?.trim().length ?? 0) >= 2 && selectedCity?.municipality !== cityQuery,
      retry: false,
    },
  );

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const citySelection =
      values.citySelection?.municipality === values.city.trim() ? values.citySelection : undefined;

    if (!citySelection) {
      setFormError('Selecciona una ciudad válida de la lista.');
      return;
    }

    const parsed = communitySchema.safeParse({
      ...values,
      city: values.city.trim(),
      citySelection,
      description: values.description.trim(),
      name: values.name.trim(),
    });

    if (!parsed.success) {
      Alert.alert('Revisa el grupo', 'Completa nombre, descripción y ciudad antes de seguir.');
      return;
    }

    await createCommunity.mutateAsync({
      citySelection: parsed.data.citySelection,
      description: parsed.data.description,
      kind: 'crew_local',
      mode: 'collaborative',
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
      visibility: parsed.data.visibility,
    });
  });

  return (
    <ScreenScroll title="Crear grupo">
      <AppCard>
        <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Crear grupo</Text>
        <Text className="text-[30px] font-black leading-9 text-text">Crea el grupo con lo básico.</Text>
        <Text className="text-[15px] leading-[23px] text-muted-text">
          Nombre, ciudad, si es privado o público y una descripción. Luego lo demás lo arreglamos desde las quedadas.
        </Text>
      </AppCard>

      <AppCard>
        <Text className="text-[22px] font-black text-text">Lo básico</Text>

        <View className="mt-3 gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Nombre</Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <TextInput
                onChangeText={(nextValue) => {
                  onChange(nextValue);
                  setFormError(null);
                }}
                placeholder="Retiro Sunday Run"
                placeholderTextColor={colors.mutedText}
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={value}
              />
            )}
          />
          {errors.name?.message ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.name.message}</Text> : null}
        </View>

        <View className="mt-4 gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Descripción breve</Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <TextInput
                multiline
                onChangeText={(nextValue) => {
                  onChange(nextValue);
                  setFormError(null);
                }}
                placeholder="Grupo para coordinar la tirada del domingo, pasar lista rápido e invitar a gente nueva."
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
          {errors.description?.message ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{errors.description.message}</Text>
          ) : null}
        </View>
      </AppCard>

      <AppCard>
        <Text className="text-[22px] font-black text-text">Ubicación y visibilidad</Text>

        <View className="mt-3 gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Ciudad</Text>
          <Controller
            control={control}
            name="city"
            render={({ field: { onChange, value } }) => (
              <View>
                <TextInput
                  autoCapitalize="words"
                  onChangeText={(nextValue) => {
                    onChange(nextValue);
                    setValue('citySelection', undefined as any);
                    setFormError(null);
                  }}
                  placeholder="Madrid"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={value}
                />
                {selectedCity?.municipality === value ? (
                  <Text className="mt-2 text-sm font-bold text-muted-text">
                    {selectedCity.municipality}, {selectedCity.province}
                  </Text>
                ) : null}
                {municipalityQuery.data && municipalityQuery.data.length > 0 ? (
                  <View className="mt-2 gap-2">
                    {municipalityQuery.data.map((suggestion) => (
                      <Pressable
                        key={suggestion.slug}
                        onPress={() => {
                          onChange(suggestion.municipality);
                          setValue('citySelection', {
                            latitude: suggestion.latitude,
                            longitude: suggestion.longitude,
                            municipality: suggestion.municipality,
                            province: suggestion.province,
                            slug: suggestion.slug,
                          });
                          setFormError(null);
                        }}
                        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                        className="rounded-2xl bg-chip px-4 py-3">
                        <Text className="text-sm font-black text-text">
                          {suggestion.municipality}, {suggestion.province}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          />
          {errors.city?.message ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.city.message}</Text> : null}
        </View>

        <View className="mt-4 gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Visibilidad</Text>
          <Controller
            control={control}
            name="visibility"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row flex-wrap gap-2.5">
                {(['public', 'private'] as const).map((visibility) => (
                  <Chip
                    key={visibility}
                    selected={value === visibility}
                    onPress={() => {
                      onChange(visibility);
                      setFormError(null);
                    }}>
                    {labelForVisibility(visibility)}
                  </Chip>
                ))}
              </View>
            )}
          />
          <Text className="text-sm font-bold leading-5 text-muted-text">
            {selectedVisibility === 'public'
              ? 'Cualquiera puede entrar y ver las salidas. Para grupos que quieren crecer.'
              : 'Solo entra gente por invitación, solicitud o código. Para grupos privados.'}
          </Text>
        </View>
      </AppCard>

      {formError ? (
        <View style={[styles.errorCard, { backgroundColor: colors.chip }]}>
          <Text className="text-sm font-extrabold leading-5 text-danger">{formError}</Text>
        </View>
      ) : null}

      <AppButton disabled={createCommunity.isPending} onPress={onSubmit}>
        {createCommunity.isPending ? 'Creando…' : 'Crear grupo'}
      </AppButton>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  errorCard: {
    borderRadius: 16,
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textArea: {
    minHeight: 112,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
});
