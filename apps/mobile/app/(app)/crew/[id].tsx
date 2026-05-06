import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeContext';
import { usePullToRefresh } from '@/components/usePullToRefresh';
import {
  AppButton,
  AppCard,
  Chip,
  CollapsibleCard,
  EmptyState,
  MetaRow,
  ScreenScroll,
  SectionHeader,
} from '@/components/ui/AppUI';
import {
  createMeetupCtaLabel,
  descriptionForMode,
  emptyMeetupsCopy,
  labelForCommunityKind,
  labelForMeetupStyle,
  labelForMode,
  lowerLabelForCommunityKind,
  managedMemberRunsBody,
  managedMemberRunsTitle,
  modeCommunityCardCopy,
} from '@/lib/community-labels';
import { invalidateCommunityMembershipState } from '@/lib/community-membership-cache';
import { hexToRgba } from '@/lib/colors';
import { trpc } from '@/lib/trpc';

type TabValue = 'runs' | 'overview' | 'members' | 'chat' | 'manage';

function formatMeetupLabel(startsAt: string | Date) {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

function formatShortDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function initialsForName(value?: string | null) {
  const words = (value ?? '')
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

function inviteRoleOptionsForViewer(role?: string | null) {
  if (role === 'owner') {
    return ['admin', 'moderator', 'host', 'member'] as const;
  }

  if (role === 'admin') {
    return ['moderator', 'host', 'member'] as const;
  }

  return [] as const;
}

function roleLabel(role?: string | null) {
  switch (role) {
    case 'owner':
      return 'Propietario';
    case 'admin':
      return 'Admin';
    case 'moderator':
      return 'Moderador';
    case 'host':
      return 'Host';
    case 'member':
    default:
      return 'Miembro';
  }
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

function HeroStat({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="flex-1 items-center px-2">
      <Text className="text-[18px] font-black leading-6 text-hero-text">{value}</Text>
      <Text className="mt-0.5 text-[11px] font-bold text-hero-text-muted">{label}</Text>
    </View>
  );
}

function CrewTabs({
  onChange,
  options,
  value,
}: {
  onChange: (value: TabValue) => void;
  options: ReadonlyArray<{ value: TabValue; label: string; badge?: number }>;
  value: TabValue;
}) {
  return (
    <View className="flex-row px-[18px]">
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
            className="flex-1 items-center pt-3">
            <Text
              numberOfLines={1}
              className={`text-[12px] font-black ${isActive ? 'text-hero-text' : 'text-hero-text-muted'}`}>
              {option.label}
            </Text>
            <View className={`mt-3 h-[2px] w-full rounded-full ${isActive ? 'bg-hero-accent' : 'bg-transparent'}`} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CrewDetailScreen() {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const communityId = rawId ?? null;
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<TabValue>('runs');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'moderator' | 'host' | 'member'>('member');
  const [accessLinkRole, setAccessLinkRole] = useState<'admin' | 'moderator' | 'host' | 'member'>('member');
  const [accessLinkSourceLabel, setAccessLinkSourceLabel] = useState('');
  const [accessLinkExpiresDays, setAccessLinkExpiresDays] = useState('14');
  const [accessLinkMaxUses, setAccessLinkMaxUses] = useState('');
  const [accessLinkRequiresApproval, setAccessLinkRequiresApproval] = useState(false);
  const [blockReason, setBlockReason] = useState('');
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
  const cancelMeetupMutation = trpc.meetups.cancel.useMutation({
    onSuccess: async () => {
      if (communityId) {
        await utils.communities.byId.invalidate({ id: communityId });
      }

      await utils.meetups.upcomingPublic.invalidate();
      await utils.profile.publicByUsername.invalidate();
    },
    onError: (error) => {
      Alert.alert('No se pudo cancelar la quedada', error.message);
    },
  });
  const joinMutation = trpc.communities.joinPublic.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await invalidateCommunityMembershipState(utils, { communityId });
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

      await invalidateCommunityMembershipState(utils, { communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo salir', error.message);
    },
  });
  const inviteMutation = trpc.communities.inviteByUsername.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      setInviteUsername('');
      setInviteRole('member');
      await invalidateCommunityMembershipState(utils, { communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo enviar la invitación', error.message);
    },
  });
  const cancelInviteMutation = trpc.communities.cancelInvite.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await invalidateCommunityMembershipState(utils, { communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo cancelar la invitación', error.message);
    },
  });
  const updateRoleMutation = trpc.communities.updateMemberRole.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await invalidateCommunityMembershipState(utils, { communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo actualizar el rol', error.message);
    },
  });
  const removeMemberMutation = trpc.communities.removeMember.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await invalidateCommunityMembershipState(utils, { communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo expulsar al miembro', error.message);
    },
  });
  const blockUserMutation = trpc.communities.blockUser.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      setBlockReason('');
      await invalidateCommunityMembershipState(utils, { communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo bloquear al usuario', error.message);
    },
  });
  const unblockUserMutation = trpc.communities.unblockUser.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await invalidateCommunityMembershipState(utils, { communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo desbloquear al usuario', error.message);
    },
  });
  const createAccessLinkMutation = trpc.communities.createAccessLink.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      setAccessLinkRole('member');
      setAccessLinkSourceLabel('');
      setAccessLinkExpiresDays('14');
      setAccessLinkMaxUses('');
      setAccessLinkRequiresApproval(false);
      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo crear el código', error.message);
    },
  });
  const revokeAccessLinkMutation = trpc.communities.revokeAccessLink.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo revocar el código', error.message);
    },
  });
  const approveAccessClaimMutation = trpc.communities.approveAccessClaim.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await invalidateCommunityMembershipState(utils, { communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo aprobar la solicitud', error.message);
    },
  });
  const rejectAccessClaimMutation = trpc.communities.rejectAccessClaim.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await utils.communities.byId.invalidate({ id: communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo rechazar la solicitud', error.message);
    },
  });
  const reviewJoinRequestMutation = trpc.communities.reviewJoinRequest.useMutation({
    onSuccess: async () => {
      if (!communityId) {
        return;
      }

      await invalidateCommunityMembershipState(utils, { communityId });
    },
    onError: (error) => {
      Alert.alert('No se pudo revisar la solicitud', error.message);
    },
  });
  const community = communityQuery.data?.community;
  const entityLabel = labelForCommunityKind(community?.kind);
  const entityLabelLower = lowerLabelForCommunityKind(community?.kind);
  const inviteRoleOptions = useMemo(
    () => inviteRoleOptionsForViewer(community?.viewerMembershipRole),
    [community?.viewerMembershipRole],
  );
  const isMutatingRsvp = rsvpMutation.isPending || unrsvpMutation.isPending;
  const isMutatingMeetupManage = cancelMeetupMutation.isPending;
  const isMutatingMembership = joinMutation.isPending || leaveMutation.isPending;
  const isMutatingStaff =
    inviteMutation.isPending ||
    cancelInviteMutation.isPending ||
    createAccessLinkMutation.isPending ||
    revokeAccessLinkMutation.isPending ||
    reviewJoinRequestMutation.isPending ||
    approveAccessClaimMutation.isPending ||
    rejectAccessClaimMutation.isPending ||
    updateRoleMutation.isPending ||
    removeMemberMutation.isPending ||
    blockUserMutation.isPending ||
    unblockUserMutation.isPending;
  const { onRefresh, refreshing } = usePullToRefresh(async () => {
    if (!communityId) {
      return;
    }

    await communityQuery.refetch();
  });

  const pendingInvitesCount = communityQuery.data?.pendingInvites.length ?? 0;
  const pendingJoinRequestsCount = communityQuery.data?.pendingJoinRequests.length ?? 0;
  const pendingAccessClaimsCount = communityQuery.data?.pendingAccessClaims.length ?? 0;
  const blockedUsersCount = communityQuery.data?.blockedUsers.length ?? 0;
  const accessLinksCount = communityQuery.data?.accessLinks.length ?? 0;
  const upcomingMeetupsCount = communityQuery.data?.upcomingMeetups.length ?? 0;
  const membersCount = communityQuery.data?.members.length ?? 0;
  const runStaffPreview =
    communityQuery.data?.members
      .filter((memberItem) =>
        memberItem.primaryRole === 'owner' ||
        memberItem.primaryRole === 'admin' ||
        memberItem.primaryRole === 'host',
      )
      .slice(0, 4) ?? [];

  const manageBadge = pendingJoinRequestsCount + pendingAccessClaimsCount;
  const isStaff = Boolean(community?.viewerCanInviteMembers);
  const isMember = Boolean(community?.viewerMembershipRole);
  const createMeetupLabel = createMeetupCtaLabel(community?.mode);

  const tabOptions = useMemo(() => {
    const base: Array<{ value: TabValue; label: string; badge?: number }> = [
      { value: 'runs', label: 'Próximas', badge: upcomingMeetupsCount },
      { value: 'overview', label: 'Info' },
      { value: 'members', label: 'Miembros', badge: isMember ? membersCount : undefined },
      { value: 'chat', label: 'Chat' },
    ];

    if (isStaff) {
      base.push({ value: 'manage', label: 'Ajustes', badge: manageBadge });
    }

    return base;
  }, [upcomingMeetupsCount, membersCount, isMember, isStaff, manageBadge]);

  async function handleMeetupAction(meetupId: number, viewerIsGoing: boolean) {
    if (viewerIsGoing) {
      await unrsvpMutation.mutateAsync({ meetupId });
      return;
    }

    await rsvpMutation.mutateAsync({ meetupId });
  }

  async function handleCancelMeetup(meetupId: number) {
    await cancelMeetupMutation.mutateAsync({ meetupId });
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

  async function handleInvite() {
    if (!communityId || !inviteUsername.trim()) {
      Alert.alert('Falta el username', 'Escribe el username exacto de la persona que quieres invitar al grupo.');
      return;
    }

    await inviteMutation.mutateAsync({
      communityId,
      role: inviteRole,
      username: inviteUsername.trim().replace(/^@+/, '').toLowerCase(),
    });
  }

  async function handleCreateAccessLink() {
    if (!communityId) {
      return;
    }

    const expiresInDays = Number.parseInt(accessLinkExpiresDays, 10);
    const maxUses = accessLinkMaxUses.trim() ? Number.parseInt(accessLinkMaxUses, 10) : null;

    if (Number.isNaN(expiresInDays) || expiresInDays <= 0) {
      Alert.alert('Días inválido', 'Introduce un número de días válido para la expiración.');
      return;
    }

    if (maxUses !== null && (Number.isNaN(maxUses) || maxUses <= 0)) {
      Alert.alert('Límite inválido', 'Si defines un límite de usos, tiene que ser un número positivo.');
      return;
    }

    await createAccessLinkMutation.mutateAsync({
      communityId,
      defaultRole: accessLinkRole,
      expiresInDays,
      maxUses,
      requiresApproval: accessLinkRequiresApproval,
      sourceLabel: accessLinkSourceLabel.trim() || undefined,
    });
  }

  async function handleShareAccessCode(code: string) {
    if (!community?.name) {
      return;
    }

    const accessUrl = Linking.createURL('/community-access', {
      queryParams: { code },
    });

    await Share.share({
      message: `Únete a ${community.name} en AppRunners con el código ${code}. También puedes entrar con este enlace: ${accessUrl}`,
    });
  }

  async function handleRoleChange(userId: string, role: 'admin' | 'moderator' | 'host' | 'member') {
    if (!communityId) {
      return;
    }

    await updateRoleMutation.mutateAsync({
      communityId,
      role,
      userId,
    });
  }

  async function handleRemoveMember(userId: string) {
    if (!communityId) {
      return;
    }

    await removeMemberMutation.mutateAsync({
      communityId,
      userId,
    });
  }

  async function handleBlockUser(userId: string) {
    if (!communityId) {
      return;
    }

    await blockUserMutation.mutateAsync({
      communityId,
      reason: blockReason.trim() || undefined,
      userId,
    });
  }

  async function handleUnblockUser(userId: string) {
    if (!communityId) {
      return;
    }

    await unblockUserMutation.mutateAsync({
      communityId,
      userId,
    });
  }

  if (communityQuery.error) {
    return (
      <ScreenScroll title="Grupo" onRefresh={communityId ? onRefresh : undefined} refreshing={refreshing}>
        <AppCard>
          <Text className="text-[25px] font-black text-text">Comunidad no disponible</Text>
          <Text className="text-[15px] leading-[23px] text-muted-text">{communityQuery.error.message}</Text>
        </AppCard>
      </ScreenScroll>
    );
  }

  const previewMeetups = (communityQuery.data?.upcomingMeetups ?? []).slice(0, 3);
  const previewMembers = (communityQuery.data?.members ?? []).slice(0, 5);
  const heroControlSurface = hexToRgba(colors.heroOverlay, 0.1);
  const heroAvatarSurface = hexToRgba(colors.heroOverlay, 0.2);

  return (
    <ScreenScroll
      contentStyle={{ paddingTop: 0 }}
      onRefresh={communityId ? onRefresh : undefined}
      refreshing={refreshing}>
      <View className="overflow-hidden rounded-b-[26px] bg-hero" style={{ marginHorizontal: -18 }}>
        <View className="px-[18px] pb-0 pt-4">
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityLabel="Volver"
              hitSlop={10}
              onPress={() => router.back()}
              className="h-9 w-9 items-center justify-center rounded-full"
              style={({ pressed }) => ({ backgroundColor: heroControlSurface, opacity: pressed ? 0.75 : 1 })}>
              <FontAwesome6 name="chevron-left" size={15} color={colors.heroText} />
            </Pressable>
            <Pressable
              accessibilityLabel="Más opciones"
              hitSlop={10}
              onPress={() => (isStaff ? setTab('manage') : undefined)}
              style={({ pressed }) => ({ backgroundColor: heroControlSurface, opacity: pressed ? 0.75 : 1 })}
              className="h-9 w-9 items-center justify-center rounded-full">
              <FontAwesome6 name="ellipsis-vertical" size={15} color={colors.heroText} solid />
            </Pressable>
          </View>

          <View className="items-center pb-4 pt-1">
            <View className="relative">
              <View
                className="h-[82px] w-[82px] items-center justify-center rounded-full border border-hero-accent"
                style={{ backgroundColor: heroAvatarSurface }}>
                <Text className="text-[28px] font-black text-hero-text">
                  {initialsForName(community?.name)}
                </Text>
              </View>
              {community ? (
                <View className="absolute bottom-1 right-0 h-5 w-5 rounded-full border-2 border-hero bg-success" />
              ) : null}
            </View>

            <Text className="mt-4 text-center text-[24px] font-black leading-[28px] text-hero-text">
              {community?.name ?? 'Cargando...'}
            </Text>
            <Text className="mt-1 text-center text-[14px] font-bold text-hero-text-muted">
              {community?.city ?? 'Community'}
            </Text>

            {community ? (
              <>
                <View className="mt-4 flex-row flex-wrap justify-center gap-2">
                  {community.pace ? <Chip tone="cool">{community.pace}</Chip> : null}
                  {community.vibe ? <Chip tone="neutral">{community.vibe}</Chip> : null}
                </View>
                <Text className="mt-4 max-w-[280px] text-center text-[15px] font-bold leading-[22px] text-hero-text">
                  {community.description}
                </Text>

                <View
                  className="mt-5 w-full rounded-card border border-hero-accent/40 p-3"
                  style={{ backgroundColor: colors.elevatedSurface }}>
                  <View className="flex-row items-center">
                    <HeroStat label="Miembros" value={isMember ? membersCount : '—'} />
                    <View className="h-9 w-px bg-border/40" />
                    <HeroStat label="Quedadas" value={upcomingMeetupsCount} />
                    <View className="h-9 w-px bg-border/40" />
                    <HeroStat label="Admins" value={Math.max(1, runStaffPreview.length)} />
                  </View>

                  {community.viewerCanCreateRuns ? (
                    <Pressable
                      disabled={isMutatingStaff}
                      onPress={() => router.push({ pathname: '/modal', params: { communityId } } as any)}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.82 : isMutatingStaff ? 0.6 : 1,
                      })}
                      className="mt-3 items-center rounded-[14px] bg-tint py-3.5">
                      <Text className="text-[14px] font-black text-on-tint">{createMeetupLabel}</Text>
                    </Pressable>
                  ) : community.visibility === 'public' && community.viewerMembershipRole !== 'owner' ? (
                    <Pressable
                      disabled={isMutatingMembership}
                      onPress={handleMembershipAction}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.82 : isMutatingMembership ? 0.6 : 1,
                      })}
                      className="mt-3 items-center rounded-[14px] bg-tint py-3.5">
                      <Text className="text-[14px] font-black text-on-tint">
                        {community.viewerMembershipRole
                          ? isMutatingMembership
                            ? 'Saliendo...'
                            : 'Salir del grupo'
                          : isMutatingMembership
                            ? 'Uniéndote...'
                            : 'Unirme a la crew'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </View>

        {community ? <CrewTabs options={tabOptions} value={tab} onChange={setTab} /> : null}
      </View>

      {tab === 'overview' && community ? (
        <>
          <AppCard>
            <Text className="text-[13px] font-black uppercase tracking-[0.6px] text-muted-text">
              Resumen
            </Text>
            <MetaRow
              items={[
                { label: 'Quedadas', value: upcomingMeetupsCount },
                { label: 'Miembros', value: isMember ? membersCount : '—' },
                { label: 'Códigos', value: isStaff ? accessLinksCount : '—' },
              ]}
            />
          </AppCard>

          <AppCard>
            <Text className="text-[13px] font-black uppercase tracking-[0.6px] text-muted-text">
              Cómo se organiza
            </Text>
            <Text className="mt-2 text-[19px] font-black leading-6 text-text">
              {labelForMode(community.mode)} · {labelForMeetupStyle(community.mode)}
            </Text>
            <Text className="mt-2 text-[14px] leading-[21px] text-muted-text">
              {descriptionForMode(community.mode)}
            </Text>
            <Text className="mt-2 text-[14px] leading-[21px] text-muted-text">
              {modeCommunityCardCopy(community.mode)}
            </Text>
          </AppCard>

          <SectionHeader
            title="Próximas quedadas"
            right={
              upcomingMeetupsCount > 3 ? (
                <Pressable
                  onPress={() => setTab('runs')}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                  <Text className="text-[13px] font-black text-tint">Ver todas</Text>
                </Pressable>
              ) : undefined
            }
          />

          {upcomingMeetupsCount === 0 ? (
            <EmptyState
              title="Sin salidas próximas."
              body={emptyMeetupsCopy(community.mode, entityLabelLower)}
            />
          ) : null}

          {previewMeetups.map((meetup) => (
            <MeetupRow
              key={meetup.id}
              communityId={communityId}
              disabled={isMutatingRsvp}
              manageDisabled={isMutatingMeetupManage}
              meetup={meetup}
              mode={community.mode}
              onCancel={handleCancelMeetup}
              onRsvp={handleMeetupAction}
            />
          ))}

          {isMember && membersCount > 0 ? (
            <>
              <SectionHeader
                title="Miembros recientes"
                right={
                  membersCount > 5 ? (
                    <Pressable
                      onPress={() => setTab('members')}
                      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                      <Text className="text-[13px] font-black text-tint">Ver todos</Text>
                    </Pressable>
                  ) : undefined
                }
              />
              {previewMembers.map((member) => (
                <MemberRow key={member.userId} name={member.name} role={member.primaryRole} username={member.username} />
              ))}
            </>
          ) : null}

          {!isMember && (communityQuery.data?.activeRunners.length ?? 0) > 0 ? (
            <>
              <SectionHeader title={`Runners en esta ${entityLabelLower}`} />
              {communityQuery.data?.activeRunners.map((runner) => (
                <RunnerRow key={runner.id} runner={runner} />
              ))}
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'runs' && community ? (
        <>
          {community.viewerCanCreateRuns ? (
            <AppButton
              onPress={() => router.push({ pathname: '/modal', params: { communityId } } as any)}>
              {createMeetupLabel}
            </AppButton>
          ) : null}

          {community.mode === 'managed' && isMember && !community.viewerCanCreateRuns ? (
            <AppCard>
              <Text className="text-[13px] font-black uppercase tracking-[0.6px] text-muted-text">
                {managedMemberRunsTitle()}
              </Text>
              <Text className="mt-2 text-[18px] font-black leading-6 text-text">
                El equipo organizador publica las quedadas.
              </Text>
              <Text className="mt-1 text-[14px] leading-[21px] text-muted-text">
                {managedMemberRunsBody(entityLabelLower)}
              </Text>
              {runStaffPreview.length > 0 ? (
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {runStaffPreview.map((memberItem) => (
                    <Chip key={memberItem.userId} tone="warm">
                      {roleLabel(memberItem.primaryRole)} · {memberItem.username ? `@${memberItem.username}` : memberItem.name}
                    </Chip>
                  ))}
                </View>
              ) : null}
            </AppCard>
          ) : null}

          {upcomingMeetupsCount === 0 ? (
            <EmptyState
              title="Sin salidas próximas."
              body={emptyMeetupsCopy(community.mode, entityLabelLower)}
            />
          ) : null}

          {communityQuery.data?.upcomingMeetups.map((meetup) => (
            <MeetupRow
              key={meetup.id}
              communityId={communityId}
              disabled={isMutatingRsvp}
              manageDisabled={isMutatingMeetupManage}
              meetup={meetup}
              mode={community.mode}
              onCancel={handleCancelMeetup}
              onRsvp={handleMeetupAction}
            />
          ))}
        </>
      ) : null}

      {tab === 'chat' && community ? (
        <EmptyState
          title="Chat todavía no disponible."
          body="Cuando conectemos conversación de grupo, vivirá aquí."
        />
      ) : null}

      {tab === 'members' && community ? (
        <>
          {isMember ? (
            <>
              {membersCount === 0 ? (
                <EmptyState
                  title="Sin miembros aún."
                  body="Cuando alguien se apunte a una salida o entre al grupo, verás aquí a todos."
                />
              ) : null}

              {communityQuery.data?.members.map((member) => (
                <MemberRow
                  key={member.userId}
                  name={member.name}
                  role={member.primaryRole}
                  username={member.username}
                  joinedAt={member.joinedAt}
                  roleTargets={member.availableRoleTargets}
                  canRemove={member.canRemove}
                  canBlock={member.canBlock}
                  isViewer={member.isViewer}
                  onRoleChange={(role) => handleRoleChange(member.userId, role)}
                  onRemove={() => handleRemoveMember(member.userId)}
                  onBlock={() => handleBlockUser(member.userId)}
                  blockReason={blockReason}
                  onBlockReasonChange={setBlockReason}
                  disabled={isMutatingStaff}
                />
              ))}

              {isStaff && blockedUsersCount > 0 ? (
                <CollapsibleCard title="Bloqueos" badge={blockedUsersCount}>
                  {communityQuery.data?.blockedUsers.map((blockedUser) => (
                    <View
                      key={blockedUser.userId}
                      className="gap-2 rounded-2xl border border-border bg-background p-3">
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <Text className="text-[16px] font-black text-text">{blockedUser.name}</Text>
                          <Text className="mt-[2px] text-[12px] font-bold text-muted-text">
                            @{blockedUser.username} · {formatShortDate(blockedUser.blockedAt)}
                          </Text>
                          {blockedUser.reason ? (
                            <Text className="mt-1 text-[13px] leading-[18px] text-muted-text">
                              {blockedUser.reason}
                            </Text>
                          ) : null}
                        </View>
                        {blockedUser.canUnblock ? (
                          <Pressable
                            disabled={isMutatingStaff}
                            onPress={() => handleUnblockUser(blockedUser.userId)}
                            style={({ pressed }) => ({
                              opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1,
                            })}
                            className="rounded-[16px] bg-chip px-3 py-2.5">
                            <Text className="text-[13px] font-black text-text">Desbloquear</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </CollapsibleCard>
              ) : null}
            </>
          ) : (
            <>
              <SectionHeader title={`Runners en esta ${entityLabelLower}`} />
              {(communityQuery.data?.activeRunners.length ?? 0) === 0 ? (
                <EmptyState
                  title="Sin runners visibles aún."
                  body="Los runners aparecen aquí cuando crean o se apuntan a salidas del grupo."
                />
              ) : null}
              {communityQuery.data?.activeRunners.map((runner) => (
                <RunnerRow key={runner.id} runner={runner} />
              ))}
            </>
          )}
        </>
      ) : null}

      {tab === 'manage' && community && isStaff ? (
        <>
          <CollapsibleCard
            title="Invitar a alguien"
            subtitle="Para gente que ya tiene cuenta en AppRunners"
            defaultOpen={pendingInvitesCount === 0 && pendingJoinRequestsCount === 0 && pendingAccessClaimsCount === 0}>
            <TextInput
              autoCapitalize="none"
              onChangeText={setInviteUsername}
              placeholder="@username"
              placeholderTextColor={colors.mutedText}
              style={[
                styles.input,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={inviteUsername}
            />
            <View className="flex-row flex-wrap gap-2">
              {inviteRoleOptions.map((role) => (
                <Chip key={role} selected={inviteRole === role} onPress={() => setInviteRole(role)}>
                  {roleLabel(role)}
                </Chip>
              ))}
            </View>
            <AppButton disabled={isMutatingStaff} onPress={handleInvite}>
              {inviteMutation.isPending ? 'Invitando...' : 'Enviar invitación'}
            </AppButton>

            {pendingInvitesCount > 0 ? (
              <>
                <Text className="mt-2 text-[13px] font-black uppercase tracking-[0.6px] text-muted-text">
                  Pendientes · {pendingInvitesCount}
                </Text>
                {communityQuery.data?.pendingInvites.map((invite) => (
                  <View
                    key={invite.id}
                    className="gap-2 rounded-2xl border border-border bg-background p-3">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-[16px] font-black text-text">@{invite.invitedUsername}</Text>
                        <Text className="mt-[2px] text-[12px] font-bold text-muted-text">
                          {invite.invitedByName} · expira {formatShortDate(invite.expiresAt)}
                        </Text>
                      </View>
                      <Chip tone="warm">{roleLabel(invite.role)}</Chip>
                    </View>
                    {invite.canCancel ? (
                      <Pressable
                        disabled={isMutatingStaff}
                        onPress={() => cancelInviteMutation.mutateAsync({ inviteId: invite.id })}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1,
                        })}
                        className="self-start rounded-[14px] bg-chip px-3 py-2">
                        <Text className="text-[13px] font-black text-text">Cancelar</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </>
            ) : null}
          </CollapsibleCard>

          {community.visibility === 'private' ? (
            <CollapsibleCard
              title="Solicitudes de entrada"
              subtitle="Gente que pidió entrar desde búsqueda"
              badge={pendingJoinRequestsCount}
              defaultOpen={pendingJoinRequestsCount > 0}>
              {pendingJoinRequestsCount === 0 ? (
                <EmptyState
                  title="Sin solicitudes que revisar."
                  body="Cuando alguien pida entrar al grupo privado, aparecerá aquí."
                />
              ) : null}
              {communityQuery.data?.pendingJoinRequests.map((request) => (
                <View
                  key={request.id}
                  className="gap-2 rounded-2xl border border-border bg-background p-3">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-[16px] font-black text-text">{request.userName}</Text>
                      <Text className="mt-[2px] text-[12px] font-bold text-muted-text">
                        @{request.username} · {formatShortDate(request.requestedAt)}
                      </Text>
                    </View>
                    <Chip tone="cool">Pendiente</Chip>
                  </View>
                  <View className="flex-row gap-2">
                    <Pressable
                      disabled={isMutatingStaff}
                      onPress={() =>
                        reviewJoinRequestMutation.mutateAsync({ action: 'approve', requestId: request.id })
                      }
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1,
                      })}
                      className="flex-1 items-center rounded-[14px] bg-tint py-2.5">
                      <Text className="text-[13px] font-black text-on-tint">Aprobar</Text>
                    </Pressable>
                    <Pressable
                      disabled={isMutatingStaff}
                      onPress={() =>
                        reviewJoinRequestMutation.mutateAsync({ action: 'reject', requestId: request.id })
                      }
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1,
                      })}
                      className="flex-1 items-center rounded-[14px] bg-chip py-2.5">
                      <Text className="text-[13px] font-black text-text">Rechazar</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </CollapsibleCard>
          ) : null}

          <CollapsibleCard
            title="Códigos de acceso"
            subtitle="Códigos reutilizables para bio, stories o DM"
            badge={accessLinksCount}>
            <Text className="text-[13px] leading-[18px] text-muted-text">
              {community.kind === 'creator_community'
                ? 'Como es un grupo dirigido, te recomendamos pedir aprobación en los códigos.'
                : community.kind === 'club' && community.visibility === 'private'
                  ? 'Es un club privado: activa la aprobación para decidir quién entra.'
                  : community.kind === 'crew_local' && community.visibility === 'public'
                    ? 'Es público: puedes dar códigos sin aprobación, que entren directo.'
                    : 'Con un código abierto, entra cualquiera. Si necesitas filtrar, pide aprobación.'}
            </Text>

            <TextInput
              onChangeText={setAccessLinkSourceLabel}
              placeholder="Etiqueta (ej. instagram-bio)"
              placeholderTextColor={colors.mutedText}
              style={[
                styles.input,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={accessLinkSourceLabel}
            />

            <View className="flex-row flex-wrap gap-2">
              {inviteRoleOptions.map((role) => (
                <Chip
                  key={`access-link-${role}`}
                  selected={accessLinkRole === role}
                  onPress={() => setAccessLinkRole(role)}>
                  {roleLabel(role)}
                </Chip>
              ))}
            </View>

            <View className="flex-row gap-3">
              <TextInput
                keyboardType="number-pad"
                onChangeText={setAccessLinkExpiresDays}
                placeholder="Días (14)"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  styles.halfInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
                value={accessLinkExpiresDays}
              />
              <TextInput
                keyboardType="number-pad"
                onChangeText={setAccessLinkMaxUses}
                placeholder="Máx. usos"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  styles.halfInput,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
                value={accessLinkMaxUses}
              />
            </View>

            <View className="flex-row flex-wrap gap-2">
              <Chip selected={!accessLinkRequiresApproval} onPress={() => setAccessLinkRequiresApproval(false)}>
                Acceso directo
              </Chip>
              <Chip selected={accessLinkRequiresApproval} onPress={() => setAccessLinkRequiresApproval(true)}>
                Con aprobación
              </Chip>
            </View>

            <AppButton disabled={isMutatingStaff} onPress={handleCreateAccessLink}>
              {createAccessLinkMutation.isPending ? 'Creando código...' : 'Crear código'}
            </AppButton>

            {accessLinksCount > 0 ? (
              <>
                <Text className="mt-2 text-[13px] font-black uppercase tracking-[0.6px] text-muted-text">
                  Activos · {accessLinksCount}
                </Text>
                {communityQuery.data?.accessLinks.map((accessLink) => (
                  <View
                    key={accessLink.id}
                    className="gap-2 rounded-2xl border border-border bg-background p-3">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-[16px] font-black text-text">{accessLink.code}</Text>
                        <Text className="mt-[2px] text-[12px] font-bold text-muted-text">
                          {accessLink.sourceLabel || 'sin etiqueta'} · expira{' '}
                          {formatShortDate(accessLink.expiresAt)}
                        </Text>
                      </View>
                      <Chip tone="warm">{roleLabel(accessLink.defaultRole)}</Chip>
                    </View>
                    <View className="flex-row flex-wrap gap-1.5">
                      <Chip tone="cool">{accessLink.requiresApproval ? 'Con aprobación' : 'Auto join'}</Chip>
                      <Chip tone="neutral">
                        {accessLink.maxUses
                          ? `${accessLink.usesCount}/${accessLink.maxUses}`
                          : `${accessLink.usesCount} usos`}
                      </Chip>
                      {accessLink.pendingClaims > 0 ? (
                        <Chip tone="warm">{accessLink.pendingClaims} pendientes</Chip>
                      ) : null}
                      <Chip tone={accessLink.isActive ? 'warm' : 'neutral'}>
                        {accessLink.isActive ? 'Activo' : 'Revocado'}
                      </Chip>
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable
                        disabled={isMutatingStaff}
                        onPress={() => handleShareAccessCode(accessLink.code)}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1,
                        })}
                        className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[14px] bg-chip py-2.5">
                        <FontAwesome6 name="share-nodes" size={12} color={colors.text} solid />
                        <Text className="text-[13px] font-black text-text">Compartir</Text>
                      </Pressable>
                      {accessLink.canRevoke ? (
                        <Pressable
                          disabled={isMutatingStaff}
                          onPress={() =>
                            revokeAccessLinkMutation.mutateAsync({ accessLinkId: accessLink.id })
                          }
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1,
                          })}
                          className="flex-1 items-center rounded-[14px] bg-chip py-2.5">
                          <Text className="text-[13px] font-black text-danger">Revocar</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </CollapsibleCard>

          <CollapsibleCard
            title="Solicitudes por código"
            subtitle="Solicitudes recibidas por código"
            badge={pendingAccessClaimsCount}
            defaultOpen={pendingAccessClaimsCount > 0}>
            {pendingAccessClaimsCount === 0 ? (
              <EmptyState
                title="Sin solicitudes que revisar."
                body="Cuando alguien entre por un código que requiera aprobación, aparecerá aquí."
              />
            ) : null}

            {communityQuery.data?.pendingAccessClaims.map((claim) => (
              <View
                key={claim.id}
                className="gap-2 rounded-2xl border border-border bg-background p-3">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-[16px] font-black text-text">{claim.userName}</Text>
                    <Text className="mt-[2px] text-[12px] font-bold text-muted-text">
                      @{claim.username} · {claim.sourceLabel || claim.accessLinkCode}
                    </Text>
                  </View>
                  <Chip tone="warm">{formatShortDate(claim.requestedAt)}</Chip>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    disabled={isMutatingStaff}
                    onPress={() => approveAccessClaimMutation.mutateAsync({ claimId: claim.id })}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1,
                    })}
                    className="flex-1 items-center rounded-[14px] bg-tint py-2.5">
                    <Text className="text-[13px] font-black text-on-tint">Aprobar</Text>
                  </Pressable>
                  <Pressable
                    disabled={isMutatingStaff}
                    onPress={() => rejectAccessClaimMutation.mutateAsync({ claimId: claim.id })}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1,
                    })}
                    className="flex-1 items-center rounded-[14px] bg-chip py-2.5">
                    <Text className="text-[13px] font-black text-text">Rechazar</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {(communityQuery.data?.recentAccessClaims.length ?? 0) > 0 ? (
              <>
                <Text className="mt-3 text-[13px] font-black uppercase tracking-[0.6px] text-muted-text">
                  Historial reciente
                </Text>
                {communityQuery.data?.recentAccessClaims.map((claim) => (
                  <View
                    key={claim.id}
                    className="gap-1 rounded-2xl border border-border bg-background p-3">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-[15px] font-black text-text">{claim.userName}</Text>
                        <Text className="mt-[1px] text-[12px] font-bold text-muted-text">
                          @{claim.username} · {claim.sourceLabel || claim.accessLinkCode}
                        </Text>
                      </View>
                      <Chip
                        tone={
                          claim.status === 'approved'
                            ? 'warm'
                            : claim.status === 'pending'
                              ? 'cool'
                              : 'neutral'
                        }>
                        {accessClaimStatusLabel(claim.status)}
                      </Chip>
                    </View>
                    <Text className="text-[12px] text-muted-text">
                      Solicitud {formatShortDate(claim.requestedAt)}
                      {claim.reviewedAt ? ` · revisión ${formatShortDate(claim.reviewedAt)}` : ''}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}
          </CollapsibleCard>

          {(communityQuery.data?.accessLinkSources.length ?? 0) > 0 ? (
            <CollapsibleCard
              title="Actividad por canal"
              subtitle="Qué canal genera más entradas al grupo">
              {communityQuery.data?.accessLinkSources.map((source) => (
                <View
                  key={source.sourceLabel}
                  className="gap-2 rounded-2xl border border-border bg-background p-3">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-[16px] font-black text-text">{source.sourceLabel}</Text>
                      <Text className="mt-[2px] text-[12px] font-bold text-muted-text">
                        {source.totalLinks} links · {source.totalUses} usos
                      </Text>
                    </View>
                    <Chip tone="warm">{source.approvedClaims} aceptadas</Chip>
                  </View>
                  {source.pendingClaims > 0 ? (
                    <View className="flex-row flex-wrap gap-1.5">
                      <Chip tone="cool">{source.pendingClaims} pendientes</Chip>
                    </View>
                  ) : null}
                </View>
              ))}
            </CollapsibleCard>
          ) : null}

          {blockedUsersCount > 0 ? (
            <CollapsibleCard title="Bloqueos" badge={blockedUsersCount}>
              {communityQuery.data?.blockedUsers.map((blockedUser) => (
                <View
                  key={blockedUser.userId}
                  className="gap-2 rounded-2xl border border-border bg-background p-3">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-[16px] font-black text-text">{blockedUser.name}</Text>
                      <Text className="mt-[2px] text-[12px] font-bold text-muted-text">
                        @{blockedUser.username} · {formatShortDate(blockedUser.blockedAt)}
                      </Text>
                      {blockedUser.reason ? (
                        <Text className="mt-1 text-[13px] leading-[18px] text-muted-text">
                          {blockedUser.reason}
                        </Text>
                      ) : null}
                    </View>
                    {blockedUser.canUnblock ? (
                      <Pressable
                        disabled={isMutatingStaff}
                        onPress={() => handleUnblockUser(blockedUser.userId)}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.75 : isMutatingStaff ? 0.7 : 1,
                        })}
                        className="rounded-[14px] bg-chip px-3 py-2">
                        <Text className="text-[13px] font-black text-text">Desbloquear</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </CollapsibleCard>
          ) : null}
        </>
      ) : null}
    </ScreenScroll>
  );
}

type MeetupRowProps = {
  communityId: string | null;
  disabled: boolean;
  manageDisabled: boolean;
  meetup: {
    attendees: Array<{
      name: string;
      userId: string;
      username: string | null;
    }>;
    createdByName?: string | null;
    createdByPrimaryRole?: string | null;
    createdByUsername?: string | null;
    id: number;
    title: string;
    startsAt: string | Date;
    distanceKm: number;
    location: string;
    messageCount?: number;
    rsvpCount: number;
    viewerCanManage?: boolean;
    viewerIsMember?: boolean;
    viewerIsGoing: boolean;
  };
  mode: 'collaborative' | 'managed';
  onCancel: (meetupId: number) => void;
  onRsvp: (meetupId: number, viewerIsGoing: boolean) => void;
};

function MeetupRow({
  communityId,
  disabled,
  manageDisabled,
  meetup,
  mode,
  onCancel,
  onRsvp,
}: MeetupRowProps) {
  const [showAttendees, setShowAttendees] = useState(false);
  const canManage = Boolean(meetup.viewerCanManage);
  const canSeeAttendees = canManage || Boolean(meetup.viewerIsMember);

  function handleEdit() {
    if (!communityId) {
      return;
    }

    router.push({ pathname: '/modal', params: { communityId, meetupId: String(meetup.id) } } as any);
  }

  function confirmCancel() {
    Alert.alert(
      'Cancelar quedada',
      'Se borrará la quedada y sus apuntados actuales. Esta acción no se puede deshacer.',
      [
        { text: 'Seguir editando', style: 'cancel' },
        {
          text: 'Cancelar quedada',
          style: 'destructive',
          onPress: () => onCancel(meetup.id),
        },
      ],
    );
  }

  const formattedDate = formatShortDate(meetup.startsAt).split(' ');
  const attendeePreview = meetup.attendees.slice(0, 4);
  const extraAttendees = Math.max(0, meetup.attendees.length - attendeePreview.length);

  return (
    <View className="border-b border-border bg-surface px-4 py-4">
      <Pressable
        onPress={() => router.push(`/meetup/${meetup.id}` as any)}
        style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        className="flex-row items-center gap-3">
        <View className="w-[50px] items-center rounded-[12px] bg-chip px-2 py-2">
          <Text className="text-[20px] font-black leading-6 text-text">{formattedDate[0]}</Text>
          <Text className="text-[10px] font-black uppercase text-muted-text">{formattedDate[1] ?? ''}</Text>
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-[16px] font-black leading-[20px] text-text" numberOfLines={1}>
            {meetup.title}
          </Text>
          <Text className="text-[12px] font-bold leading-[17px] text-muted-text" numberOfLines={1}>
            {meetup.distanceKm} km · {meetup.location}
          </Text>
          <Text className="text-[12px] font-bold leading-[18px] text-muted-text" numberOfLines={1}>
            {formatMeetupLabel(meetup.startsAt)}
          </Text>
        </View>
      </Pressable>

      <View className="mt-3 flex-row items-center justify-between gap-3 pl-[62px]">
        <View className="flex-row items-center">
          {attendeePreview.map((attendee, index) => (
            <View
              key={attendee.userId}
              className="h-6 w-6 items-center justify-center rounded-full border border-surface bg-chip"
              style={{ marginLeft: index === 0 ? 0 : -7 }}>
              <Text className="text-[8px] font-black text-text">
                {initialsForName(attendee.username ?? attendee.name)}
              </Text>
            </View>
          ))}
          {extraAttendees > 0 ? (
            <View className="ml-1 h-6 min-w-6 items-center justify-center rounded-full bg-chip px-1.5">
              <Text className="text-[9px] font-black text-text">+{extraAttendees}</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          disabled={disabled}
          onPress={() => onRsvp(meetup.id, meetup.viewerIsGoing)}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : disabled ? 0.7 : 1 })}
          className={`rounded-full px-4 py-2.5 ${meetup.viewerIsGoing ? 'bg-chip' : 'bg-tint'}`}>
          <Text className={`text-[12px] font-black ${meetup.viewerIsGoing ? 'text-text' : 'text-on-tint'}`}>
            {meetup.viewerIsGoing ? 'Apuntado' : 'Me apunto'}
          </Text>
        </Pressable>
      </View>

      {canSeeAttendees || canManage ? (
        <View className="mt-2 pl-[62px]">
          {canSeeAttendees ? (
            <View className="flex-row flex-wrap gap-2">
              {canManage ? (
                <Pressable
                  disabled={manageDisabled}
                  onPress={handleEdit}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : manageDisabled ? 0.7 : 1 })}
                  className="rounded-full bg-chip px-3 py-1.5">
                  <Text className="text-[12px] font-black text-text">Editar</Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={canManage ? manageDisabled : disabled}
                onPress={() => setShowAttendees((current) => !current)}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : (canManage ? manageDisabled : disabled) ? 0.7 : 1 })}
                className="rounded-full bg-chip px-3 py-1.5">
                <Text className="text-[12px] font-black text-text">
                  {showAttendees ? 'Ocultar quién va' : `Ver quién va · ${meetup.attendees.length}`}
                </Text>
              </Pressable>
              {canManage ? (
                <Pressable
                  disabled={manageDisabled}
                  onPress={confirmCancel}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : manageDisabled ? 0.7 : 1 })}
                  className="rounded-full bg-danger-surface px-3 py-1.5">
                  <Text className="text-[12px] font-black text-danger">Cancelar</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {canSeeAttendees && showAttendees ? (
            <View className="mt-2 gap-2 rounded-2xl bg-background px-3 py-3">
              <Text className="text-[12px] font-black uppercase tracking-[0.5px] text-muted-text">
                Quién va · {meetup.attendees.length}
              </Text>
              {meetup.attendees.length === 0 ? (
                <Text className="text-[13px] leading-[19px] text-muted-text">
                  Todavía no hay gente apuntada.
                </Text>
              ) : (
                meetup.attendees.map((attendee) => (
                  <View key={attendee.userId} className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-[14px] font-bold text-text" numberOfLines={1}>
                      {attendee.username ? `@${attendee.username}` : attendee.name}
                    </Text>
                    <Text className="text-[12px] font-bold text-muted-text" numberOfLines={1}>
                      {attendee.username ? attendee.name : 'Runner'}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

type RunnerRowProps = {
  runner: {
    id: string | number;
    username: string | null;
    area?: string | null;
    city?: string | null;
    pace: string;
    level?: string | null;
  };
};

function RunnerRow({ runner }: RunnerRowProps) {
  const { colors } = useAppTheme();
  const username = runner.username;
  const fallbackInitials = (username ?? String(runner.id)).slice(0, 2).toUpperCase();

  const content = (
    <View className="flex-row items-center gap-3 rounded-card border border-border bg-surface p-4">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-chip">
        <Text className="text-[15px] font-black text-text">{fallbackInitials}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[16px] font-black text-text" numberOfLines={1}>
          {username ? `@${username}` : 'Runner privado'}
        </Text>
        <Text className="mt-[2px] text-[12px] font-bold text-muted-text" numberOfLines={1}>
          {[runner.area, runner.city].filter(Boolean).join(' · ') || 'Ubicación privada'}
        </Text>
        <View className="mt-1.5 flex-row flex-wrap gap-1.5">
          <Chip tone="cool">{runner.pace}</Chip>
          {runner.level ? <Chip tone="warm">{runner.level}</Chip> : null}
        </View>
      </View>
      {username ? <FontAwesome6 name="chevron-right" size={13} color={colors.mutedText} /> : null}
    </View>
  );

  if (!username) {
    return content;
  }

  return (
    <Link href={`/runner/${username}` as any} asChild>
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>{content}</Pressable>
    </Link>
  );
}

type MemberRowProps = {
  blockReason?: string;
  canBlock?: boolean;
  canRemove?: boolean;
  disabled?: boolean;
  isViewer?: boolean;
  joinedAt?: string | Date | null;
  name: string | null;
  onBlock?: () => void;
  onBlockReasonChange?: (value: string) => void;
  onRemove?: () => void;
  onRoleChange?: (role: 'admin' | 'moderator' | 'host' | 'member') => void;
  role?: string | null;
  roleTargets?: ReadonlyArray<'admin' | 'moderator' | 'host' | 'member'>;
  username: string | null;
};

function MemberRow(props: MemberRowProps) {
  const {
    blockReason,
    canBlock,
    canRemove,
    disabled,
    isViewer,
    joinedAt,
    name,
    onBlock,
    onBlockReasonChange,
    onRemove,
    onRoleChange,
    role,
    roleTargets,
    username,
  } = props;
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const hasActions =
    (roleTargets && roleTargets.length > 0) || ((canRemove || canBlock) && !isViewer);

  return (
    <View className="rounded-card border border-border bg-surface">
      <Pressable
        disabled={!hasActions}
        onPress={() => setExpanded((prev) => !prev)}
        style={({ pressed }) => ({ opacity: pressed && hasActions ? 0.85 : 1 })}
        className="flex-row items-center gap-3 p-4">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-chip">
          <Text className="text-[15px] font-black text-text">
            {(name || username || '??').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-[16px] font-black text-text" numberOfLines={1}>
            {name ?? username ?? 'Runner'}
          </Text>
          <Text className="mt-[2px] text-[12px] font-bold text-muted-text" numberOfLines={1}>
            {username ? `@${username}` : 'Perfil privado'}
            {joinedAt ? ` · desde ${formatShortDate(joinedAt)}` : ''}
          </Text>
        </View>
        <Chip tone="warm">{roleLabel(role)}</Chip>
        {hasActions ? (
          <FontAwesome6
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={colors.mutedText}
          />
        ) : null}
      </Pressable>

      {expanded && hasActions ? (
        <View className="gap-3 border-t border-border px-4 py-3">
          {roleTargets && roleTargets.length > 0 && onRoleChange ? (
            <View className="gap-2">
              <Text className="text-[12px] font-black uppercase tracking-[0.5px] text-muted-text">
                Cambiar rol
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {roleTargets.map((target) => (
                  <Chip key={target} onPress={() => onRoleChange(target)}>
                    {roleLabel(target)}
                  </Chip>
                ))}
              </View>
            </View>
          ) : null}

          {canRemove && onRemove ? (
            <Pressable
              disabled={disabled}
              onPress={onRemove}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : disabled ? 0.7 : 1 })}
              className="self-start rounded-[14px] bg-chip px-3 py-2">
              <Text className="text-[13px] font-black text-text">Expulsar</Text>
            </Pressable>
          ) : null}

          {canBlock && onBlock && onBlockReasonChange ? (
            <View className="gap-2">
              <TextInput
                onChangeText={onBlockReasonChange}
                placeholder="Motivo opcional del bloqueo"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, marginTop: 0 },
                ]}
                value={blockReason}
              />
              <Pressable
                disabled={disabled}
                onPress={onBlock}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : disabled ? 0.7 : 1 })}
                className="self-start rounded-[14px] bg-danger-surface px-3 py-2">
                <Text className="text-[13px] font-black text-danger">Bloquear</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  halfInput: {
    flex: 1,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
