import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { useAppTheme } from '@/components/ThemeContext';
import { AppButton, AppCard, Chip, ScreenScroll } from '@/components/ui/AppUI';
import { invalidateCommunityMembershipState } from '@/lib/community-membership-cache';
import {
  descriptionForCommunityKind,
  labelForCommunityKind,
  labelForMode,
  labelForVisibility,
  recommendedSetupForCommunityKind,
} from '@/lib/community-labels';
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
  kind: z.enum(['crew_local', 'creator_community', 'club', 'training_group']),
  mode: z.enum(['collaborative', 'managed']),
  name: z.string().min(2, 'El nombre es obligatorio'),
  pace: z.string().max(32).optional(),
  slug: z
    .string()
    .min(3, 'El slug necesita al menos 3 caracteres')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Usa minúsculas, números y guiones'),
  vibe: z.string().max(80).optional(),
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
  const [hasEditedSlug, setHasEditedSlug] = useState(false);
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
      kind: 'crew_local',
      mode: 'collaborative',
      pace: '',
      slug: '',
      vibe: '',
      visibility: 'public',
    },
  });
  const cityQuery = useWatch({ control, name: 'city' });
  const selectedCity = useWatch({ control, name: 'citySelection' });
  const selectedKind = useWatch({ control, name: 'kind' });
  const selectedMode = useWatch({ control, name: 'mode' });
  const selectedVisibility = useWatch({ control, name: 'visibility' });
  const municipalityQuery = trpc.geo.searchMunicipalities.useQuery(
    { query: cityQuery ?? '', limit: 6 },
    {
      enabled: (cityQuery?.trim().length ?? 0) >= 2 && selectedCity?.municipality !== cityQuery,
      retry: false,
    },
  );

  const modeOptions = useMemo(
    () => [
      { label: 'Colaborativo', value: 'collaborative' as const },
      { label: 'Dirigido', value: 'managed' as const },
    ],
    [],
  );
  const visibilityOptions = useMemo(
    () => [
      { label: 'Pública', value: 'public' as const },
      { label: 'Privada', value: 'private' as const },
    ],
    [],
  );
  const recommendedSetup = useMemo(
    () => recommendedSetupForCommunityKind(selectedKind),
    [selectedKind],
  );

  useEffect(() => {
    setValue('mode', recommendedSetup.mode);
    setValue('visibility', recommendedSetup.visibility);
  }, [recommendedSetup.mode, recommendedSetup.visibility, setValue]);

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
      pace: values.pace?.trim() || undefined,
      slug: values.slug.trim(),
      vibe: values.vibe?.trim() || undefined,
    });

    if (!parsed.success) {
      setFormError('Revisa nombre, slug, ciudad y descripción antes de crear la comunidad.');
      return;
    }

    await createCommunity.mutateAsync({
      citySelection: parsed.data.citySelection,
      description: parsed.data.description,
      kind: parsed.data.kind,
      mode: parsed.data.mode,
      name: parsed.data.name,
      pace: parsed.data.pace,
      slug: parsed.data.slug,
      vibe: parsed.data.vibe,
      visibility: parsed.data.visibility,
    });
  });

  return (
    <ScreenScroll>
      <AppCard>
        <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Nueva comunidad</Text>
        <Text className="text-[30px] font-black leading-9 text-text">Lanza un espacio nuevo en AppRunners.</Text>
        <Text className="text-[15px] leading-[23px] text-muted-text">
          Crea una crew local o una community managed. Después podrás publicar runs, invitar gente y construir tu
          estructura.
        </Text>
      </AppCard>

      <AppCard>
        <Text className="text-[22px] font-black text-text">Identidad</Text>

        <View className="mt-3 gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Nombre</Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <TextInput
                onChangeText={(nextValue) => {
                  onChange(nextValue);
                  if (!hasEditedSlug) {
                    setValue('slug', slugify(nextValue));
                  }
                  setFormError(null);
                }}
                placeholder="Retiro Social Run Club"
                placeholderTextColor={colors.mutedText}
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={value}
              />
            )}
          />
          {errors.name?.message ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.name.message}</Text> : null}
        </View>

        <View className="mt-4 gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Slug</Text>
          <Controller
            control={control}
            name="slug"
            render={({ field: { onChange, value } }) => (
              <TextInput
                autoCapitalize="none"
                onChangeText={(nextValue) => {
                  setHasEditedSlug(true);
                  onChange(slugify(nextValue));
                  setFormError(null);
                }}
                placeholder="retiro-social-run-club"
                placeholderTextColor={colors.mutedText}
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={value}
              />
            )}
          />
          {errors.slug?.message ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.slug.message}</Text> : null}
        </View>

        <View className="mt-4 gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Descripción</Text>
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
                placeholder="Qué tipo de gente entra aquí, qué ritmo se respira y qué tipo de runs se montan."
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
        <Text className="text-[22px] font-black text-text">Tipo y reglas</Text>

        <View className="mt-3 gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Tipo visible</Text>
          <Controller
            control={control}
            name="kind"
            render={({ field: { onChange, value } }) => (
              <View className="gap-2.5">
                {(['crew_local', 'creator_community', 'club', 'training_group'] as const).map((kind) => (
                  <Pressable
                    key={kind}
                    onPress={() => {
                      onChange(kind);
                      setFormError(null);
                    }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
                    className={`rounded-[22px] border p-4 ${value === kind ? 'border-tint bg-chip' : 'border-border bg-background'}`}>
                    <Text className="text-[18px] font-black text-text">{labelForCommunityKind(kind)}</Text>
                    <Text className="mt-1.5 text-[15px] leading-[23px] text-muted-text">
                      {descriptionForCommunityKind(kind)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
          <Text className="text-sm font-bold leading-5 text-muted-text">{recommendedSetup.accessLinkCopy}</Text>
        </View>

        <View className="mt-4 gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Modo operativo</Text>
          <Controller
            control={control}
            name="mode"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row flex-wrap gap-2.5">
                {modeOptions.map((option) => (
                  <Chip
                    key={option.value}
                    selected={value === option.value}
                    onPress={() => {
                      onChange(option.value);
                      setFormError(null);
                    }}>
                    {option.label}
                  </Chip>
                ))}
              </View>
            )}
          />
          <Text className="text-sm font-bold leading-5 text-muted-text">
            {selectedKind === 'crew_local'
              ? 'Para crews locales suele encajar collaborative si quieres que los miembros propongan runs.'
              : 'Para espacios de creator o club suele encajar managed si quieres controlar quién publica runs oficiales.'}
          </Text>
          <Text className="text-sm font-bold leading-5 text-muted-text">
            Selección actual: {labelForMode(selectedMode)}.
          </Text>
        </View>

        <View className="mt-4 gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Visibilidad</Text>
          <Controller
            control={control}
            name="visibility"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row flex-wrap gap-2.5">
                {visibilityOptions.map((option) => (
                  <Chip
                    key={option.value}
                    selected={value === option.value}
                    onPress={() => {
                      onChange(option.value);
                      setFormError(null);
                    }}>
                    {option.label}
                  </Chip>
                ))}
              </View>
            )}
          />
          <Text className="text-sm font-bold leading-5 text-muted-text">
            Selección actual: {labelForVisibility(selectedVisibility)}.
          </Text>
        </View>
      </AppCard>

      <AppCard>
        <Text className="text-[22px] font-black text-text">Ciudad y tono</Text>

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
        </View>

        <View className="mt-4 gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Ritmo orientativo</Text>
          <Controller
            control={control}
            name="pace"
            render={({ field: { onChange, value } }) => (
              <TextInput
                onChangeText={onChange}
                placeholder="5:20/km"
                placeholderTextColor={colors.mutedText}
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={value}
              />
            )}
          />
        </View>

        <View className="mt-4 gap-1.5">
          <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Vibe</Text>
          <Controller
            control={control}
            name="vibe"
            render={({ field: { onChange, value } }) => (
              <TextInput
                onChangeText={onChange}
                placeholder="social, coffee, steady"
                placeholderTextColor={colors.mutedText}
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={value}
              />
            )}
          />
        </View>
      </AppCard>

      {formError ? (
        <View style={[styles.errorCard, { backgroundColor: colors.chip }]}>
          <Text className="text-sm font-extrabold leading-5 text-danger">{formError}</Text>
        </View>
      ) : null}

      <View className="gap-3">
        <AppButton disabled={createCommunity.isPending} onPress={onSubmit}>
          {createCommunity.isPending ? 'Creando...' : 'Crear comunidad'}
        </AppButton>
        <Pressable
          onPress={() => {
            if (createCommunity.isPending) {
              return;
            }
            router.back();
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          className="items-center rounded-[18px] bg-chip py-[15px]">
          <Text className="text-[15px] font-black text-text">Cancelar</Text>
        </Pressable>
      </View>
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
