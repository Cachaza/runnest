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

const HERO_CHIPS = ['Tu crew', 'Quedadas', 'Recomendaciones'];

export default function SignInScreen() {
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmedEmail = email.trim().toLowerCase();
    setError(null);

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
      const result = await authClient.signIn.email({
        email: trimmedEmail,
        password,
      });

      if (result.error) {
        setError(result.error.message ?? 'No hemos podido iniciar sesión.');
        return;
      }

      setPassword('');
      await queryClient.invalidateQueries();
      router.replace('/');
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
            Bienvenido{'\n'}de vuelta,{'\n'}runner.
          </Text>
          <Text className="mt-3 text-[15px] leading-[23px] text-hero-text-muted">
            Tus recomendaciones, crews y quedadas te están esperando.
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
          <Text className="text-[26px] font-black leading-8 text-text">Vuelve a tus quedadas</Text>
          <Text className="mt-1.5 text-[14px] leading-[21px] text-muted-text">
            Entra para ver recomendaciones, apuntarte a quedadas y gestionar tu perfil.
          </Text>

          <View className="mt-5 gap-3.5">
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
                autoComplete="current-password"
                onChangeText={setPassword}
                placeholder="Mínimo 8 caracteres"
                value={password}
              />
            </AuthFormField>
          </View>

          <Pressable className="mt-3 self-start" hitSlop={8}>
            <Text className="text-[13px] font-bold text-tint">¿Olvidaste tu contraseña?</Text>
          </Pressable>

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
              {submitting ? 'Entrando...' : 'Entrar'}
            </Text>
          </Pressable>

          <View className="mt-4 flex-row justify-center gap-1.5">
            <Text className="text-[13px] text-muted-text">¿Nuevo en AppRunners?</Text>
            <Pressable hitSlop={6} onPress={() => router.replace('/(auth)/sign-up')}>
              <Text className="text-[13px] font-black text-tint">Crear cuenta</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
