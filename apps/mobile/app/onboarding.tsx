import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
import { ScreenScroll } from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
import { queryClient, trpc } from '@/lib/trpc';

type CitySelection = {
  latitude: number;
  longitude: number;
  municipality: string;
  province: string;
  slug: string;
};

type FormState = {
  city: string;
  citySelection: CitySelection | undefined;
  area: string;
  pace: string;
  level: string;
  distance: string;
  availabilitySlots: AvailabilitySlot[];
  goals: string;
  bio: string;
};

const PACE_OPTIONS = [
  { label: '< 4:00/km', value: '< 4:00/km' },
  { label: '4:00–4:30', value: '4:15/km' },
  { label: '4:30–5:00', value: '4:45/km' },
  { label: '5:00–5:30', value: '5:15/km' },
  { label: '5:30–6:00', value: '5:45/km' },
  { label: '6:00–6:30', value: '6:15/km' },
  { label: '> 6:30/km', value: '> 6:30/km' },
];

const TOTAL_STEPS = 4;

const STEP_CONFIG = [
  {
    step: 1,
    kicker: 'Paso 1 de 4 · Dónde corres',
    title: 'Tu ciudad\nrunner.',
    body: 'Dinos dónde corres para encontrar crews y quedadas cerca de ti.',
    chips: ['Ciudad', 'Barrio', 'Zona'],
  },
  {
    step: 2,
    kicker: 'Paso 2 de 4 · Cómo corres',
    title: 'Tu ritmo\ny nivel.',
    body: 'Conectamos runners por ritmo. Sin presiones, solo compatibilidad real.',
    chips: ['5K', '10K', 'Media', 'Maratón'],
  },
  {
    step: 3,
    kicker: 'Paso 3 de 4 · Cuándo corres',
    title: 'Tu horario\nde running.',
    body: 'Marca cuándo sueles salir a correr para que encontremos crews con tu mismo hueco.',
    chips: ['Mañanas', 'Tardes', 'Fines de semana'],
  },
  {
    step: 4,
    kicker: 'Paso 4 de 4 · Qué buscas',
    title: 'Tus metas\ny tu crew.',
    body: 'Cuéntanos qué buscas para que las recomendaciones sean de verdad tuyas.',
    chips: ['Social', 'Constancia', 'Carreras'],
  },
];

