import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { usePullToRefresh } from '@/components/usePullToRefresh';
import {
  AppCard,
  Chip,
  EmptyState,
  HorizontalScroller,
  ScreenScroll,
  SectionHeader,
  SegmentedTabs,
} from '@/components/ui/AppUI';
import { authClient } from '@/lib/auth-client';
import {
  CommunityKind,
  CommunityMode,
  CommunityVisibility,
  labelForCommunityKind,
  labelForMeetupOrganizer,
  labelForMeetupStyle,
  labelForMode,
  labelForVisibility,
} from '@/lib/community-labels';
import { invalidateCommunityMembershipState } from '@/lib/community-membership-cache';
import { hexToRgba } from '@/lib/colors';
import { trpc } from '@/lib/trpc';

type TabValue = 'discover' | 'spaces' | 'inbox';

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

  return `~${Math.round(distanceKm)} km`;
}

function formatShortDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function accessClaimStatusLabel(status: 'pending' | 'approved' | 'rejected' | 'cancelled') {
  switch (status) {
    case 'approved':
      return 'Aprobado';
    case 'rejected':
      return 'Rechazado';
    case 'cancelled':
      return 'Cancelado';
    case 'pending':
    default:
      return 'Pendiente';
  }
}

function joinRequestStatusLabel(status: 'pending' | 'approved' | 'rejected' | 'cancelled') {
  switch (status) {
    case 'approved':
      return 'Aprobada';
    case 'rejected':
      return 'Rechazada';
    case 'cancelled':
      return 'Cancelada';
    case 'pending':
    default:
      return 'Pendiente';
  }
}

