import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { authClient } from '@/lib/auth-client';
import { queryClient } from '@/lib/trpc';

type AuthMode = 'sign-up' | 'sign-in';

export default function SignInScreen() {
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<AuthMode>('sign-up');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === 'sign-up';

  async function handleSubmit() {
    const trimmedUsername = username.trim().replace(/^@+/, '').toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    setError(null);

    if (isSignUp && trimmedUsername.length < 3) {
      setError('El username debe tener al menos 3 caracteres.');
      return;
    }

    if (isSignUp && !/^[a-z0-9_]+$/.test(trimmedUsername)) {
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
      const result = isSignUp
        ? await authClient.signUp.email({
            email: trimmedEmail,
            name: trimmedUsername,
            password,
          })
        : await authClient.signIn.email({
            email: trimmedEmail,
            password,
          });

      if (result.error) {
        setError(result.error.message ?? 'No hemos podido iniciar sesión.');
        return;
      }

      setPassword('');
      await queryClient.invalidateQueries();
      router.replace(isSignUp ? '/onboarding' : '/');
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
        contentContainerClassName="gap-[18px] px-[18px] pb-[42px] pt-16">
        <View className="min-h-[270px] rounded-[34px] bg-hero p-6">
          <Text className="text-xs font-black uppercase tracking-[1.4px] text-hero-accent">AppRunners</Text>
          <Text className="mt-[18px] text-[42px] font-black leading-[46px] text-hero-text">
            Encuentra crews reales cerca de ti.
          </Text>
          <Text className="mt-3.5 text-[17px] leading-[25px] text-hero-text-muted">
            Quedadas, ritmos compatibles y planes para correr en compañía.
          </Text>

          <View className="mt-6 flex-row flex-wrap gap-2.5">
            {['Madrid', 'Crews', 'Meetups'].map((chip) => (
              <View key={chip} className="rounded-full bg-hero-accent px-3 py-[9px]">
                <Text className="text-xs font-black uppercase tracking-[0.4px] text-[#1A1410]">{chip}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="rounded-[30px] border border-border bg-surface p-[18px]">
          <View className="flex-row gap-1.5 rounded-full bg-chip p-[5px]">
            <Pressable
              onPress={() => {
                setMode('sign-up');
                setError(null);
              }}
              className={`flex-1 items-center rounded-full py-3 ${isSignUp ? 'bg-tint' : ''}`}>
              <Text className={`text-sm font-black ${isSignUp ? 'text-[#FFF8EC]' : 'text-text'}`}>
                Crear cuenta
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode('sign-in');
                setError(null);
              }}
              className={`flex-1 items-center rounded-full py-3 ${!isSignUp ? 'bg-tint' : ''}`}>
              <Text className={`text-sm font-black ${!isSignUp ? 'text-[#FFF8EC]' : 'text-text'}`}>
                Entrar
              </Text>
            </Pressable>
          </View>

          <Text className="mt-[22px] text-[26px] font-black leading-8 text-text">
            {isSignUp ? 'Empieza con tu crew' : 'Vuelve a tus quedadas'}
          </Text>
          <Text className="mt-2 text-[15px] leading-[22px] text-muted-text">
            {isSignUp
              ? 'Reserva tu username y luego completa ciudad, ritmo y preferencias.'
              : 'Entra para ver recomendaciones, apuntarte a quedadas y editar tu perfil runner.'}
          </Text>

          <View className="mt-4 gap-3">
            {isSignUp ? (
              <View className="gap-1.5">
                <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Username</Text>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setUsername}
                  placeholder="@runner_madrid"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={username}
                />
              </View>
            ) : null}

            <View className="gap-1.5">
              <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="runner@email.com"
                placeholderTextColor={colors.mutedText}
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={email}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-[13px] font-black uppercase tracking-[0.7px] text-muted-text">Contraseña</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                onChangeText={setPassword}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={colors.mutedText}
                secureTextEntry
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={password}
              />
            </View>
          </View>

          {error ? (
            <View style={[styles.errorCard, { backgroundColor: colors.chip }]}>
              <Text className="text-sm font-bold leading-5 text-danger">{error}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={submitting}
            onPress={handleSubmit}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : submitting ? 0.7 : 1 })}
            className={`mt-[18px] items-center rounded-[18px] bg-tint py-4`}>
            <Text className="text-base font-black text-[#FFF8EC]">
              {submitting ? 'Conectando...' : isSignUp ? 'Crear cuenta' : 'Entrar'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  errorCard: {
    borderRadius: 16,
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
});
