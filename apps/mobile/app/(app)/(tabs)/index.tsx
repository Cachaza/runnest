import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { usePullToRefresh } from '@/components/usePullToRefresh';
import {
  AppCard,
  Chip,
  EmptyState,
  HeroPanel,
  HorizontalScroller,
  QuickAction,
  QuickActionRow,
  ScreenScroll,
} from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
import {
  labelForCommunityKind,
  labelForMeetupOrganizer,
  labelForMeetupStyle,
} from '@/lib/community-labels';
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

export default function TodayScreen() {
  const { colors } = useAppTheme();
  const { data: session } = authClient.useSession();
  const profileQuery = trpc.profile.me.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const viewerMeetupsQuery = trpc.meetups.upcomingForViewer.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const myMembershipsQuery = trpc.communities.myMemberships.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const recommendedQuery = trpc.communities.recommended.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });

  const profile = profileQuery.data?.profile;
  const nextMeetup = viewerMeetupsQuery.data?.[0];
  const memberships = myMembershipsQuery.data ?? [];
  const recommendedCommunities = recommendedQuery.data?.slice(0, 2) ?? [];
  const nextMeetupOrganizer = nextMeetup?.createdByUsername
    ? `@${nextMeetup.createdByUsername}`
    : nextMeetup?.createdByName ?? 'el grupo';

  const { onRefresh, refreshing } = usePullToRefresh(async () => {
    await Promise.all([
      viewerMeetupsQuery.refetch(),
      myMembershipsQuery.refetch(),
      ...(session ? [profileQuery.refetch(), recommendedQuery.refetch()] : []),
    ]);
  });

  return (
    <ScreenScroll onRefresh={onRefresh} refreshing={refreshing}>
      <HeroPanel
        body="Aquí ves la próxima salida y quién se apunta. Todo lo que necesitas saber."
        kicker="Hoy"
        title={`Hola, ${session?.user.name ?? 'runner'}.`}
      />

      <QuickActionRow>
        <QuickAction
          icon="plus"
          label="Quedada"
          tone="primary"
          onPress={() => router.push('/modal' as any)}
        />
        <QuickAction
          icon="key"
          label="Código"
          onPress={() => router.push('/community-access' as any)}
        />
        <QuickAction
          icon="users"
          label="Grupos"
          onPress={() => router.push('/communities' as any)}
        />
      </QuickActionRow>

      <View className="flex-row gap-3">
        <View className="min-h-[110px] flex-1 rounded-card border border-border bg-surface p-4">
          <FontAwesome6 name="users" size={16} color={colors.tint} style={{ marginBottom: 8 }} />
          <Text className="text-[22px] font-black leading-7 text-text">{memberships.length}</Text>
          <Text className="mt-2 text-[13px] font-bold uppercase text-muted-text">tus grupos</Text>
        </View>
        <View className="min-h-[110px] flex-1 rounded-card border border-border bg-surface p-4">
          <FontAwesome6 name="calendar-day" size={16} color={colors.tint} style={{ marginBottom: 8 }} />
          <Text className="text-[22px] font-black leading-7 text-text">
            {viewerMeetupsQuery.data?.length ?? 0}
          </Text>
          <Text className="mt-2 text-[13px] font-bold uppercase text-muted-text">salidas próximas</Text>
        </View>
      </View>

      <View className="gap-2.5 rounded-[30px] border border-border bg-hero p-5">
        <Text className="text-xs font-black uppercase tracking-[1px] text-hero-accent">La próxima del grupo</Text>
        {viewerMeetupsQuery.isPending ? (
          <View className="flex-row items-center gap-2.5">
            <ActivityIndicator color={colors.heroAccent} />
            <Text className="text-[15px] leading-[23px] text-hero-text-muted">Cargando próximas quedadas...</Text>
          </View>
        ) : nextMeetup ? (
          <>
            <Text className="text-[25px] font-black leading-[29px] text-hero-text">{nextMeetup.title}</Text>
            <Text className="text-[15px] leading-[23px] text-hero-text-muted">
              {formatMeetupLabel(nextMeetup.startsAt)} · {nextMeetup.communityName}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Chip tone={nextMeetup.communityMode === 'managed' ? 'warm' : 'cool'}>
                {labelForMeetupStyle(nextMeetup.communityMode)}
              </Chip>
              <Chip tone="neutral">{nextMeetup.distanceKm} km</Chip>
              <Chip tone="neutral">{nextMeetup.rsvpCount} apuntados</Chip>
            </View>
            <Text className="text-[15px] leading-[23px] text-hero-text-muted">
              {nextMeetup.location} · {labelForMeetupOrganizer(nextMeetup.communityMode)} {nextMeetupOrganizer}
            </Text>
            <Text className="text-[15px] leading-[23px] text-hero-text-muted">
              {nextMeetup.viewerIsGoing ? 'Ya estás apuntado.' : 'Aún no te has apuntado.'}
            </Text>
            {nextMeetup.attendees.length > 0 ? (
              <Text className="text-[15px] leading-[23px] text-hero-text-muted" numberOfLines={2}>
                Quién viene: {nextMeetup.attendees.map((attendee) => attendee.username ? `@${attendee.username}` : attendee.name).join(', ')}
              </Text>
            ) : null}
            <Link href={`/crew/${nextMeetup.communityId}` as any} asChild>
              <Pressable
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                className="mt-2 items-center rounded-2xl bg-hero-accent py-3.5">
                <Text className="text-[15px] font-black text-on-accent">Abrir grupo</Text>
              </Pressable>
            </Link>
          </>
        ) : (
          <>
            <Text className="text-[25px] font-black leading-[29px] text-hero-text">Sin salidas próximas.</Text>
            <Text className="text-[15px] leading-[23px] text-hero-text-muted">
              Crea una salida o entra en un grupo para que aparezcan aquí.
            </Text>
            <View className="mt-2 flex-row gap-2.5">
              <Link href="/modal" asChild>
                <Pressable
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                  className="flex-1 items-center rounded-2xl bg-hero-accent py-3.5">
                  <Text className="text-[15px] font-black text-on-accent">Crear quedada</Text>
                </Pressable>
              </Link>
              <Link href="/community-access" asChild>
                <Pressable
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                  className="flex-1 items-center rounded-2xl border border-hero-accent py-3.5">
                  <Text className="text-[15px] font-black text-hero-accent">Entrar con código</Text>
                </Pressable>
              </Link>
            </View>
          </>
        )}
      </View>

      <AppCard>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Perfil</Text>
          {profileQuery.isPending ? <ActivityIndicator color={colors.tint} /> : null}
        </View>
        <Text className="text-2xl font-black leading-7 text-text">
          {profile ? 'Perfil completo.' : 'Completa tu ficha.'}
        </Text>
        <Text className="text-[15px] leading-[23px] text-muted-text">
          {profile
            ? `${profile.city} · ${profile.pace}${profile.availability ? ` · ${profile.availability}` : ''}`
            : 'Ayuda al grupo a conocerte: ciudad, ritmo y horarios disponibles. Así sabes quién más corre cuando tú.'}
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

      <AppCard>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Tus grupos</Text>
          {myMembershipsQuery.isPending ? <ActivityIndicator color={colors.tint} /> : null}
        </View>
        {memberships.length > 0 ? (
          <HorizontalScroller>
            {memberships.map((community) => (
              <Link key={community.id} href={`/crew/${community.id}` as any} asChild>
                <Pressable
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  className="w-[250px] rounded-[20px] bg-chip px-4 py-4">
                  <Text className="text-[18px] font-black text-text" numberOfLines={1}>
                    {community.name}
                  </Text>
                  <Text className="mt-1 text-[13px] font-bold text-muted-text" numberOfLines={1}>
                    {labelForCommunityKind(community.kind)} · {community.city}
                  </Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    <Chip tone="warm">{community.primaryRole ?? 'miembro'}</Chip>
                    <Chip tone={community.visibility === 'private' ? 'warm' : 'cool'}>
                      {community.visibility === 'private' ? 'Privado' : 'Público'}
                    </Chip>
                    {community.canCreateRuns ? <Chip tone="cool">Organizas</Chip> : null}
                  </View>
                </Pressable>
              </Link>
            ))}
          </HorizontalScroller>
        ) : (
          <EmptyState
            title="Aún no estás en ningún grupo."
            body="Crea uno desde aquí o entra con un código que te pasen."
          />
        )}
        <Link href="/communities" asChild>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            className="mt-2 self-start rounded-2xl bg-chip px-4 py-3">
            <Text className="text-sm font-black text-text">Ir a grupos</Text>
          </Pressable>
        </Link>
      </AppCard>

      <AppCard>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-black uppercase tracking-[1px] text-tint">Otros grupos</Text>
          {recommendedQuery.isPending ? <ActivityIndicator color={colors.tint} /> : null}
        </View>
        {recommendedCommunities.length > 0 ? (
          <>
            {recommendedCommunities.map((community) => (
              <Link key={community.id} href={`/crew/${community.id}` as any} asChild>
                <Pressable
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  className="rounded-[18px] bg-chip px-4 py-3">
                  <View className="gap-1.5">
                    <Text className="flex-1 text-[18px] font-black leading-6 text-text">{community.name}</Text>
                    <Text className="text-[14px] font-bold leading-5 text-muted-text">
                      {labelForCommunityKind(community.kind)} · {community.city}
                      {community.recommendationReason ? ` · ${community.recommendationReason}` : ''}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            ))}
          </>
        ) : (
          <Text className="text-[15px] leading-[23px] text-muted-text">
            Cuando haya más grupos activos, te los mostramos aquí.
          </Text>
        )}
      </AppCard>
    </ScreenScroll>
  );
}
