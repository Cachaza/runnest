import { Link } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { usePullToRefresh } from '@/components/usePullToRefresh';
import { AppCard, Chip, HeroPanel, ScreenScroll, SectionHeader } from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
import { labelForCommunityKind } from '@/lib/community-labels';
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

export default function CommunitiesScreen() {
  const { colors, isDark } = useAppTheme();
  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();
  const communitiesQuery = trpc.communities.listPublic.useQuery();
  const myMembershipsQuery = trpc.communities.myMemberships.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const recommendedQuery = trpc.communities.recommended.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const meetupsQuery = trpc.meetups.upcomingPublic.useQuery();
  const publicRunnersQuery = trpc.profile.publicRunners.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const rsvpMutation = trpc.meetups.rsvp.useMutation({
    onSuccess: async () => {
      await utils.meetups.upcomingPublic.invalidate();
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar RSVP', error.message);
    },
  });
  const unrsvpMutation = trpc.meetups.unrsvp.useMutation({
    onSuccess: async () => {
      await utils.meetups.upcomingPublic.invalidate();
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar RSVP', error.message);
    },
  });
  const recommendedCommunities = recommendedQuery.data ?? [];
  const communities = recommendedCommunities.length > 0 ? recommendedCommunities : (communitiesQuery.data ?? []);
  const isLoadingCommunities = communitiesQuery.isPending || recommendedQuery.isPending;
  const isMutatingRsvp = rsvpMutation.isPending || unrsvpMutation.isPending;
  const { onRefresh, refreshing } = usePullToRefresh(async () => {
    await Promise.all([
      communitiesQuery.refetch(),
      meetupsQuery.refetch(),
      ...(session ? [myMembershipsQuery.refetch(), recommendedQuery.refetch(), publicRunnersQuery.refetch()] : []),
    ]);
  });

  async function handleMeetupAction(meetupId: number, viewerIsGoing: boolean) {
    if (!session) {
      return;
    }

    if (viewerIsGoing) {
      await unrsvpMutation.mutateAsync({ meetupId });
      return;
    }

    await rsvpMutation.mutateAsync({ meetupId });
  }

  return (
    <ScreenScroll onRefresh={onRefresh} refreshing={refreshing}>
      <HeroPanel
        body="Descubre runs públicos, encuentra comunidades donde encajas y monta la tuya si quieres liderar un espacio."
        kicker="Comunidades"
        title="Runs y comunidades cerca de ti"
      >
        <View className="mt-5">
          <Link href="/community-new" asChild>
            <Pressable
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              className="self-start rounded-2xl bg-hero-accent px-4 py-3.5">
              <Text className="text-[15px] font-black text-[#1A1410]">Crear comunidad</Text>
            </Pressable>
          </Link>
        </View>
      </HeroPanel>

      {session ? (
        <>
          <SectionHeader
            loading={myMembershipsQuery.isPending}
            title="Tus espacios"
            right={
              <Link href="/community-new" asChild>
                <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                  <Text className="text-sm font-black text-tint">Crear</Text>
                </Pressable>
              </Link>
            }
          />

          {!myMembershipsQuery.isPending && (myMembershipsQuery.data?.length ?? 0) === 0 ? (
            <AppCard>
              <Text className="text-[22px] font-black text-text">Aún no perteneces a ninguna comunidad.</Text>
              <Text className="text-[15px] leading-[23px] text-muted-text">
                Únete a una pública desde discovery o crea la tuya para empezar a publicar runs.
              </Text>
            </AppCard>
          ) : null}

          {myMembershipsQuery.data?.map((community) => (
            <Link key={community.id} href={`/crew/${community.id}` as any} asChild>
              <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                <AppCard>
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-[22px] font-black text-text">{community.name}</Text>
                      <Text className="mt-[3px] text-sm font-bold text-muted-text">
                        {labelForCommunityKind(community.kind)} · {community.city}
                      </Text>
                    </View>
                    {community.primaryRole ? <Chip tone="warm">{community.primaryRole}</Chip> : null}
                  </View>
                  <Text className="text-[15px] leading-[23px] text-muted-text">{community.description}</Text>
                  <View className="mt-0.5 flex-row flex-wrap gap-2.5">
                    <Chip tone="cool">{community.mode === 'collaborative' ? 'Collaborative' : 'Managed'}</Chip>
                    <Chip tone="neutral">{community.visibility === 'public' ? 'Public' : 'Private'}</Chip>
                    {community.canCreateRuns ? <Chip tone="warm">Can host</Chip> : null}
                  </View>
                </AppCard>
              </Pressable>
            </Link>
          ))}
        </>
      ) : null}

      <SectionHeader
        loading={isLoadingCommunities}
        title={recommendedCommunities.length > 0 ? 'Recomendadas para ti' : 'Todas las comunidades'}
      />

      {communitiesQuery.error ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">No se pudieron cargar las comunidades</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">{communitiesQuery.error.message}</Text>
        </AppCard>
      ) : null}

      {!isLoadingCommunities && communities.length === 0 ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">Aún no hay comunidades activas.</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            Cuando se creen comunidades aparecerán aquí con su ciudad, ritmo y vibe.
          </Text>
        </AppCard>
      ) : null}

      {communities.map((community) => {
        const recommendationReason = (community as { recommendationReason?: string }).recommendationReason;
        const entityLabel = labelForCommunityKind(community.kind);

        return (
          <Link key={community.id} href={`/crew/${community.id}` as any} asChild>
            <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
              <AppCard>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-[22px] font-black text-text">{community.name}</Text>
                    <Text className="mt-[3px] text-sm font-bold text-muted-text">
                      {entityLabel} · {community.city}
                    </Text>
                  </View>
                  {recommendationReason ? (
                    <Chip tone="warm">{recommendationReason}</Chip>
                  ) : null}
                </View>
                <Text className="text-[15px] leading-[23px] text-muted-text">{community.description}</Text>
                <View className="mt-0.5 flex-row flex-wrap gap-2.5">
                  {community.pace ? <Chip tone="cool">{community.pace}</Chip> : null}
                  {community.vibe ? <Chip tone="neutral">{community.vibe}</Chip> : null}
                  <Chip tone="warm">{community.mode === 'collaborative' ? 'Collaborative' : 'Managed'}</Chip>
                  <Chip tone="neutral">{community.visibility === 'public' ? 'Public' : 'Private'}</Chip>
                </View>
                <Text className="text-sm font-black text-tint">Ver detalle</Text>
              </AppCard>
            </Pressable>
          </Link>
        );
      })}

      <SectionHeader loading={publicRunnersQuery.isPending} title="Runners activos" />

      {publicRunnersQuery.data?.map((runner) => (
        <Link key={runner.id} href={`/runner/${runner.username}` as any} asChild>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
            <AppCard>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[22px] font-black text-text">@{runner.username}</Text>
                  <Text className="mt-[3px] text-sm font-bold text-muted-text">
                    {[runner.area, runner.city].filter(Boolean).join(' · ') || 'Ubicación privada'}
                  </Text>
                </View>
                {runner.level ? <Chip tone="warm">{runner.level}</Chip> : null}
              </View>
              <View className="mt-0.5 flex-row flex-wrap gap-2.5">
                <Chip tone="cool">{runner.pace}</Chip>
                {runner.goals ? <Chip tone="neutral">{runner.goals.split(',')[0].trim()}</Chip> : null}
              </View>
            </AppCard>
          </Pressable>
        </Link>
      ))}

      <SectionHeader loading={meetupsQuery.isPending} title="Próximas quedadas" />

      {meetupsQuery.error ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">No se pudieron cargar quedadas</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            {meetupsQuery.error.message}
          </Text>
        </AppCard>
      ) : null}

      {!meetupsQuery.isPending && !meetupsQuery.error && meetupsQuery.data?.length === 0 ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">Sin quedadas publicadas.</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            Crea una desde Hoy o desde tus espacios para empezar a mover a la comunidad.
          </Text>
        </AppCard>
      ) : null}

      {meetupsQuery.data?.map((meetup) => {
        const viewerDistance = formatViewerDistance(meetup.distanceFromViewerKm);

        return (
          <View
            key={meetup.id}
            style={[
              styles.timelineItem,
              {
                backgroundColor: colors.hero,
                borderColor: colors.border,
                shadowColor: isDark ? '#000' : '#5C4833',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.3 : 0.08,
                shadowRadius: 8,
                elevation: 4,
              },
            ]}>
            <View style={[styles.datePill, { backgroundColor: colors.heroAccent }]}>
              <Text style={styles.datePillText}>{formatMeetupLabel(meetup.startsAt)}</Text>
            </View>
            <View style={styles.timelineBody}>
              <Text style={[styles.timelineTitle, { color: colors.heroText }]}>{meetup.title}</Text>
              <Text style={[styles.timelineNote, { color: colors.heroTextMuted }]}>
                {meetup.communityName} · {meetup.distanceKm} km · {meetup.location}
              </Text>
              {viewerDistance ? (
                <Text style={[styles.timelineNote, { color: colors.heroTextMuted }]}>{viewerDistance}</Text>
              ) : null}
              <View style={styles.timelineFooter}>
                <Text style={[styles.rsvpMeta, { color: colors.heroTextMuted }]}>
                  {meetup.rsvpCount} apuntados
                </Text>
                <Pressable
                  disabled={isMutatingRsvp}
                  onPress={() => handleMeetupAction(meetup.id, meetup.viewerIsGoing)}
                  style={({ pressed }) => [
                    styles.rsvpButton,
                    {
                      backgroundColor: meetup.viewerIsGoing
                        ? isDark ? 'rgba(255,243,228,0.12)' : 'rgba(255,248,236,0.16)'
                        : colors.heroAccent,
                      opacity: pressed ? 0.7 : isMutatingRsvp ? 0.7 : 1,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.rsvpButtonText,
                      { color: meetup.viewerIsGoing ? colors.heroText : '#1A1410' },
                    ]}>
                    {meetup.viewerIsGoing ? 'Salir' : 'Me apunto'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  datePill: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 74,
    paddingHorizontal: 10,
    width: 84,
  },
  datePillText: {
    color: '#1A1410',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  rsvpButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rsvpButtonText: {
    fontSize: 13,
    fontWeight: '900',
  },
  rsvpMeta: {
    fontSize: 13,
    fontWeight: '700',
  },
  timelineBody: {
    flex: 1,
    gap: 6,
  },
  timelineFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timelineItem: {
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  timelineNote: {
    fontSize: 14,
    lineHeight: 21,
  },
  timelineTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
});
