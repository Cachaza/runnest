import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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
  authFieldStyles,
} from '@/components/AuthFormField';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { useAppTheme } from '@/components/ThemeContext';
import { authClient } from '@/lib/auth-client';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ error?: string; token?: string }>();
  const token = useMemo(
    () => (Array.isArray(params.token) ? params.token[0] : params.token) ?? '',
    [params.token],
  );
  const tokenError = useMemo(
    () => (Array.isArray(params.error) ? params.error[0] : params.error) ?? null,
    [params.error],
  );
  const { colors } = useAppTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(tokenError ? 'Ese enlace no es válido o ha caducado.' : null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!token) {
      setError('Falta el token de recuperación.');
      return;
    }

    if (password.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(result.error.message ?? 'No hemos podido cambiar la contraseña.');
        return;
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
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

        <View className="rounded-[34px] bg-hero px-7 pb-7 pt-6">
          <Text className="text-[11px] font-black uppercase tracking-[2px] text-hero-accent">
            Nueva contraseña
          </Text>
          <Text className="mt-4 text-[34px] font-black leading-[38px] text-hero-text">
            Vuelve a{'\n'}entrar rápido.
          </Text>
          <Text className="mt-3 text-[15px] leading-[23px] text-hero-text-muted">
            Elige una contraseña nueva y vuelve al grupo sin perder el ritmo.
          </Text>
        </View>

        <View className="rounded-[30px] border border-border bg-surface p-5">
          <Text className="text-[26px] font-black leading-8 text-text">Elige una contraseña nueva</Text>
          <Text className="mt-1.5 text-[14px] leading-[21px] text-muted-text">
            Mínimo 8 caracteres. Después entras directo al grupo.
          </Text>

          <View className="mt-5 gap-3.5">
            <AuthFormField label="Nueva contraseña">
              <AuthPasswordInput
                autoComplete="new-password"
                onChangeText={setPassword}
                placeholder="Mínimo 8 caracteres"
                value={password}
              />
            </AuthFormField>

            <AuthFormField label="Repite la contraseña">
              <AuthPasswordInput
                autoComplete="new-password"
                onChangeText={setConfirmPassword}
                placeholder="Repite la contraseña"
                value={confirmPassword}
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

          {success ? (
            <View style={[authFieldStyles.errorCard, { backgroundColor: colors.chip }]}>
              <Text className="text-[13px] font-bold leading-5 text-text">
                Contraseña actualizada. Ya puedes entrar con la nueva clave.
              </Text>
            </View>
          ) : null}

          <Pressable
            disabled={submitting}
            onPress={handleSubmit}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : submitting ? 0.65 : 1 })}
            className="mt-5 items-center rounded-[18px] bg-tint py-[16px]">
            <Text className="text-[15px] font-black text-on-tint">
              {submitting ? 'Guardando...' : 'Guardar contraseña'}
            </Text>
          </Pressable>

          {success ? (
            <Pressable
              className="mt-3 self-start"
              hitSlop={8}
              onPress={() => router.replace('/(auth)/sign-in')}>
              <Text className="text-[13px] font-bold text-tint">Ir al inicio de sesión</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
