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
  AuthTextInput,
  authFieldStyles,
} from '@/components/AuthFormField';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { useAppTheme } from '@/components/ThemeContext';
import { apiBaseUrl, authClient } from '@/lib/auth-client';

export default function ForgotPasswordScreen() {
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmedEmail = email.trim().toLowerCase();
    setError(null);
    setSubmitted(false);

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Introduce un email válido.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: trimmedEmail,
        redirectTo: `${apiBaseUrl}/auth/reset-password`,
      });

      if (result.error) {
        setError(result.error.message ?? 'No hemos podido enviar el enlace.');
        return;
      }

      setSubmitted(true);
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
            Recuperar acceso
          </Text>
          <Text className="mt-4 text-[34px] font-black leading-[38px] text-hero-text">
            Te mandamos{'\n'}un enlace.
          </Text>
          <Text className="mt-3 text-[15px] leading-[23px] text-hero-text-muted">
            Escribe tu email y te enviaremos un enlace para restablecer la contraseña.
          </Text>
        </View>

        <View className="rounded-[30px] border border-border bg-surface p-5">
          <Text className="text-[26px] font-black leading-8 text-text">Recupera el acceso</Text>
          <Text className="mt-1.5 text-[14px] leading-[21px] text-muted-text">
            Si la cuenta existe, el enlace llegará al email en unos segundos.
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

          {submitted ? (
            <View style={[authFieldStyles.errorCard, { backgroundColor: colors.chip }]}>
              <Text className="text-[13px] font-bold leading-5 text-text">
                Revisa tu correo. Si hay una cuenta con ese email, el enlace llegará en segundos.
              </Text>
            </View>
          ) : null}

          <Pressable
            disabled={submitting}
            onPress={handleSubmit}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : submitting ? 0.65 : 1 })}
            className="mt-5 items-center rounded-[18px] bg-tint py-[16px]">
            <Text className="text-[15px] font-black text-on-tint">
              {submitting ? 'Enviando...' : 'Enviar enlace'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
