import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  AuthFormField,
  AuthPasswordInput,
  AuthTextInput,
  authFieldStyles,
} from '@/components/AuthFormField';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { useAppTheme } from '@/components/ThemeContext';
import { authClient } from '@/lib/auth-client';
import { queryClient } from '@/lib/trpc';

const HERO_CHIPS = ['Crews reales', 'Tu ciudad', 'Ritmo compatible'];

export default function SignUpScreen() {
  const { colors } = useAppTheme();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmedUsername = username.trim().replace(/^@+/, '').toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();
    setError(null);

    if (trimmedUsername.length < 3) {
      setError('El username debe tener al menos 3 caracteres.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
      setError('El username solo puede tener letras, números y guiones bajos.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Introduce un email válido.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await authClient.signUp.email({
        email: trimmedEmail,
        name: trimmedUsername,
        password,
      });

      if (result.error) {
        setError(result.error.message ?? 'No hemos podido crear la cuenta.');
        return;
      }

      setPassword('');
      await queryClient.invalidateQueries();
      router.replace('/onboarding');
    } catch {
      setError('No se pudo conectar con AppRunners. Revisa la API e inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', default: undefined })}
      className="flex-1 bg-background">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-[18px] pb-[52px] pt-14">
        <View className="flex-row">
          <HeaderBackButton onPress={() => router.back()} />
        </View>

        {/* Hero compacto */}
        <View className="rounded-[34px] bg-hero px-7 pb-7 pt-6">
          <Text className="text-[11px] font-black uppercase tracking-[2px] text-hero-accent">
            AppRunners
          </Text>
          <Text className="mt-4 text-[34px] font-black leading-[38px] text-hero-text">
            Empieza con{'\n'}tu crew.
          </Text>
          <Text className="mt-3 text-[15px] leading-[23px] text-hero-text-muted">
            Reserva tu username y encuentra runners compatibles.
          </Text>
          <View className="mt-4 flex-row flex-wrap gap-2">
            {HERO_CHIPS.map((chip) => (
              <View key={chip} className="rounded-full bg-hero-accent px-3 py-2">
                <Text className="text-xs font-black uppercase tracking-[0.4px] text-on-accent">
                  {chip}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Form card */}
        <View className="rounded-[30px] border border-border bg-surface p-5">
          <Text className="text-[26px] font-black leading-8 text-text">Crear cuenta</Text>
          <Text className="mt-1.5 text-[14px] leading-[21px] text-muted-text">
            Reserva tu username y completa tu perfil runner para empezar.
          </Text>

          <View className="mt-5 gap-3.5">
            <AuthFormField label="Username">
              <AuthTextInput
                autoCapitalize="none"
                onChangeText={setUsername}
                placeholder="@runner_madrid"
                value={username}
              />
            </AuthFormField>

            <AuthFormField label="Email">
              <AuthTextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="runner@email.com"
                value={email}
              />
            </AuthFormField>

            <AuthFormField label="Contraseña">
              <AuthPasswordInput
                autoComplete="new-password"
                onChangeText={setPassword}
                placeholder="Mínimo 8 caracteres"
                value={password}
              />
            </AuthFormField>
          </View>

          {error ? (
            <View style={[authFieldStyles.errorCard, { backgroundColor: colors.chip }]}>
              <View className="flex-row items-start gap-2">
                <FontAwesome6
                  color={colors.danger}
                  name="triangle-exclamation"
                  size={12}
                  style={{ marginTop: 2 }}
                />
                <Text className="flex-1 text-[13px] font-bold leading-5 text-danger">{error}</Text>
              </View>
            </View>
          ) : null}

          <Pressable
            disabled={submitting}
            onPress={handleSubmit}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : submitting ? 0.65 : 1 })}
            className="mt-5 items-center rounded-[18px] bg-tint py-[16px]">
            <Text className="text-[15px] font-black text-on-tint">
              {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </Text>
          </Pressable>

          <View className="mt-4 flex-row justify-center gap-1.5">
            <Text className="text-[13px] text-muted-text">¿Ya tienes cuenta?</Text>
            <Pressable hitSlop={6} onPress={() => router.replace('/(auth)/sign-in')}>
              <Text className="text-[13px] font-black text-tint">Entra aquí</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
