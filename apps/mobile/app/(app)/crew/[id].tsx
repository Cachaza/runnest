import { Link, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { usePullToRefresh } from '@/components/usePullToRefresh';
import { AppButton, AppCard, Chip, HeroPanel, ScreenScroll, SectionHeader } from '@/components/ui/AppUI';
import { labelForCommunityKind, lowerLabelForCommunityKind } from '@/lib/community-labels';
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

export default function CrewDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const communityId = rawId ?? null;
  const utils = trpc.useUtils();
  const communityQuery = trpc.communities.byId.useQuery(
    { id: communityId ?? '' },
    {
      enabled: Boolean(communityId),
      retry: false,
    },
  );
  const rsvpMutation = trpc.meetups.rsvp.useMutation({
    onSuccess: async () => {
      if (communityId) {
        await utils.communities.byId.invalidate({ id: communityId });
      }

      await utils.meetups.upcomingPublic.invalidate();
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar RSVP', error.message);
    },
  });
  const unrsvpMutation = trpc.meetups.unrsvp.useMutation({
    onSuccess: async () => {
      if (communityId) {
        await utils.communities.byId.invalidate({ id: communityId });
      }

      await utils.meetups.upcomingPublic.invalidate();
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar RSVP', error.message);
    },
  });
  const joinMutation = trpc.communities.joinPublic.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await Promise.all([
        utils.communities.byId.invalidate({ id: communityId }),
        utils.communities.myMemberships.invalidate(),
        utils.communities.hostable.invalidate(),
      ]);
    },
    onError: (error) => {
      Alert.alert('No se pudo unir', error.message);
    },
  });
  const leaveMutation = trpc.communities.leave.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await Promise.all([
        utils.communities.byId.invalidate({ id: communityId }),
        utils.communities.myMemberships.invalidate(),
        utils.communities.hostable.invalidate(),
      ]);
    },
    onError: (error) => {
      Alert.alert('No se pudo salir', error.message);
    },
  });
  const community = communityQuery.data?.community;
  const entityLabel = labelForCommunityKind(community?.kind);
  const entityLabelLower = lowerLabelForCommunityKind(community?.kind);
  const isMutatingRsvp = rsvpMutation.isPending || unrsvpMutation.isPending;
  const isMutatingMembership = joinMutation.isPending || leaveMutation.isPending;
  const { onRefresh, refreshing } = usePullToRefresh(async () => {
    if (!communityId) {
      return;
    }

    await communityQuery.refetch();
  });

  async function handleMeetupAction(meetupId: number, viewerIsGoing: boolean) {
    if (viewerIsGoing) {
      await unrsvpMutation.mutateAsync({ meetupId });
      return;
    }

    await rsvpMutation.mutateAsync({ meetupId });
  }

  async function handleMembershipAction() {
    if (!community || !communityId) {
      return;
    }

    if (community.viewerMembershipRole) {
      await leaveMutation.mutateAsync({ communityId });
      return;
    }

    await joinMutation.mutateAsync({ communityId });
  }

  if (communityQuery.error) {
    return (
      <ScreenScroll onRefresh={communityId ? onRefresh : undefined} refreshing={refreshing}>
        <AppCard>
          <Text className="text-[25px] font-black text-text">Comunidad no disponible</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">{communityQuery.error.message}</Text>
        </AppCard>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll onRefresh={communityId ? onRefresh : undefined} refreshing={refreshing}>
      <HeroPanel
        body={community?.description ?? 'Cargando detalle de la comunidad...'}
        kicker={community ? `${entityLabel} · ${community.city}` : 'Community'}
        title={community?.name ?? 'Cargando...'}>
        {community ? (
          <View className="mt-5 gap-3">
            <View className="flex-row flex-wrap gap-2.5">
              {community.pace ? <Chip tone="cool">{community.pace}</Chip> : null}
              {community.vibe ? <Chip tone="neutral">{community.vibe}</Chip> : null}
              <Chip tone="warm">{community.mode === 'collaborative' ? 'Collaborative' : 'Managed'}</Chip>
              <Chip tone="neutral">{community.visibility === 'public' ? 'Public' : 'Private'}</Chip>
              {community.viewerMembershipRole ? <Chip tone="warm">{community.viewerMembershipRole}</Chip> : null}
            </View>

            {community.visibility === 'public' ? (
              <AppButton
                disabled={isMutatingMembership || community.viewerMembershipRole === 'owner'}
                onPress={handleMembershipAction}>
                {community.viewerMembershipRole
                  ? isMutatingMembership
                    ? 'Saliendo...'
                    : community.viewerMembershipRole === 'owner'
                      ? 'Owner'
                      : 'Salir de la comunidad'
                  : isMutatingMembership
                    ? 'Uniéndote...'
                    : 'Unirme a esta comunidad'}
              </AppButton>
            ) : !community.viewerMembershipRole ? (
              <Text className="text-sm font-bold leading-5 text-hero-text-muted">
                Esta comunidad es privada y entra por invitación.
              </Text>
            ) : null}
          </View>
        ) : null}
      </HeroPanel>

      <SectionHeader loading={communityQuery.isPending} title="Próximas quedadas" />

      {!communityQuery.isPending && communityQuery.data?.upcomingMeetups.length === 0 ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">Sin quedadas futuras.</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            Cuando esta {entityLabelLower} publique una salida o preparación de carrera, aparecerá aquí.
          </Text>
        </AppCard>
      ) : null}

      {communityQuery.data?.upcomingMeetups.map((meetup) => (
        <AppCard key={meetup.id}>
          <Text className="text-xs font-black uppercase tracking-[1px] text-tint">
            {formatMeetupLabel(meetup.startsAt)}
          </Text>
          <Text className="text-[22px] font-black text-text">{meetup.title}</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            {meetup.distanceKm} km · {meetup.location}
          </Text>
          <View className="mt-1 flex-row items-center justify-between gap-3">
            <Text className="text-sm font-bold text-muted-text">{meetup.rsvpCount} apuntados</Text>
            <Pressable
              disabled={isMutatingRsvp}
              onPress={() => handleMeetupAction(meetup.id, meetup.viewerIsGoing)}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutatingRsvp ? 0.7 : 1 })}
              className="rounded-2xl bg-chip px-4 py-3">
              <Text className="text-sm font-black text-text">
                {meetup.viewerIsGoing ? 'Salir' : 'Me apunto'}
              </Text>
            </Pressable>
          </View>
        </AppCard>
      ))}

      <SectionHeader loading={communityQuery.isPending} title={`Runners en esta ${entityLabelLower}`} />

      {!communityQuery.isPending && communityQuery.data?.activeRunners.length === 0 ? (
        <AppCard>
          <Text className="text-[22px] font-black text-text">Aún sin runners públicos.</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">
            Los runners aparecerán cuando creen o confirmen quedadas de esta comunidad.
          </Text>
        </AppCard>
      ) : null}

      {communityQuery.data?.activeRunners.map((runner) => (
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
    </ScreenScroll>
  );
}
