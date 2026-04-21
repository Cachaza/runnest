import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { AppCard, Chip, HeroPanel, ScreenScroll } from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
import { trpc } from '@/lib/trpc';

function formatMeetupLabel(startsAt: string | Date) {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

function formatViewerDistance(distanceKm: number | null | undefined) {
  if (distanceKm === null || distanceKm === undefined) {
    return null;
  }

  return `~${Math.round(distanceKm)} km de ti`;
}

export default function TodayScreen() {
  const { colors, isDark } = useAppTheme();
  const { data: session } = authClient.useSession();
  const profileQuery = trpc.profile.me.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const meetupsQuery = trpc.meetups.upcoming.useQuery();
  const recommendedQuery = trpc.crews.recommended.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const profile = profileQuery.data?.profile;
  const nextMeetup = meetupsQuery.data?.[0];
  const recommendedCrews = recommendedQuery.data?.slice(0, 3) ?? [];
  const nextMeetupDistance = formatViewerDistance(nextMeetup?.distanceFromViewerKm);

  return (
    <ScreenScroll>
      <HeroPanel
        body="Tu punto de partida para encontrar crews, quedar para correr y mantener tu ritmo social."
        kicker="Hoy en AppRunners"
        title={`Hola, ${session?.user.name ?? 'runner'}.`}
      />

      <View className="flex-row gap-3">
        <View className="min-h-[110px] flex-1 rounded-card border border-border bg-surface p-4">
          <Text className="text-[22px] font-black leading-7 text-text">
            {profile?.pace ?? 'Pendiente'}
          </Text>
          <Text className="mt-2 text-[13px] font-bold uppercase text-muted-text">ritmo base</Text>
        </View>
        <View className="min-h-[110px] flex-1 rounded-card border border-border bg-surface p-4">
          <Text className="text-[22px] font-black leading-7 text-text">
            {profile?.city ?? 'Ciudad'}
          </Text>
          <Text className="mt-2 text-[13px] font-bold uppercase text-muted-text">zona runner</Text>
        </View>
      </View>

      <AppCard>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Perfil runner</Text>
          {profileQuery.isPending ? <ActivityIndicator color={colors.tint} /> : null}
        </View>
        <Text className="text-2xl font-black leading-7 text-text">
          {profile ? 'Tu perfil ya mueve las recomendaciones.' : 'Completa tu ritmo y ciudad.'}
        </Text>
        <Text className="text-[15px] leading-[23px] text-muted-text">
          {profile
            ? `${profile.city} · ${profile.pace}${profile.availability ? ` · ${profile.availability}` : ''}`
            : 'Dinos dónde corres y a qué ritmo para ordenar crews y quedadas por compatibilidad.'}
        </Text>
        <Link href="/profile" asChild>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            className="mt-2 self-start rounded-2xl bg-chip px-4 py-3">
            <Text className="text-sm font-black text-text">
              {profile ? 'Editar perfil' : 'Completar perfil'}
            </Text>
          </Pressable>
        </Link>
      </AppCard>

      <View className="gap-2.5 rounded-[30px] border border-border bg-hero p-5">
        <Text className="text-xs font-black uppercase tracking-[1px] text-hero-accent">Tu próxima quedada</Text>
        {meetupsQuery.isPending ? (
          <View className="flex-row items-center gap-2.5">
            <ActivityIndicator color={colors.heroAccent} />
            <Text className="text-[15px] leading-[23px] text-hero-text-muted">Buscando planes...</Text>
          </View>
        ) : nextMeetup ? (
          <>
            <Text className="text-[25px] font-black leading-[29px] text-hero-text">{nextMeetup.title}</Text>
            <Text className="text-[15px] leading-[23px] text-hero-text-muted">
              {formatMeetupLabel(nextMeetup.startsAt)} · {nextMeetup.crewName}
            </Text>
            <Text className="text-[15px] leading-[23px] text-hero-text-muted">
              {nextMeetup.distanceKm} km · {nextMeetup.location} · {nextMeetup.rsvpCount} apuntados
            </Text>
            {nextMeetupDistance ? (
              <Text className="text-[15px] leading-[23px] text-hero-text-muted">{nextMeetupDistance}</Text>
            ) : null}
          </>
        ) : (
          <>
            <Text className="text-[25px] font-black leading-[29px] text-hero-text">Aún no hay planes activos.</Text>
            <Text className="text-[15px] leading-[23px] text-hero-text-muted">
              Crea la primera quedada y dale una excusa a tu crew para salir.
            </Text>
          </>
        )}
        <Link href="/modal" asChild>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            className="mt-2 items-center rounded-2xl bg-hero-accent py-3.5">
            <Text className="text-[15px] font-black text-[#1A1410]">Crear quedada</Text>
          </Pressable>
        </Link>
      </View>

      <AppCard>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Crews recomendadas</Text>
          {recommendedQuery.isPending ? <ActivityIndicator color={colors.tint} /> : null}
        </View>
        {recommendedCrews.length > 0 ? (
          <>
            {recommendedCrews.map((crew) => (
              <Link key={crew.id} href={`/crew/${crew.id}` as any} asChild>
                <Pressable
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  className="rounded-[18px] bg-chip px-4 py-3">
                  <View className="gap-1.5">
                    <View className="flex-row items-start justify-between gap-2">
                      <Text className="flex-1 text-[18px] font-black leading-6 text-text">{crew.name}</Text>
                      <Chip tone="warm">Match</Chip>
                    </View>
                    <Text className="text-[14px] font-bold leading-5 text-muted-text">
                      {crew.city} · {crew.pace} · {crew.recommendationReason}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            ))}
          </>
        ) : (
          <>
            <Text className="text-2xl font-black leading-7 text-text">Sin recomendación todavía.</Text>
            <Text className="text-[15px] leading-[23px] text-muted-text">
              Cuando completes tu perfil, AppRunners priorizará crews por ciudad y ritmo.
            </Text>
          </>
        )}
        <Link href="/communities" asChild>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            className="mt-2 self-start rounded-2xl bg-chip px-4 py-3">
            <Text className="text-sm font-black text-text">Ver crews</Text>
          </Pressable>
        </Link>
      </AppCard>
    </ScreenScroll>
  );
}
