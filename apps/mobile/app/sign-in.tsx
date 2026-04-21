import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
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

const HERO_CHIPS_SIGNUP = ['Crews reales', 'Tu ciudad', 'Quedadas', 'Ritmo compatible'];
const HERO_CHIPS_SIGNIN = ['Tu crew', 'Quedadas', 'Recomendaciones'];

export default function SignInScreen() {
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<AuthMode>('sign-up');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === 'sign-up';

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setShowPassword(false);
  }

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
        ? await authClient.signUp.email({ email: trimmedEmail, name: trimmedUsername, password })
        : await authClient.signIn.email({ email: trimmedEmail, password });

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

  const heroChips = isSignUp ? HERO_CHIPS_SIGNUP : HERO_CHIPS_SIGNIN;

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', default: undefined })}
      className="flex-1 bg-background">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-[18px] pb-[52px] pt-14">

        {/* Hero */}
        <View className="rounded-[34px] bg-hero px-7 pb-8 pt-6">
          <Text className="text-[11px] font-black uppercase tracking-[2px] text-hero-accent">
            AppRunners
          </Text>
          <Text className="mt-5 text-[42px] font-black leading-[46px] text-hero-text">
            {isSignUp
              ? 'Encuentra\ntu crew\nde running.'
              : 'Bienvenido\nde vuelta,\nrunner.'}
          </Text>
          <Text className="mt-3 text-[16px] leading-[25px] text-hero-text-muted">
            {isSignUp
              ? 'Conecta con runners locales. Queda a correr y construye hábito en compañía.'
              : 'Tus recomendaciones, crews y quedadas te están esperando.'}
          </Text>
          <View className="mt-5 flex-row flex-wrap gap-2">
            {heroChips.map((chip) => (
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

          {/* Mode toggle */}
          <View className="flex-row gap-1.5 rounded-full bg-chip p-[5px]">
            <Pressable
              onPress={() => switchMode('sign-up')}
              className={`flex-1 items-center rounded-full py-3 ${isSignUp ? 'bg-tint' : ''}`}>
              <Text className={`text-sm font-black ${isSignUp ? 'text-on-tint' : 'text-text'}`}>
                Crear cuenta
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchMode('sign-in')}
              className={`flex-1 items-center rounded-full py-3 ${!isSignUp ? 'bg-tint' : ''}`}>
              <Text className={`text-sm font-black ${!isSignUp ? 'text-on-tint' : 'text-text'}`}>
                Entrar
              </Text>
            </Pressable>
          </View>

          <Text className="mt-5 text-[26px] font-black leading-8 text-text">
            {isSignUp ? 'Empieza con tu crew' : 'Vuelve a tus quedadas'}
          </Text>
          <Text className="mt-1.5 text-[14px] leading-[21px] text-muted-text">
            {isSignUp
              ? 'Reserva tu username y completa tu perfil runner para encontrar crews compatibles.'
              : 'Entra para ver recomendaciones, apuntarte a quedadas y gestionar tu perfil.'}
          </Text>

          <View className="mt-5 gap-3.5">
            {isSignUp ? (
              <FormField label="Username">
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setUsername}
                  placeholder="@runner_madrid"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={username}
                />
              </FormField>
            ) : null}

            <FormField label="Email">
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
            </FormField>

            <FormField label="Contraseña">
              <View>
                <TextInput
                  autoCapitalize="none"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  onChangeText={setPassword}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor={colors.mutedText}
                  secureTextEntry={!showPassword}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                  ]}
                  value={password}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeToggle}>
                  <FontAwesome6
                    color={colors.mutedText}
                    name={showPassword ? 'eye-slash' : 'eye'}
                    size={15}
                  />
                </Pressable>
              </View>
            </FormField>
          </View>

          {!isSignUp ? (
            <Pressable className="mt-3 self-start" hitSlop={8}>
              <Text className="text-[13px] font-bold text-tint">¿Olvidaste tu contraseña?</Text>
            </Pressable>
          ) : null}

          {error ? (
            <View style={[styles.errorCard, { backgroundColor: colors.chip }]}>
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
            style={({ pressed }) => ({
              opacity: pressed ? 0.85 : submitting ? 0.65 : 1,
            })}
            className="mt-5 items-center rounded-[18px] bg-tint py-[16px]">
            <Text className="text-[15px] font-black text-on-tint">
              {submitting ? 'Conectando...' : isSignUp ? 'Crear cuenta' : 'Entrar'}
            </Text>
          </Pressable>

          {/* Switch mode link */}
          <View className="mt-4 flex-row justify-center gap-1.5">
            <Text className="text-[13px] text-muted-text">
              {isSignUp ? '¿Ya tienes cuenta?' : '¿Nuevo en AppRunners?'}
            </Text>
            <Pressable hitSlop={6} onPress={() => switchMode(isSignUp ? 'sign-in' : 'sign-up')}>
              <Text className="text-[13px] font-black text-tint">
                {isSignUp ? 'Entra aquí' : 'Crear cuenta'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-[12px] font-black uppercase tracking-[0.8px] text-muted-text">{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  errorCard: {
    borderRadius: 14,
    marginTop: 14,
    padding: 14,
  },
  eyeToggle: {
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  passwordInput: {
    paddingRight: 50,
  },
});
