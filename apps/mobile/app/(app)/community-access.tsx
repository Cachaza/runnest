import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { AppButton, AppCard, ScreenScroll } from '@/components/ui/AppUI';
import { trpc } from '@/lib/trpc';

export default function CommunityAccessScreen() {
  const { colors } = useAppTheme();
  const utils = trpc.useUtils();
  const params = useLocalSearchParams<{ code?: string }>();
  const prefetchedCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const [code, setCode] = useState('');
  const redeemMutation = trpc.communities.redeemAccessLink.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.communities.myMemberships.invalidate(),
        utils.communities.myInvites.invalidate(),
      ]);

      if (result.status === 'joined' || result.status === 'already_member') {
        router.replace(`/crew/${result.communityId}` as any);
        return;
      }

      Alert.alert(
        'Solicitud enviada',
        `Tu acceso a ${result.communityName} queda pendiente de aprobación del staff.`,
      );
      router.back();
    },
    onError: (error) => {
      Alert.alert('No se pudo usar el código', error.message);
    },
  });

  useEffect(() => {
    if (prefetchedCode) {
      setCode(prefetchedCode);
    }
  }, [prefetchedCode]);

  async function handleRedeem() {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      Alert.alert('Falta el código', 'Pega o escribe un código válido de acceso.');
      return;
    }

    await redeemMutation.mutateAsync({ code: trimmedCode });
  }

  return (
    <ScreenScroll>
      <AppCard>
        <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Entrar con código</Text>
        <Text className="text-[30px] font-black leading-9 text-text">Canjea un access link desde móvil.</Text>
        <Text className="text-[15px] leading-[23px] text-muted-text">
          Pega el código que te haya compartido una community, club o creator. Si el link requiere aprobación,
          la solicitud se enviará al staff.
        </Text>

        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setCode}
          placeholder="ALEJANDRO-LAB"
          placeholderTextColor={colors.mutedText}
          style={{
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
            borderRadius: 16,
            borderWidth: 1,
            color: colors.text,
            fontSize: 16,
            marginTop: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
          value={code}
        />
      </AppCard>

      <View className="gap-3">
        <AppButton disabled={redeemMutation.isPending} onPress={handleRedeem}>
          {redeemMutation.isPending ? 'Validando...' : 'Usar código'}
        </AppButton>
        <AppButton
          disabled={redeemMutation.isPending}
          onPress={() => router.back()}
          tone="secondary">
          Cancelar
        </AppButton>
      </View>
    </ScreenScroll>
  );
}