export default function OnboardingScreen() {
  const { colors } = useAppTheme();
  const { data: session } = authClient.useSession();
  const username = usernameCandidateFrom(session?.user.name || session?.user.email?.split('@')[0]);

  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    city: '',
    citySelection: undefined,
    area: '',
    pace: '',
    level: '',
    distance: '',
    availabilitySlots: [],
    goals: '',
    bio: '',
  });

  const upsertProfile = trpc.profile.upsert.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.replace('/');
    },
    onError: (error) => {
      Alert.alert('No se pudo guardar el perfil', error.message);
    },
  });

  function handleNext() {
    setStepError(null);

    if (step === 1 && (!form.citySelection || form.citySelection.municipality !== form.city)) {
      setStepError('Elige tu ciudad de la lista de sugerencias.');
      return;
    }
    if (step === 2 && !form.pace) {
      setStepError('Elige tu rango de ritmo para que podamos conectarte con crews compatibles.');
      return;
    }

    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  }

  async function handleSubmit() {
    const slots = form.availabilitySlots;
    await upsertProfile.mutateAsync({
      username: username || undefined,
      city: form.city,
      citySelection: form.citySelection!,
      area: form.area.trim() || undefined,
      pace: form.pace.trim(),
      level: form.level || undefined,
      distance: form.distance || undefined,
      availability: formatAvailability(slots),
      availabilitySlots: slots,
      goals: form.goals || undefined,
      bio: form.bio.trim() || undefined,
    });
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

  const config = STEP_CONFIG[step - 1];

  return (
    <ScreenScroll>
      {/* Hero */}
      <View className="rounded-[34px] bg-hero px-7 pb-8 pt-6">
        <Text className="text-[11px] font-black uppercase tracking-[1.6px] text-hero-accent">
          {config.kicker}
        </Text>
        <Text className="mt-4 text-[40px] font-black leading-[44px] text-hero-text">
          {config.title}
        </Text>
        <Text className="mt-3 text-[16px] leading-[24px] text-hero-text-muted">{config.body}</Text>
        <View className="mt-5 flex-row flex-wrap gap-2">
          {config.chips.map((chip) => (
            <View key={chip} className="rounded-full bg-hero-accent px-3 py-2">
              <Text className="text-xs font-black uppercase tracking-[0.4px] text-on-accent">
                {chip}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Progress bar */}
      <View className="flex-row gap-2 px-1">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            className={`h-[5px] flex-1 rounded-full ${i < step ? 'bg-tint' : 'bg-chip'}`}
          />
        ))}
      </View>

      {/* Step card */}
      <View className="rounded-[30px] border border-border bg-surface p-5">
        {step === 1 && (
          <StepCiudad
            colors={colors}
            form={form}
            setForm={setForm}
          />
        )}
        {step === 2 && <StepRitmo form={form} setForm={setForm} />}
        {step === 3 && <StepDisponibilidad form={form} setForm={setForm} />}
        {step === 4 && <StepMetas colors={colors} form={form} setForm={setForm} />}

        {stepError ? (
          <View style={[onbStyles.errorCard, { backgroundColor: colors.chip }]}>
            <View className="flex-row items-start gap-2">
              <FontAwesome6
                color={colors.danger}
                name="triangle-exclamation"
                size={12}
                style={{ marginTop: 2 }}
              />
              <Text className="flex-1 text-[13px] font-bold leading-5 text-danger">{stepError}</Text>
            </View>
          </View>
        ) : null}

        {/* Navigation */}
        <View className="mt-5 flex-row gap-3">
          {step > 1 ? (
            <Pressable
              onPress={() => {
                setStep((s) => s - 1);
                setStepError(null);
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              className="items-center justify-center rounded-[18px] border border-border bg-chip px-5 py-[16px]">
              <FontAwesome6 color={colors.text} name="chevron-left" size={14} />
            </Pressable>
          ) : null}
          <Pressable
            disabled={upsertProfile.isPending}
            onPress={handleNext}
            style={({ pressed }) => ({
              opacity: pressed ? 0.85 : upsertProfile.isPending ? 0.65 : 1,
            })}
            className="flex-1 items-center rounded-[18px] bg-tint py-[16px]">
            <Text className="text-[15px] font-black text-on-tint">
              {upsertProfile.isPending
                ? 'Guardando...'
                : step === TOTAL_STEPS
                  ? 'Entrar a AppRunners'
                  : 'Siguiente →'}
            </Text>
          </Pressable>
        </View>

        <View className="mt-3 items-center">
          <Pressable hitSlop={8} onPress={handleSignOut}>
            <Text className="text-[13px] font-bold text-muted-text">Cerrar sesión</Text>
          </Pressable>
        </View>
      </View>
    </ScreenScroll>
  );
}

// ── Step 1: Ciudad ────────────────────────────────────────────────────────────

function StepCiudad({
  colors,
  form,
  setForm,
}: {
  colors: ReturnType<typeof useAppTheme>['colors'];
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const municipalityQuery = trpc.geo.searchMunicipalities.useQuery(
    { query: form.city, limit: 6 },
    {
      enabled: (form.city?.trim().length ?? 0) >= 2 && form.citySelection?.municipality !== form.city,
      retry: false,
    },
  );

  return (
    <View className="gap-4">
      <StepTitle>Dónde corres</StepTitle>

      <StepField label="Ciudad">
        <TextInput
          autoCapitalize="words"
          onChangeText={(v) =>
            setForm((f) => ({ ...f, city: v, citySelection: undefined }))
          }
          placeholder="Madrid"
          placeholderTextColor={colors.mutedText}
          style={[onbStyles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          value={form.city}
        />
        {form.citySelection?.municipality === form.city ? (
          <Text className="mt-1 text-[13px] font-bold text-success">
            {form.citySelection.province} · ciudad normalizada
          </Text>
        ) : null}
        {municipalityQuery.data && municipalityQuery.data.length > 0 ? (
          <View style={[onbStyles.suggestions, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {municipalityQuery.data.map((s) => (
              <Pressable
                key={s.id}
                onPress={() =>
                  setForm((f) => ({
                    ...f,
                    city: s.municipality,
                    citySelection: {
                      latitude: s.latitude,
                      longitude: s.longitude,
                      municipality: s.municipality,
                      province: s.province,
                      slug: s.slug,
                    },
                  }))
                }
                className="px-4 py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-[15px] font-black text-text">{s.label}</Text>
                <Text className="text-[13px] font-bold text-muted-text">{s.subtitle}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </StepField>

      <StepField label="Zona o barrio (opcional)">
        <TextInput
          autoCapitalize="words"
          onChangeText={(v) => setForm((f) => ({ ...f, area: v }))}
          placeholder="Retiro, Madrid Río, Gràcia..."
          placeholderTextColor={colors.mutedText}
          style={[onbStyles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          value={form.area}
        />
      </StepField>
    </View>
  );
}

// ── Step 2: Ritmo ─────────────────────────────────────────────────────────────

function StepRitmo({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <View className="gap-4">
      <StepTitle>Tu ritmo runner</StepTitle>

      <StepField label="Ritmo cómodo por km">
        <OptionChips
          onChange={(v) => setForm((f) => ({ ...f, pace: v }))}
          options={PACE_OPTIONS}
          value={form.pace}
        />
      </StepField>

      <StepField label="Nivel">
        <OptionChips
          onChange={(v) => setForm((f) => ({ ...f, level: v }))}
          options={LEVEL_OPTIONS}
          value={form.level}
        />
      </StepField>

      <StepField label="Distancia habitual">
        <OptionChips
          onChange={(v) => setForm((f) => ({ ...f, distance: v }))}
          options={DISTANCE_OPTIONS}
          value={form.distance}
        />
      </StepField>
    </View>
  );
}

// ── Step 3: Disponibilidad ────────────────────────────────────────────────────

function StepDisponibilidad({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <View className="gap-4">
      <StepTitle>Cuándo corres</StepTitle>
      <Text className="text-[14px] leading-[21px] text-muted-text">
        Opcional pero muy útil: marca los días y franjas en que sueles salir a correr.
      </Text>
      <AvailabilityGrid
        onChange={(slots) => setForm((f) => ({ ...f, availabilitySlots: slots }))}
        value={form.availabilitySlots}
      />
    </View>
  );
}

// ── Step 4: Metas ─────────────────────────────────────────────────────────────

function StepMetas({
  colors,
  form,
  setForm,
}: {
  colors: ReturnType<typeof useAppTheme>['colors'];
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <View className="gap-4">
      <StepTitle>Qué buscas</StepTitle>

      <StepField label="Metas (puedes elegir varias)">
        <OptionChips
          multiselect
          onChange={(v) => setForm((f) => ({ ...f, goals: v }))}
          options={GOAL_OPTIONS}
          value={form.goals}
        />
      </StepField>

      <StepField label="Cuéntanos más (opcional)">
        <TextInput
          autoCapitalize="sentences"
          multiline
          onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
          placeholder="Rodajes sociales, preparar 10K, encontrar crew de barrio..."
          placeholderTextColor={colors.mutedText}
          style={[onbStyles.input, onbStyles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          value={form.bio}
        />
      </StepField>
    </View>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function StepTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-[22px] font-black leading-7 text-text">{children}</Text>
  );
}

function StepField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-[12px] font-black uppercase tracking-[0.8px] text-muted-text">{label}</Text>
      {children}
    </View>
  );
}

const onbStyles = StyleSheet.create({
  errorCard: {
    borderRadius: 14,
    marginTop: 14,
    padding: 14,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  suggestions: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
});
