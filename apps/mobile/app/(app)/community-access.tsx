import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, TextInput } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { AppButton, AppCard, ScreenScroll } from '@/components/ui/AppUI';
import { invalidateCommunityMembershipState } from '@/lib/community-membership-cache';
import { trpc } from '@/lib/trpc';

export default function CommunityAccessScreen() {
  const { colors } = useAppTheme();
  const utils = trpc.useUtils();
  const params = useLocalSearchParams<{ code?: string }>();
  const prefetchedCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const [code, setCode] = useState('');
  const redeemMutation = trpc.communities.redeemAccessLink.useMutation({
    onSuccess: async (result) => {
      await invalidateCommunityMembershipState(utils, { communityId: result.communityId });

      if (result.status === 'joined' || result.status === 'already_member') {
        router.replace(`/crew/${result.communityId}` as any);
        return;
      }

      Alert.alert(
        'Solicitud enviada',
        `El equipo de ${result.communityName} tiene que aprobarte. Te avisamos en cuanto lo revisen.`,
      );
      router.replace('/communities');
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
      Alert.alert('Falta el código', 'Pega o escribe el código que te compartieron.');
      return;
    }

    await redeemMutation.mutateAsync({ code: trimmedCode });
  }

  return (
    <ScreenScroll>
      <AppCard>
        <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Entrar con código</Text>
        <Text className="text-[30px] font-black leading-9 text-text">Pega el código que te pasaron.</Text>
        <Text className="text-[15px] leading-[23px] text-muted-text">
          Escribe o pega el código que alguien del grupo te haya compartido. Si hace falta aprobación, te avisamos cuando te acepten.
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

      <AppButton disabled={redeemMutation.isPending} onPress={handleRedeem}>
        {redeemMutation.isPending ? 'Validando…' : 'Entrar con este código'}
      </AppButton>
    </ScreenScroll>
  );
}