function initialsForCommunity(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 'AR';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export default function CommunitiesScreen() {
  const { colors, isDark } = useAppTheme();
  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();
  const [tab, setTab] = useState<TabValue>('discover');
  const hasInitializedDefaultTab = useRef(false);
  const [communitySearch, setCommunitySearch] = useState('');
  const trimmedCommunitySearch = communitySearch.trim();
  const communitiesQuery = trpc.communities.listPublic.useQuery();
  const communitySearchQuery = trpc.communities.search.useQuery(
    { query: trimmedCommunitySearch },
    {
      enabled: !!session && trimmedCommunitySearch.length >= 2,
      retry: false,
    },
  );
  const myAccessLinkClaimsQuery = trpc.communities.myAccessLinkClaims.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const myInvitesQuery = trpc.communities.myInvites.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  });
  const myJoinRequestsQuery = trpc.communities.myJoinRequests.useQuery(undefined, {
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
  const acceptInviteMutation = trpc.communities.acceptInvite.useMutation({
    onSuccess: async () => {
      await invalidateCommunityMembershipState(utils);
    },
    onError: (error) => {
      Alert.alert('No se pudo aceptar la invitación', error.message);
    },
  });
  const rejectInviteMutation = trpc.communities.rejectInvite.useMutation({
    onSuccess: async () => {
      await utils.communities.myInvites.invalidate();
    },
    onError: (error) => {
      Alert.alert('No se pudo rechazar la invitación', error.message);
    },
  });
  const joinCommunityMutation = trpc.communities.joinPublic.useMutation({
    onSuccess: async () => {
      await invalidateCommunityMembershipState(utils);
    },
    onError: (error) => {
      Alert.alert('No se pudo unir', error.message);
    },
  });
  const requestJoinMutation = trpc.communities.requestJoin.useMutation({
    onSuccess: async () => {
      await invalidateCommunityMembershipState(utils);
    },
    onError: (error) => {
      Alert.alert('No se pudo solicitar entrada', error.message);
    },
  });
  const cancelJoinRequestMutation = trpc.communities.cancelJoinRequest.useMutation({
    onSuccess: async () => {
      await invalidateCommunityMembershipState(utils);
    },
    onError: (error) => {
      Alert.alert('No se pudo cancelar la solicitud', error.message);
    },
  });
  const recommendedCommunities = recommendedQuery.data ?? [];
  const communities = recommendedCommunities.length > 0 ? recommendedCommunities : (communitiesQuery.data ?? []);
  const isLoadingCommunities = communitiesQuery.isPending || recommendedQuery.isPending;
  const isMutatingRsvp = rsvpMutation.isPending || unrsvpMutation.isPending;
  const isMutatingInvite = acceptInviteMutation.isPending || rejectInviteMutation.isPending;
  const isMutatingJoinRequest =
    joinCommunityMutation.isPending || requestJoinMutation.isPending || cancelJoinRequestMutation.isPending;

  const pendingInvitesCount = myInvitesQuery.data?.length ?? 0;
  const pendingJoinRequestsCount = useMemo(
    () => (myJoinRequestsQuery.data ?? []).filter((r) => r.status === 'pending').length,
    [myJoinRequestsQuery.data],
  );
  const pendingAccessClaimsCount = useMemo(
    () => (myAccessLinkClaimsQuery.data ?? []).filter((c) => c.status === 'pending').length,
    [myAccessLinkClaimsQuery.data],
  );
  const inboxBadge = pendingInvitesCount + pendingJoinRequestsCount + pendingAccessClaimsCount;
  const myMembershipsCount = myMembershipsQuery.data?.length ?? 0;
  const heroBorderColor = hexToRgba(colors.heroOverlay, 0.1);
  const heroIconSurface = hexToRgba(colors.heroOverlay, 0.08);
  const heroIconSurfaceStrong = hexToRgba(colors.heroOverlay, 0.18);
  const heroButtonSurface = hexToRgba(colors.heroOverlay, 0.12);

  useEffect(() => {
    if (!session || hasInitializedDefaultTab.current) {
      return;
    }

    hasInitializedDefaultTab.current = true;
    setTab('spaces');
  }, [session]);

  const { onRefresh, refreshing } = usePullToRefresh(async () => {
    await Promise.all([
      communitiesQuery.refetch(),
      meetupsQuery.refetch(),
      ...(session && trimmedCommunitySearch.length >= 2 ? [communitySearchQuery.refetch()] : []),
      ...(session
        ? [
            myAccessLinkClaimsQuery.refetch(),
            myInvitesQuery.refetch(),
            myJoinRequestsQuery.refetch(),
            myMembershipsQuery.refetch(),
            recommendedQuery.refetch(),
            publicRunnersQuery.refetch(),
          ]
        : []),
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

  async function handleInviteAction(inviteId: string, action: 'accept' | 'reject') {
    if (action === 'accept') {
      await acceptInviteMutation.mutateAsync({ inviteId });
      return;
    }

    await rejectInviteMutation.mutateAsync({ inviteId });
  }

  async function handleCommunitySearchAction(result: {
    communityId?: string;
    id?: string;
    joinRequestId: string | null;
    joinRequestStatus: 'pending' | 'approved' | 'rejected' | 'cancelled' | null;
    visibility: 'public' | 'private';
  }) {
    const communityId = result.communityId ?? result.id;

    if (!communityId) {
      return;
    }

    if (result.visibility === 'public') {
      await joinCommunityMutation.mutateAsync({ communityId });
      return;
    }

    if (result.joinRequestStatus === 'pending' && result.joinRequestId) {
      await cancelJoinRequestMutation.mutateAsync({ requestId: result.joinRequestId });
      return;
    }

    await requestJoinMutation.mutateAsync({ communityId });
  }

  const tabOptions = useMemo(() => {
    const base: Array<{ value: TabValue; label: string; badge?: number }> = [];

    if (session) {
      base.push({ value: 'spaces', label: 'Mis grupos', badge: myMembershipsCount });
      base.push({ value: 'inbox', label: 'Pendiente', badge: inboxBadge });
    }

    base.push({ value: 'discover', label: 'Descubrir' });

    return base;
  }, [session, myMembershipsCount, inboxBadge]);

  return (
    <ScreenScroll onRefresh={onRefresh} refreshing={refreshing}>
      {/* Hero */}
      <View className="gap-5 rounded-hero bg-hero p-5">
        <View>
          <Text className="text-[11px] font-black uppercase tracking-[0.9px] text-hero-accent">Grupos</Text>
          <Text className="mt-2 text-[28px] font-black leading-[31px] text-hero-text">
            Todos tus grupos en un sitio.
          </Text>
          <Text className="mt-1 text-[15px] leading-[21px] text-hero-text-muted">
            Aquí están tus grupos, las salidas que vienen y las invitaciones que recibes.
          </Text>
        </View>
        {session ? (
          <View className="flex-row gap-2.5">
            <Pressable
              onPress={() => router.push('/community-new')}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              className="flex-1 items-center gap-2 rounded-card border border-tint/30 bg-tint px-3 py-3">
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: heroIconSurfaceStrong }}>
                <FontAwesome6 name="plus" size={15} color={colors.onTint} solid />
              </View>
              <Text className="text-[11px] font-black text-on-tint">Grupo</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/community-access')}
              style={({ pressed }) => ({ borderColor: heroBorderColor, opacity: pressed ? 0.75 : 1 })}
              className="flex-1 items-center gap-2 rounded-card border px-3 py-3">
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: heroIconSurface }}>
                <FontAwesome6 name="key" size={15} color={colors.heroText} solid />
              </View>
              <Text className="text-[11px] font-black text-hero-text">Código</Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('discover')}
              style={({ pressed }) => ({ borderColor: heroBorderColor, opacity: pressed ? 0.75 : 1 })}
              className="flex-1 items-center gap-2 rounded-card border px-3 py-3">
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: heroIconSurface }}>
                <FontAwesome6 name="magnifying-glass" size={15} color={colors.heroText} solid />
              </View>
              <Text className="text-[11px] font-black text-hero-text">Buscar</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <SegmentedTabs value={tab} onChange={setTab} options={tabOptions} />

      {tab === 'discover' ? (
        <>
          <View className="flex-row gap-2">
            <View className="min-h-[44px] flex-1 flex-row items-center gap-2 rounded-full border border-border bg-chip px-4">
              <FontAwesome6 name="magnifying-glass" size={14} color={colors.mutedText} />
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => setCommunitySearch(value)}
                placeholder="Buscar comunidades..."
                placeholderTextColor={colors.mutedText}
                style={{ color: colors.text, flex: 1, fontSize: 14, fontWeight: '700', paddingVertical: 0 }}
                value={communitySearch}
              />
            </View>
          </View>

          {trimmedCommunitySearch.length >= 2 ? (
            <>
              <SectionHeader loading={communitySearchQuery.isPending} title="Resultados" />

              {!communitySearchQuery.isPending && (communitySearchQuery.data?.length ?? 0) === 0 ? (
                <EmptyState title="Sin coincidencias." body="Prueba con el nombre exacto del grupo o una pista de ciudad." />
              ) : null}

              {communitySearchQuery.data?.map((result) => {
                const primaryActionLabel =
                  result.visibility === 'public'
                    ? 'Unirme'
                    : result.joinRequestStatus === 'pending'
                      ? 'Cancelar solicitud'
                      : result.joinRequestStatus === 'rejected'
                        ? 'Volver a solicitar'
                        : 'Solicitar entrada';

                return (
                  <CommunityListItem
                    key={result.id}
                    id={result.id}
                    name={result.name}
                    kind={result.kind}
                    city={result.city}
                    description={result.description}
                    mode={result.mode}
                    visibility={result.visibility}
                    pace={result.pace}
                    vibe={result.joinRequestStatus ? joinRequestStatusLabel(result.joinRequestStatus) : null}
                    actionLabel={result.canOpen ? undefined : primaryActionLabel}
                    onActionPress={
                      result.canOpen
                        ? undefined
                        : () => {
                            void handleCommunitySearchAction(result);
                          }
                    }
                  />
                );
              })}
            </>
          ) : null}

          <SectionHeader loading={meetupsQuery.isPending} title="Próximas quedadas" />

          {meetupsQuery.error ? (
            <AppCard>
              <Text className="text-[17px] font-black text-text">No se pudieron cargar quedadas</Text>
              <Text className="text-[14px] leading-[21px] text-muted-text">{meetupsQuery.error.message}</Text>
            </AppCard>
          ) : null}

          {!meetupsQuery.isPending && !meetupsQuery.error && meetupsQuery.data?.length === 0 ? (
            <EmptyState
              title="Sin salidas públicas."
              body="Crea una desde Hoy o desde uno de tus grupos para que aparezca aquí."
            />
          ) : null}

          {meetupsQuery.data && meetupsQuery.data.length > 0 ? (
            <HorizontalScroller>
              {meetupsQuery.data.map((meetup) => {
                const viewerDistance = formatViewerDistance(meetup.distanceFromViewerKm);
                const organizerName = meetup.createdByUsername
                  ? `@${meetup.createdByUsername}`
                  : meetup.createdByName ?? 'organización';

                return (
                  <View
                    key={meetup.id}
                    style={[
                      styles.meetupCard,
                      {
                        backgroundColor: colors.hero,
                        shadowColor: colors.shadow,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isDark ? 0.3 : 0.08,
                        shadowRadius: 8,
                        elevation: 4,
                      },
                    ]}>
                    <View style={[styles.datePill, { backgroundColor: colors.heroAccent }]}>
                      <Text style={[styles.datePillText, { color: colors.onAccent }]}>
                        {formatMeetupLabel(meetup.startsAt)}
                      </Text>
                    </View>
                    <Text style={[styles.meetupTitle, { color: colors.heroText }]} numberOfLines={2}>
                      {meetup.title}
                    </Text>
                    <Text
                      style={[styles.meetupNote, { color: colors.heroTextMuted }]}
                      numberOfLines={1}>
                      {meetup.communityName} · {meetup.location}
                    </Text>
                    <View className="mt-1 flex-row flex-wrap gap-2">
                      <Chip tone={meetup.communityMode === 'managed' ? 'warm' : 'cool'}>
                        {labelForMeetupStyle(meetup.communityMode)}
                      </Chip>
                      <Chip tone="neutral">{labelForMode(meetup.communityMode)}</Chip>
                    </View>
                    <Text style={[styles.meetupNote, { color: colors.heroTextMuted }]} numberOfLines={1}>
                      {meetup.distanceKm} km{viewerDistance ? ` · ${viewerDistance} de ti` : ''}
                    </Text>
                    <Text style={[styles.meetupNote, { color: colors.heroTextMuted }]} numberOfLines={1}>
                      {labelForMeetupOrganizer(meetup.communityMode)} {organizerName}
                    </Text>
                    <View style={styles.meetupFooter}>
                      <Text style={[styles.rsvpMeta, { color: colors.heroTextMuted }]}>
                        {meetup.rsvpCount} apuntados
                      </Text>
                      <View className="flex-row gap-2">
                        {session ? (
                          <Link href={`/meetup/${meetup.id}` as any} asChild>
                            <Pressable
                              style={({ pressed }) => [
                                styles.rsvpButton,
                                {
                                  backgroundColor: heroButtonSurface,
                                  opacity: pressed ? 0.7 : 1,
                                },
                              ]}>
                              <Text style={[styles.rsvpButtonText, { color: colors.heroText }]}>
                                Ver
                              </Text>
                            </Pressable>
                          </Link>
                        ) : null}
                        <Pressable
                          disabled={isMutatingRsvp || !session}
                          onPress={() => handleMeetupAction(meetup.id, meetup.viewerIsGoing)}
                          style={({ pressed }) => [
                            styles.rsvpButton,
                            {
                              backgroundColor: meetup.viewerIsGoing
                                ? heroButtonSurface
                                : colors.tint,
                              opacity: pressed ? 0.7 : isMutatingRsvp || !session ? 0.7 : 1,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.rsvpButtonText,
                              { color: meetup.viewerIsGoing ? colors.heroText : colors.onTint },
                            ]}>
                            {meetup.viewerIsGoing ? 'Salgo' : 'Me apunto'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </HorizontalScroller>
          ) : null}

          <SectionHeader
            loading={isLoadingCommunities}
            title={recommendedCommunities.length > 0 ? 'Para descubrir más' : 'Grupos públicos'}
          />

          {communitiesQuery.error ? (
            <AppCard>
              <Text className="text-[17px] font-black text-text">No se pudieron cargar las comunidades</Text>
              <Text className="text-[14px] leading-[21px] text-muted-text">{communitiesQuery.error.message}</Text>
            </AppCard>
          ) : null}

          {!isLoadingCommunities && communities.length === 0 ? (
            <EmptyState
              title="Aún no hay grupos activos."
              body="Cuando haya grupos públicos activos, aparecerán aquí."
            />
          ) : null}

          {communities.map((community) => {
            const recommendationReason = (community as { recommendationReason?: string }).recommendationReason;

            return (
              <CommunityListItem
                key={community.id}
                id={community.id}
                name={community.name}
                kind={community.kind}
                city={community.city}
                description={community.description}
                mode={community.mode}
                visibility={community.visibility}
                pace={community.pace}
                vibe={community.vibe}
                highlight={recommendationReason}
              />
            );
          })}

          {session && (publicRunnersQuery.data?.length ?? 0) > 0 ? (
            <>
              <SectionHeader loading={publicRunnersQuery.isPending} title="Runners activos" />

              <HorizontalScroller>
                {publicRunnersQuery.data?.map((runner) => (
                  <Link key={runner.id} href={`/runner/${runner.username}` as any} asChild>
                    <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                      <View style={styles.runnerCard} className="rounded-card border border-border bg-surface">
                        <Text className="text-[17px] font-black text-text" numberOfLines={1}>
                          @{runner.username}
                        </Text>
                        <Text className="text-[12px] font-bold text-muted-text" numberOfLines={1}>
                          {[runner.area, runner.city].filter(Boolean).join(' · ') || 'Ubicación privada'}
                        </Text>
                        <View className="mt-1 flex-row flex-wrap gap-1.5">
                          <Chip tone="cool">{runner.pace}</Chip>
                          {runner.level ? <Chip tone="warm">{runner.level}</Chip> : null}
                        </View>
                      </View>
                    </Pressable>
                  </Link>
                ))}
              </HorizontalScroller>
            </>
          ) : null}
        </>
      ) : null}

      {session && tab === 'spaces' ? (
        <>
          <AppCard>
            <View className="flex-row items-center gap-2">
              <FontAwesome6 name="magnifying-glass" size={14} color={colors.mutedText} />
              <Text className="text-[13px] font-black uppercase tracking-[0.5px] text-muted-text">
                Buscar comunidad
              </Text>
            </View>
            <TextInput
              autoCapitalize="none"
              onChangeText={setCommunitySearch}
              placeholder="Ej. bilbao athletics o marina-circle"
              placeholderTextColor={colors.mutedText}
              style={[
                styles.input,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={communitySearch}
            />
              <Text className="text-[13px] leading-5 text-muted-text">
              Los grupos privados no salen aquí. Búscalos por nombre o ciudad para pedirles acceso.
            </Text>
          </AppCard>

          {trimmedCommunitySearch.length >= 2 ? (
            <>
              {communitySearchQuery.isPending ? (
                <EmptyState title="Buscando..." body="Buscando por nombre y ciudad..." />
              ) : null}

              {!communitySearchQuery.isPending && (communitySearchQuery.data?.length ?? 0) === 0 ? (
                <EmptyState
                  title="Sin coincidencias."
                  body="Prueba con el nombre exacto del grupo o una pista de ciudad."
                />
              ) : null}

              {communitySearchQuery.data?.map((result) => {
                const canOpen = result.canOpen;
                const primaryActionLabel =
                  result.visibility === 'public'
                    ? 'Unirme'
                    : result.joinRequestStatus === 'pending'
                      ? 'Cancelar solicitud'
                      : result.joinRequestStatus === 'rejected'
                        ? 'Volver a solicitar'
                        : 'Solicitar entrada';

                return (
                  <AppCard key={result.id}>
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-[19px] font-black text-text">{result.name}</Text>
                        <Text className="mt-[2px] text-[13px] font-bold text-muted-text">
                          {labelForCommunityKind(result.kind)} · {result.city}
                        </Text>
                      </View>
                    <Chip tone={result.visibility === 'private' ? 'warm' : 'cool'}>
                      {labelForVisibility(result.visibility)}
                    </Chip>
                    </View>
                    <Text className="text-[14px] leading-[21px] text-muted-text" numberOfLines={3}>
                      {result.description}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      <Chip tone="warm">{labelForMode(result.mode)}</Chip>
                      {result.pace ? <Chip tone="cool">{result.pace}</Chip> : null}
                      {result.joinRequestStatus ? (
                        <Chip tone={result.joinRequestStatus === 'pending' ? 'cool' : 'neutral'}>
                          {joinRequestStatusLabel(result.joinRequestStatus)}
                        </Chip>
                      ) : null}
                    </View>
                    <View className="mt-1 flex-row gap-2.5">
                      {canOpen ? (
                        <Link href={`/crew/${result.id}` as any} asChild>
                          <Pressable
                            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                            className="flex-1 items-center rounded-[18px] bg-chip py-[13px]">
                            <Text className="text-[14px] font-black text-text">Ver grupo</Text>
                          </Pressable>
                        </Link>
                      ) : null}
                      {result.canJoinDirectly ||
                      result.canRequestJoin ||
                      result.joinRequestStatus === 'pending' ||
                      result.joinRequestStatus === 'rejected' ? (
                        <Pressable
                          disabled={isMutatingJoinRequest}
                          onPress={() => handleCommunitySearchAction(result)}
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.75 : isMutatingJoinRequest ? 0.7 : 1,
                          })}
                          className="flex-1 items-center rounded-[18px] bg-tint py-[13px]">
                          <Text className="text-[14px] font-black text-on-tint">{primaryActionLabel}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </AppCard>
                );
              })}
            </>
          ) : null}

          <SectionHeader
            loading={myMembershipsQuery.isPending}
            title="Tus espacios"
            right={
              <Link href="/community-new" asChild>
                <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                  <Text className="text-[13px] font-black text-tint">+ Crear grupo</Text>
                </Pressable>
              </Link>
            }
          />

          {!myMembershipsQuery.isPending && (myMembershipsQuery.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="Aún no estás en ningún grupo."
              body="Busca uno público, entra con un código o crea uno nuevo."
            />
          ) : null}

          {myMembershipsQuery.data?.map((community) => (
            <CommunityListItem
              key={community.id}
              id={community.id}
              name={community.name}
              kind={community.kind}
              city={community.city}
              description={community.description}
              mode={community.mode}
              visibility={community.visibility}
              primaryRole={community.primaryRole}
              canCreateRuns={community.canCreateRuns}
            />
          ))}
        </>
      ) : null}

      {session && tab === 'inbox' ? (
        <>
          <SectionHeader
            loading={myInvitesQuery.isPending}
            title="Invitaciones"
            right={pendingInvitesCount > 0 ? <Chip tone="warm">{pendingInvitesCount}</Chip> : undefined}
          />

          {!myInvitesQuery.isPending && pendingInvitesCount === 0 ? (
            <EmptyState
              title="Sin invitaciones."
              body="Cuando alguien te invite a su grupo, te avisamos aquí."
            />
          ) : null}

          {myInvitesQuery.data?.map((invite) => (
            <AppCard key={invite.id}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[19px] font-black text-text">{invite.communityName}</Text>
                  <Text className="mt-[2px] text-[13px] font-bold text-muted-text">
                    {labelForCommunityKind(invite.communityKind)} · {invite.invitedByName}
                  </Text>
                </View>
                <Chip tone="warm">{invite.role}</Chip>
              </View>
              <Text className="text-[13px] text-muted-text">
                Expira el {formatShortDate(invite.expiresAt)}
              </Text>
              <View className="mt-1 flex-row gap-2.5">
                <Pressable
                  disabled={isMutatingInvite}
                  onPress={() => handleInviteAction(invite.id, 'accept')}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutatingInvite ? 0.7 : 1 })}
                  className="flex-1 items-center rounded-[18px] bg-tint py-[13px]">
                    <Text className="text-[14px] font-black text-on-tint">Aceptar</Text>
                </Pressable>
                <Pressable
                  disabled={isMutatingInvite}
                  onPress={() => handleInviteAction(invite.id, 'reject')}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : isMutatingInvite ? 0.7 : 1 })}
                  className="flex-1 items-center rounded-[18px] bg-chip py-[13px]">
                  <Text className="text-[14px] font-black text-text">Rechazar</Text>
                </Pressable>
              </View>
            </AppCard>
          ))}

          <SectionHeader
            loading={myJoinRequestsQuery.isPending}
            title="Solicitudes enviadas"
            right={
              pendingJoinRequestsCount > 0 ? <Chip tone="cool">{pendingJoinRequestsCount}</Chip> : undefined
            }
          />

          {!myJoinRequestsQuery.isPending && (myJoinRequestsQuery.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="Sin solicitudes pendientes."
              body="Si pides entrar a un grupo privado, aquí verás si te aceptan."
            />
          ) : null}

          {myJoinRequestsQuery.data?.map((request) => (
            <AppCard key={request.id}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[19px] font-black text-text">{request.communityName}</Text>
                  <Text className="mt-[2px] text-[13px] font-bold text-muted-text">
                    {labelForCommunityKind(request.communityKind)} · enviada {formatShortDate(request.requestedAt)}
                  </Text>
                </View>
                <Chip
                  tone={request.status === 'approved' ? 'warm' : request.status === 'pending' ? 'cool' : 'neutral'}>
                  {joinRequestStatusLabel(request.status)}
                </Chip>
              </View>
              {request.status === 'approved' || request.status === 'pending' ? (
                <View className="mt-1 flex-row gap-2.5">
                  {request.status === 'approved' ? (
                    <Link href={`/crew/${request.communityId}` as any} asChild>
                      <Pressable
                        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                        className="flex-1 items-center rounded-[18px] bg-tint py-[13px]">
                        <Text className="text-[14px] font-black text-on-tint">Abrir grupo</Text>
                      </Pressable>
                    </Link>
                  ) : null}
                  {request.status === 'pending' ? (
                    <Pressable
                      disabled={isMutatingJoinRequest}
                      onPress={() => cancelJoinRequestMutation.mutateAsync({ requestId: request.id })}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.75 : isMutatingJoinRequest ? 0.7 : 1,
                      })}
                      className="flex-1 items-center rounded-[18px] bg-chip py-[13px]">
                      <Text className="text-[14px] font-black text-text">Cancelar</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </AppCard>
          ))}

          <SectionHeader
            loading={myAccessLinkClaimsQuery.isPending}
            title="Accesos por código"
            right={
              pendingAccessClaimsCount > 0 ? <Chip tone="cool">{pendingAccessClaimsCount}</Chip> : undefined
            }
          />

          {!myAccessLinkClaimsQuery.isPending && (myAccessLinkClaimsQuery.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="Sin códigos usados."
              body="Cuando uses un código para entrar a un grupo, aparecerá aquí."
            />
          ) : null}

          {myAccessLinkClaimsQuery.data?.map((claim) => (
            <AppCard key={claim.id}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[19px] font-black text-text">{claim.communityName}</Text>
                  <Text className="mt-[2px] text-[13px] font-bold text-muted-text">
                    {labelForCommunityKind(claim.communityKind)} · {claim.sourceLabel || claim.accessLinkCode}
                  </Text>
                </View>
                <Chip
                  tone={claim.status === 'approved' ? 'warm' : claim.status === 'pending' ? 'cool' : 'neutral'}>
                  {accessClaimStatusLabel(claim.status)}
                </Chip>
              </View>
              {claim.status === 'approved' ? (
                <Link href={`/crew/${claim.communityId}` as any} asChild>
                  <Pressable
                    style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                    className="mt-1 self-start rounded-[18px] bg-chip px-4 py-3">
                    <Text className="text-[13px] font-black text-text">Abrir grupo</Text>
                  </Pressable>
                </Link>
              ) : null}
            </AppCard>
          ))}
        </>
      ) : null}
    </ScreenScroll>
  );
}

type CommunityListItemProps = {
  canCreateRuns?: boolean;
  city: string;
  description: string;
  highlight?: string;
  id: string;
  kind: CommunityKind;
  mode: CommunityMode;
  name: string;
  pace?: string | null;
  primaryRole?: string | null;
  actionLabel?: string;
  onActionPress?: () => void;
  visibility: CommunityVisibility;
  vibe?: string | null;
};

function CommunityListItem(props: CommunityListItemProps) {
  const {
    canCreateRuns,
    city,
    description,
    highlight,
    id,
    kind,
    mode,
    name,
    actionLabel,
    onActionPress,
    pace,
    primaryRole,
    visibility,
    vibe,
  } = props;
  const { colors } = useAppTheme();
  const cardContent = (
    <View className="flex-row items-center gap-3 rounded-card border border-border bg-surface p-4">
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.hero }}>
        <Text className="text-[17px] font-black text-hero-text">{initialsForCommunity(name)}</Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[18px] font-black leading-[22px] text-text" numberOfLines={1}>
              {name}
            </Text>
            <Text className="mt-[1px] text-[12px] font-bold text-muted-text" numberOfLines={1}>
              {city}
            </Text>
          </View>
          {actionLabel ? (
            <Pressable
              disabled={!onActionPress}
              onPress={onActionPress}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              className="rounded-full bg-chip px-3 py-2">
              <Text className="text-[11px] font-black text-text">{actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text className="mt-2 text-[13px] leading-[18px] text-muted-text" numberOfLines={2}>
          {description}
        </Text>
        <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
          {highlight ? <Chip tone="warm">{highlight}</Chip> : null}
          {pace ? <Chip tone="cool">{pace}</Chip> : null}
          {vibe ? <Chip tone="neutral">{vibe}</Chip> : null}
          <Chip tone={mode === 'managed' ? 'warm' : 'neutral'}>{labelForMode(mode)}</Chip>
          <Chip tone={visibility === 'private' ? 'warm' : 'cool'}>{labelForVisibility(visibility)}</Chip>
          {primaryRole ? <Chip tone="warm">{primaryRole}</Chip> : null}
          {canCreateRuns ? <Chip tone="cool">Organizas</Chip> : null}
        </View>
        <Text className="mt-3 text-[12px] font-bold text-muted-text" numberOfLines={1}>
          {labelForCommunityKind(kind)}
        </Text>
      </View>
      {!actionLabel ? <FontAwesome6 name="chevron-right" size={13} color={colors.mutedText} /> : null}
    </View>
  );

  if (actionLabel && onActionPress) {
    return cardContent;
  }

  return (
    <Link href={`/crew/${id}` as any} asChild>
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
        {cardContent}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  datePill: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  datePillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  meetupCard: {
    borderRadius: 22,
    padding: 16,
    width: 260,
  },
  meetupFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 10,
  },
  meetupNote: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  meetupTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 22,
  },
  runnerCard: {
    gap: 4,
    padding: 14,
    width: 180,
  },
  rsvpButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rsvpButtonText: {
    fontSize: 12,
    fontWeight: '900',
  },
  rsvpMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
});
