import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { ProfileForm, usernameCandidateFrom } from '@/components/ProfileForm';
import { HeroPanel, ScreenScroll } from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
import { queryClient, trpc } from '@/lib/trpc';

export default function OnboardingScreen() {
  const { data: session } = authClient.useSession();
  const profileQuery = trpc.profile.me.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const fallbackUsername = usernameCandidateFrom(session?.user.name || session?.user.email?.split('@')[0]);

  async function handleSignOut() {
    const result = await authClient.signOut();

    if (result.error) {
      Alert.alert('No se pudo cerrar sesión', result.error.message);
      return;
    }

    queryClient.clear();
    router.replace('/');
  }

  return (
    <ScreenScroll>
      <HeroPanel
        kicker="Primer paso"
        title={fallbackUsername ? `Hola @${fallbackUsername}` : 'Completa tu perfil'}
        body="Antes de entrar, necesitamos ciudad, ritmo y preferencias para que AppRunners pueda recomendarte crews compatibles.">
        <View className="mt-6 flex-row flex-wrap gap-2.5">
          {['Ciudad', 'Ritmo', 'Nivel', 'Metas'].map((chip) => (
            <View key={chip} className="rounded-full bg-hero-accent px-3 py-[9px]">
              <Text className="text-xs font-black uppercase tracking-[0.4px] text-[#1A1410]">{chip}</Text>
            </View>
          ))}
        </View>
      </HeroPanel>

      <ProfileForm
        description="Este onboarding crea tu perfil inicial. Después podrás editar tus datos runner desde Perfil, pero el username queda reservado."
        fallbackUsername={fallbackUsername}
        isLoading={profileQuery.isPending}
        lockedUsernameCopy="Reservado al crear la cuenta. Será tu identificador público en crews y quedadas."
        onSaved={() => router.replace('/')}
        profile={profileQuery.data?.profile}
        savedMessage="Perfil creado. Entrando en AppRunners..."
        submitLabel="Entrar a AppRunners"
        title="Tu punto de partida"
      />

      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        className="items-center py-3">
        <Text className="text-[14px] font-black text-muted-text">Cerrar sesión</Text>
      </Pressable>
    </ScreenScroll>
  );
}
